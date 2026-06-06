import random
from collections import Counter
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from whatif import constants
from whatif.models import (
    WhatIfGameResult,
    WhatIfNpc,
    WhatIfPlayer,
    WhatIfQuestion,
    WhatIfSession,
    WhatIfSessionPlacement,
)
from whatif.endgame import (
    backfill_whatif_session_placements_from_history,
    compute_endgame_awards,
    current_round_number,
    empty_player_tally,
    enrich_final_scores_with_lifetime_lines,
    full_lifetime_stats_for_user,
    gold_medal_count_for_user,
    record_challenge_started,
    record_reveal_tallies,
    stamp_endgame_stats,
)
from whatif.rules import evaluate_vote_scores, two_subject_candidate_ids
from whatif.subject_board import (
    build_ring_layout,
    candidate_seats,
    default_marker_index,
    duel_subject_candidate_seats,
    is_challenge_seat,
    player_id_at_seat,
    roll_subject_die,
    seat_occupant_at,
    subject_board_seat_count,
    subject_pick_is_degenerate,
)
from whatif.validators import validate_question_text_field
from whatif.constants import STALE_OPEN_LOBBY_AGE_HOURS
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
        self.assertEqual(subject_board_seat_count(3, 5), 6)
        self.assertEqual(default_marker_index(2), 0)
        self.assertEqual(default_marker_index(3), 3)
        self.assertEqual(default_marker_index(3, 5), 5)

    def test_build_ring_layout_interleaves(self):
        layout = build_ring_layout([1, 2, 3, 4, 5], [101])
        kinds = [k for k, _ in layout]
        self.assertEqual(
            kinds,
            ["player", "player", "player", "npc", "player", "player"],
        )
        self.assertEqual(layout[3], ("npc", 101))
        layout2 = build_ring_layout([1, 2, 3, 4], [101, 102, 103, 104])
        self.assertEqual(len(layout2), 8)
        self.assertEqual([k for k, _ in layout2].count("npc"), 4)

    def test_two_players_with_npcs_no_challenge(self):
        layout = build_ring_layout([1, 2], [101])
        self.assertEqual(len(layout), 3)
        self.assertEqual(subject_board_seat_count(2, 3), 3)

    def test_candidate_seats_wrap(self):
        self.assertEqual(candidate_seats(1, 2, 4), (3, 3))
        self.assertEqual(candidate_seats(0, 5, 4), (3, 1))

    def test_player_id_at_seat_and_challenge(self):
        ids = [10, 20, 30]
        L = 4
        self.assertEqual(player_id_at_seat(ids, 0, L), 10)
        self.assertIsNone(player_id_at_seat(ids, 3, L))
        self.assertTrue(is_challenge_seat(3, L, 3))
        self.assertFalse(is_challenge_seat(2, L, 3))

    def test_seat_occupant_npc(self):
        layout = build_ring_layout([10, 20, 30], [99])
        L = subject_board_seat_count(3, 4)
        self.assertEqual(seat_occupant_at(layout, 2, L, 3), ("npc", 99))

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

    def test_roll_always_d6(self):
        random.seed(1)
        for _ in range(120):
            n, _a, _b = roll_subject_die(marker=3, forbidden_seat=None, seat_count=4, num_players=2)
            self.assertGreaterEqual(n, 1)
            self.assertLessEqual(n, constants.SUBJECT_DIE_FACES)

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


class WhatIfValidatorTests(TestCase):
    def test_question_text_accepts_common_punctuation(self):
        samples = [
            "Don't stop!",
            "50% off",
            "C++",
            "…",
            "—em dash—",
            "@mention",
            "Q&A / notes & more",
        ]
        for s in samples:
            with self.subTest(s=s):
                self.assertEqual(validate_question_text_field("prompt", s, max_length=500), s)

    def test_question_text_rejects_control_characters(self):
        with self.assertRaises(ValueError) as ctx:
            validate_question_text_field("prompt", "bad\x00text", max_length=500)
        self.assertIn("unsupported characters", str(ctx.exception).lower())

    def test_question_text_strips_and_enforces_max_length(self):
        self.assertEqual(
            validate_question_text_field("answer_1", "  hi  ", max_length=10),
            "hi",
        )
        with self.assertRaises(ValueError):
            validate_question_text_field("answer_1", "x" * 11, max_length=10)


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

    def _fast_forward_declare_winner(self, code: str) -> dict:
        """Session GET applies declare-winner after scoreboard animation delay."""
        session = WhatIfSession.objects.get(short_code=code.upper())
        st = dict(session.state or {})
        st["declare_winner_not_before"] = (timezone.now() - timedelta(seconds=1)).isoformat()
        session.state = st
        session.save(update_fields=["state"])
        polled = self.client.get(f"/api/v1/whatif/sessions/{code}/")
        self.assertEqual(polled.status_code, 200)
        return polled.json()

    def _ordered_player_ids(self, code: str) -> list[int]:
        return list(
            WhatIfPlayer.objects.filter(session__short_code=code)
            .order_by("created_at", "id")
            .values_list("id", flat=True)
        )

    def _player_secret_by_id(self, code: str, player_id: int) -> str:
        return str(WhatIfPlayer.objects.get(session__short_code=code, id=player_id).player_secret)

    def _die_choice_prefer_non_active(self, code: str, state: dict, ordered_ids: list[int]) -> str:
        """Pick 'a' or 'b' for pick_subject_die_choice; 3+ avoids active as subject when a seat allows."""
        session = WhatIfSession.objects.get(short_code=code)
        npc_ids = list(session.npcs.order_by("created_at", "id").values_list("id", flat=True))
        layout = build_ring_layout(ordered_ids, npc_ids)
        p = len(ordered_ids)
        e = len(layout)
        L = subject_board_seat_count(p, e)
        active = int(state["active_player_id"])
        a = int(state["subject_candidate_seat_a"])
        b = int(state["subject_candidate_seat_b"])
        if state.get("subject_pick_degenerate"):
            return "a"

        def rank(seat: int) -> tuple[int, int]:
            if is_challenge_seat(seat, L, p, e):
                return (2, seat)
            occ = seat_occupant_at(layout, seat, L, p)
            if occ is None:
                return (2, seat)
            kind, eid = occ
            if kind == "npc":
                return (0, seat)
            # 2p: either player may be subject; 3+: prefer not the baton holder when possible.
            non_active = 0 if (p == 2 or eid != active) else 1
            return (non_active, seat)

        ra, rb = rank(a), rank(b)
        if ra < rb:
            return "a"
        if rb < ra:
            return "b"
        return "a"

    def _post_pick_subject_die_choice(self, code: str, state: dict) -> dict:
        ordered_ids = self._ordered_player_ids(code)
        choice = self._die_choice_prefer_non_active(code, state, ordered_ids)
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

    def test_round_number_starts_at_one_after_start_game(self):
        code, host_secret, _user = self._create_session()
        self._join(code, "John")
        self._join(code, "Maya")
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        tv = self.client.get(f"/api/v1/whatif/sessions/{code}/")
        self.assertEqual(tv.status_code, 200)
        self.assertEqual(tv.json()["state"]["round_number"], 1)
        token = self._player_secret_by_id(code, self._ordered_player_ids(code)[0])
        hand = self.client.get(
            f"/api/v1/whatif/sessions/{code}/hand/",
            HTTP_X_WHATIF_PLAYER_TOKEN=token,
        )
        self.assertEqual(hand.status_code, 200)
        self.assertEqual(hand.json()["state"]["round_number"], 1)

    def test_hand_state_includes_npcs(self):
        code, host_secret, _user = self._create_session()
        self._join(code, "John")
        self._join(code, "Maya")
        self._join(code, "Alex")
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "add_npc", "display_name": "Ghost"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        token = self._player_secret_by_id(code, self._ordered_player_ids(code)[0])
        hand = self.client.get(
            f"/api/v1/whatif/sessions/{code}/hand/",
            HTTP_X_WHATIF_PLAYER_TOKEN=token,
        )
        self.assertEqual(hand.status_code, 200)
        body = hand.json()
        self.assertEqual(len(body["npcs"]), 1)
        self.assertEqual(body["npcs"][0]["display_name"], "Ghost")
        self.assertIn("avatar_emoji", body["npcs"][0])

    def test_add_npc_and_entity_cap(self):
        code, host_secret, _user = self._create_session()
        self._join(code, "John")
        self._join(code, "Maya")
        add = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "add_npc", "display_name": "Ghost"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        self.assertEqual(add.status_code, 200)
        body = self.client.get(f"/api/v1/whatif/sessions/{code}/").json()
        self.assertEqual(len(body["npcs"]), 1)
        self.assertEqual(body["npcs"][0]["display_name"], "Ghost")
        for i in range(5):
            self.client.post(
                f"/api/v1/whatif/sessions/{code}/action/",
                {"type": "add_npc", "display_name": f"N{i}"},
                format="json",
                HTTP_X_WHATIF_HOST_TOKEN=host_secret,
            )
        full = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "add_npc", "display_name": "Extra"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        self.assertEqual(full.status_code, 400)
        join_full = self.client.post(
            f"/api/v1/whatif/sessions/{code}/join/",
            {"display_name": "Zed"},
            format="json",
        )
        self.assertEqual(join_full.status_code, 400)

    def test_npc_name_collides_with_player(self):
        code, host_secret, _user = self._create_session()
        self._join(code, "Alex")
        dup = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "add_npc", "display_name": "alex"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        self.assertEqual(dup.status_code, 400)

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

    def test_join_rejects_duplicate_authenticated_user_seat(self):
        code, _host_secret, _host = self._create_session()
        user = User.objects.create_user(email="pat@example.com", password="secret12345")
        user.account_status = User.AccountStatus.APPROVED
        user.save(update_fields=["account_status"])
        self.client.force_login(user)
        first = self.client.post(
            f"/api/v1/whatif/sessions/{code}/join/",
            {"display_name": "Pat"},
            format="json",
        )
        self.assertEqual(first.status_code, 201)
        second = self.client.post(
            f"/api/v1/whatif/sessions/{code}/join/",
            {"display_name": "PatTwo"},
            format="json",
        )
        self.assertEqual(second.status_code, 400)
        self.assertIn("already have a seat", second.json().get("detail", "").lower())
        self.assertEqual(
            WhatIfPlayer.objects.filter(session__short_code=code, user_id=user.id).count(),
            1,
        )

    def test_leave_game_removes_player_from_lobby(self):
        code, _host_secret, _user = self._create_session()
        p1 = self._join(code, "Alex")
        self._join(code, "Maya")
        leave = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "leave_game"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(leave.status_code, 200)
        polled = self.client.get(f"/api/v1/whatif/sessions/{code}/")
        self.assertEqual(polled.status_code, 200)
        self.assertEqual([p["display_name"] for p in polled.json()["players"]], ["Maya"])
        rejoin = self.client.post(
            f"/api/v1/whatif/sessions/{code}/join/",
            {"display_name": "Alex"},
            format="json",
        )
        self.assertEqual(rejoin.status_code, 201)

    def test_next_turn_after_winning_reveal_declares_winner_when_hold_elapsed(self):
        code, host_secret, _user = self._create_session()
        p1 = self._join(code, "John")
        p2 = self._join(code, "Maya")
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
        self.assertEqual(reveal.json()["status"], "post_results")
        session = WhatIfSession.objects.get(short_code=code)
        st = dict(session.state or {})
        st["declare_winner_not_before"] = (timezone.now() - timedelta(seconds=1)).isoformat()
        session.state = st
        session.save(update_fields=["state"])
        next_turn = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "next_turn"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=active_token,
        )
        self.assertEqual(next_turn.status_code, 200)
        self.assertEqual(next_turn.json()["status"], "ended")
        self.assertEqual(next_turn.json()["state"]["winner_player_id"], active_player.id)

    def test_leave_game_rejected_after_start(self):
        code, host_secret, _user = self._create_session()
        p1 = self._join(code, "John")
        self._join(code, "Maya")
        start = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        self.assertEqual(start.status_code, 200)
        leave = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "leave_game"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(leave.status_code, 400)
        self.assertIn("before the game starts", leave.json().get("detail", "").lower())

    def test_join_rejects_after_game_started(self):
        code, host_secret, _user = self._create_session()
        self._join(code, "John")
        self._join(code, "Maya")
        start = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "start_game"},
            format="json",
            HTTP_X_WHATIF_HOST_TOKEN=host_secret,
        )
        self.assertEqual(start.status_code, 200)
        response = self.client.post(
            f"/api/v1/whatif/sessions/{code}/join/",
            {"display_name": "Latecomer"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("already started", response.json().get("detail", "").lower())

    def test_join_assigns_unique_avatar_emojis_per_session(self):
        code, _host_secret, _user = self._create_session()
        emojis: list[str] = []
        for i in range(constants.WHATIF_MAX_ENTITIES):
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
        self.assertEqual(body["state"]["endgame_stats"]["questions_drawn"], 1)
        self.assertIn("rounds_completed", body["state"]["endgame_stats"])
        self.assertIn("endgame_awards", body["state"])
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
        choice = self._die_choice_prefer_non_active(code, st0, ordered)
        seat = int(st0["subject_candidate_seat_a" if choice == "a" else "subject_candidate_seat_b"])
        target_id = player_id_at_seat(ordered, seat, subject_board_seat_count(len(ordered), len(ordered)))
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

    @patch("whatif.constants.SCOREBOARD_REVEAL_TOTAL_MS", 0)
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
        body = reveal.json()
        self.assertEqual(body["status"], "post_results")
        self.assertEqual(body["state"]["pending_winner_player_id"], active_player.id)
        self.assertIsNone(body["state"].get("winner_player_id"))
        self._fast_forward_declare_winner(code)
        result = WhatIfGameResult.objects.get(session__short_code=code)
        self.assertEqual(result.winner_display_name, result.winner_player.display_name)

    def test_winning_reveal_waits_for_scoreboard_before_declaring_winner(self):
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
        body = reveal.json()
        self.assertEqual(body["status"], "post_results")
        self.assertIsNotNone(body["state"].get("revealed_at"))
        self.assertEqual(body["state"]["pending_winner_player_id"], active_player.id)

        polled = self.client.get(f"/api/v1/whatif/sessions/{code}/")
        self.assertEqual(polled.status_code, 200)
        self.assertEqual(polled.json()["status"], "post_results")

        ended = self._fast_forward_declare_winner(code)
        self.assertEqual(ended["status"], "ended")
        self.assertEqual(ended["state"]["winner_player_id"], active_player.id)
        self.assertIsNone(ended["state"].get("pending_winner_player_id"))

        next_turn = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "next_turn"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=active_token,
        )
        self.assertEqual(next_turn.status_code, 400)

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
        self.assertEqual(reveal.json()["status"], "post_results")
        self.assertEqual(reveal.json()["state"]["pending_winner_player_id"], active_player.id)
        ended = self._fast_forward_declare_winner(code)
        self.assertEqual(ended["status"], "ended")
        active_player.refresh_from_db()
        self.assertGreaterEqual(active_player.score, 5)

    def test_reveal_response_includes_fresh_player_scores(self):
        """TV/hand payloads must not serve stale prefetched scores after F() updates."""
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
        body = reveal.json()
        db_scores = dict(
            WhatIfPlayer.objects.filter(session__short_code=code).values_list("id", "score")
        )
        for row in body["players"]:
            self.assertEqual(row["score"], db_scores[row["id"]], msg=row["display_name"])

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

    @patch("whatif.views.roll_subject_die", side_effect=[(1, 3, 0), (1, 1, 2)])
    def test_duel_voting_auto_reveals_on_session_get_after_deadline(self, _mock_roll):
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
            int(req.json()["state"]["pending_question_skip_question_id"]),
            int(req.json()["state"]["question_id"]),
        )
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
        self.assertIsNone(body["state"].get("pending_question_skip_by_player_id"))
        self.assertIsNone(body["state"].get("pending_question_skip_question_id"))
        self.assertIsNotNone(body["state"].get("challenge_target_player_id"))
        self.assertEqual(body["state"].get("duel"), None)
        self.assertIsNotNone(body["state"].get("question_id"))

    @patch("whatif.views.roll_subject_die", side_effect=[(1, 3, 0), (1, 1, 2)])
    def test_question_skip_keeps_challenge_subject_and_duel(self, _mock_roll):
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

    def test_stale_question_skip_request_hidden_after_new_question(self):
        """Pending skip from a prior question must not appear once a new question is loaded."""
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
        old_qid = self.client.get(f"/api/v1/whatif/sessions/{code}/").json()["state"]["question_id"]
        maya_id = WhatIfPlayer.objects.get(session__short_code=code, display_name="Maya").id
        req = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "request_question_skip"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p2,
        )
        self.assertEqual(req.status_code, 200, req.json())
        sess = WhatIfSession.objects.get(short_code=code)
        st = dict(sess.state or {})
        st["question_id"] = old_qid + 9999
        st["pending_question_skip_by_player_id"] = maya_id
        st["pending_question_skip_question_id"] = old_qid
        sess.state = st
        sess.save(update_fields=["state", "updated_at"])
        polled = self.client.get(f"/api/v1/whatif/sessions/{code}/")
        self.assertEqual(polled.status_code, 200)
        self.assertIsNone(polled.json()["state"].get("pending_question_skip_by_player_id"))

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

    def test_unvote_rejected_after_deadline_elapsed(self):
        code, _host, p1, _p2 = self._start_voting_round()
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 2},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        sess = WhatIfSession.objects.get(short_code=code)
        st = dict(sess.state or {})
        st["voting_deadline_at"] = (timezone.now() - timedelta(seconds=1)).isoformat()
        sess.state = st
        sess.save(update_fields=["state", "updated_at"])

        resp = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "unvote"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(resp.status_code, 400, resp.json())
        self.assertIn("Time's up", resp.json()["detail"])

        polled = self.client.get(f"/api/v1/whatif/sessions/{code}/")
        self.assertEqual(polled.json()["status"], "voting")

    def test_unvote_preserves_last_vote_for_hand_and_timeout_reveal(self):
        from whatif import constants

        code, _host, p1, p2 = self._start_voting_round()
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 4},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        uv = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "unvote"},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(uv.status_code, 200, uv.json())
        self.assertEqual(uv.json()["state"]["votes"], {})
        self.assertEqual(list(uv.json()["state"]["last_votes"].values()), [4])

        hand = self.client.get(
            f"/api/v1/whatif/sessions/{code}/hand/",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(hand.status_code, 200, hand.json())
        hand_body = hand.json()
        self.assertIsNone(hand_body["state"]["your_vote"])
        self.assertEqual(hand_body["state"]["your_last_vote"], 4)

        # Other player still needs to vote; push past grace so auto-reveal restores p1's last choice.
        self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 1},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p2,
        )
        sess = WhatIfSession.objects.get(short_code=code)
        st = dict(sess.state or {})
        st["voting_deadline_at"] = (
            timezone.now() - timedelta(seconds=constants.VOTING_TIME_UP_GRACE_SECONDS + 2)
        ).isoformat()
        sess.state = st
        sess.save(update_fields=["state", "updated_at"])

        polled = self.client.get(f"/api/v1/whatif/sessions/{code}/")
        self.assertEqual(polled.json()["status"], "post_results")
        vote_counts = polled.json()["state"].get("vote_counts") or {}
        self.assertEqual(int(vote_counts.get("4", 0)), 1)

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

    def test_close_stale_open_endpoint_closes_old_lobbies(self):
        host = self._approved("stale-host@example.com")
        self.client.force_login(host)
        cr = self.client.post("/api/v1/whatif/sessions/", {}, format="json")
        self.assertEqual(cr.status_code, 201)
        code = cr.json()["short_code"]
        stale_created = timezone.now() - timedelta(hours=STALE_OPEN_LOBBY_AGE_HOURS + 1)
        WhatIfSession.objects.filter(short_code=code).update(
            created_at=stale_created,
            updated_at=stale_created,
        )
        guest = self._approved("stale-guest@example.com")
        self.client.force_login(guest)
        r = self.client.post("/api/v1/whatif/sessions/close-stale-open/", {}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["closed_count"], 1)
        session = WhatIfSession.objects.get(short_code=code)
        self.assertEqual(session.status, WhatIfSession.Status.ENDED)
        self.assertEqual(session.state.get("ended_reason"), "stale_lobby")

    def test_close_stale_open_leaves_fresh_lobby_and_in_progress(self):
        host = self._approved("fresh-host@example.com")
        self.client.force_login(host)
        fresh = self.client.post("/api/v1/whatif/sessions/", {}, format="json")
        fresh_code = fresh.json()["short_code"]
        stale = self.client.post("/api/v1/whatif/sessions/", {}, format="json")
        stale_code = stale.json()["short_code"]
        stale_created = timezone.now() - timedelta(hours=STALE_OPEN_LOBBY_AGE_HOURS + 2)
        WhatIfSession.objects.filter(short_code=stale_code).update(
            created_at=stale_created,
            updated_at=stale_created,
        )
        WhatIfSession.objects.filter(short_code=fresh_code).update(
            status=WhatIfSession.Status.VOTING,
        )
        r = self.client.post("/api/v1/whatif/sessions/close-stale-open/", {}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["closed_count"], 1)
        self.assertEqual(
            WhatIfSession.objects.get(short_code=fresh_code).status,
            WhatIfSession.Status.VOTING,
        )
        self.assertEqual(
            WhatIfSession.objects.get(short_code=stale_code).status,
            WhatIfSession.Status.ENDED,
        )

    def test_list_my_sessions_closes_stale_open_lobby(self):
        host = self._approved("mine-stale@example.com")
        self.client.force_login(host)
        cr = self.client.post("/api/v1/whatif/sessions/", {}, format="json")
        code = cr.json()["short_code"]
        stale_created = timezone.now() - timedelta(hours=STALE_OPEN_LOBBY_AGE_HOURS + 1)
        WhatIfSession.objects.filter(short_code=code).update(
            created_at=stale_created,
            updated_at=stale_created,
        )
        r = self.client.get("/api/v1/whatif/sessions/mine/")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["open_lobby"], [])
        self.assertEqual(len(body["completed"]), 1)
        self.assertEqual(body["completed"][0]["short_code"], code)


class WhatIfRealtimeTests(WhatIfApiTests):
    def test_session_group_name(self):
        from whatif.realtime import whatif_session_group_name

        self.assertEqual(whatif_session_group_name("abcd"), "whatif_session_ABCD")

    @patch("whatif.views.notify_whatif_session")
    def test_join_session_notifies_websocket_clients(self, mock_notify):
        code, _host, _user = self._create_session()
        mock_notify.reset_mock()
        self._join(code, "Maya")
        mock_notify.assert_called_once()
        called_code, = mock_notify.call_args[0]
        self.assertEqual(called_code, code)
        self.assertIsNotNone(mock_notify.call_args[1].get("state_version"))

    @patch("whatif.views.notify_whatif_session")
    def test_session_action_notifies_websocket_clients(self, mock_notify):
        code, _host, p1, _p2 = self._start_voting_round()
        mock_notify.reset_mock()
        vote = self.client.post(
            f"/api/v1/whatif/sessions/{code}/action/",
            {"type": "vote", "option_index": 1},
            format="json",
            HTTP_X_WHATIF_PLAYER_TOKEN=p1,
        )
        self.assertEqual(vote.status_code, 200)
        self.assertTrue(mock_notify.called)
        self.assertEqual(mock_notify.call_args[0][0], code)

    def test_validate_player_token(self):
        from whatif.consumers import _validate_player_token

        code, _host, _user = self._create_session()
        secret = self._join(code, "Pat")
        self.assertTrue(_validate_player_token(code, secret))
        self.assertFalse(
            _validate_player_token(code, "00000000-0000-0000-0000-000000000001"),
        )


class WhatIfQueryBudgetTests(WhatIfApiTests):
    """Regression ceilings for SQL count per request (see whatif/session_queries.py)."""

    def test_join_query_budget(self):
        code, _host, _user = self._create_session()
        with self.assertNumQueries(10):
            self._join(code, "Alex")

    def test_vote_action_query_budget(self):
        code, _host, p1, _p2 = self._start_voting_round()
        with self.assertNumQueries(13):
            self.client.post(
                f"/api/v1/whatif/sessions/{code}/action/",
                {"type": "vote", "option_index": 1},
                format="json",
                HTTP_X_WHATIF_PLAYER_TOKEN=p1,
            )

    def test_start_game_action_query_budget(self):
        code, host, _owner = self._create_session()
        self._join(code, "John")
        self._join(code, "Maya")
        with self.assertNumQueries(17):
            self.client.post(
                f"/api/v1/whatif/sessions/{code}/action/",
                {"type": "start_game"},
                format="json",
                HTTP_X_WHATIF_HOST_TOKEN=host,
            )

    def test_get_session_query_budget(self):
        code, _host, _user = self._create_session()
        self._join(code, "Alex")
        with self.assertNumQueries(4):
            self.client.get(f"/api/v1/whatif/sessions/{code}/")


class EndgameStatsTests(TestCase):
    def test_current_round_number(self):
        self.assertIsNone(current_round_number({}))
        self.assertEqual(
            current_round_number({"session_tallies": {"round_number": 3}}),
            3,
        )
        self.assertEqual(
            current_round_number({"session_tallies": {"rounds_completed": 1}, "question_id": 5}),
            2,
        )

    def test_record_reveal_and_challenge_tallies(self):
        state: dict = {"session_tallies": {}, "player_tallies": {}}
        record_challenge_started(state, issuer_id=1, challenged_id=2)
        record_reveal_tallies(
            state,
            round_scores={1: 4, 2: 4},
            flairs=["Splitskies!"],
            is_duel=True,
        )
        self.assertEqual(state["session_tallies"]["challenges_started"], 1)
        self.assertEqual(state["session_tallies"]["rounds_completed"], 1)
        self.assertEqual(state["session_tallies"]["flairs"]["Splitskies!"], 1)
        self.assertEqual(state["player_tallies"]["1"]["challenges_issued"], 1)
        self.assertEqual(state["player_tallies"]["2"]["times_challenged"], 1)
        self.assertEqual(state["player_tallies"]["1"]["duel_points"], 4)

    def test_compute_endgame_awards_picks_leader(self):
        User = get_user_model()
        user = User.objects.create_user(email="eg1@example.com", password="x")
        session = WhatIfSession.objects.create(short_code="EGME", owner=user, status=WhatIfSession.Status.ENDED)
        p1 = WhatIfPlayer.objects.create(session=session, user=user, display_name="A", avatar_emoji="🐸", score=10)
        p2 = WhatIfPlayer.objects.create(session=session, display_name="B", avatar_emoji="🦆", score=5)
        state = {
            "player_tallies": {
                str(p1.id): {**empty_player_tally(), "rounds_scored": 3},
                str(p2.id): {**empty_player_tally(), "rounds_scored": 1},
            }
        }
        awards = compute_endgame_awards(session, state)
        scored = next(a for a in awards if a["key"] == "most_rounds_scored")
        self.assertEqual(scored["player_ids"], [p1.id])
        self.assertEqual(scored["value"], 3)

    def test_stamp_endgame_creates_placements(self):
        User = get_user_model()
        user = User.objects.create_user(email="eg2@example.com", password="x")
        session = WhatIfSession.objects.create(short_code="EGMZ", owner=user, status=WhatIfSession.Status.VOTING)
        p1 = WhatIfPlayer.objects.create(session=session, user=user, display_name="A", avatar_emoji="🐸", score=12)
        WhatIfPlayer.objects.create(session=session, display_name="B", avatar_emoji="🦆", score=7)
        state = stamp_endgame_stats(session, {"session_tallies": {"rounds_completed": 2}})
        self.assertEqual(state["endgame_stats"]["rounds_completed"], 2)
        self.assertTrue(WhatIfSessionPlacement.objects.filter(session=session, player=p1, rank=1).exists())

    def test_scoreboard_lifetime_line_medals_by_rank(self):
        User = get_user_model()
        user = User.objects.create_user(email="sl1@example.com", password="x")
        user2 = User.objects.create_user(email="sl2@example.com", password="x")
        user3 = User.objects.create_user(email="sl3@example.com", password="x")

        past_win = WhatIfSession.objects.create(short_code="SLMA", owner=user, status=WhatIfSession.Status.ENDED)
        WhatIfGameResult.objects.create(
            session=past_win,
            winner_player=WhatIfPlayer.objects.create(
                session=past_win, user=user, display_name="Past", avatar_emoji="🐸", score=20
            ),
            winner_user=user,
            winner_display_name="Past",
        )
        past_silver = WhatIfSession.objects.create(short_code="SLMB", owner=user, status=WhatIfSession.Status.ENDED)
        past_silver_player = WhatIfPlayer.objects.create(
            session=past_silver, user=user2, display_name="Past2", avatar_emoji="🦆", score=8
        )
        WhatIfSessionPlacement.objects.create(
            session=past_silver,
            player=past_silver_player,
            user=user2,
            display_name="Past2",
            rank=2,
            score=8,
        )

        current = WhatIfSession.objects.create(short_code="SLMC", owner=user, status=WhatIfSession.Status.VOTING)
        p1 = WhatIfPlayer.objects.create(session=current, user=user, display_name="Win", avatar_emoji="🐸", score=25)
        p2 = WhatIfPlayer.objects.create(session=current, user=user2, display_name="Second", avatar_emoji="🦆", score=18)
        p3 = WhatIfPlayer.objects.create(session=current, user=user3, display_name="Third", avatar_emoji="🐱", score=12)
        WhatIfPlayer.objects.create(session=current, display_name="Fourth", avatar_emoji="🐶", score=5)
        state = stamp_endgame_stats(
            current,
            {
                "winner_player_id": p1.id,
                "player_tallies": {},
                "session_tallies": {"rounds_completed": 1},
            },
        )
        fs = {row["player_id"]: row for row in state["final_scores"]}
        self.assertEqual(fs[p1.id]["lifetime_line"], "2 gold medals")
        self.assertEqual(fs[p2.id]["lifetime_line"], "2 silver medals")
        self.assertEqual(fs[p3.id]["lifetime_line"], "1 bronze medal")
        self.assertIsNone(fs[next(p.id for p in current.players.all() if not p.user_id)]["lifetime_line"])

    def test_scoreboard_lifetime_line_rank_four_new_high_score(self):
        User = get_user_model()
        user = User.objects.create_user(email="sl3@example.com", password="x")
        past = WhatIfSession.objects.create(short_code="SLMD", owner=user, status=WhatIfSession.Status.ENDED)
        WhatIfPlayer.objects.create(session=past, user=user, display_name="Old", avatar_emoji="🐸", score=10)
        current = WhatIfSession.objects.create(short_code="SLME", owner=user, status=WhatIfSession.Status.ENDED)
        player = WhatIfPlayer.objects.create(session=current, user=user, display_name="New", avatar_emoji="🦆", score=15)
        rows = enrich_final_scores_with_lifetime_lines(
            current,
            [{"player_id": player.id, "display_name": "New", "avatar_emoji": "🦆", "score": 15, "rank": 4}],
            {"player_tallies": {str(player.id): empty_player_tally()}},
        )
        self.assertEqual(rows[0]["lifetime_line"], "New high score: 15 pts")

    def test_scoreboard_lifetime_line_fallback_total_points(self):
        User = get_user_model()
        user = User.objects.create_user(email="sl4@example.com", password="x")
        past = WhatIfSession.objects.create(short_code="SLMF", owner=user, status=WhatIfSession.Status.ENDED)
        WhatIfPlayer.objects.create(session=past, user=user, display_name="Old", avatar_emoji="🐸", score=10)
        current = WhatIfSession.objects.create(short_code="SLMG", owner=user, status=WhatIfSession.Status.ENDED)
        player = WhatIfPlayer.objects.create(session=current, user=user, display_name="Mid", avatar_emoji="🦆", score=5)
        rows = enrich_final_scores_with_lifetime_lines(
            current,
            [{"player_id": player.id, "display_name": "Mid", "avatar_emoji": "🦆", "score": 5, "rank": 4}],
            {"player_tallies": {str(player.id): empty_player_tally()}},
        )
        self.assertEqual(rows[0]["lifetime_line"], "15 lifetime pts")

    def test_full_lifetime_stats_api(self):
        User = get_user_model()
        user = User.objects.create_user(email="sl5@example.com", password="x")
        past = WhatIfSession.objects.create(short_code="SLMH", owner=user, status=WhatIfSession.Status.ENDED)
        WhatIfPlayer.objects.create(session=past, user=user, display_name="A", avatar_emoji="🐸", score=10)
        WhatIfSessionPlacement.objects.create(
            session=past,
            player=WhatIfPlayer.objects.get(session=past),
            user=user,
            display_name="A",
            rank=2,
            score=10,
        )
        self.client.force_login(user)
        resp = self.client.get("/api/v1/whatif/lifetime-stats/")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["games_completed"], 1)
        self.assertEqual(body["total_points"], 10)
        self.assertEqual(body["silver_medals"], 1)

    def test_backfill_whatif_session_placements_from_history(self):
        User = get_user_model()
        user = User.objects.create_user(email="bf1@example.com", password="x")
        user2 = User.objects.create_user(email="bf2@example.com", password="x")
        user3 = User.objects.create_user(email="bf3@example.com", password="x")
        session = WhatIfSession.objects.create(short_code="BFAA", owner=user, status=WhatIfSession.Status.ENDED)
        WhatIfPlayer.objects.create(session=session, user=user, display_name="First", avatar_emoji="🐸", score=20)
        WhatIfPlayer.objects.create(session=session, user=user2, display_name="Second", avatar_emoji="🦆", score=15)
        WhatIfPlayer.objects.create(session=session, user=user3, display_name="Third", avatar_emoji="🐱", score=10)
        self.assertFalse(WhatIfSessionPlacement.objects.filter(session=session).exists())

        stats = backfill_whatif_session_placements_from_history()
        self.assertEqual(stats["sessions_processed"], 1)
        self.assertEqual(stats["placements_created"], 3)
        placements = {
            row["rank"]: row["user_id"]
            for row in WhatIfSessionPlacement.objects.filter(session=session).values("rank", "user_id")
        }
        self.assertEqual(placements[1], user.id)
        self.assertEqual(placements[2], user2.id)
        self.assertEqual(placements[3], user3.id)

        lifetime = full_lifetime_stats_for_user(user2.id)
        self.assertEqual(lifetime["silver_medals"], 1)
        self.assertEqual(lifetime["bronze_medals"], 0)

        stats_again = backfill_whatif_session_placements_from_history()
        self.assertEqual(stats_again["placements_created"], 0)
        self.assertEqual(WhatIfSessionPlacement.objects.filter(session=session).count(), 3)

    def test_gold_medal_count_requires_linked_winner_player(self):
        User = get_user_model()
        user = User.objects.create_user(email="sl6@example.com", password="x")
        other = User.objects.create_user(email="sl7@example.com", password="x")
        session = WhatIfSession.objects.create(short_code="SLMI", owner=user, status=WhatIfSession.Status.ENDED)
        guest_winner = WhatIfPlayer.objects.create(
            session=session, display_name="Guest", avatar_emoji="🐸", score=10
        )
        WhatIfGameResult.objects.create(
            session=session,
            winner_player=guest_winner,
            winner_user=user,
            winner_display_name="Guest",
        )
        self.assertEqual(gold_medal_count_for_user(user.id), 0)

        linked = WhatIfSession.objects.create(short_code="SLMJ", owner=user, status=WhatIfSession.Status.ENDED)
        linked_winner = WhatIfPlayer.objects.create(
            session=linked, user=user, display_name="Me", avatar_emoji="🦆", score=12
        )
        WhatIfGameResult.objects.create(
            session=linked,
            winner_player=linked_winner,
            winner_user=user,
            winner_display_name="Me",
        )
        self.assertEqual(gold_medal_count_for_user(user.id), 1)

