"""
Achievement evaluation.

Policy (aligned with planning doc):
- **Sticky unlocks** for count-based quote badges (Archivist, Town Crier): once a UserAchievement
  row exists, it is not removed if the user later deletes quotes or makes them private.
- **WhatIf Warrior**: session status ENDED, user has a WhatIfPlayer row with non-null `user_id`
  for that session. Count distinct ENDED sessions; unlock at >= 5. Guests (null user) never earn
  account achievements.
- **WhatIf Wiz**: session ended with a winner (WhatIfGameResult), winner has non-null `winner_user`,
  room had >= 3 WhatIfPlayer rows (seats, including paused). Unlock once for that user.
- **WhatIf Dece Proposer**: user proposed questions that staff approved; count approved non-deleted rows with
  `proposed_by_id`; unlock at >= 5. Evaluated when a proposal transitions to approved (no bulk backfill).
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from closet.models import Item
from quotes.models import Quote

User = get_user_model()

SLUG_ARCHIVIST = "archivist"
SLUG_TOWN_CRIER = "town_crier"
SLUG_WHATIF_WIZ = "whatif_wiz"
SLUG_WHATIF_WARRIOR = "whatif_warrior"
SLUG_WHATIF_DECE_PROPOSER = "whatif_dece_proposer"
SLUG_PONDCLICKER_TIER_1 = "pondclicker_tier_1_pond"
SLUG_PONDCLICKER_TIER_2 = "pondclicker_tier_2_pond"
SLUG_PONDCLICKER_TIER_3 = "pondclicker_tier_3_pond"
SLUG_PONDCLICKER_TIER_4 = "pondclicker_tier_4_pond"
SLUG_PONDCLICKER_TIER_5 = "pondclicker_tier_5_pond"
SLUG_PONDCLICKER_TIER_6 = "pondclicker_tier_6_pond"
SLUG_PONDCLICKER_TIER_7 = "pondclicker_tier_7_pond"
SLUG_PONDCLICKER_POND_PAWN = "pondclicker_pond_pawn"
SLUG_PONDCLICKER_TADPOLE_TRAVELER = "pondclicker_tadpole_traveler"
SLUG_PONDCLICKER_POND_PIONEER = "pondclicker_pond_pioneer"
SLUG_PONDCLICKER_LILY_PAD_LEAPER = "pondclicker_lily_pad_leaper"
SLUG_PONDCLICKER_WETLAND_WANDERER = "pondclicker_wetland_wanderer"
SLUG_PONDCLICKER_MARSH_WARDEN = "pondclicker_marsh_warden"
SLUG_PONDCLICKER_CURRENT_COMMANDER = "pondclicker_current_commander"
SLUG_PONDCLICKER_STILLWATER_STRATEGIST = "pondclicker_stillwater_strategist"
SLUG_PONDCLICKER_ECOSYSTEM_ARCHITECT = "pondclicker_ecosystem_architect"
SLUG_PONDCLICKER_POND_POTENTATE = "pondclicker_pond_potentate"

# Marquee denizen ids per tier (mirrors frontend `MARQUEE_IDS_BY_TIER` in clicker/catalog.ts).
PONDCLICKER_MARQUEE_BY_TIER: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        SLUG_PONDCLICKER_TIER_1,
        (
            "pond_snails",
            "tadpoles",
            "water_fleas",
            "dragonfly_nymph",
            "leeches",
        ),
    ),
    (
        SLUG_PONDCLICKER_TIER_2,
        ("crayfish", "minnows", "green_frogs", "water_striders", "diving_beetles"),
    ),
    (
        SLUG_PONDCLICKER_TIER_3,
        (
            "bluegill",
            "pumpkinseed_sunfish",
            "painted_turtles",
            "salamanders",
            "perch",
        ),
    ),
    (
        SLUG_PONDCLICKER_TIER_4,
        (
            "largemouth_bass",
            "softshell_turtle",
            "bullfrogs",
            "muskrats",
            "catfish",
        ),
    ),
    (
        SLUG_PONDCLICKER_TIER_5,
        (
            "northern_pike",
            "snapping_turtle",
            "mallard_ducks",
            "great_blue_herons",
            "canada_geese",
        ),
    ),
    (
        SLUG_PONDCLICKER_TIER_6,
        ("otters", "beavers", "bald_eagles", "bowfin", "mute_swans"),
    ),
    (
        SLUG_PONDCLICKER_TIER_7,
        (
            "white_tailed_deer",
            "fireflies",
            "brown_bats",
            "bumblebees",
            "water_snake",
            "fishing_spider",
            "american_mink",
            "belted_kingfisher",
            "monarch_butterfly",
            "raccoon",
        ),
    ),
)
PONDCLICKER_MILESTONE_ACHIEVEMENTS: tuple[tuple[str, int], ...] = (
    (SLUG_PONDCLICKER_POND_PAWN, 50),
    (SLUG_PONDCLICKER_TADPOLE_TRAVELER, 100),
    (SLUG_PONDCLICKER_POND_PIONEER, 150),
    (SLUG_PONDCLICKER_LILY_PAD_LEAPER, 200),
    (SLUG_PONDCLICKER_WETLAND_WANDERER, 250),
    (SLUG_PONDCLICKER_MARSH_WARDEN, 300),
    (SLUG_PONDCLICKER_CURRENT_COMMANDER, 350),
    (SLUG_PONDCLICKER_STILLWATER_STRATEGIST, 400),
    (SLUG_PONDCLICKER_ECOSYSTEM_ARCHITECT, 450),
    (SLUG_PONDCLICKER_POND_POTENTATE, 500),
)
SLUG_SHARING_IS_CARING = "sharing_is_caring"
SLUG_SOMETHING_BORROWED = "something_borrowed"
SLUG_GOOD_AS_NEW = "good_as_new"
SLUG_THATS_AMORE = "thats_amore"
SLUG_TASTY_PLANS = "tasty_plans"
SLUG_SMORGASBORD = "smorgasbord"
SLUG_I_CAN_SMELL_IT_FROM_HERE = "i_can_smell_it_from_here"
SLUG_MONTH_OF_MUSIC = "month_of_music"
SLUG_MUSIC_LOVER = "music_lover"
SLUG_MUSICALLY_MULTILOQUENT = "musically_multiloquent"
SLUG_SCHEDULE_COORDINATOR = "schedule_coordinator"
SLUG_FAMILIAL_ARBORIST = "familial_arborist"
SLUG_ESTATES_FARMHAND = "estates_farmhand"
SLUG_ESTATES_HIGHWAYMAN = "estates_highwayman"
SLUG_ESTATES_LOOKOUT = "estates_lookout"
SLUG_ESTATES_GATEKEEPER = "estates_gatekeeper"
SLUG_ESTATES_MONARCH = "estates_monarch"
SLUG_ESTATES_ROYAL = "estates_royal"
SLUG_ESTATES_NOBLE = "estates_noble"
SLUG_ESTATES_PEASANT = "estates_peasant"
SLUG_ESTATES_THRONED_YA = "estates_throned_ya"
SLUG_ESTATES_FARMED_YA = "estates_farmed_ya"
SLUG_PEER_INTO_THE_STARS = "peer_into_the_stars"
SLUG_WELCOME_TO_POND_ARBOR = "welcome_to_pond_arbor"
SLUG_GOALS_TRI_GOAL_ATHLON = "goals_tri_goal_athlon"
SLUG_GOALS_STREAK_WEEK = "goals_streak_week"
SLUG_GOALS_MARATHON_MONTH = "goals_marathon_month"
SLUG_GOALS_CHECKPOINT_CHARLIE = "goals_checkpoint_charlie"
SLUG_GOALS_LIFES_A_CHORE = "goals_lifes_a_chore"
SLUG_GOALS_ON_TARGET = "goals_on_target"
SLUG_RECOMMENDATIONS_TEN_TEN_NO_NOTES = "recommendations_ten_ten_no_notes"
SLUG_RECOMMENDATIONS_AND_ALSO = "recommendations_and_also"
SLUG_RECOMMENDATIONS_FIVE_STARS = "recommendations_five_stars"
SLUG_READS_GOOD = "reads_good"
SLUG_SCORENADO_GAME_PLAYER = "scorenado_game_player"
SLUG_SCORENADO_HAT_TRICK = "scorenado_hat_trick"
SLUG_SCORENADO_DROSSELMEYER = "scorenado_drosselmeyer"
SLUG_SCORENADO_SCOREKEEPER = "scorenado_scorekeeper"

ARCHIVIST_MIN_QUOTES = 10
FAMILIAL_ARBORIST_MIN_PEOPLE = 10
TOWN_CRIER_MIN_PUBLIC = 10
WHATIF_WIZ_MIN_PLAYERS = 3
WHATIF_WARRIOR_MIN_SESSIONS = 5
WHATIF_DECE_PROPOSER_MIN_APPROVED = 5
SHARING_IS_CARING_MIN_ITEMS = 5
TASTY_PLANS_MIN_FILLED_SLOTS = 14
SMORGASBORD_MIN_MEALS = 20
MONTH_OF_MUSIC_MIN_RESPONSES = 30
MUSIC_LOVER_MIN_HEARTS = 10
MUSICALLY_MULTILOQUENT_MIN_DISTINCT_FRIEND_POSTS = 10
ESTATES_ZONE_BADGE_MIN_WINS = 50
ESTATES_ROYAL_MIN_PVP_WINS = 5
ESTATES_NOBLE_MIN_GAMES = 10
ESTATES_PEASANT_MIN_SOLO_WINS = 5
GOALS_TRI_GOAL_ATHLON_MIN_ACTIVE = 3
GOALS_STREAK_WEEK_MIN_BEST = 7
GOALS_MARATHON_MONTH_MIN_BEST = 30
GOALS_CHECKPOINT_CHARLIE_MIN_COMPLETED = 10
GOALS_LIFES_A_CHORE_MIN_CHORES_SAME_DAY = 5
GOALS_ON_TARGET_MIN_COMPLETED_PROJECTS = 5
RECOMMENDATIONS_FIVE_STARS_MIN_RATINGS = 5
SCORENADO_HAT_TRICK_MIN_WINS = 3
SCORENADO_DROSSELMEYER_MIN_PUBLISHED = 3
SCORENADO_SCOREKEEPER_MIN_GAMES = 5


def _filled_meal_instance_slot_count(instance_id: int) -> int:
    from django.db.models import Count

    from meal.models import MealPlanInstanceSlot

    return (
        MealPlanInstanceSlot.objects.filter(instance_id=instance_id)
        .annotate(n=Count("slot_meals"))
        .filter(n__gte=1)
        .count()
    )


def _try_unlock(user_id: int, slug: str, *, context: dict | None = None) -> bool:
    from achievements.models import AchievementDefinition, UserAchievement

    defn = AchievementDefinition.objects.filter(slug=slug, is_active=True).first()
    if defn is None:
        return False
    with transaction.atomic():
        _, created = UserAchievement.objects.get_or_create(
            user_id=user_id,
            achievement=defn,
            defaults={"context": context or {}},
        )
    return created


def _pondclicker_marquee_tier_complete(owned: dict, upgrade_ids: tuple[str, ...]) -> bool:
    for key in upgrade_ids:
        raw = owned.get(key)
        if not isinstance(raw, (int, float)) or raw < 1:
            return False
    return True


def evaluate_pondclicker_achievements_for_user(user_id: int, state: dict) -> bool:
    """
    Unlock pondclicker tier badges when the save includes all marquee denizens
    for that tier (five for tiers 1–6, ten for tier 7). Idempotent via `_try_unlock`.
    Returns True if any new unlock was granted on this call.
    """
    if not isinstance(state, dict):
        return False
    owned = state.get("owned_upgrades")
    if not isinstance(owned, dict):
        return False
    any_new = False
    for slug, required in PONDCLICKER_MARQUEE_BY_TIER:
        if not _pondclicker_marquee_tier_complete(owned, required):
            continue
        if _try_unlock(user_id, slug):
            any_new = True
    return any_new


def _clicker2_milestone_count(state: dict) -> int:
    raw = state.get("milestones_reached")
    if not isinstance(raw, dict):
        return 0
    return sum(
        1 for v in raw.values() if isinstance(v, (int, float)) and v >= 0
    )


def evaluate_clicker2_achievements_for_user(user_id: int, state: dict) -> bool:
    """
    Unlock PondClicker Redux milestone-count badges. Idempotent via `_try_unlock`.
    Returns True if any new unlock was granted on this call.
    """
    if not isinstance(state, dict):
        return False
    count = _clicker2_milestone_count(state)
    any_new = False
    for slug, min_count in PONDCLICKER_MILESTONE_ACHIEVEMENTS:
        if count < min_count:
            continue
        if _try_unlock(user_id, slug):
            any_new = True
    return any_new


def evaluate_zodiac_peer_into_stars_for_user(user_id: int) -> None:
    """Unlock when the member has a staff-imported natal chart at Zodiackary."""
    from zodiac.friend_zodiac import friend_has_shareable_zodiac
    from zodiac.models import AstroProfile

    astro = AstroProfile.objects.filter(user_id=user_id).first()
    if not friend_has_shareable_zodiac(astro):
        return
    if not astro.natal_chart:
        return
    _try_unlock(user_id, SLUG_PEER_INTO_THE_STARS)


def evaluate_people_achievements_for_user(user_id: int) -> None:
    """Call after people create / update / delete; unlocks at 10 active people (sticky)."""
    from people.models import Person

    n = Person.objects.filter(owner_user_id=user_id, deleted_at__isnull=True).count()
    if n >= FAMILIAL_ARBORIST_MIN_PEOPLE:
        _try_unlock(user_id, SLUG_FAMILIAL_ARBORIST)


def evaluate_quote_achievements_for_user(user_id: int) -> None:
    """Call after quote create / owner PATCH / soft-delete."""
    user = User.objects.filter(pk=user_id).first()
    if user is None:
        return

    active = Quote.objects.filter(owner_id=user_id, deleted_at__isnull=True)
    if active.count() >= ARCHIVIST_MIN_QUOTES:
        _try_unlock(user_id, SLUG_ARCHIVIST)

    public_active = active.filter(visibility=Quote.Visibility.PUBLISHED)
    if public_active.count() >= TOWN_CRIER_MIN_PUBLIC:
        _try_unlock(user_id, SLUG_TOWN_CRIER)


def evaluate_closet_sharing_is_caring_for_user(user_id: int) -> None:
    active_owned_count = Item.objects.filter(
        owner_user_id=user_id,
        deleted_at__isnull=True,
    ).count()
    if active_owned_count >= SHARING_IS_CARING_MIN_ITEMS:
        _try_unlock(user_id, SLUG_SHARING_IS_CARING)


def evaluate_schedule_coordinator_for_user(user_id: int) -> None:
    """Unlock when the user has at least one active linked (non-manual) calendar source."""
    from calendars.models import CalendarSource

    has_linked = CalendarSource.objects.filter(
        owner_id=user_id,
        is_active=True,
        source_type__in=(
            CalendarSource.SourceType.ICAL,
            CalendarSource.SourceType.GOOGLE_OAUTH,
        ),
    ).exists()
    if has_linked:
        _try_unlock(user_id, SLUG_SCHEDULE_COORDINATOR)


def evaluate_closet_return_achievements_for_users(*, owner_user_id: int, borrower_user_id: int) -> None:
    _try_unlock(owner_user_id, SLUG_GOOD_AS_NEW)
    _try_unlock(borrower_user_id, SLUG_SOMETHING_BORROWED)


def evaluate_meal_maestro_partner_for_user(user_id: int) -> None:
    """Call after profile save when meal partner may have changed; unlocks both users when mutual."""
    from meal.partner import mutual_meal_pair

    user = User.objects.filter(pk=user_id).select_related("profile").first()
    if user is None or not mutual_meal_pair(user=user):
        return
    partner_id = user.profile.meal_crud_partner_id
    _try_unlock(user_id, SLUG_THATS_AMORE)
    if partner_id:
        _try_unlock(partner_id, SLUG_THATS_AMORE)


def evaluate_meal_maestro_tasty_plans_for_instance(*, instance_id: int) -> None:
    """Call after instance grid update or create-from-template; owner earns when enough slots have meals."""
    from meal.models import MealPlanInstance

    inst = MealPlanInstance.objects.filter(pk=instance_id).only("owner_user_id").first()
    if inst is None:
        return
    if _filled_meal_instance_slot_count(instance_id) < TASTY_PLANS_MIN_FILLED_SLOTS:
        return
    _try_unlock(
        inst.owner_user_id,
        SLUG_TASTY_PLANS,
        context={"instance_id": instance_id},
    )


def evaluate_meal_maestro_smorgasbord_for_user(user_id: int) -> None:
    """Call after creating a meal; unlocks when the user owns enough saved meals."""
    from meal.models import Meal

    if Meal.objects.filter(owner_user_id=user_id).count() >= SMORGASBORD_MIN_MEALS:
        _try_unlock(user_id, SLUG_SMORGASBORD)


def evaluate_welcome_to_pond_arbor_for_user(user_id: int) -> None:
    """Unlock when the user completes account onboarding."""
    _try_unlock(user_id, SLUG_WELCOME_TO_POND_ARBOR)


def evaluate_meal_maestro_friend_recipe_copy_for_user(user_id: int) -> None:
    """Unlock when the user saves a friend's published recipe (shared meal copy)."""
    _try_unlock(user_id, SLUG_I_CAN_SMELL_IT_FROM_HERE)


def evaluate_songaday_month_of_music_for_user(user_id: int) -> None:
    from songaday.models import SongResponse

    if SongResponse.objects.filter(user_id=user_id).count() >= MONTH_OF_MUSIC_MIN_RESPONSES:
        _try_unlock(user_id, SLUG_MONTH_OF_MUSIC)


def evaluate_songaday_music_lover_for_user(user_id: int) -> None:
    from friends.services import friend_ids_for_user
    from songaday.models import SongResponseHeart

    user = User.objects.filter(pk=user_id).first()
    if user is None:
        return
    friends = friend_ids_for_user(user=user)
    if not friends:
        return
    n = (
        SongResponseHeart.objects.filter(user_id=user_id, response__user_id__in=friends)
        .exclude(response__user_id=user_id)
        .count()
    )
    if n >= MUSIC_LOVER_MIN_HEARTS:
        _try_unlock(user_id, SLUG_MUSIC_LOVER)


def evaluate_songaday_musically_multiloquent_for_user(user_id: int) -> None:
    """
    Unlock when the user has commented on >= N distinct Song-a-Day posts owned by friends
    (not own posts). Multiple comments on the same post count once.
    """
    from django.contrib.contenttypes.models import ContentType

    from friend_comments.models import FriendComment
    from friends.services import friend_ids_for_user
    from songaday.models import SongResponse

    user = User.objects.filter(pk=user_id).first()
    if user is None:
        return
    friends = friend_ids_for_user(user=user)
    if not friends:
        return
    ct = ContentType.objects.get_for_model(SongResponse)
    qualifying_response_ids = SongResponse.objects.filter(user_id__in=friends).exclude(
        user_id=user_id
    ).values_list("pk", flat=True)
    n = (
        FriendComment.objects.filter(
            author_id=user_id,
            content_type=ct,
            object_id__in=qualifying_response_ids,
        )
        .values("object_id")
        .distinct()
        .count()
    )
    if n >= MUSICALLY_MULTILOQUENT_MIN_DISTINCT_FRIEND_POSTS:
        _try_unlock(user_id, SLUG_MUSICALLY_MULTILOQUENT)


def _count_ended_sessions_for_user(user_id: int) -> int:
    from whatif.models import WhatIfSession

    return (
        WhatIfSession.objects.filter(
            status=WhatIfSession.Status.ENDED,
            players__user_id=user_id,
        )
        .distinct()
        .count()
    )


def evaluate_whatif_warrior_for_user(user_id: int) -> None:
    if _count_ended_sessions_for_user(user_id) >= WHATIF_WARRIOR_MIN_SESSIONS:
        _try_unlock(user_id, SLUG_WHATIF_WARRIOR)


def evaluate_whatif_dece_proposer_for_user(user_id: int) -> None:
    """Unlock when the user has enough community proposals approved (non-deleted)."""
    from whatif.models import WhatIfQuestion

    n = WhatIfQuestion.objects.filter(
        proposed_by_id=user_id,
        review_status=WhatIfQuestion.ReviewStatus.APPROVED,
        deleted_at__isnull=True,
    ).count()
    if n >= WHATIF_DECE_PROPOSER_MIN_APPROVED:
        _try_unlock(user_id, SLUG_WHATIF_DECE_PROPOSER)


def _goals_max_streak_best_for_user(user_id: int) -> int:
    """Best consecutive period streak across the user's ongoing goals."""
    from datetime import timedelta

    from goals.models import CheckIn, Goal
    from goals.stats import compute_goal_stats
    from users.models import Profile

    profile = Profile.objects.filter(user_id=user_id).first()
    goals = Goal.objects.filter(
        owner_user_id=user_id,
        kind=Goal.Kind.CONTINUOUS,
    ).prefetch_related("checkpoints")
    if not goals:
        return 0
    since = timezone.now() - timedelta(days=400)
    goal_ids = [g.id for g in goals]
    rows = CheckIn.objects.filter(
        goal_id__in=goal_ids,
        owner_user_id=user_id,
        occurred_at__gte=since,
    ).values_list("goal_id", "occurred_at", "checkpoint_id")
    by_goal: dict = {}
    for gid, occurred_at, cp_id in rows:
        by_goal.setdefault(gid, []).append((occurred_at, cp_id))

    best = 0
    for goal in goals:
        occ = by_goal.get(goal.id, [])
        cp_times = [cp.completed_at for cp in goal.checkpoints.all() if cp.completed_at]
        stats = compute_goal_stats(goal, occ, cp_times, profile)
        best = max(best, stats.streak_best)
    return best


def _goals_max_chore_checkins_on_single_day(user_id: int) -> int:
    """Most chore check-ins on one local calendar day (user timezone)."""
    from collections import Counter
    from datetime import date

    from goals.models import CheckIn, Goal
    from goals.stats import _user_tz
    from users.models import Profile

    profile = Profile.objects.filter(user_id=user_id).first()
    tz = _user_tz(profile)
    rows = CheckIn.objects.filter(
        owner_user_id=user_id,
        goal__kind=Goal.Kind.CHORE,
    ).values_list("occurred_at", flat=True)
    counts: Counter[date] = Counter()
    for occurred_at in rows:
        counts[occurred_at.astimezone(tz).date()] += 1
    return max(counts.values()) if counts else 0


def evaluate_goals_achievements_for_user(user_id: int) -> None:
    """Goal-Getter badges (sticky unlocks via UserAchievement.get_or_create)."""
    from goals.models import Checkpoint, Goal

    active_count = Goal.objects.filter(
        owner_user_id=user_id,
        status=Goal.Status.ACTIVE,
    ).count()
    if active_count >= GOALS_TRI_GOAL_ATHLON_MIN_ACTIVE:
        _try_unlock(user_id, SLUG_GOALS_TRI_GOAL_ATHLON, context={"active_goals": active_count})

    max_streak = _goals_max_streak_best_for_user(user_id)
    if max_streak >= GOALS_STREAK_WEEK_MIN_BEST:
        _try_unlock(user_id, SLUG_GOALS_STREAK_WEEK, context={"streak_best": max_streak})
    if max_streak >= GOALS_MARATHON_MONTH_MIN_BEST:
        _try_unlock(user_id, SLUG_GOALS_MARATHON_MONTH, context={"streak_best": max_streak})

    completed_checkpoints = Checkpoint.objects.filter(
        goal__owner_user_id=user_id,
        completed_at__isnull=False,
    ).count()
    if completed_checkpoints >= GOALS_CHECKPOINT_CHARLIE_MIN_COMPLETED:
        _try_unlock(
            user_id,
            SLUG_GOALS_CHECKPOINT_CHARLIE,
            context={"completed_checkpoints": completed_checkpoints},
        )

    max_chores_day = _goals_max_chore_checkins_on_single_day(user_id)
    if max_chores_day >= GOALS_LIFES_A_CHORE_MIN_CHORES_SAME_DAY:
        _try_unlock(
            user_id,
            SLUG_GOALS_LIFES_A_CHORE,
            context={"max_chore_checkins_single_day": max_chores_day},
        )

    completed_projects = Goal.objects.filter(
        owner_user_id=user_id,
        kind=Goal.Kind.ONE_TIME,
        status=Goal.Status.COMPLETED,
    ).count()
    if completed_projects >= GOALS_ON_TARGET_MIN_COMPLETED_PROJECTS:
        _try_unlock(
            user_id,
            SLUG_GOALS_ON_TARGET,
            context={"completed_projects": completed_projects},
        )


def evaluate_reads_good_for_user(user_id: int, shelves: list | None) -> None:
    """Unlock when the user has at least one book on a Books community shelf."""
    from books.social import community_feed_has_books

    if community_feed_has_books(shelves or []):
        _try_unlock(user_id, SLUG_READS_GOOD)


def evaluate_recommendations_share_for_user(user_id: int) -> None:
    """Unlock when the user shares a recommendation via the add flow."""
    _try_unlock(user_id, SLUG_RECOMMENDATIONS_TEN_TEN_NO_NOTES)


def evaluate_recommendations_comment_on_other_for_user(
    user_id: int,
    *,
    entry_creator_id: int,
) -> None:
    if entry_creator_id != user_id:
        _try_unlock(user_id, SLUG_RECOMMENDATIONS_AND_ALSO)


def evaluate_recommendations_five_stars_for_user(user_id: int) -> None:
    from recommendations.services import active_reviews_qs

    review_count = active_reviews_qs().filter(reviewer_id=user_id).count()
    if review_count >= RECOMMENDATIONS_FIVE_STARS_MIN_RATINGS:
        _try_unlock(
            user_id,
            SLUG_RECOMMENDATIONS_FIVE_STARS,
            context={"review_count": review_count},
        )


def evaluate_recommendations_achievements_for_user(user_id: int) -> None:
    """Backfill helper for Recommendations badges."""
    from recommendations.models import Entry
    from recommendations.services import active_reviews_qs

    reviews = active_reviews_qs().filter(reviewer_id=user_id)
    if reviews.filter(entry__created_by_id=user_id).exists():
        _try_unlock(user_id, SLUG_RECOMMENDATIONS_TEN_TEN_NO_NOTES)
    elif Entry.objects.filter(created_by_id=user_id).exists():
        _try_unlock(user_id, SLUG_RECOMMENDATIONS_TEN_TEN_NO_NOTES)
    if reviews.exclude(entry__created_by_id=user_id).exists():
        _try_unlock(user_id, SLUG_RECOMMENDATIONS_AND_ALSO)
    evaluate_recommendations_five_stars_for_user(user_id)


def _scorenado_user_accepted_invite_on_seat(player, user_id: int) -> bool:
    from scorenado.models import GamePlayer

    return (
        player.claimed_user_id == user_id
        and player.invited_user_id == user_id
        and player.invite_status == GamePlayer.INVITE_ACCEPTED
    )


def _scorenado_count_finalized_invite_acceptances(user_id: int) -> int:
    from scorenado.models import GamePlayer

    return GamePlayer.objects.filter(
        claimed_user_id=user_id,
        invited_user_id=user_id,
        invite_status=GamePlayer.INVITE_ACCEPTED,
        game__is_finalized=True,
    ).count()


def _scorenado_count_finalized_invite_wins(user_id: int) -> int:
    from scorenado.models import Game, GamePlayer
    from scorenado.services import player_totals_from_score_rows, winner_player_ids

    wins = 0
    game_ids = (
        GamePlayer.objects.filter(
            claimed_user_id=user_id,
            invited_user_id=user_id,
            invite_status=GamePlayer.INVITE_ACCEPTED,
            game__is_finalized=True,
        )
        .values_list("game_id", flat=True)
        .distinct()
    )
    for game in Game.objects.filter(pk__in=game_ids).prefetch_related("players", "categories"):
        players = list(game.players.all())
        if not any(_scorenado_user_accepted_invite_on_seat(p, user_id) for p in players):
            continue
        categories = list(game.categories.all())
        totals = player_totals_from_score_rows(game, categories=categories)
        winner_ids = winner_player_ids(game, players=players, totals=totals)
        for pid in winner_ids:
            player = next((p for p in players if str(p.id) == pid), None)
            if player and player.claimed_user_id == user_id:
                wins += 1
                break
    return wins


def _scorenado_count_published_templates(user_id: int) -> int:
    from scorenado.models import ScoreboardTemplate

    return ScoreboardTemplate.objects.filter(
        owner_user_id=user_id,
        is_published=True,
    ).count()


def _scorenado_count_finalized_games_with_friends(user_id: int) -> int:
    from django.db.models import Q

    from scorenado.models import Game

    games = (
        Game.objects.filter(is_finalized=True)
        .filter(Q(owner_user_id=user_id) | Q(players__claimed_user_id=user_id))
        .distinct()
        .prefetch_related("players")
    )
    count = 0
    for game in games:
        players = list(game.players.all())
        participated = game.owner_user_id == user_id or any(
            p.claimed_user_id == user_id for p in players
        )
        if not participated:
            continue
        if not any(
            p.claimed_user_id is not None and p.claimed_user_id != user_id for p in players
        ):
            continue
        count += 1
    return count


def evaluate_scorenado_achievements_for_user(user_id: int) -> None:
    """Scorenado badges (sticky unlocks). Invite/wins require finalized games."""
    invite_acceptances = _scorenado_count_finalized_invite_acceptances(user_id)
    if invite_acceptances >= 1:
        _try_unlock(
            user_id,
            SLUG_SCORENADO_GAME_PLAYER,
            context={"finalized_invite_acceptances": invite_acceptances},
        )

    invite_wins = _scorenado_count_finalized_invite_wins(user_id)
    if invite_wins >= SCORENADO_HAT_TRICK_MIN_WINS:
        _try_unlock(
            user_id,
            SLUG_SCORENADO_HAT_TRICK,
            context={"finalized_invite_wins": invite_wins},
        )

    published_templates = _scorenado_count_published_templates(user_id)
    if published_templates >= SCORENADO_DROSSELMEYER_MIN_PUBLISHED:
        _try_unlock(
            user_id,
            SLUG_SCORENADO_DROSSELMEYER,
            context={"published_templates": published_templates},
        )

    friend_games = _scorenado_count_finalized_games_with_friends(user_id)
    if friend_games >= SCORENADO_SCOREKEEPER_MIN_GAMES:
        _try_unlock(
            user_id,
            SLUG_SCORENADO_SCOREKEEPER,
            context={"finalized_games_with_friends": friend_games},
        )


def evaluate_estates_achievements_for_user(user_id: int) -> None:
    from estates.models import EstatesUserStats

    stats = EstatesUserStats.objects.filter(user_id=user_id).first()
    if stats is None:
        return
    if stats.zone_farm_wins >= ESTATES_ZONE_BADGE_MIN_WINS:
        _try_unlock(user_id, SLUG_ESTATES_FARMHAND)
    if stats.zone_road_wins >= ESTATES_ZONE_BADGE_MIN_WINS:
        _try_unlock(user_id, SLUG_ESTATES_HIGHWAYMAN)
    if stats.zone_tower_wins >= ESTATES_ZONE_BADGE_MIN_WINS:
        _try_unlock(user_id, SLUG_ESTATES_LOOKOUT)
    if stats.zone_gate_wins >= ESTATES_ZONE_BADGE_MIN_WINS:
        _try_unlock(user_id, SLUG_ESTATES_GATEKEEPER)
    if stats.zone_throne_wins >= ESTATES_ZONE_BADGE_MIN_WINS:
        _try_unlock(user_id, SLUG_ESTATES_MONARCH)
    if stats.pvp_wins >= ESTATES_ROYAL_MIN_PVP_WINS:
        _try_unlock(user_id, SLUG_ESTATES_ROYAL)
    if stats.games_completed >= ESTATES_NOBLE_MIN_GAMES:
        _try_unlock(user_id, SLUG_ESTATES_NOBLE)
    if stats.solo_wins >= ESTATES_PEASANT_MIN_SOLO_WINS:
        _try_unlock(user_id, SLUG_ESTATES_PEASANT)


def evaluate_estates_stunt_zone_win_achievements(
    *,
    game,
    user_id: int,
    zone_name: str,
    winning_card: dict | None,
) -> None:
    """One-shot PvP achievements for winning Throne or Farm with a base rank-1 card."""
    from estates.bot_user import is_computer_user
    from estates.game_setup import is_base_rank_one_card

    if getattr(game, "is_solo", False):
        return
    user = User.objects.filter(pk=user_id).first()
    if user is None or is_computer_user(user):
        return
    if winning_card is None or not is_base_rank_one_card(winning_card):
        return
    if zone_name == "throne":
        _try_unlock(user_id, SLUG_ESTATES_THRONED_YA)
    elif zone_name == "farm":
        _try_unlock(user_id, SLUG_ESTATES_FARMED_YA)


def evaluate_after_whatif_session_ended(session_id: int) -> None:
    """
    Call whenever a session transitions to ENDED (winner path or no_more_questions).
    Warrior: re-check every linked participant. Wiz: only when a game result with a logged-in winner exists.
    """
    from whatif.models import WhatIfGameResult, WhatIfPlayer, WhatIfSession

    session = WhatIfSession.objects.filter(pk=session_id).first()
    if session is None or session.status != WhatIfSession.Status.ENDED:
        return

    player_user_ids = list(
        WhatIfPlayer.objects.filter(session_id=session_id, user_id__isnull=False)
        .values_list("user_id", flat=True)
        .distinct()
    )
    for uid in player_user_ids:
        evaluate_whatif_warrior_for_user(uid)

    result = WhatIfGameResult.objects.filter(session_id=session_id).select_related("winner_user").first()
    if result is None or result.winner_user_id is None:
        return

    seat_count = WhatIfPlayer.objects.filter(session_id=session_id).count()
    if seat_count < WHATIF_WIZ_MIN_PLAYERS:
        return

    _try_unlock(
        result.winner_user_id,
        SLUG_WHATIF_WIZ,
        context={"session_id": session_id},
    )


def achievement_rows_for_user(
    user,
    *,
    public_only: bool,
    hide_user_hidden_from_friends: bool = False,
):
    from django.db.models import Q

    from achievements.models import UserAchievement

    qs = (
        UserAchievement.objects.filter(user=user)
        .select_related("achievement")
        .order_by("-unlocked_at", "achievement__slug")
    )
    if public_only:
        qs = qs.filter(achievement__show_on_public_profile=True)
    if hide_user_hidden_from_friends:
        qs = qs.filter(Q(visible_to_friends__isnull=True) | Q(visible_to_friends=True))

    return list(qs)


def backfill_all_achievements() -> None:
    """Management command: grant unlocks for users who already meet rules (post-deploy)."""
    from clicker.models import Clicker2GameSave, ClickerGameSave
    from whatif.models import WhatIfGameResult, WhatIfPlayer, WhatIfSession

    from meal.models import MealPlanInstance

    from calendars.models import CalendarSource

    for uid in User.objects.values_list("pk", flat=True):
        evaluate_quote_achievements_for_user(uid)
        evaluate_closet_sharing_is_caring_for_user(uid)
        evaluate_meal_maestro_partner_for_user(uid)
        evaluate_meal_maestro_smorgasbord_for_user(uid)
        evaluate_songaday_month_of_music_for_user(uid)
        evaluate_songaday_music_lover_for_user(uid)
        evaluate_songaday_musically_multiloquent_for_user(uid)
        evaluate_zodiac_peer_into_stars_for_user(uid)
        evaluate_goals_achievements_for_user(uid)
        evaluate_recommendations_achievements_for_user(uid)
        evaluate_scorenado_achievements_for_user(uid)

    for row in ClickerGameSave.objects.iterator():
        evaluate_pondclicker_achievements_for_user(row.user_id, row.state or {})

    for row in Clicker2GameSave.objects.iterator():
        evaluate_clicker2_achievements_for_user(row.user_id, row.state or {})

    for uid in (
        User.objects.filter(whatif_players__session__status=WhatIfSession.Status.ENDED)
        .distinct()
        .values_list("pk", flat=True)
    ):
        evaluate_whatif_warrior_for_user(uid)

    for result in WhatIfGameResult.objects.exclude(winner_user_id__isnull=True).iterator():
        if (
            WhatIfPlayer.objects.filter(session_id=result.session_id).count()
            >= WHATIF_WIZ_MIN_PLAYERS
        ):
            _try_unlock(
                result.winner_user_id,
                SLUG_WHATIF_WIZ,
                context={"session_id": result.session_id},
            )

    for inst in MealPlanInstance.objects.iterator():
        if _filled_meal_instance_slot_count(inst.pk) >= TASTY_PLANS_MIN_FILLED_SLOTS:
            _try_unlock(
                inst.owner_user_id,
                SLUG_TASTY_PLANS,
                context={"instance_id": inst.pk},
            )

    for uid in (
        CalendarSource.objects.filter(
            is_active=True,
            source_type__in=(
                CalendarSource.SourceType.ICAL,
                CalendarSource.SourceType.GOOGLE_OAUTH,
            ),
        )
        .values_list("owner_id", flat=True)
        .distinct()
    ):
        evaluate_schedule_coordinator_for_user(uid)

    from estates.stats import backfill_estates_match_stats_from_history

    backfill_estates_match_stats_from_history()


def achievement_definitions_catalog_payload() -> list[dict]:
    """All active achievement definitions, ordered like the catalog (for staff reference).

    Shape matches :func:`achievements_payload_for_user` items except `unlocked_at` is a placeholder
    and `visible_to_friends` is omitted; clients that render friend-style cards should hide the
    earned date for this payload.
    """
    from achievements.models import AchievementDefinition

    rows: list[dict] = []
    for d in AchievementDefinition.objects.filter(is_active=True).order_by("order", "slug"):
        rows.append(
            {
                "slug": d.slug,
                "title": d.title,
                "description": d.description or "",
                "category": d.category or "",
                "unlocked_at": "1970-01-01T00:00:00Z",
                "display_group": d.display_group or "",
                "display_group_order": d.display_group_order,
            }
        )
    return rows


def achievements_payload_for_user(
    user,
    *,
    public_only: bool,
    hide_user_hidden_from_friends: bool = False,
) -> list[dict]:
    rows = achievement_rows_for_user(
        user,
        public_only=public_only,
        hide_user_hidden_from_friends=hide_user_hidden_from_friends,
    )
    out = []
    for ua in rows:
        d = ua.achievement
        out.append(
            {
                "slug": d.slug,
                "title": d.title,
                "description": d.description,
                "category": d.category,
                "unlocked_at": ua.unlocked_at,
                "display_group": d.display_group,
                "display_group_order": d.display_group_order,
                "visible_to_friends": ua.visible_to_friends,
            }
        )
    return out


MAX_ACHIEVEMENT_PEER_SLUGS = 64
MAX_ACHIEVEMENT_PEERS_PER_SLUG = 24


def viewer_can_view_user_public_achievement_list(*, viewer, profile_user) -> bool:
    """Same visibility gate as ``achievements.views._achievements_for_viewer`` before building payload."""
    from friends.services import are_friends

    from users.models import Profile

    is_owner = bool(
        viewer
        and getattr(viewer, "is_authenticated", False)
        and viewer.id == profile_user.id
    )
    if is_owner:
        return True
    viewer_approved = bool(
        viewer
        and getattr(viewer, "is_authenticated", False)
        and getattr(viewer, "account_status", None) == User.AccountStatus.APPROVED
    )
    if not viewer_approved:
        return False
    is_friend = bool(are_friends(user_a=viewer, user_b=profile_user))
    owner_profile = getattr(profile_user, "profile", None)
    publish_vis = (
        getattr(owner_profile, "social_publish_visibility", None)
        or Profile.SocialPublishVisibility.ALL_APPROVED
    )
    return publish_vis == Profile.SocialPublishVisibility.ALL_APPROVED or (
        publish_vis == Profile.SocialPublishVisibility.FRIENDS_ONLY and is_friend
    )


def _normalize_peer_slugs(slugs: list) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in slugs:
        if not isinstance(raw, str):
            continue
        s = raw.strip()
        if not s:
            continue
        if len(s) > 64:
            s = s[:64]
        if s in seen:
            continue
        seen.add(s)
        out.append(s)
        if len(out) >= MAX_ACHIEVEMENT_PEER_SLUGS:
            break
    return out


def _user_peer_row(user) -> dict:
    from users.avatar_url import profile_avatar_url
    from users.models import Profile

    profile = getattr(user, "profile", None)
    if profile is None:
        profile, _ = Profile.objects.get_or_create(user=user, defaults={"display_name": ""})
    nickname = (profile.display_name or user.email.split("@")[0]).strip()
    return {
        "id": user.id,
        "nickname": nickname,
        "avatar_url": profile_avatar_url(profile),
    }


def achievement_peers_by_slug_for_viewer_candidates(
    *,
    viewer,
    slugs: list,
    candidate_user_ids: set[int],
) -> dict[str, list[dict]]:
    normalized = _normalize_peer_slugs(slugs if isinstance(slugs, list) else [])
    if not normalized:
        return {}

    if not candidate_user_ids:
        return {s: [] for s in normalized}

    users = list(User.objects.filter(pk__in=candidate_user_ids).select_related("profile"))
    allowed_ids = [
        u.id
        for u in users
        if viewer_can_view_user_public_achievement_list(viewer=viewer, profile_user=u)
    ]
    if not allowed_ids:
        return {s: [] for s in normalized}

    from django.db.models import Q

    from achievements.models import UserAchievement

    qs = (
        UserAchievement.objects.filter(
            user_id__in=allowed_ids,
            achievement__slug__in=normalized,
            achievement__show_on_public_profile=True,
        )
        .filter(Q(visible_to_friends__isnull=True) | Q(visible_to_friends=True))
        .select_related("user", "user__profile", "achievement")
        .order_by("-unlocked_at", "user_id")
    )

    per_slug_counts: dict[str, int] = {s: 0 for s in normalized}
    peers_by_slug: dict[str, list[dict]] = {s: [] for s in normalized}

    for ua in qs:
        slug = ua.achievement.slug
        if slug not in peers_by_slug:
            continue
        if per_slug_counts[slug] >= MAX_ACHIEVEMENT_PEERS_PER_SLUG:
            continue
        peers_by_slug[slug].append(_user_peer_row(ua.user))
        per_slug_counts[slug] += 1

    return peers_by_slug


def achievement_peers_for_my_friends(*, viewer, slugs: list) -> dict[str, list[dict]]:
    from friends.services import friend_ids_for_user

    ids = friend_ids_for_user(user=viewer)
    ids.discard(viewer.id)
    return achievement_peers_by_slug_for_viewer_candidates(
        viewer=viewer,
        slugs=slugs,
        candidate_user_ids=ids,
    )


def achievement_peers_for_subject_friends(*, viewer, subject, slugs: list) -> dict[str, list[dict]]:
    from friends.services import are_friends, friends_queryset_for_user

    if not are_friends(user_a=viewer, user_b=subject):
        raise ValueError("not_friends")

    candidate_ids = set(friends_queryset_for_user(user=subject).values_list("pk", flat=True))
    candidate_ids.discard(viewer.pk)
    candidate_ids.discard(subject.pk)
    return achievement_peers_by_slug_for_viewer_candidates(
        viewer=viewer,
        slugs=slugs,
        candidate_user_ids=candidate_ids,
    )


def _trophy_case_sort_key(
    *,
    earner_count: int,
    viewer_has: bool,
    catalog_order: int,
    slug: str,
) -> tuple:
    if earner_count == 1 and viewer_has:
        tier = 0
    elif earner_count == 1 and not viewer_has:
        tier = 1
    else:
        tier = 2
    count_key = 0 if tier < 2 else earner_count
    return (tier, count_key, catalog_order, slug)


def achievement_trophy_case_payload(viewer) -> dict:
    """Hall of Fame: full public catalog with earners in the viewer's visible population."""
    from collections import defaultdict

    from django.db.models import Q

    from achievements.models import AchievementDefinition, UserAchievement
    from users.social_privacy import visible_user_ids_for_achievement_surfaces

    population_ids = visible_user_ids_for_achievement_surfaces(viewer=viewer)
    viewer_id = int(viewer.id)

    definitions = list(
        AchievementDefinition.objects.filter(
            is_active=True,
            show_on_public_profile=True,
        ).order_by("order", "slug")
    )

    earners_by_slug: dict[str, list[dict]] = defaultdict(list)
    earner_counts: dict[str, int] = defaultdict(int)

    if population_ids:
        qs = (
            UserAchievement.objects.filter(
                user_id__in=population_ids,
                achievement__show_on_public_profile=True,
            )
            .filter(
                Q(user_id=viewer_id)
                | Q(visible_to_friends__isnull=True)
                | Q(visible_to_friends=True)
            )
            .select_related("user", "user__profile", "achievement")
            .order_by("-unlocked_at", "user_id")
        )

        for ua in qs:
            slug = ua.achievement.slug
            earner_counts[slug] += 1
            if len(earners_by_slug[slug]) < MAX_ACHIEVEMENT_PEERS_PER_SLUG:
                row = _user_peer_row(ua.user)
                row["unlocked_at"] = ua.unlocked_at.isoformat()
                earners_by_slug[slug].append(row)

    rows: list[dict] = []
    for defn in definitions:
        slug = defn.slug
        count = earner_counts.get(slug, 0)
        is_earned = count > 0
        row = {
            "slug": slug,
            "category": defn.category or "",
            "display_group": defn.display_group or "",
            "display_group_order": defn.display_group_order,
            "catalog_order": defn.order,
            "is_earned": is_earned,
            "earner_count": count,
            "earners": earners_by_slug.get(slug, []),
        }
        row["title"] = defn.title
        row["description"] = (defn.description or "") if is_earned else ""
        rows.append(row)

    return {"population_count": len(population_ids), "rows": rows}
