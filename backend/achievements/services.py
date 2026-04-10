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
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction

from closet.models import Item
from quotes.models import Quote

User = get_user_model()

SLUG_ARCHIVIST = "archivist"
SLUG_TOWN_CRIER = "town_crier"
SLUG_WHATIF_WIZ = "whatif_wiz"
SLUG_WHATIF_WARRIOR = "whatif_warrior"
SLUG_PONDCLICKER_TIER_1 = "pondclicker_tier_1_pond"
SLUG_SHARING_IS_CARING = "sharing_is_caring"
SLUG_SOMETHING_BORROWED = "something_borrowed"
SLUG_GOOD_AS_NEW = "good_as_new"
SLUG_THATS_AMORE = "thats_amore"
SLUG_TASTY_PLANS = "tasty_plans"

ARCHIVIST_MIN_QUOTES = 10
TOWN_CRIER_MIN_PUBLIC = 10
WHATIF_WIZ_MIN_PLAYERS = 3
WHATIF_WARRIOR_MIN_SESSIONS = 5
SHARING_IS_CARING_MIN_ITEMS = 5
TASTY_PLANS_MIN_FILLED_SLOTS = 14


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


def evaluate_pondclicker_achievements_for_user(user_id: int, state: dict) -> None:
    """
    Unlock Tier 1 pond when save includes all three Tier 1 marquee denizens.
    """
    if not isinstance(state, dict):
        return
    owned = state.get("owned_upgrades")
    if not isinstance(owned, dict):
        return
    required = ("pond_snails", "tadpoles", "water_fleas")
    for key in required:
        raw = owned.get(key)
        if not isinstance(raw, (int, float)) or raw < 1:
            return
    _try_unlock(user_id, SLUG_PONDCLICKER_TIER_1)


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
    from clicker.models import ClickerGameSave
    from whatif.models import WhatIfGameResult, WhatIfPlayer, WhatIfSession

    from meal.models import MealPlanInstance

    for uid in User.objects.values_list("pk", flat=True):
        evaluate_quote_achievements_for_user(uid)
        evaluate_closet_sharing_is_caring_for_user(uid)
        evaluate_meal_maestro_partner_for_user(uid)

    for row in ClickerGameSave.objects.iterator():
        evaluate_pondclicker_achievements_for_user(row.user_id, row.state or {})

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
