import random
from collections import Counter
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
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

