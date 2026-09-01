import json
from unittest import mock

from django.test import Client, SimpleTestCase, TestCase
from django.test.utils import override_settings

from closet.models import BorrowRequest, ClosetChannelAsk, ClosetChannelAskOffer, Item, Loan
from closet.tests.helpers import ClosetTestMixin
from slack_integration.models import SlackIdentity

from slack_integration.tests.test_closet_slack import _post_command, _post_interaction, _slack_sig


def _post_events(*, client, body: dict, secret: str, timestamp: str = "1714060800"):
    raw = json.dumps(body).encode("utf-8")
    sig = _slack_sig(secret=secret, timestamp=timestamp, body=raw)
    with mock.patch("slack_integration.slack_verify.time.time", return_value=int(timestamp)):
        return client.post(
            "/api/v1/slack/events/",
            data=raw,
            content_type="application/json",
            **{
                "HTTP_X_SLACK_REQUEST_TIMESTAMP": timestamp,
                "HTTP_X_SLACK_SIGNATURE": sig,
            },
        )


def _closet_message_body(*, text: str, event_id: str = "Ev_closet", ts: str = "111.1", thread_ts: str = ""):
    event = {
        "type": "message",
        "channel": "C_closet",
        "user": "U_borrower",
        "text": text,
        "ts": ts,
    }
    if thread_ts:
        event["thread_ts"] = thread_ts
    return {
        "team_id": "T_test",
        "event_id": event_id,
        "type": "event_callback",
        "event": event,
    }


@override_settings(
    SLACK_SIGNING_SECRET="test_secret",
    SLACK_BOT_TOKEN="xoxb-test",
    SLACK_CLOSET_CHANNEL_ID="C_closet",
    SLACK_PROMPTS_CHANNEL_ID="C_songaday",
    SLACK_CLOSET_NOTIFICATIONS_ENABLED=True,
)
class ClosetChannelAskIngestTests(ClosetTestMixin, TestCase):
    def setUp(self):
        self.client = Client()
        self.create_users()
        self.make_friends(self.owner, self.borrower)
        SlackIdentity.objects.create(team_id="T_test", slack_user_id="U_owner", user=self.owner)
        SlackIdentity.objects.create(team_id="T_test", slack_user_id="U_borrower", user=self.borrower)

    def test_channel_messages_do_not_create_asks(self):
        self.make_item(owner=self.owner, name="Table saw")
        self.make_item(owner=self.owner, name="Fluke Multimeter")
        with (
            mock.patch("slack_integration.closet_ask.slack_chat_post_message") as mock_post,
            mock.patch("slack_integration.closet_ask.notify_pondarbor_user_dm") as mock_dm,
        ):
            for text in (
                "Does anyone have a table saw?",
                "multimeter?",
                "Thanks everyone",
                "I returned the table saw",
                "thinking about weekend plans",
            ):
                resp = _post_events(
                    client=self.client,
                    body=_closet_message_body(text=text, event_id=f"Ev_{text[:12]}", ts=f"111.{len(text)}"),
                    secret="test_secret",
                )
                self.assertEqual(resp.status_code, 200, msg=text)
        mock_post.assert_not_called()
        mock_dm.assert_not_called()
        self.assertEqual(ClosetChannelAsk.objects.count(), 0)

    def test_songaday_channel_still_ignores_closet_phrasing_without_url(self):
        body = _closet_message_body(text="Does anyone have a table saw?")
        body["event"]["channel"] = "C_songaday"
        with mock.patch("slack_integration.closet_ask.slack_chat_post_message") as mock_post:
            resp = _post_events(client=self.client, body=body, secret="test_secret")
        self.assertEqual(resp.status_code, 200)
        mock_post.assert_not_called()
        self.assertEqual(ClosetChannelAsk.objects.count(), 0)


@override_settings(
    SLACK_SIGNING_SECRET="test_secret",
    SLACK_BOT_TOKEN="xoxb-test",
    SLACK_CLOSET_CHANNEL_ID="C_closet",
    SLACK_CLOSET_NOTIFICATIONS_ENABLED=True,
)
class ClosetRequestCommandTests(ClosetTestMixin, TestCase):
    def setUp(self):
        self.client = Client()
        self.create_users()
        self.make_friends(self.owner, self.borrower)
        SlackIdentity.objects.create(team_id="T_test", slack_user_id="U_owner", user=self.owner)
        SlackIdentity.objects.create(team_id="T_test", slack_user_id="U_borrower", user=self.borrower)

    def _post(self, *, text: str, channel_id: str = "C_closet", user_id: str = "U_borrower"):
        return _post_command(
            client=self.client,
            secret="test_secret",
            params={
                "command": "/request",
                "text": text,
                "user_id": user_id,
                "team_id": "T_test",
                "channel_id": channel_id,
            },
        )

    def test_empty_text_is_ephemeral_usage(self):
        resp = self._post(text="")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["response_type"], "ephemeral")
        self.assertIn("/request", data["text"])
        self.assertEqual(ClosetChannelAsk.objects.count(), 0)

    def test_unlinked_user_is_ephemeral_no_ask(self):
        with mock.patch(
            "slack_integration.views.slack_users_info",
            return_value={"ok": True, "user": {"profile": {"email": "nope@example.com"}}},
        ):
            resp = self._post(text="table saw", user_id="U_stranger")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["response_type"], "ephemeral")
        self.assertEqual(ClosetChannelAsk.objects.count(), 0)

    def test_in_closet_echoes_crowd_prompt_and_dms_matches(self):
        self.make_item(owner=self.owner, name="Table saw")
        with (
            mock.patch("slack_integration.closet_ask.slack_chat_post_message") as mock_post,
            mock.patch("slack_integration.closet_ask.notify_pondarbor_user_dm") as mock_dm,
        ):
            resp = self._post(text="a table saw", channel_id="C_closet")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["response_type"], "in_channel")
        self.assertIn("I Do", json.dumps(data["blocks"]))
        self.assertIn("table saw", data["text"].casefold())
        mock_post.assert_not_called()
        mock_dm.assert_called()
        ask = ClosetChannelAsk.objects.get()
        self.assertEqual(ask.item_query.casefold(), "table saw")
        self.assertEqual(ask.requester_user_id, self.borrower.id)
        self.assertEqual(ask.slack_channel_id, "C_closet")
        dm_blocks = json.dumps(mock_dm.call_args.kwargs["blocks"])
        self.assertIn("Request loan", dm_blocks)

    def test_from_other_channel_posts_to_closet(self):
        with (
            mock.patch(
                "slack_integration.closet_ask.slack_chat_post_message",
                return_value={"ok": True, "ts": "222.2"},
            ) as mock_post,
            mock.patch("slack_integration.closet_ask.notify_pondarbor_user_dm") as mock_dm,
        ):
            resp = self._post(text="weedwhacker", channel_id="D0123456789")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["response_type"], "ephemeral")
        self.assertIn("closet channel", data["text"].casefold())
        mock_dm.assert_not_called()
        mock_post.assert_called_once()
        self.assertEqual(mock_post.call_args.kwargs["channel"], "C_closet")
        self.assertIn("I Do", json.dumps(mock_post.call_args.kwargs["blocks"]))
        ask = ClosetChannelAsk.objects.get()
        self.assertEqual(ask.item_query.casefold(), "weedwhacker")
        self.assertEqual(ask.slack_prompt_ts, "222.2")

    def test_quantity_from_command_text(self):
        with mock.patch(
            "slack_integration.closet_ask.slack_chat_post_message",
            return_value={"ok": True, "ts": "222.2"},
        ):
            resp = self._post(text="4 placemats", channel_id="D0123456789")
        self.assertEqual(resp.status_code, 200)
        ask = ClosetChannelAsk.objects.get()
        self.assertEqual(ask.item_query.casefold(), "placemats")
        self.assertEqual(ask.quantity, 4)


@override_settings(
    SLACK_SIGNING_SECRET="test_secret",
    SLACK_BOT_TOKEN="xoxb-test",
    SLACK_CLOSET_CHANNEL_ID="C_closet",
    SLACK_CLOSET_NOTIFICATIONS_ENABLED=True,
)
class ClosetChannelAskInteractionTests(ClosetTestMixin, TestCase):
    def setUp(self):
        self.client = Client()
        self.create_users()
        self.make_friends(self.owner, self.borrower)
        SlackIdentity.objects.create(team_id="T_test", slack_user_id="U_owner", user=self.owner)
        SlackIdentity.objects.create(team_id="T_test", slack_user_id="U_borrower", user=self.borrower)
        SlackIdentity.objects.create(team_id="T_test", slack_user_id="U_friend2", user=self.friend_two)
        self.ask = ClosetChannelAsk.objects.create(
            requester_user=self.borrower,
            item_query="table saw",
            raw_text="Does anyone have a table saw?",
            date_needed_by=self.today,
            slack_team_id="T_test",
            slack_channel_id="C_closet",
            slack_message_ts="111.1",
        )

    def _payload(self, *, slack_user: str, action_id: str, value: str, extra=None):
        action = {"action_id": action_id, "value": value}
        if extra:
            action.update(extra)
        return {
            "type": "block_actions",
            "team": {"id": "T_test"},
            "user": {"id": slack_user},
            "channel": {"id": "C_closet"},
            "actions": [action],
        }

    @mock.patch("slack_integration.interactions.notify_slack_action_confirmation")
    def test_requester_cannot_i_do_own_ask(self, mock_confirm):
        resp = _post_interaction(
            client=self.client,
            payload=self._payload(slack_user="U_borrower", action_id="closet_ask_i_do", value=str(self.ask.id)),
            secret="test_secret",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(Item.objects.filter(owner_user=self.borrower).count(), 0)
        mock_confirm.assert_called()
        self.assertIn("own request", mock_confirm.call_args.kwargs["text"].lower())

    @mock.patch("slack_integration.closet_ask.slack_chat_post_message", return_value={"ok": True, "ts": "333.3"})
    @mock.patch("slack_integration.closet_ask.notify_pondarbor_user_dm")
    def test_i_do_with_close_item_sends_picker_not_duplicate(self, mock_dm, mock_post):
        existing = self.make_item(owner=self.owner, name="Table saw")
        resp = _post_interaction(
            client=self.client,
            payload=self._payload(slack_user="U_owner", action_id="closet_ask_i_do", value=str(self.ask.id)),
            secret="test_secret",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(Item.objects.filter(owner_user=self.owner).count(), 1)
        self.assertEqual(ClosetChannelAskOffer.objects.count(), 0)
        flat = json.dumps(mock_dm.call_args.kwargs["blocks"])
        self.assertIn("closet_ask_pick_item", flat)
        self.assertIn("closet_ask_create_item", flat)
        mock_post.assert_called()
        self.assertIn("says they have", mock_post.call_args.kwargs["text"])
        self.assertIn("table saw", mock_post.call_args.kwargs["text"].casefold())

    @mock.patch("slack_integration.closet_ask.slack_chat_post_message", return_value={"ok": True, "ts": "333.3"})
    @mock.patch("slack_integration.closet_ask.notify_pondarbor_user_dm")
    def test_i_do_without_match_creates_item_and_notifies_requester(self, mock_dm, mock_post):
        resp = _post_interaction(
            client=self.client,
            payload=self._payload(slack_user="U_owner", action_id="closet_ask_i_do", value=str(self.ask.id)),
            secret="test_secret",
        )
        self.assertEqual(resp.status_code, 200)
        item = Item.objects.get(owner_user=self.owner)
        self.assertEqual(item.name.casefold(), "table saw")
        offer = ClosetChannelAskOffer.objects.get()
        self.assertTrue(offer.created_item)
        texts = [c.kwargs.get("text", "") for c in mock_dm.call_args_list]
        self.assertTrue(any("Offer a loan" in t for t in texts))
        self.assertTrue(any("now listed" in t for t in texts))
        self.assertIn("says they have", mock_post.call_args.kwargs["text"])
        self.assertTrue(mock_post.call_args.kwargs.get("reply_broadcast"))

    @mock.patch("slack_integration.closet_ask.slack_chat_post_message", return_value={"ok": True, "ts": "333.3"})
    @mock.patch("slack_integration.closet_ask.notify_pondarbor_user_dm")
    def test_second_i_do_does_not_repost_channel_notice(self, mock_dm, mock_post):
        item = self.make_item(owner=self.owner, name="Table saw")
        ClosetChannelAskOffer.objects.create(
            ask=self.ask, owner_user=self.owner, item=item, created_item=False
        )
        _post_interaction(
            client=self.client,
            payload=self._payload(slack_user="U_owner", action_id="closet_ask_i_do", value=str(self.ask.id)),
            secret="test_secret",
        )
        mock_post.assert_not_called()

    @mock.patch("slack_integration.closet_ask.notify_pondarbor_user_dm")
    def test_pick_existing_does_not_create_item(self, mock_dm):
        item = self.make_item(owner=self.owner, name="DeWalt table saw")
        resp = _post_interaction(
            client=self.client,
            payload=self._payload(
                slack_user="U_owner",
                action_id="closet_ask_pick_item",
                value=f"{self.ask.id}:{item.id}",
            ),
            secret="test_secret",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(Item.objects.filter(owner_user=self.owner).count(), 1)
        offer = ClosetChannelAskOffer.objects.get()
        self.assertEqual(offer.item_id, item.id)
        self.assertFalse(offer.created_item)

    @mock.patch("slack_integration.closet_ask.notify_pondarbor_user_dm")
    @mock.patch("slack_integration.closet_ask.notify_slack_action_confirmation")
    def test_offer_yes_starts_loan(self, mock_confirm, mock_dm):
        item = self.make_item(owner=self.owner, name="Table saw")
        offer = ClosetChannelAskOffer.objects.create(
            ask=self.ask, owner_user=self.owner, item=item, created_item=False
        )
        with self.captureOnCommitCallbacks(execute=True):
            resp = _post_interaction(
                client=self.client,
                payload=self._payload(
                    slack_user="U_owner",
                    action_id="closet_offer_loan_yes",
                    value=str(offer.id),
                ),
                secret="test_secret",
            )
        self.assertEqual(resp.status_code, 200)
        item.refresh_from_db()
        self.assertEqual(item.current_holder_user_id, self.borrower.id)
        self.assertTrue(Loan.objects.filter(item=item, status=Loan.Status.ACTIVE).exists())
        mock_confirm.assert_called()
        self.assertIn("Loan started", mock_confirm.call_args.kwargs["text"])

    @mock.patch("slack_integration.closet_ask.notify_pondarbor_user_dm")
    @mock.patch("slack_integration.closet_ask.notify_slack_action_confirmation")
    def test_offer_yes_when_loaned_creates_pending_request(self, mock_confirm, mock_dm):
        item = self.make_item(owner=self.owner, name="Table saw", holder=self.friend_two)
        self.make_friends(self.owner, self.friend_two)
        self.make_active_loan(item=item, owner=self.owner, borrower=self.friend_two)
        offer = ClosetChannelAskOffer.objects.create(
            ask=self.ask, owner_user=self.owner, item=item, created_item=False
        )
        resp = _post_interaction(
            client=self.client,
            payload=self._payload(
                slack_user="U_owner",
                action_id="closet_offer_loan_yes",
                value=str(offer.id),
            ),
            secret="test_secret",
        )
        self.assertEqual(resp.status_code, 200)
        row = BorrowRequest.objects.get(item=item, requester_user=self.borrower)
        self.assertEqual(row.status, BorrowRequest.Status.PENDING)
        self.assertFalse(Loan.objects.filter(item=item, borrower_user=self.borrower).exists())
        self.assertIn("loaned", mock_confirm.call_args.kwargs["text"].lower())

    @mock.patch("slack_integration.interactions.notify_slack_action_confirmation")
    def test_offer_yes_not_friends(self, mock_confirm):
        item = self.make_item(owner=self.other, name="Table saw")
        SlackIdentity.objects.create(team_id="T_test", slack_user_id="U_other", user=self.other)
        offer = ClosetChannelAskOffer.objects.create(
            ask=self.ask, owner_user=self.other, item=item, created_item=True
        )
        resp = _post_interaction(
            client=self.client,
            payload=self._payload(
                slack_user="U_other",
                action_id="closet_offer_loan_yes",
                value=str(offer.id),
            ),
            secret="test_secret",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("not friends", mock_confirm.call_args.kwargs["text"].lower())
        self.assertFalse(Loan.objects.filter(item=item).exists())

    @mock.patch("slack_integration.closet_ask.notify_slack_action_confirmation")
    def test_request_loan_creates_pending_and_notifies_owner(self, mock_confirm):
        item = self.make_item(owner=self.owner, name="Table saw")
        with mock.patch("closet.slack_notify.notify_pondarbor_user_dm") as mock_dm:
            with self.captureOnCommitCallbacks(execute=True):
                resp = _post_interaction(
                    client=self.client,
                    payload=self._payload(
                        slack_user="U_borrower",
                        action_id="closet_request_loan",
                        value=f"{self.ask.id}:{item.id}",
                    ),
                    secret="test_secret",
                )
            self.assertEqual(resp.status_code, 200)
            row = BorrowRequest.objects.get(item=item, requester_user=self.borrower)
            self.assertEqual(row.status, BorrowRequest.Status.PENDING)
            mock_confirm.assert_called()
            self.assertIn("Request sent", mock_confirm.call_args.kwargs["text"])
            self.assertTrue(mock_dm.called)

    @mock.patch("slack_integration.closet_ask.slack_chat_post_ephemeral")
    def test_i_dont_ephemeral_ack(self, mock_eph):
        resp = _post_interaction(
            client=self.client,
            payload=self._payload(slack_user="U_owner", action_id="closet_ask_i_dont", value=str(self.ask.id)),
            secret="test_secret",
        )
        self.assertEqual(resp.status_code, 200)
        mock_eph.assert_called()
        self.assertEqual(mock_eph.call_args.kwargs["text"], "Thanks for replying!")


class SlackChannelIdNormalizeTests(SimpleTestCase):
    def test_extracts_id_from_archive_url_and_quotes(self):
        from slack_integration.slack_ids import normalize_slack_channel_id

        self.assertEqual(
            normalize_slack_channel_id("https://pondarbor.slack.com/archives/C0123456789"),
            "C0123456789",
        )
        self.assertEqual(normalize_slack_channel_id('"C0123456789"'), "C0123456789")

    def test_plain_text_from_rich_text_blocks(self):
        from slack_integration.slack_event_text import slack_event_plain_text

        event = {
            "text": "",
            "blocks": [
                {
                    "type": "rich_text",
                    "elements": [
                        {
                            "type": "rich_text_section",
                            "elements": [{"type": "text", "text": "Does anyone have a ladder?"}],
                        }
                    ],
                }
            ],
        }
        self.assertEqual(slack_event_plain_text(event), "Does anyone have a ladder?")
