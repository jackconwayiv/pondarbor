import random
from collections import Counter
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from whatif.models import WhatIfGameResult, WhatIfPlayer, WhatIfQuestion, WhatIfSession
from whatif.rules import evaluate_vote_scores, two_subject_candidate_ids
from whatif.views import AVATAR_EMOJIS, _draw_question


def _mark_all_players_ready(code: str) -> None:
    WhatIfPlayer.objects.filter(session__short_code=code).update(ready_to_start=True)


User = get_user_model()


class WhatIfSubjectRulesTests(TestCase):
    def test_two_candidates_exclude_active(self):
        random.seed(0)
        c = two_subject_candidate_ids(
            player_ids=[10, 20, 30],
            active_player_id=10,
            subject_times={},
        )
        self.assertEqual(len(c), 2)
        self.assertNotIn(10, c)
        self.assertEqual(set(c), {20, 30})

    def test_prefers_players_with_fewest_subject_times(self):
        random.seed(1)
        c = two_subject_candidate_ids(
            player_ids=[1, 2, 3, 4],
            active_player_id=1,
            subject_times={"2": 0, "3": 5, "4": 5},
        )
        self.assertEqual(len(c), 2)
        self.assertIn(2, c)

    def test_two_player_game_both_are_subject_candidates(self):
        c = two_subject_candidate_ids(
            player_ids=[10, 20],
            active_player_id=10,
            subject_times={},
        )
        self.assertEqual(c, [10, 20])

    def test_no_scores_when_top_vote_count_is_one(self):
        # 3-player split: each vote is unique, so nobody scores.
        scores = evaluate_vote_scores(
            active_player_id=1,
            votes={1: 1, 2: 2, 3: 3},
        )
        self.assertEqual(scores, {})

    def test_two_player_both_same_option_still_scores(self):
        scores = evaluate_vote_scores(
            active_player_id=1,
            votes={1: 2, 2: 2},
        )
        # Both players get +1 for top option; active gets +1 extra.
        self.assertEqual(scores, {1: 2, 2: 1})

    def test_four_player_two_two_split_all_score(self):
        scores = evaluate_vote_scores(
            active_player_id=1,
            votes={1: 4, 2: 4, 3: 5, 4: 5},
        )
        # Top tier is tied at 2 votes each, so all four voters score (+ active bonus).
        self.assertEqual(scores, {1: 2, 2: 1, 3: 1, 4: 1})


class WhatIfApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        WhatIfQuestion.objects.create(
            prompt="What if {subject} had to pick a weekend plan?",
            answer_1="Mountain",
            answer_2="Beach",
            answer_3="Coffee",
            answer_4="Tea",
            answer_5="Cats",
            answer_6="Dogs",
        )
        WhatIfQuestion.objects.create(
            prompt="What if {subject} were a kind of fruit?",
            answer_1="Apple",
            answer_2="Orange",
            answer_3="Banana",
            answer_4="Pineapple",
            answer_5="Cherry",
            answer_6="Apricot",
        )

    def _create_session(self) -> tuple[str, str, User]:
        user = User.objects.create_user(email="host@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save(update_fields=["account_status"])
        self.client.force_login(user)
        response = self.client.post("/api/v1/whatif/sessions/", {}, format="json")
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.client.logout()
        session = WhatIfSession.objects.get(short_code=body["short_code"])
        self.assertEqual(session.owner_id, user.id)
        return body["short_code"], body["host_secret"], user

    def _join(self, code: str, name: str) -> str:
        response = self.client.post(
            f"/api/v1/whatif/sessions/{code}/join/",
            {"display_name": name},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        return response.json()["player_secret"]

    def test_health(self):
        response = self.client.get("/api/v1/whatif/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["app"], "whatif")

    def test_get_session_includes_players_after_join(self):
        code, _host_secret, _user = self._create_session()
        self._join(code, "Alex")
        response = self.client.get(f"/api/v1/whatif/sessions/{code}/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body["players"]), 1)
        self.assertEqual(body["players"][0]["display_name"], "Alex")
        self.assertIn("ready_to_start", body["players"][0])

    def test_join_rejects_duplicate_display_name_case_insensitive(self):
        code, _host_secret, _user = self._create_session()
        self._join(code, "Alex")
        response = self.client.post(
            f"/api/v1/whatif/sessions/{code}/join/",
            {"display_name": "alex"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("already in the room", response.json().get("detail", ""))

    def test_join_assigns_unique_avatar_emojis_per_session(self):
        code, _host_secret, _user = self._create_session()
        emojis: list[str] = []
        for i in range(20):
            secret = self._join(code, f"Player{i}")
            p = WhatIfPlayer.objects.get(player_secret=secret)
            emojis.append(p.avatar_emoji)
        self.assertEqual(len(emojis), len(set(emojis)))
        for e in emojis:
            self.assertIn(e, AVATAR_EMOJIS)

    @patch("whatif.views.AVATAR_EMOJIS", ["🦊", "🐻"])
    def test_join_allows_duplicate_emoji_when_pool_exhausted(self):
        code, _host_secret, _user = self._create_session()
        for i in range(3):
            self._join(code, f"P{i}")
        emojis = list(WhatIfPlayer.objects.filter(session__short_code=code).values_list("avatar_emoji", flat=True))
        self.assertEqual(len(emojis), 3)
        self.assertGreaterEqual(max(Counter(emojis).values()), 2)

    def test_create_session_requires_authentication(self):
        response = self.client.post("/api/v1/whatif/sessions/", {}, format="json")
        self.assertIn(response.status_code, (401, 403))

    def test_create_session_requires_approved_account(self):
        pending = User.objects.create_user(email="pending-host@example.com", password="secret12345")
        self.client.force_login(pending)
        response = self.client.post("/api/v1/whatif/sessions/", {}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertIn("pending approval", response.json().get("detail", "").lower())

    def test_host_token_can_start_without_player(self):
        code, host_secret, _user = self._create_session()
        self._join(code, "John")
        self._join(code, "Maya")
        _mark_all_players_ready(code)
        response = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "turn")

    def test_start_game_blocked_until_all_ready(self):
        code, host_secret, _user = self._create_session()
        self._join(code, "John")
        self._join(code, "Maya")
        response = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        self.assertEqual(response.status_code, 400)

    def test_player_cannot_start_game(self):
        code, _host_secret, _user = self._create_session()
        p1 = self._join(code, "John")
        self._join(code, "Maya")
        _mark_all_players_ready(code)
        response = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(response.status_code, 403)

    def test_full_round_flow_plurality_and_active_bonus(self):
        code, host_secret, _owner = self._create_session()
        p1 = self._join(code, "John")
        p2 = self._join(code, "Maya")
        _mark_all_players_ready(code)
        start = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        self.assertEqual(start.status_code, 200)
        cids = start.json()["state"]["subject_candidate_ids"]
        target_id = cids[0]
        target_name = WhatIfPlayer.objects.get(id=target_id).display_name
        pick = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_subject", "target_player_id": target_id},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(pick.status_code, 200)
        self.assertEqual(pick.json()["status"], "voting")
        self.assertIn(target_name, pick.json()["state"]["question"]["prompt"])
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 3},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 3},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p2,
        )
        reveal = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "reveal"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(reveal.status_code, 200)
        body = reveal.json()
        active_id = body["state"]["active_player_id"]
        self.assertEqual(body["state"]["round_scores"][str(active_id)], 2)

    def test_reveal_requires_all_players_voted_and_active_actor(self):
        code, host_secret, _owner = self._create_session()
        p1 = self._join(code, "John")
        p2 = self._join(code, "Maya")
        _mark_all_players_ready(code)
        start = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        cids = start.json()["state"]["subject_candidate_ids"]
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_subject", "target_player_id": cids[0]},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 1},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        reveal_early = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "reveal"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(reveal_early.status_code, 400)
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 1},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p2,
        )
        reveal_wrong_player = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "reveal"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p2,
        )
        self.assertEqual(reveal_wrong_player.status_code, 403)

    def test_next_turn_requires_active_and_delay(self):
        code, host_secret, _owner = self._create_session()
        p1 = self._join(code, "John")
        p2 = self._join(code, "Maya")
        _mark_all_players_ready(code)
        start = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        cids = start.json()["state"]["subject_candidate_ids"]
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_subject", "target_player_id": cids[0]},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 2},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 2},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p2,
        )
        reveal = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "reveal"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(reveal.status_code, 200)
        too_soon = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "next_turn"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(too_soon.status_code, 400)
        wrong_actor = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "next_turn"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p2,
        )
        self.assertEqual(wrong_actor.status_code, 403)

    def test_reveal_when_paused_player_skipped_for_vote_quorum(self):
        code, host_secret, _owner = self._create_session()
        p1 = self._join(code, "John")
        p2 = self._join(code, "Maya")
        p3 = self._join(code, "Pat")
        _mark_all_players_ready(code)
        start = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        self.assertEqual(start.status_code, 200)
        cids = start.json()["state"]["subject_candidate_ids"]
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_subject", "target_player_id": cids[0]},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        pat = WhatIfPlayer.objects.get(session__short_code=code, display_name="Pat")
        pause = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "set_player_paused", "target_player_id": pat.id, "paused": True},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        self.assertEqual(pause.status_code, 200)
        pat_payload = next(pl for pl in pause.json()["players"] if pl["display_name"] == "Pat")
        self.assertTrue(pat_payload["paused"])
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 2},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 2},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p2,
        )
        reveal = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "reveal"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(reveal.status_code, 200)
        self.assertEqual(reveal.json()["status"], "post_results")

    @patch("whatif.constants.ROUND_TRANSITION_SECONDS", 0)
    def test_next_turn_skips_paused_player_in_rotation(self):
        code, host_secret, _owner = self._create_session()
        p1 = self._join(code, "John")
        p2 = self._join(code, "Maya")
        p3 = self._join(code, "Pat")
        _mark_all_players_ready(code)
        start = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        self.assertEqual(start.status_code, 200)
        john_id = WhatIfPlayer.objects.get(session__short_code=code, display_name="John").id
        maya_id = WhatIfPlayer.objects.get(session__short_code=code, display_name="Maya").id
        pat_id = WhatIfPlayer.objects.get(session__short_code=code, display_name="Pat").id
        self.assertEqual(start.json()["state"]["active_player_id"], john_id)
        cids = start.json()["state"]["subject_candidate_ids"]
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_subject", "target_player_id": cids[0]},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        for tok in (p1, p2, p3):
            self.client.post(
                f"/api/v1/whatif/sessions/{code}/action/",
                {"type": "vote", "option_index": 3},
                format="json",
                HTTP_X_WHATIF_PLAYER_TOKEN=tok,
            )
        reveal = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "reveal"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(reveal.status_code, 200)
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "set_player_paused", "target_player_id": maya_id, "paused": True},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        advance = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "next_turn"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(advance.status_code, 200)
        self.assertEqual(advance.json()["state"]["active_player_id"], pat_id)

    def test_resume_mid_voting_requires_vote_before_reveal(self):
        """Resuming someone after others voted while they were paused re-adds them to the quorum."""
        code, host_secret, _owner = self._create_session()
        p1 = self._join(code, "John")
        p2 = self._join(code, "Maya")
        p3 = self._join(code, "Pat")
        _mark_all_players_ready(code)
        start = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        self.assertEqual(start.status_code, 200)
        pat_id = WhatIfPlayer.objects.get(session__short_code=code, display_name="Pat").id
        cids = start.json()["state"]["subject_candidate_ids"]
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_subject", "target_player_id": cids[0]},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "set_player_paused", "target_player_id": pat_id, "paused": True},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 2},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 2},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p2,
        )
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "set_player_paused", "target_player_id": pat_id, "paused": False},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        blocked = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "reveal"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(blocked.status_code, 400)
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 2},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p3,
        )
        reveal = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "reveal"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(reveal.status_code, 200)

    def test_paused_player_cannot_vote(self):
        code, host_secret, _owner = self._create_session()
        p1 = self._join(code, "John")
        p2 = self._join(code, "Maya")
        self._join(code, "Pat")
        _mark_all_players_ready(code)
        start = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        cids = start.json()["state"]["subject_candidate_ids"]
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_subject", "target_player_id": cids[0]},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        maya = WhatIfPlayer.objects.get(session__short_code=code, display_name="Maya")
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "set_player_paused", "target_player_id": maya.id, "paused": True},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        bad_vote = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 1},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p2,
        )
        self.assertEqual(bad_vote.status_code, 400)

    def test_cannot_pause_active_player_during_voting(self):
        code, host_secret, _owner = self._create_session()
        p1 = self._join(code, "John")
        p2 = self._join(code, "Maya")
        p3 = self._join(code, "Pat")
        _mark_all_players_ready(code)
        start = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        cids = start.json()["state"]["subject_candidate_ids"]
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_subject", "target_player_id": cids[0]},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        john = WhatIfPlayer.objects.get(session__short_code=code, display_name="John")
        self.assertEqual(start.json()["state"]["active_player_id"], john.id)
        block = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "set_player_paused", "target_player_id": john.id, "paused": True},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        self.assertEqual(block.status_code, 400)

    def test_set_player_paused_requires_host(self):
        code, host_secret, _owner = self._create_session()
        p1 = self._join(code, "John")
        p2 = self._join(code, "Maya")
        john = WhatIfPlayer.objects.get(session__short_code=code, display_name="John")
        r = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "set_player_paused", "target_player_id": john.id, "paused": True},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p2,
        )
        self.assertEqual(r.status_code, 403)

    def test_legacy_prompt_without_subject_placeholder_uses_fallback(self):
        WhatIfQuestion.objects.all().delete()
        WhatIfQuestion.objects.create(
            prompt="What fruit would this person be?",
            answer_1="Apple",
            answer_2="Orange",
            answer_3="Banana",
            answer_4="Pineapple",
            answer_5="Cherry",
            answer_6="Apricot",
        )
        code, host_secret, _owner = self._create_session()
        p1 = self._join(code, "John")
        self._join(code, "Maya")
        _mark_all_players_ready(code)
        start = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        cids = start.json()["state"]["subject_candidate_ids"]
        pick = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_subject", "target_player_id": cids[0]},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(pick.status_code, 200)
        self.assertIn("What if ", pick.json()["state"]["question"]["prompt"])

    def test_guest_winner_persists_display_name(self):
        code, host_secret, _owner = self._create_session()
        p1 = self._join(code, "GuestOne")
        p2 = self._join(code, "GuestTwo")
        _mark_all_players_ready(code)
        start = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        active_id = start.json()["state"]["active_player_id"]
        active_token = p1 if WhatIfPlayer.objects.get(player_secret=p1).id == active_id else p2
        active_player = WhatIfPlayer.objects.get(player_secret=active_token)
        # Force near-win then reveal a winning round.
        WhatIfPlayer.objects.filter(id=active_player.id).update(score=24)
        cids = start.json()["state"]["subject_candidate_ids"]
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_subject", "target_player_id": cids[0]},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=active_token,
        )
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 1},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 1},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p2,
        )
        reveal = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "reveal"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=active_token,
        )
        self.assertEqual(reveal.status_code, 200)
        self.assertEqual(reveal.json()["status"], "ended")
        result = WhatIfGameResult.objects.get(session__short_code=code)
        self.assertEqual(result.winner_display_name, result.winner_player.display_name)

    @patch("whatif.rules.WIN_SCORE", 5)
    def test_reveal_ends_game_using_fresh_db_scores_at_custom_threshold(self):
        """Winner check must see scores after F() updates (not stale related player cache)."""
        code, host_secret, _owner = self._create_session()
        p1 = self._join(code, "GuestOne")
        p2 = self._join(code, "GuestTwo")
        _mark_all_players_ready(code)
        start = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        active_id = start.json()["state"]["active_player_id"]
        active_token = p1 if WhatIfPlayer.objects.get(player_secret=p1).id == active_id else p2
        active_player = WhatIfPlayer.objects.get(player_secret=active_token)
        WhatIfPlayer.objects.filter(id=active_player.id).update(score=3)
        cids = start.json()["state"]["subject_candidate_ids"]
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_subject", "target_player_id": cids[0]},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=active_token,
        )
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 1},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 1},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p2,
        )
        reveal = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "reveal"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=active_token,
        )
        self.assertEqual(reveal.status_code, 200)
        self.assertEqual(reveal.json()["status"], "ended")
        active_player.refresh_from_db()
        self.assertGreaterEqual(active_player.score, 5)

    def test_draw_question_prefers_global_least_used(self):
        WhatIfQuestion.objects.all().delete()
        q_low = WhatIfQuestion.objects.create(
            prompt="What if {subject} low?",
            answer_1="a",
            answer_2="b",
            answer_3="c",
            answer_4="d",
            answer_5="e",
            answer_6="f",
            sessions_used_count=0,
        )
        WhatIfQuestion.objects.create(
            prompt="What if {subject} higher?",
            answer_1="a",
            answer_2="b",
            answer_3="c",
            answer_4="d",
            answer_5="e",
            answer_6="f",
            sessions_used_count=2,
        )
        code, _host_secret, _owner = self._create_session()
        session = WhatIfSession.objects.get(short_code=code)
        picked = _draw_question(session)
        self.assertIsNotNone(picked)
        self.assertEqual(picked.id, q_low.id)

    def test_draw_question_skips_used_in_session_then_falls_back(self):
        WhatIfQuestion.objects.all().delete()
        q0 = WhatIfQuestion.objects.create(
            prompt="What if {subject} zero?",
            answer_1="a",
            answer_2="b",
            answer_3="c",
            answer_4="d",
            answer_5="e",
            answer_6="f",
            sessions_used_count=0,
        )
        q1 = WhatIfQuestion.objects.create(
            prompt="What if {subject} one?",
            answer_1="a",
            answer_2="b",
            answer_3="c",
            answer_4="d",
            answer_5="e",
            answer_6="f",
            sessions_used_count=1,
        )
        code, _host_secret, _owner = self._create_session()
        session = WhatIfSession.objects.get(short_code=code)
        session.question_usages.create(question=q0)
        picked = _draw_question(session)
        self.assertIsNotNone(picked)
        self.assertEqual(picked.id, q1.id)

    def test_pick_subject_recovers_if_round_question_missing(self):
        code, host_secret, _owner = self._create_session()
        p1 = self._join(code, "John")
        self._join(code, "Maya")
        _mark_all_players_ready(code)

        start = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        self.assertEqual(start.status_code, 200)
        cids = start.json()["state"]["subject_candidate_ids"]
        self.assertGreater(len(cids), 0)

        session = WhatIfSession.objects.get(short_code=code)
        state = dict(session.state or {})
        state.pop("question_id", None)
        session.state = state
        session.save(update_fields=["state", "updated_at"])

        pick = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_subject", "target_player_id": cids[0]},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(pick.status_code, 200, pick.json())
        self.assertEqual(pick.json()["status"], "voting")
        self.assertIsNotNone(pick.json()["state"].get("question"))

    @patch("whatif.views.random.random", return_value=0.0)
    def test_duel_voting_auto_reveals_on_session_get_after_deadline(self, _mock_random):
        """Duel round + lazy auto-reveal when deadline is past (simulated via state); GET session applies it."""
        code, host_secret, _owner = self._create_session()
        p1 = self._join(code, "John")
        p2 = self._join(code, "Maya")
        self._join(code, "Pat")
        _mark_all_players_ready(code)
        start = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        self.assertEqual(start.status_code, 200)
        john_id = WhatIfPlayer.objects.get(session__short_code=code, display_name="John").id
        maya_id = WhatIfPlayer.objects.get(session__short_code=code, display_name="Maya").id
        self.assertEqual(start.json()["state"]["active_player_id"], john_id)
        opts = start.json()["state"]["subject_options"]
        self.assertTrue(any(o.get("kind") == "challenge" for o in opts))
        c1 = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_subject", "challenge": True},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(c1.status_code, 200, c1.json())
        self.assertEqual(c1.json()["state"]["duel"]["step"], "pick_opponent")
        c2 = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_duel_opponent", "target_player_id": maya_id},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(c2.status_code, 200, c2.json())
        cand = c2.json()["state"]["subject_candidate_ids"]
        self.assertEqual(len(cand), 2)
        subject_pick = cand[0]
        c3 = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_subject", "target_player_id": subject_pick},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(c3.status_code, 200, c3.json())
        self.assertEqual(c3.json()["status"], "voting")
        self.assertEqual(c3.json()["state"]["duel"]["step"], "voting")
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 1},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        sess = WhatIfSession.objects.get(short_code=code)
        self.assertEqual(sess.status, WhatIfSession.Status.VOTING)
        st = dict(sess.state or {})
        st["voting_deadline_at"] = (timezone.now() - timedelta(seconds=5)).isoformat()
        sess.state = st
        sess.save(update_fields=["state", "updated_at"])
        polled = self.client.get(f"/api/v1/whatif/sessions/{code}/")
        self.assertEqual(polled.status_code, 200)
        self.assertEqual(polled.json()["status"], "post_results")
        st_out = polled.json()["state"]
        self.assertIsInstance(st_out.get("reveal_flairs"), list)
        self.assertIn("revealed_at", st_out)

    @patch("whatif.views.random.random", return_value=1.0)
    def test_voting_question_skip_non_active_requests_active_approves(self, _mock_random):
        """Voting-phase skip: non-active requests, only active can approve (combined flow check)."""
        code, host_secret, _owner = self._create_session()
        p1 = self._join(code, "John")
        p2 = self._join(code, "Maya")
        p3 = self._join(code, "Pat")
        _mark_all_players_ready(code)
        start = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        self.assertEqual(start.status_code, 200)
        cids = start.json()["state"]["subject_candidate_ids"]
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_subject", "target_player_id": cids[0]},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 2},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        req = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "request_question_skip"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p2,
        )
        self.assertEqual(req.status_code, 200, req.json())
        self.assertEqual(req.json()["status"], "voting")
        self.assertIsNotNone(req.json()["state"].get("pending_question_skip_by_player_id"))
        maya_id = WhatIfPlayer.objects.get(session__short_code=code, display_name="Maya").id
        self.assertEqual(int(req.json()["state"]["pending_question_skip_by_player_id"]), maya_id)
        self.assertEqual(
            int(req.json()["state"]["active_player_id"]),
            WhatIfPlayer.objects.get(session__short_code=code, display_name="John").id,
        )
        bad = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "resolve_question_skip", "approve": True},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p3,
        )
        self.assertEqual(bad.status_code, 403)
        ok = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "resolve_question_skip", "approve": True},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(ok.status_code, 200, ok.json())
        self.assertEqual(ok.json()["status"], "voting")
        body = ok.json()
        self.assertEqual(body["state"].get("votes"), {})
        self.assertIsNotNone(body["state"].get("challenge_target_player_id"))
        self.assertEqual(body["state"].get("duel"), None)
        self.assertIsNotNone(body["state"].get("question_id"))

    @patch("whatif.views.random.random", return_value=0.0)
    def test_question_skip_keeps_challenge_subject_and_duel(self, _mock_random):
        """After skip during challenge voting, same subject and duelists; new question; still voting."""
        code, host_secret, _owner = self._create_session()
        p1 = self._join(code, "John")
        p2 = self._join(code, "Maya")
        self._join(code, "Pat")
        _mark_all_players_ready(code)
        start = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        self.assertEqual(start.status_code, 200)
        maya_id = WhatIfPlayer.objects.get(session__short_code=code, display_name="Maya").id
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_subject", "challenge": True},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        pick_opp = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_duel_opponent", "target_player_id": maya_id},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(pick_opp.status_code, 200, pick_opp.json())
        cids = pick_opp.json()["state"]["subject_candidate_ids"]
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_subject", "target_player_id": cids[0]},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        before = self.client.get(f"/api/v1/whatif/sessions/{code}/").json()
        self.assertEqual(before["status"], "voting")
        self.assertEqual(before["state"]["duel"]["step"], "voting")
        challenge_target = before["state"]["challenge_target_player_id"]
        skip_resp = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "request_question_skip"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(skip_resp.status_code, 200, skip_resp.json())
        after = skip_resp.json()
        self.assertEqual(after["status"], "voting")
        self.assertEqual(after["state"]["challenge_target_player_id"], challenge_target)
        self.assertEqual(after["state"]["duel"]["step"], "voting")
        self.assertEqual(int(after["state"]["duel"]["challenged_player_id"]), maya_id)
        self.assertEqual(after["state"]["votes"], {})


class WhatIfAdminApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(email="staff@example.com", password="secret12345", is_staff=True)
        self.member = User.objects.create_user(email="member@example.com", password="secret12345", is_staff=False)
        self.question = WhatIfQuestion.objects.create(
            prompt="What if {subject} admin?",
            answer_1="a",
            answer_2="b",
            answer_3="c",
            answer_4="d",
            answer_5="e",
            answer_6="f",
        )

    def test_non_staff_forbidden(self):
        self.client.force_login(self.member)
        r = self.client.get("/api/v1/whatif/questions/")
        self.assertEqual(r.status_code, 403)

    def test_staff_can_crud_question(self):
        self.client.force_login(self.staff)
        listed = self.client.get("/api/v1/whatif/questions/")
        self.assertEqual(listed.status_code, 200)
        self.assertGreaterEqual(len(listed.json()), 1)

        created = self.client.post(
            "/api/v1/whatif/questions/",
            {
                "prompt": "What if {subject} created?",
                "answer_1": "1",
                "answer_2": "2",
                "answer_3": "3",
                "answer_4": "4",
                "answer_5": "5",
                "answer_6": "6",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        qid = created.json()["id"]

        patched = self.client.patch(
            f"/api/v1/whatif/questions/{qid}/",
            {"answer_3": "updated"},
            format="json",
        )
        self.assertEqual(patched.status_code, 200)
        self.assertEqual(patched.json()["answer_3"], "updated")

        deleted = self.client.delete(f"/api/v1/whatif/questions/{qid}/")
        self.assertEqual(deleted.status_code, 204)

    def test_list_questions_list_filter(self):
        self.client.force_login(self.staff)
        rejected = WhatIfQuestion.objects.create(
            prompt="What if {subject} rejected?",
            answer_1="1",
            answer_2="2",
            answer_3="3",
            answer_4="4",
            answer_5="5",
            answer_6="6",
            review_status=WhatIfQuestion.ReviewStatus.REJECTED,
            is_active=False,
        )
        inactive = WhatIfQuestion.objects.create(
            prompt="What if {subject} inactive?",
            answer_1="1",
            answer_2="2",
            answer_3="3",
            answer_4="4",
            answer_5="5",
            answer_6="6",
            review_status=WhatIfQuestion.ReviewStatus.APPROVED,
            is_active=False,
        )
        pending = WhatIfQuestion.objects.create(
            prompt="What if {subject} pending?",
            answer_1="1",
            answer_2="2",
            answer_3="3",
            answer_4="4",
            answer_5="5",
            answer_6="6",
            review_status=WhatIfQuestion.ReviewStatus.PENDING,
            is_active=True,
        )

        def ids_for(url: str) -> set[int]:
            r = self.client.get(url)
            self.assertEqual(r.status_code, 200)
            return {row["id"] for row in r.json()}

        all_ids = ids_for("/api/v1/whatif/questions/")
        self.assertIn(self.question.id, all_ids)
        self.assertIn(rejected.id, all_ids)
        self.assertIn(inactive.id, all_ids)
        self.assertIn(pending.id, all_ids)

        active_ids = ids_for("/api/v1/whatif/questions/?list_filter=active")
        self.assertIn(self.question.id, active_ids)
        self.assertIn(pending.id, active_ids)
        self.assertNotIn(rejected.id, active_ids)
        self.assertNotIn(inactive.id, active_ids)

        inactive_ids = ids_for("/api/v1/whatif/questions/?list_filter=inactive")
        self.assertIn(rejected.id, inactive_ids)
        self.assertIn(inactive.id, inactive_ids)
        self.assertNotIn(self.question.id, inactive_ids)
        self.assertNotIn(pending.id, inactive_ids)

        rejected_ids = ids_for("/api/v1/whatif/questions/?list_filter=rejected")
        self.assertEqual(rejected_ids, {rejected.id})

    def test_bulk_import_parses_and_creates(self):
        self.client.force_login(self.staff)
        text = (
            "What if {subject} bulk one?\n"
            "1 - a\n2 - b\n3 - c\n4 - d\n5 - e\n6 - f\n\n"
            "What if {subject} bulk two?\n"
            "1 - aa\n2 - bb\n3 - cc\n4 - dd\n5 - ee\n6 - ff\n"
        )
        r = self.client.post("/api/v1/whatif/questions/bulk-import/", {"text": text}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["created_count"], 2)

    def test_bulk_import_reports_format_errors(self):
        self.client.force_login(self.staff)
        bad = "What if {subject} broken?\n1 - a\n2 - b\n3 - c\n4 - d\n5 - e\n"
        r = self.client.post("/api/v1/whatif/questions/bulk-import/", {"text": bad}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("errors", r.json())

