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
from whatif.subject_board import (
    candidate_seats,
    default_marker_index,
    duel_subject_candidate_seats,
    is_challenge_seat,
    player_id_at_seat,
    roll_subject_die,
    subject_board_seat_count,
    subject_pick_is_degenerate,
)
from whatif.views import AVATAR_EMOJIS, _draw_question


def _mark_all_players_ready(code: str) -> None:
    # Ready-gating was removed; helper remains for compatibility in older tests.
    _ = code


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


class WhatIfSubjectBoardTests(TestCase):
    def test_seat_count_and_default_marker(self):
        self.assertEqual(subject_board_seat_count(2), 2)
        self.assertEqual(subject_board_seat_count(3), 4)
        self.assertEqual(default_marker_index(2), 0)
        self.assertEqual(default_marker_index(3), 3)

    def test_candidate_seats_wrap(self):
        self.assertEqual(candidate_seats(1, 2, 4), (3, 3))

    def test_player_id_at_seat_and_challenge(self):
        ids = [10, 20, 30]
        L = 4
        self.assertEqual(player_id_at_seat(ids, 0, L), 10)
        self.assertIsNone(player_id_at_seat(ids, 3, L))
        self.assertTrue(is_challenge_seat(3, L, 3))
        self.assertFalse(is_challenge_seat(2, L, 3))

    def test_roll_respects_forbidden_seat(self):
        random.seed(0)
        for _ in range(80):
            _n, a, b = roll_subject_die(marker=2, forbidden_seat=2, seat_count=4, num_players=3)
            if a == b:
                self.assertNotEqual(a, 2)
            else:
                self.assertTrue(a != 2 or b != 2)

    def test_roll_degenerate_allowed_when_not_forbidden(self):
        n, a, b = roll_subject_die(marker=0, forbidden_seat=1, seat_count=2, num_players=2)
        self.assertEqual(a, b)
        self.assertNotEqual(a, 1)

    def test_subject_pick_is_degenerate(self):
        self.assertTrue(subject_pick_is_degenerate(1, 1))
        self.assertFalse(subject_pick_is_degenerate(0, 1))

    def test_roll_caps_die_faces_at_six(self):
        random.seed(1)
        for _ in range(120):
            n, _a, _b = roll_subject_die(marker=3, forbidden_seat=None, seat_count=9, num_players=8)
            self.assertGreaterEqual(n, 1)
            self.assertLessEqual(n, 6)

    def test_duel_subject_candidate_seats_never_lands_on_challenge(self):
        L = 4
        P = 3
        for marker in range(L):
            for step in range(1, 7):
                a, b = duel_subject_candidate_seats(marker, step, L, P)
                self.assertFalse(is_challenge_seat(a, L, P), msg=f"m={marker} n={step} a={a}")
                self.assertFalse(is_challenge_seat(b, L, P), msg=f"m={marker} n={step} b={b}")

    def test_duel_subject_skips_challenge_naive_would_hit(self):
        """marker=2 step=1: naive CW lands on Challenge (3); duel walk skips to player seats."""
        L = 4
        P = 3
        naive_a, naive_b = candidate_seats(2, 1, L)
        self.assertEqual((naive_a, naive_b), (1, 3))
        self.assertTrue(is_challenge_seat(naive_b, L, P))
        a, b = duel_subject_candidate_seats(2, 1, L, P)
        self.assertFalse(is_challenge_seat(a, L, P))
        self.assertFalse(is_challenge_seat(b, L, P))


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

    def _ordered_player_ids(self, code: str) -> list[int]:
        return list(
            WhatIfPlayer.objects.filter(session__short_code=code)
            .order_by("created_at", "id")
            .values_list("id", flat=True)
        )

    def _player_secret_by_id(self, code: str, player_id: int) -> str:
        return str(WhatIfPlayer.objects.get(session__short_code=code, id=player_id).player_secret)

    def _die_choice_prefer_non_active(self, state: dict, ordered_ids: list[int]) -> str:
        """Pick 'a' or 'b' for pick_subject_die_choice; 3+ avoids active as subject when a seat allows."""
        p = len(ordered_ids)
        L = subject_board_seat_count(p)
        active = int(state["active_player_id"])
        a = int(state["subject_candidate_seat_a"])
        b = int(state["subject_candidate_seat_b"])
        if state.get("subject_pick_degenerate"):
            return "a"

        def rank(seat: int) -> tuple[int, int]:
            if is_challenge_seat(seat, L, p):
                return (2, seat)
            tid = player_id_at_seat(ordered_ids, seat, L)
            if tid is None:
                return (2, seat)
            # 2p: either player may be subject; 3+: prefer not the baton holder when possible.
            non_active = 0 if (p == 2 or tid != active) else 1
            return (non_active, seat)

        ra, rb = rank(a), rank(b)
        if ra < rb:
            return "a"
        if rb < ra:
            return "b"
        return "a"

    def _post_pick_subject_die_choice(self, code: str, state: dict) -> dict:
        ordered_ids = self._ordered_player_ids(code)
        choice = self._die_choice_prefer_non_active(state, ordered_ids)
        aid = int(state["active_player_id"])
        token = self._player_secret_by_id(code, aid)
        resp = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_subject_die_choice", "choice": choice},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=token,
        )
        self.assertEqual(resp.status_code, 200, resp.json())
        return resp.json()

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

    def test_start_game_allows_start_without_ready_toggle(self):
        code, host_secret, _user = self._create_session()
        self._join(code, "John")
        self._join(code, "Maya")
        response = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        self.assertEqual(response.status_code, 200)

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

    def test_complete_game_host_ends_with_unique_winner(self):
        code, host_secret, _user = self._create_session()
        self._join(code, "John")
        self._join(code, "Maya")
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        ordered = self._ordered_player_ids(code)
        WhatIfPlayer.objects.filter(id=ordered[0]).update(score=12)
        WhatIfPlayer.objects.filter(id=ordered[1]).update(score=7)
        response = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "complete_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "ended")
        self.assertEqual(body["state"]["ended_reason"], "host_ended")
        self.assertEqual(body["state"]["winner_player_id"], ordered[0])
        fs = body["state"]["final_scores"]
        self.assertEqual(len(fs), 2)
        self.assertEqual(fs[0]["player_id"], ordered[0])
        self.assertEqual(fs[0]["rank"], 1)
        sess = WhatIfSession.objects.get(short_code=code)
        self.assertTrue(WhatIfGameResult.objects.filter(session=sess).exists())

    def test_complete_game_tie_at_top_has_no_winner_or_result(self):
        code, host_secret, _user = self._create_session()
        self._join(code, "John")
        self._join(code, "Maya")
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        ordered = self._ordered_player_ids(code)
        WhatIfPlayer.objects.filter(id__in=ordered).update(score=5)
        response = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "complete_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "ended")
        self.assertIsNone(body["state"]["winner_player_id"])
        ranks = {row["player_id"]: row["rank"] for row in body["state"]["final_scores"]}
        self.assertEqual(ranks[ordered[0]], 1)
        self.assertEqual(ranks[ordered[1]], 1)
        sess = WhatIfSession.objects.get(short_code=code)
        self.assertFalse(WhatIfGameResult.objects.filter(session=sess).exists())

    def test_complete_game_requires_host_token(self):
        code, host_secret, _user = self._create_session()
        p1 = self._join(code, "John")
        self._join(code, "Maya")
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        response = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "complete_game"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(response.status_code, 403)

    def test_complete_game_rejected_in_lobby(self):
        code, host_secret, _user = self._create_session()
        self._join(code, "John")
        self._join(code, "Maya")
        response = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "complete_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("not started", response.json().get("detail", "").lower())

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
        st0 = start.json()["state"]
        ordered = self._ordered_player_ids(code)
        choice = self._die_choice_prefer_non_active(st0, ordered)
        seat = int(st0["subject_candidate_seat_a" if choice == "a" else "subject_candidate_seat_b"])
        target_id = player_id_at_seat(ordered, seat, subject_board_seat_count(len(ordered)))
        self.assertIsNotNone(target_id)
        target_name = WhatIfPlayer.objects.get(id=target_id).display_name
        pick = self._post_pick_subject_die_choice(code, st0)
        self.assertEqual(pick["status"], "voting")
        self.assertIn(target_name, pick["state"]["question"]["prompt"])
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
        self._post_pick_subject_die_choice(code, start.json()["state"])
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
        self._post_pick_subject_die_choice(code, start.json()["state"])
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
        self._post_pick_subject_die_choice(code, start.json()["state"])
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
        self._post_pick_subject_die_choice(code, start.json()["state"])
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
        self._post_pick_subject_die_choice(code, start.json()["state"])
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
        self._post_pick_subject_die_choice(code, start.json()["state"])
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
        self._post_pick_subject_die_choice(code, start.json()["state"])
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
        pick = self._post_pick_subject_die_choice(code, start.json()["state"])
        self.assertIn("What if ", pick["state"]["question"]["prompt"])

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
        self._post_pick_subject_die_choice(code, start.json()["state"])
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
        self._post_pick_subject_die_choice(code, start.json()["state"])
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
        self.assertIsNotNone(start.json()["state"].get("subject_die_value"))

        session = WhatIfSession.objects.get(short_code=code)
        state = dict(session.state or {})
        state.pop("question_id", None)
        session.state = state
        session.save(update_fields=["state", "updated_at"])

        pick = self._post_pick_subject_die_choice(code, dict(session.state))
        self.assertEqual(pick["status"], "voting")
        self.assertIsNotNone(pick["state"].get("question"))

    @patch("whatif.views.roll_subject_die_duel_subject", return_value=(1, 1, 2))
    @patch("whatif.views.roll_subject_die", return_value=(1, 3, 0))
    def test_duel_voting_auto_reveals_on_session_get_after_deadline(self, _mock_roll, _mock_duel):
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
        st0 = start.json()["state"]
        self.assertEqual(st0["active_player_id"], john_id)
        self.assertIsNotNone(st0.get("subject_die_value"))
        self.assertEqual(int(st0["subject_candidate_seat_a"]), 3)
        c1 = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_subject_die_choice", "choice": "a"},
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
        self.assertIsNotNone(c2.json()["state"].get("subject_die_value"))
        c3 = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_subject_die_choice", "choice": "a"},
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
        st["voting_deadline_at"] = (timezone.now() - timedelta(seconds=15)).isoformat()
        sess.state = st
        sess.save(update_fields=["state", "updated_at"])
        polled = self.client.get(f"/api/v1/whatif/sessions/{code}/")
        self.assertEqual(polled.status_code, 200)
        self.assertEqual(polled.json()["status"], "post_results")
        st_out = polled.json()["state"]
        self.assertIsInstance(st_out.get("reveal_flairs"), list)
        self.assertIn("revealed_at", st_out)

    def test_voting_question_skip_non_active_requests_active_approves(self):
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
        self._post_pick_subject_die_choice(code, start.json()["state"])
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

    @patch("whatif.views.roll_subject_die_duel_subject", return_value=(1, 1, 2))
    @patch("whatif.views.roll_subject_die", return_value=(1, 3, 0))
    def test_question_skip_keeps_challenge_subject_and_duel(self, _mock_roll, _mock_duel):
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
        c0 = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_subject_die_choice", "choice": "a"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(c0.status_code, 200, c0.json())
        pick_opp = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_duel_opponent", "target_player_id": maya_id},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(pick_opp.status_code, 200, pick_opp.json())
        self.assertIsNotNone(pick_opp.json()["state"].get("subject_die_value"))
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "pick_subject_die_choice", "choice": "a"},
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

    def _start_voting_round(self) -> tuple[str, str, str, str]:
        """Helper: create a 2-player session and advance to voting status. Returns (code, host, p1, p2)."""
        code, host, _owner = self._create_session()
        p1 = self._join(code, "John")
        p2 = self._join(code, "Maya")
        _mark_all_players_ready(code)
        start = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host,
        )
        self.assertEqual(start.status_code, 200)
        self.assertIsNotNone(start.json()["state"].get("subject_die_value"))
        pick = self._post_pick_subject_die_choice(code, start.json()["state"])
        self.assertEqual(pick["status"], "voting")
        return code, host, p1, p2

    def test_voting_deadline_unset_until_first_vote(self):
        code, _host, _p1, _p2 = self._start_voting_round()
        body = self.client.get(f"/api/v1/whatif/sessions/{code}/").json()
        self.assertIsNone(body["state"].get("voting_deadline_at"))
        self.assertFalse(body["state"].get("voting_paused"))

    def test_first_vote_starts_deadline_subsequent_votes_do_not_reset(self):
        """Needs 3+ players so the second vote is not yet unanimous (2p would snap deadline)."""
        code, host, _owner = self._create_session()
        p1 = self._join(code, "John")
        p2 = self._join(code, "Maya")
        p3 = self._join(code, "Pat")
        _mark_all_players_ready(code)
        start = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host,
        )
        self.assertEqual(start.status_code, 200)
        pick = self._post_pick_subject_die_choice(code, start.json()["state"])
        self.assertEqual(pick["status"], "voting")

        before = timezone.now()
        v1 = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 1},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(v1.status_code, 200, v1.json())
        deadline_after_first = v1.json()["state"]["voting_deadline_at"]
        self.assertIsNotNone(deadline_after_first)
        from datetime import datetime as _dt

        d1 = _dt.fromisoformat(deadline_after_first)
        if timezone.is_naive(d1):
            d1 = timezone.make_aware(d1)
        self.assertGreater(d1, before)

        v2 = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 2},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p2,
        )
        self.assertEqual(v2.status_code, 200, v2.json())
        self.assertEqual(v2.json()["state"]["voting_deadline_at"], deadline_after_first)

        v3 = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 3},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p3,
        )
        self.assertEqual(v3.status_code, 200, v3.json())
        last_deadline = v3.json()["state"]["voting_deadline_at"]
        self.assertIsNotNone(last_deadline)
        d_last = _dt.fromisoformat(last_deadline)
        if timezone.is_naive(d_last):
            d_last = timezone.make_aware(d_last)
        self.assertLessEqual(d_last, timezone.now() + timedelta(seconds=2))

    def test_all_votes_in_snaps_deadline_to_now_two_players(self):
        code, _host, p1, p2 = self._start_voting_round()
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 1},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        before = timezone.now()
        v2 = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 2},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p2,
        )
        self.assertEqual(v2.status_code, 200, v2.json())
        dl = v2.json()["state"]["voting_deadline_at"]
        self.assertIsNotNone(dl)
        from datetime import datetime as _dt

        d = _dt.fromisoformat(dl)
        if timezone.is_naive(d):
            d = timezone.make_aware(d)
        self.assertLessEqual(d, timezone.now() + timedelta(seconds=2))
        self.assertGreaterEqual(d, before - timedelta(seconds=2))

    def test_unvote_clears_vote_and_decrements_response_count_without_resetting_timer(self):
        code, _host, p1, _p2 = self._start_voting_round()
        v1 = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 4},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        deadline = v1.json()["state"]["voting_deadline_at"]
        question_id = v1.json()["state"]["question_id"]
        responses_before = WhatIfQuestion.objects.get(id=question_id).total_responses

        uv = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "unvote"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(uv.status_code, 200, uv.json())
        body = uv.json()
        self.assertEqual(body["state"]["votes"], {})
        self.assertEqual(body["state"]["voted_player_ids"], [])
        # Timer never resets, even if every voter has unvoted.
        self.assertEqual(body["state"]["voting_deadline_at"], deadline)
        self.assertEqual(
            WhatIfQuestion.objects.get(id=question_id).total_responses,
            responses_before - 1,
        )

    def test_unvote_then_revote_does_not_double_count_responses(self):
        code, _host, p1, _p2 = self._start_voting_round()
        question_id = self.client.get(f"/api/v1/whatif/sessions/{code}/").json()["state"]["question_id"]
        responses_before = WhatIfQuestion.objects.get(id=question_id).total_responses
        for _ in range(3):
            self.client.post(
                f"/api/v1/whatif/sessions/{code}/action/",
                {"type": "vote", "option_index": 1},
                format="json",
                HTTP_X_WHATIF_PLAYER_TOKEN=p1,
            )
            self.client.post(
                f"/api/v1/whatif/sessions/{code}/action/",
                {"type": "unvote"},
                format="json",
                HTTP_X_WHATIF_PLAYER_TOKEN=p1,
            )
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 2},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(
            WhatIfQuestion.objects.get(id=question_id).total_responses,
            responses_before + 1,
        )

    def test_unvote_without_existing_vote_rejected(self):
        code, _host, p1, _p2 = self._start_voting_round()
        resp = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "unvote"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(resp.status_code, 400)

    def test_active_player_can_pause_and_resume_voting_preserving_remaining(self):
        code, _host, p1, p2 = self._start_voting_round()
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 1},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )

        pause = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "toggle_voting_pause"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(pause.status_code, 200, pause.json())
        body = pause.json()
        self.assertTrue(body["state"]["voting_paused"])
        self.assertIsNone(body["state"]["voting_deadline_at"])
        remaining = body["state"]["voting_pause_remaining_seconds"]
        self.assertIsInstance(remaining, (int, float))
        self.assertGreater(remaining, 0)

        # Vote rejected while paused.
        rejected = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 2},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p2,
        )
        self.assertEqual(rejected.status_code, 400)

        resume = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "toggle_voting_pause"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(resume.status_code, 200, resume.json())
        body2 = resume.json()
        self.assertFalse(body2["state"]["voting_paused"])
        self.assertIsNone(body2["state"]["voting_pause_remaining_seconds"])
        self.assertIsNotNone(body2["state"]["voting_deadline_at"])

    def test_only_active_player_can_pause_voting(self):
        code, _host, _p1, p2 = self._start_voting_round()
        resp = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "toggle_voting_pause"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p2,
        )
        self.assertEqual(resp.status_code, 403)

    def test_auto_reveal_honors_grace_period(self):
        from whatif import constants

        code, _host, p1, p2 = self._start_voting_round()
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 1},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        # Push deadline into the past, but inside the grace window — should NOT auto-reveal yet.
        sess = WhatIfSession.objects.get(short_code=code)
        st = dict(sess.state or {})
        st["voting_deadline_at"] = (
            timezone.now() - timedelta(seconds=max(0, constants.VOTING_TIME_UP_GRACE_SECONDS - 2))
        ).isoformat()
        sess.state = st
        sess.save(update_fields=["state", "updated_at"])
        polled = self.client.get(f"/api/v1/whatif/sessions/{code}/")
        self.assertEqual(polled.json()["status"], "voting")

        # Push it past the grace period — auto-reveal should fire.
        sess.refresh_from_db()
        st = dict(sess.state or {})
        st["voting_deadline_at"] = (
            timezone.now() - timedelta(seconds=constants.VOTING_TIME_UP_GRACE_SECONDS + 5)
        ).isoformat()
        # Need at least one more vote so reveal can produce a meaningful result; but auto-reveal works
        # regardless of who has voted, so we'll let it fire with just p1's vote.
        _ = p2
        sess.state = st
        sess.save(update_fields=["state", "updated_at"])
        polled2 = self.client.get(f"/api/v1/whatif/sessions/{code}/")
        self.assertEqual(polled2.json()["status"], "post_results")

    def test_paused_round_does_not_auto_reveal(self):
        code, _host, p1, _p2 = self._start_voting_round()
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 1},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "toggle_voting_pause"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        # Even if we somehow had a deadline in the past, paused state must block auto-reveal.
        sess = WhatIfSession.objects.get(short_code=code)
        st = dict(sess.state or {})
        st["voting_deadline_at"] = (timezone.now() - timedelta(seconds=120)).isoformat()
        sess.state = st
        sess.save(update_fields=["state", "updated_at"])
        polled = self.client.get(f"/api/v1/whatif/sessions/{code}/")
        self.assertEqual(polled.json()["status"], "voting")
        self.assertTrue(polled.json()["state"]["voting_paused"])


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

    def test_patch_approve_pending_triggers_dece_proposer_at_threshold(self):
        from achievements.models import AchievementDefinition, UserAchievement
        from achievements.services import SLUG_WHATIF_DECE_PROPOSER

        AchievementDefinition.objects.get_or_create(
            slug=SLUG_WHATIF_DECE_PROPOSER,
            defaults={
                "title": "Dece Proposer",
                "description": "",
                "category": "whatif",
                "order": 45,
            },
        )
        proposer = User.objects.create_user(email="proposer-dece@example.com", password="secret12345")
        base = {
            "answer_1": "1",
            "answer_2": "2",
            "answer_3": "3",
            "answer_4": "4",
            "answer_5": "5",
            "answer_6": "6",
        }
        for i in range(4):
            WhatIfQuestion.objects.create(
                prompt=f"What if {{subject}} prior{i}?",
                review_status=WhatIfQuestion.ReviewStatus.APPROVED,
                proposed_by=proposer,
                **base,
            )
        pending = WhatIfQuestion.objects.create(
            prompt="What if {subject} fifth pending?",
            review_status=WhatIfQuestion.ReviewStatus.PENDING,
            is_active=False,
            proposed_by=proposer,
            **base,
        )
        self.client.force_login(self.staff)
        r = self.client.patch(
            f"/api/v1/whatif/questions/{pending.id}/",
            {"review_status": "approved", "is_active": True},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertTrue(
            UserAchievement.objects.filter(
                user=proposer, achievement__slug=SLUG_WHATIF_DECE_PROPOSER
            ).exists()
        )


class WhatIfMySessionsTests(TestCase):
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

    def _approved(self, email: str) -> User:
        u = User.objects.create_user(email=email, password="secret12345")
        u.account_status = User.AccountStatus.APPROVED
        u.save(update_fields=["account_status"])
        return u

    def test_mine_requires_authentication(self):
        r = self.client.get("/api/v1/whatif/sessions/mine/")
        self.assertIn(r.status_code, (401, 403))

    def test_mine_requires_approved_account(self):
        u = User.objects.create_user(email="pending@example.com", password="secret12345")
        self.client.force_login(u)
        r = self.client.get("/api/v1/whatif/sessions/mine/")
        self.assertEqual(r.status_code, 403)

    def test_owner_sees_open_lobby_row(self):
        host = self._approved("host-owner@example.com")
        self.client.force_login(host)
        cr = self.client.post("/api/v1/whatif/sessions/", {}, format="json")
        self.assertEqual(cr.status_code, 201)
        code = cr.json()["short_code"]
        r = self.client.get("/api/v1/whatif/sessions/mine/")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(len(body["open_lobby"]), 1)
        self.assertEqual(body["in_progress"], [])
        self.assertEqual(body["completed"], [])
        row = body["open_lobby"][0]
        self.assertEqual(row["short_code"], code)
        self.assertTrue(row["is_owner"])
        self.assertEqual(row["player_names"], [])
        self.assertEqual(row["status"], WhatIfSession.Status.OPEN)
        self.assertIsNone(row.get("player_secret"))

    def test_joined_player_sees_session_not_owner(self):
        host = self._approved("host2@example.com")
        joiner = self._approved("joiner@example.com")
        self.client.force_login(host)
        cr = self.client.post("/api/v1/whatif/sessions/", {}, format="json")
        code = cr.json()["short_code"]
        self.client.logout()
        self.client.force_login(joiner)
        jr = self.client.post(
            f"/api/v1/whatif/sessions/{code}/join/",
            {"display_name": "Maya"},
            format="json",
        )
        self.assertEqual(jr.status_code, 201)
        r = self.client.get("/api/v1/whatif/sessions/mine/")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(len(body["open_lobby"]), 1)
        row = body["open_lobby"][0]
        self.assertEqual(row["short_code"], code)
        self.assertFalse(row["is_owner"])
        self.assertEqual(row["player_names"], ["Maya"])
        secret = str(
            WhatIfPlayer.objects.get(session__short_code=code, display_name="Maya").player_secret
        )
        self.assertEqual(row["player_secret"], secret)

    def test_open_lobby_sorted_by_updated_at_desc(self):
        host = self._approved("host3@example.com")
        self.client.force_login(host)
        older = self.client.post("/api/v1/whatif/sessions/", {}, format="json").json()["short_code"]
        newer = self.client.post("/api/v1/whatif/sessions/", {}, format="json").json()["short_code"]
        WhatIfSession.objects.filter(short_code=older).update(
            updated_at=timezone.now() - timedelta(days=2)
        )
        r = self.client.get("/api/v1/whatif/sessions/mine/")
        self.assertEqual(r.status_code, 200)
        codes = [row["short_code"] for row in r.json()["open_lobby"]]
        self.assertEqual(codes[0], newer)
        self.assertEqual(codes[1], older)

    def test_completed_bucket(self):
        host = self._approved("host4@example.com")
        self.client.force_login(host)
        cr = self.client.post("/api/v1/whatif/sessions/", {}, format="json")
        code = cr.json()["short_code"]
        WhatIfSession.objects.filter(short_code=code).update(status=WhatIfSession.Status.ENDED)
        r = self.client.get("/api/v1/whatif/sessions/mine/")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["open_lobby"], [])
        self.assertEqual(body["in_progress"], [])
        self.assertEqual(len(body["completed"]), 1)
        self.assertEqual(body["completed"][0]["short_code"], code)
        self.assertEqual(body["completed"][0]["status"], WhatIfSession.Status.ENDED)

