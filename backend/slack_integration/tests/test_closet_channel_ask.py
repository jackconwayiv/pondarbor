import json
from unittest import mock

from django.test import Client, TestCase
from django.test.utils import override_settings

from closet.models import BorrowRequest, ClosetChannelAsk, ClosetChannelAskOffer, Item, Loan
from closet.tests.helpers import ClosetTestMixin
from slack_integration.models import SlackIdentity

from slack_integration.tests.test_closet_slack import _post_interaction, _slack_sig


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
        SlackIdentity.objects.create(team_id="T_test", slack_user_id="U_friend2", user=self.friend_two)

    def test_non_ask_is_silent(self):
        with (
            mock.patch("slack_integration.closet_ask.slack_chat_post_message") as mock_post,
            mock.patch("slack_integration.closet_ask.notify_pondarbor_user_dm") as mock_dm,
        ):
            resp = _post_events(
                client=self.client,
                body=_closet_message_body(text="Thanks everyone"),
                secret="test_secret",
            )
        self.assertEqual(resp.status_code, 200)
        mock_post.assert_not_called()
        mock_dm.assert_not_called()
        self.assertEqual(ClosetChannelAsk.objects.count(), 0)

    def test_thread_reply_ignored(self):
        with mock.patch("slack_integration.closet_ask.slack_chat_post_message") as mock_post:
            _post_events(
                client=self.client,
                body=_closet_message_body(text="Does anyone have a table saw?", thread_ts="111.0", ts="111.2"),
                secret="test_secret",
            )
        mock_post.assert_not_called()
        self.assertEqual(ClosetChannelAsk.objects.count(), 0)

    def test_ask_with_matches_dms_and_ephemeral_and_crowd(self):
        self.make_item(owner=self.owner, name="Table saw")
        with (
            mock.patch("slack_integration.closet_ask.slack_chat_post_message", return_value={"ok": True, "ts": "222.2"}) as mock_post,
            mock.patch("slack_integration.closet_ask.slack_chat_post_ephemeral", return_value={"ok": True}) as mock_eph,
            mock.patch("slack_integration.closet_ask.notify_pondarbor_user_dm") as mock_dm,
        ):
            resp = _post_events(
                client=self.client,
                body=_closet_message_body(text="Does anyone have a table saw?"),
                secret="test_secret",
            )
        self.assertEqual(resp.status_code, 200)
        ask = ClosetChannelAsk.objects.get()
        self.assertEqual(ask.item_query.casefold(), "table saw")
        self.assertEqual(ask.requester_user_id, self.borrower.id)
        mock_dm.assert_called()
        mock_eph.assert_called()
        mock_post.assert_called()
        crowd_kwargs = mock_post.call_args.kwargs
        self.assertIn("I Do", json.dumps(crowd_kwargs["blocks"]))
        dm_blocks = json.dumps(mock_dm.call_args.kwargs["blocks"])
        self.assertIn("Request loan", dm_blocks)
        self.assertNotIn(" (loaned)", dm_blocks)

    def test_loaned_match_is_flagged(self):
        item = self.make_item(owner=self.owner, name="Table saw", holder=self.friend_two)
        self.make_active_loan(item=item, owner=self.owner, borrower=self.friend_two)
        with (
            mock.patch("slack_integration.closet_ask.slack_chat_post_message", return_value={"ok": True, "ts": "222.2"}),
            mock.patch("slack_integration.closet_ask.slack_chat_post_ephemeral", return_value={"ok": True}),
            mock.patch("slack_integration.closet_ask.notify_pondarbor_user_dm") as mock_dm,
        ):
            _post_events(
                client=self.client,
                body=_closet_message_body(text="Does anyone have a table saw?"),
                secret="test_secret",
            )
        dm_text = json.dumps(mock_dm.call_args.kwargs["blocks"])
        self.assertIn("loaned", dm_text)

    def test_no_matches_skips_requester_dm_still_posts_crowd(self):
        with (
            mock.patch("slack_integration.closet_ask.slack_chat_post_message", return_value={"ok": True, "ts": "222.2"}) as mock_post,
            mock.patch("slack_integration.closet_ask.slack_chat_post_ephemeral", return_value={"ok": True}) as mock_eph,
            mock.patch("slack_integration.closet_ask.notify_pondarbor_user_dm") as mock_dm,
        ):
            _post_events(
                client=self.client,
                body=_closet_message_body(text="Does anyone have a table saw?"),
                secret="test_secret",
            )
        mock_dm.assert_not_called()
        mock_eph.assert_not_called()
        mock_post.assert_called_once()
        self.assertEqual(ClosetChannelAsk.objects.count(), 1)

    def test_unlinked_user_gets_ephemeral_no_ask(self):
        body = _closet_message_body(text="Does anyone have a table saw?")
        body["event"]["user"] = "U_stranger"
        with (
            mock.patch("slack_integration.views.slack_users_info", return_value={"ok": True, "user": {"profile": {"email": "nope@example.com"}}}),
            mock.patch("slack_integration.closet_ask.slack_chat_post_ephemeral", return_value={"ok": True}) as mock_eph,
            mock.patch("slack_integration.closet_ask.slack_chat_post_message") as mock_post,
        ):
            _post_events(client=self.client, body=body, secret="test_secret")
        mock_eph.assert_called()
        mock_post.assert_not_called()
        self.assertEqual(ClosetChannelAsk.objects.count(), 0)

    def test_songaday_channel_still_ignores_closet_phrasing_without_url(self):
        body = _closet_message_body(text="Does anyone have a table saw?")
        body["event"]["channel"] = "C_songaday"
        with mock.patch("slack_integration.closet_ask.slack_chat_post_message") as mock_post:
            resp = _post_events(client=self.client, body=body, secret="test_secret")
        self.assertEqual(resp.status_code, 200)
        mock_post.assert_not_called()
        self.assertEqual(ClosetChannelAsk.objects.count(), 0)

    def test_inventory_word_without_ask_phrase_still_matches(self):
        self.make_item(owner=self.owner, name="Fluke Multimeter")
        with (
            mock.patch("slack_integration.closet_ask.slack_chat_post_message", return_value={"ok": True, "ts": "222.2"}) as mock_post,
            mock.patch("slack_integration.closet_ask.slack_chat_post_ephemeral", return_value={"ok": True}) as mock_eph,
            mock.patch("slack_integration.closet_ask.notify_pondarbor_user_dm") as mock_dm,
        ):
            resp = _post_events(
                client=self.client,
                body=_closet_message_body(text="multimeter?"),
                secret="test_secret",
            )
        self.assertEqual(resp.status_code, 200)
        ask = ClosetChannelAsk.objects.get()
        self.assertEqual(ask.item_query.casefold(), "multimeter")
        mock_dm.assert_called()
        mock_eph.assert_called()
        mock_post.assert_called()

    def test_return_chatter_does_not_scan_inventory(self):
        self.make_item(owner=self.owner, name="Table saw")
        with (
            mock.patch("slack_integration.closet_ask.slack_chat_post_message") as mock_post,
            mock.patch("slack_integration.closet_ask.notify_pondarbor_user_dm") as mock_dm,
        ):
            _post_events(
                client=self.client,
                body=_closet_message_body(text="I returned the table saw"),
                secret="test_secret",
            )
        mock_post.assert_not_called()
        mock_dm.assert_not_called()
        self.assertEqual(ClosetChannelAsk.objects.count(), 0)

    def test_thanks_stays_silent_even_when_closet_has_items(self):
        self.make_item(owner=self.owner, name="Table saw")
        with (
            mock.patch("slack_integration.closet_ask.slack_chat_post_message") as mock_post,
            mock.patch("slack_integration.closet_ask.notify_pondarbor_user_dm") as mock_dm,
        ):
            _post_events(
                client=self.client,
                body=_closet_message_body(text="Thanks everyone"),
                secret="test_secret",
            )
        mock_post.assert_not_called()
        mock_dm.assert_not_called()
        self.assertEqual(ClosetChannelAsk.objects.count(), 0)


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
        self.assertIn("own ask", mock_confirm.call_args.kwargs["text"].lower())

    @mock.patch("slack_integration.closet_ask.notify_pondarbor_user_dm")
    def test_i_do_with_close_item_sends_picker_not_duplicate(self, mock_dm):
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

    @mock.patch("slack_integration.closet_ask.notify_pondarbor_user_dm")
    def test_i_do_without_match_creates_item_and_notifies_requester(self, mock_dm):
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
        self.assertEqual(mock_eph.call_args.kwargs["text"], "Okay.")
