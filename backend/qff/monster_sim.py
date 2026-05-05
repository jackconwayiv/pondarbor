"""Lazy monster spawn, pursuit, and combat round simulation for QFF."""

from __future__ import annotations

import logging
import random
import time
from datetime import timedelta

from django.conf import settings
from django.db import connection, transaction
from django.db.models import Exists, Min, OuterRef, Q
from django.utils import timezone

from qff.combat_math import (
    hero_attacker_stats,
    hero_defender_stats,
    hero_unlit_dark_area_for_combat,
    monster_attacker_stats,
    monster_defender_stats,
    resolve_physical_strike,
)
from qff.constants import (
    COMBAT_ROUND_SECONDS,
    GUTS_EQUIPMENT_KEEP_GUTS_DIVISOR,
    GUTS_EQUIPMENT_KEEP_MAX_PCT,
    MONSTER_SENSE_ADJACENT_DC,
    PURSUIT_STEP_SECONDS,
)
from qff.game_helpers import (
    encumbrance_excess,
    encumbrance_notice_if_hindered,
    modified_stats,
    presence_threshold,
    roll_d100,
)
from qff.models import (
    Character,
    CharacterQuestProgress,
    Item,
    ItemInstance,
    MonsterInstance,
    MonsterTemplate,
    QuestTransition,
    Room,
    RoomBroadcast,
    RoomExit,
    RoomGoldPile,
)
from qff.quest_engine import character_carries_item_template, character_item_template_quantity
from qff.realtime import notify_qff_rooms
from qff.realm_presence import broadcast_realm_depart

logger = logging.getLogger(__name__)

# Serialize lazy sim across concurrent requests (Postgres advisory lock).
QFF_LAZY_SIM_LOCK_KEY = 0x5146465F53494D00


def add_gold_to_room_floor(room_id: int, amount: int) -> None:
    """Add gold to the room floor, merging into existing piles and clearing labels."""
    if amount <= 0:
        return
    with transaction.atomic():
        piles = list(
            RoomGoldPile.objects.filter(room_id=room_id).select_for_update().order_by("id")
        )
        if not piles:
            RoomGoldPile.objects.create(room_id=room_id, amount_remaining=amount, label="")
            return
        keep = piles[0]
        total = int(keep.amount_remaining) + amount
        for p in piles[1:]:
            total += int(p.amount_remaining)
            p.delete()
        keep.amount_remaining = total
        keep.label = ""
        keep.save(update_fields=["amount_remaining", "label"])


_CHARACTER_COMBAT_SELECT = (
    "current_room",
    "current_room__area",
    "head_item__item",
    "main_hand_item__item",
    "off_hand_item__item",
    "chest_item__item",
    "feet_item__item",
    "ring_item__item",
    "amulet_item__item",
)


def _character_for_combat(pk: int) -> Character | None:
    return (
        Character.objects.select_related(*_CHARACTER_COMBAT_SELECT)
        .filter(pk=pk, is_dead=False)
        .first()
    )


def _narrate_monster_engages_hero(
    monster: MonsterInstance, room_id: int, hero_pk: int
) -> None:
    """Engagement counts as wind-up: broadcast and start the strike timer (via caller)."""
    mname = monster.template.name
    _narrate(
        room_id,
        f"The {mname} prepares to strike!",
        target_character_id=hero_pk,
    )
    hc = Character.objects.filter(pk=hero_pk).first()
    hn = hc.name if hc else "someone"
    for h in _heroes_in_room(room_id):
        if h.pk != hero_pk:
            _narrate(
                room_id,
                f"The {mname} prepares to strike at {hn}!",
                target_character_id=h.pk,
            )


def _narrate(
    room_id: int,
    text: str,
    *,
    target_character_id: int | None = None,
    speaker_id: int | None = None,
    log_tone: str = "",
) -> None:
    t = (text or "").strip()[:500]
    if not t:
        return
    tone = (log_tone or "").strip()[:16]
    RoomBroadcast.objects.create(
        room_id=room_id,
        speaker_id=speaker_id,
        target_character_id=target_character_id,
        text=t,
        log_tone=tone,
        scope=RoomBroadcast.Scope.ROOM,
    )


def _exit_direction_label(from_room_id: int, to_room_id: int) -> str:
    ex = RoomExit.objects.filter(from_room_id=from_room_id, to_room_id=to_room_id).first()
    if ex:
        return ex.get_direction_display().lower()
    return "onward"


def _initiative_roll_hero(char: Character) -> int:
    return roll_d100() + int(char.moves)


def _initiative_roll_monster(inst: MonsterInstance) -> int:
    return roll_d100() + int(inst.template.moves or 0)


def _heroes_in_room(room_id: int) -> list[Character]:
    th = presence_threshold()
    return list(
        Character.objects.filter(
            current_room_id=room_id,
            last_activity_at__gte=th,
            is_dead=False,
        ).order_by("id")
    )


def _pick_engagement_target(room_id: int, exclude_pk: int | None = None) -> Character | None:
    heroes = _heroes_in_room(room_id)
    if exclude_pk is not None:
        heroes = [h for h in heroes if h.pk != exclude_pk]
    if not heroes:
        return None
    weights = [max(1, 100 - 3 * int(h.rizz)) for h in heroes]
    total = sum(weights)
    r = random.uniform(0, total)
    acc = 0.0
    for h, w in zip(heroes, weights, strict=True):
        acc += w
        if r <= acc:
            return h
    return heroes[-1]


def _normalize_monster_engagement_to_room_heroes(
    monster: MonsterInstance, room_id: int, heroes: list[Character]
) -> None:
    """With one active hero in the room, monster always aggros them. With several, retarget if the
    engaged hero is no longer present (rizz-weighted pick). No narration."""
    if not heroes:
        return
    hero_ids = {h.pk for h in heroes}
    update_fields: list[str] = []
    if len(heroes) == 1:
        sole = heroes[0]
        if monster.engaged_character_id != sole.pk:
            monster.engaged_character_id = sole.pk
            update_fields.append("engaged_character")
        if monster.pursuit_target_character_id != sole.pk:
            monster.pursuit_target_character_id = sole.pk
            update_fields.append("pursuit_target_character")
    elif monster.engaged_character_id and monster.engaged_character_id not in hero_ids:
        new_t = _pick_engagement_target(room_id)
        if new_t:
            monster.engaged_character_id = new_t.pk
            monster.pursuit_target_character_id = new_t.pk
            update_fields.extend(["engaged_character", "pursuit_target_character"])
    if update_fields:
        monster.save(update_fields=[*update_fields, "updated_at"])


def _reevaluate_monster_engagement_in_room(monster: MonsterInstance, room_id: int) -> None:
    """Rizz-weighted retarget among present heroes after a strike (or similar).

    If ``engaged_character`` changes, gaze lines go to each hero in the room.
    Never updates ``next_action_at`` or ``monster_strike_pending``.
    """
    heroes = _heroes_in_room(room_id)
    if not heroes:
        return
    hero_ids = {h.pk for h in heroes}
    old_pk = monster.engaged_character_id
    if len(heroes) == 1:
        new_t = heroes[0]
    else:
        new_t = _pick_engagement_target(room_id)
    if not new_t:
        return
    if old_pk and old_pk in hero_ids and new_t.pk == old_pk:
        return
    monster.engaged_character_id = new_t.pk
    monster.pursuit_target_character_id = new_t.pk
    monster.save(
        update_fields=["engaged_character", "pursuit_target_character", "updated_at"]
    )
    mname = monster.template.name
    for h in heroes:
        if h.pk == new_t.pk:
            _narrate(
                room_id,
                f"The {mname} turns its gaze to you!",
                target_character_id=h.pk,
            )
        else:
            _narrate(
                room_id,
                f"The {mname} turns its gaze to {new_t.name}!",
                target_character_id=h.pk,
            )


def _finish_monster_strike_turn(monster_pk: int, room_id: int, now) -> None:
    """Re-pick engagement after resolving a strike; arm if cadence still needs it."""
    m = MonsterInstance.objects.select_related("template").get(pk=monster_pk)
    _reevaluate_monster_engagement_in_room(m, room_id)
    m2 = MonsterInstance.objects.select_related("template").get(pk=monster_pk)
    try_bind_monster_to_room_heroes(m2, room_id, now)


def _arm_monster_try_bind(monster_pk: int, room_id: int, now) -> None:
    m = MonsterInstance.objects.select_related("template").get(pk=monster_pk)
    try_bind_monster_to_room_heroes(m, room_id, now)


def flush_bind_monsters_with_room_heroes(now) -> set[int]:
    """Bind and arm any monster sharing a room with active heroes (no move required)."""
    affected: set[int] = set()
    th = presence_threshold()
    room_ids = sorted(
        Character.objects.filter(
            last_activity_at__gte=th,
            is_dead=False,
        )
        .values_list("current_room_id", flat=True)
        .distinct()
    )
    for room_id in room_ids:
        if not room_id:
            continue
        if not MonsterInstance.objects.filter(current_room_id=room_id).exists():
            continue
        heroes = _heroes_in_room(room_id)
        if not heroes:
            continue
        for m in MonsterInstance.objects.filter(current_room_id=room_id).select_related(
            "template"
        ):
            # Bind + wind-up narration before single-hero normalization. Otherwise a lair spawn
            # (armed timer, no engagement) gets silent engagement from normalize, and try_bind
            # treats engaged+armed as a no-op — skipping "prepares to strike!".
            _arm_monster_try_bind(m.pk, room_id, now)
            m.refresh_from_db()
            _normalize_monster_engagement_to_room_heroes(m, room_id, heroes)
        affected.add(room_id)
    return affected


def _retarget_or_pursue_leaver(
    monster: MonsterInstance,
    leaver: Character,
    old_room_id: int,
    dest_room_id: int,
) -> None:
    heroes_here = [h for h in _heroes_in_room(old_room_id) if h.pk != leaver.pk]
    if heroes_here and random.random() < 0.5:
        new_t = _pick_engagement_target(old_room_id)
        if new_t:
            monster.engaged_character_id = new_t.pk
            monster.pursuit_target_character_id = new_t.pk
            monster.save(
                update_fields=["engaged_character", "pursuit_target_character", "updated_at"]
            )
            mname = monster.template.name
            observers = _heroes_in_room(old_room_id)
            for h in observers:
                if h.pk == new_t.pk:
                    _narrate(
                        old_room_id,
                        f"The {mname} turns its gaze to you!",
                        target_character_id=h.pk,
                    )
                else:
                    _narrate(
                        old_room_id,
                        f"The {mname} turns its gaze to {new_t.name}!",
                        target_character_id=h.pk,
                    )
            return
    dest = Room.objects.filter(pk=dest_room_id).first()
    mname = monster.template.name
    dir_label = _exit_direction_label(old_room_id, dest_room_id)
    if dest and dest.is_safe:
        # Hero reached safety: drop engagement and pursuit (no pathing through safe rooms).
        monster.engaged_character_id = None
        monster.pursuit_target_character_id = None
        monster.pursuit_path = []
        monster.next_pursuit_at = None
        monster.monster_strike_pending = False
        _narrate(
            old_room_id,
            f"The {mname} snarls but does not follow {leaver.name} toward the {dir_label}.",
        )
        return
    monster.engaged_character_id = leaver.pk
    monster.pursuit_target_character_id = leaver.pk
    _narrate(
        old_room_id,
        f"{mname} pursues {leaver.name} toward the {dir_label}.",
    )


def _retarget_on_monster_enter_room(monster: MonsterInstance, room_id: int) -> None:
    heroes = _heroes_in_room(room_id)
    if not heroes:
        return
    hero_ids = {h.pk for h in heroes}
    if monster.engaged_character_id in hero_ids:
        _normalize_monster_engagement_to_room_heroes(monster, room_id, heroes)
        return
    if monster.pursuit_target_character_id in hero_ids:
        monster.engaged_character_id = monster.pursuit_target_character_id
        monster.save(update_fields=["engaged_character", "updated_at"])
        _normalize_monster_engagement_to_room_heroes(monster, room_id, heroes)
        return
    if len(heroes) == 1:
        new_t = heroes[0]
    else:
        new_t = _pick_engagement_target(room_id)
    if not new_t:
        return
    mname = monster.template.name
    _narrate(
        room_id,
        f"{mname} turns its attention to you!",
        target_character_id=new_t.pk,
    )
    for h in heroes:
        if h.pk != new_t.pk:
            _narrate(
                room_id,
                f"{mname} turns its attention toward {new_t.name}!",
                target_character_id=h.pk,
            )
    monster.engaged_character_id = new_t.pk
    monster.pursuit_target_character_id = new_t.pk
    monster.save(
        update_fields=["engaged_character", "pursuit_target_character", "updated_at"]
    )


def monster_step_room(monster: MonsterInstance, dest_room_id: int) -> None:
    old_id = monster.current_room_id
    if old_id == dest_room_id:
        return
    dest = Room.objects.filter(pk=dest_room_id).first()
    if not dest:
        return
    if dest.is_safe:
        return
    dir_label = _exit_direction_label(old_id, dest_room_id)
    mname = monster.template.name
    _narrate(old_id, f"{mname} heads {dir_label}.")
    monster.current_room_id = dest_room_id
    _narrate(dest_room_id, f"{mname} arrives from the {dir_label}.")
    _retarget_on_monster_enter_room(monster, dest_room_id)


def monsters_follow_hero_move(hero: Character, old_room_id: int, dest_room_id: int) -> None:
    qs = (
        MonsterInstance.objects.filter(
            Q(engaged_character_id=hero.pk) | Q(pursuit_target_character_id=hero.pk),
            current_room_id=old_room_id,
        )
        .select_related("template")
    )
    for m in qs:
        _retarget_or_pursue_leaver(m, hero, old_room_id, dest_room_id)
        m.save(
            update_fields=[
                "engaged_character",
                "pursuit_target_character",
                "pursuit_path",
                "next_pursuit_at",
                "monster_strike_pending",
                "updated_at",
            ]
        )

    for m in MonsterInstance.objects.filter(pursuit_target_character_id=hero.pk).select_related(
        "template"
    ):
        path = [int(x) for x in (m.pursuit_path or []) if x is not None]
        if not path or path[-1] != dest_room_id:
            path.append(dest_room_id)
        m.pursuit_path = path
        if m.next_pursuit_at is None:
            m.next_pursuit_at = timezone.now()
        m.save(update_fields=["pursuit_path", "next_pursuit_at", "updated_at"])

    for m in MonsterInstance.objects.filter(
        pursuit_target_character_id=hero.pk,
        current_room_id=old_room_id,
    ).select_related("template"):
        path = [int(x) for x in (m.pursuit_path or []) if x is not None]
        if path and path[0] == dest_room_id:
            dest = Room.objects.filter(pk=dest_room_id).first()
            if dest and dest.is_safe:
                # Blocked at safe threshold; keep tile on path for timed pursuit flush.
                continue
            m.pursuit_path = path[1:]
            monster_step_room(m, dest_room_id)
            # Match flush_pursuit_steps pacing so the same HTTP request does not immediately
            # advance this monster again along the remaining path.
            m.next_pursuit_at = timezone.now() + timedelta(seconds=PURSUIT_STEP_SECONDS)
            m.save(
                update_fields=[
                    "current_room",
                    "pursuit_path",
                    "engaged_character",
                    "pursuit_target_character",
                    "next_pursuit_at",
                    "updated_at",
                ]
            )


def _disengage_monsters_from_hero(hero: Character, *, reset_hero_combat: bool = True) -> int:
    """Clear aggro from any monster pointed at ``hero``; optionally reset hero combat state.

    Returns the number of monster rows updated. Used by safe-room entry and by the /leave flow.
    """
    n = MonsterInstance.objects.filter(
        Q(engaged_character_id=hero.pk) | Q(pursuit_target_character_id=hero.pk)
    ).update(
        engaged_character_id=None,
        pursuit_target_character_id=None,
        pursuit_path=[],
        next_pursuit_at=None,
        monster_strike_pending=False,
        updated_at=timezone.now(),
    )
    if reset_hero_combat and n:
        hero.next_action_at = None
        hero.combat_target_monster_id = None
        hero.save(
            update_fields=[
                "next_action_at",
                "combat_target_monster",
                "updated_at",
            ]
        )
    return n


def safe_room_disengage(hero: Character, room: Room) -> bool:
    if not room.is_safe:
        return False
    n = _disengage_monsters_from_hero(hero)
    return bool(n)


def try_bind_monster_to_room_heroes(monster: MonsterInstance, room_id: int, now) -> bool:
    """Arm or restore monster engagement in ``room_id``. Returns True if state was updated.

    - Engaged + armed: noop (False).
    - Engaged + unarmed: narrate engagement (wind-up), ``next_action_at = now +`` round length.
    - Armed + no engagement: pick target, narrate engagement, reset ``next_action_at`` to the
      same round length (engagement starts the strike timer).
    - Fully idle: full bind (random hero), narrate engagement, arm timer.
    """
    if monster.current_room_id != room_id:
        return False
    heroes = _heroes_in_room(room_id)
    if not heroes:
        return False

    armed = monster.next_action_at is not None or monster.monster_strike_pending

    if monster.engaged_character_id:
        if armed:
            return False
        hero_e = _character_for_combat(monster.engaged_character_id)
        if not hero_e or hero_e.current_room_id != room_id:
            return False
        if monster.pursuit_target_character_id is None:
            monster.pursuit_target_character_id = hero_e.pk
        monster.monster_strike_pending = False
        _narrate_monster_engages_hero(monster, room_id, hero_e.pk)
        monster.next_action_at = now + timedelta(seconds=COMBAT_ROUND_SECONDS)
        monster.save(
            update_fields=[
                "pursuit_target_character",
                "monster_strike_pending",
                "next_action_at",
                "updated_at",
            ]
        )
        return True

    if armed:
        target: Character | None = None
        pt = monster.pursuit_target_character_id
        if pt:
            h = _character_for_combat(pt)
            if h and h.current_room_id == room_id:
                target = h
        if not target:
            target = _pick_engagement_target(room_id)
        if not target:
            return False
        monster.engaged_character_id = target.pk
        if monster.pursuit_target_character_id is None:
            monster.pursuit_target_character_id = target.pk
        monster.monster_strike_pending = False
        _narrate_monster_engages_hero(monster, room_id, target.pk)
        monster.next_action_at = now + timedelta(seconds=COMBAT_ROUND_SECONDS)
        monster.save(
            update_fields=[
                "engaged_character",
                "pursuit_target_character",
                "monster_strike_pending",
                "next_action_at",
                "updated_at",
            ]
        )
        return True

    target = _pick_engagement_target(room_id)
    if not target:
        return False
    monster.engaged_character_id = target.pk
    monster.pursuit_target_character_id = target.pk
    monster.monster_strike_pending = False
    _narrate_monster_engages_hero(monster, room_id, target.pk)
    monster.next_action_at = now + timedelta(seconds=COMBAT_ROUND_SECONDS)
    monster.save(
        update_fields=[
            "engaged_character",
            "pursuit_target_character",
            "monster_strike_pending",
            "next_action_at",
            "updated_at",
        ]
    )
    return True


def _sync_or_bind_monster_to_arriving_hero(
    monster: MonsterInstance, hero: Character, room_id: int, now
) -> None:
    """Monster was pursuing ``hero``; they are now in the same room after a move.

    Preserves ``next_action_at`` / ``monster_strike_pending`` when combat is already armed.
    Does **not** use random target pick (unlike ``try_bind_monster_to_room_heroes``).
    """
    if monster.current_room_id != room_id or monster.pursuit_target_character_id != hero.pk:
        return
    if monster.next_action_at is not None or monster.monster_strike_pending:
        monster.engaged_character_id = hero.pk
        monster.save(update_fields=["engaged_character", "updated_at"])
        return
    monster.engaged_character_id = hero.pk
    monster.pursuit_target_character_id = hero.pk
    monster.monster_strike_pending = False
    _narrate_monster_engages_hero(monster, room_id, hero.pk)
    monster.next_action_at = now + timedelta(seconds=COMBAT_ROUND_SECONDS)
    monster.save(
        update_fields=[
            "engaged_character",
            "pursuit_target_character",
            "monster_strike_pending",
            "next_action_at",
            "updated_at",
        ]
    )


def ensure_monster_engaged_by_attacker(
    monster: MonsterInstance, hero: Character, now
) -> None:
    """Bind monster to the attacking hero without resetting an already-armed combat cadence."""
    if monster.current_room_id != hero.current_room_id:
        return
    if monster.next_action_at is not None or monster.monster_strike_pending:
        if (
            monster.engaged_character_id == hero.pk
            and monster.pursuit_target_character_id == hero.pk
        ):
            return
        monster.engaged_character_id = hero.pk
        monster.pursuit_target_character_id = hero.pk
        monster.save(
            update_fields=["engaged_character", "pursuit_target_character", "updated_at"]
        )
        return
    # Unarmed: only set FKs; flush_bind_monsters_with_room_heroes (after combat) arms pacing
    # so the same request does not immediately wind-up in flush_combat_rounds.
    monster.engaged_character_id = hero.pk
    monster.pursuit_target_character_id = hero.pk
    monster.save(
        update_fields=["engaged_character", "pursuit_target_character", "updated_at"]
    )


def engage_monsters_for_new_arrivals(hero: Character, room_id: int) -> None:
    now = timezone.now()
    for m in MonsterInstance.objects.filter(current_room_id=room_id).select_related("template"):
        armed = m.next_action_at is not None or m.monster_strike_pending
        if m.engaged_character_id and armed:
            continue
        if m.pursuit_target_character_id == hero.pk:
            _sync_or_bind_monster_to_arriving_hero(m, hero, room_id, now)
            continue
        try_bind_monster_to_room_heroes(m, room_id, now)


def sense_adjacent_monster_lines(hero: Character, room_id: int) -> list[str]:
    """Hero-only sense lines; returned in command ``messages`` so they stay after the move line."""
    exits = list(
        RoomExit.objects.filter(from_room_id=room_id).select_related("to_room"),
    )
    if not exits:
        return []
    to_ids = [ex.to_room_id for ex in exits]
    occupied = set(
        MonsterInstance.objects.filter(current_room_id__in=to_ids).values_list(
            "current_room_id", flat=True
        )
    )
    out: list[str] = []
    for ex in exits:
        if ex.to_room_id not in occupied:
            continue
        roll = roll_d100() + int(hero.sense) - encumbrance_excess(hero)
        if roll >= MONSTER_SENSE_ADJACENT_DC:
            d = ex.direction
            if d == RoomExit.Direction.UP:
                line = "You sense the presence of an enemy above you."
            elif d == RoomExit.Direction.DOWN:
                line = "You sense the presence of an enemy below you."
            elif d in (RoomExit.Direction.IN, RoomExit.Direction.OUT):
                line = "You sense the presence of an enemy through the entryway."
            else:
                label = ex.get_direction_display().lower()
                line = f"You sense the presence of an enemy to the {label}."
            out.append(line)
    if out and encumbrance_excess(hero) > 0:
        return encumbrance_notice_if_hindered(hero) + out
    return out


def maybe_spawn_lairs(now) -> set[int]:
    affected: set[int] = set()
    rooms = Room.objects.filter(monster_lair_template_id__isnull=False).select_related(
        "monster_lair_template",
    )
    for room in rooms:
        tpl = room.monster_lair_template
        if not tpl:
            continue
        if room.lair_last_instance_id:
            if MonsterInstance.objects.filter(pk=room.lair_last_instance_id).exists():
                continue
        if room.lair_next_spawn_at is not None and now < room.lair_next_spawn_at:
            continue
        inst = MonsterInstance.objects.create(
            template_id=tpl.pk,
            current_room_id=room.pk,
            lair_room_id=room.pk,
            cur_hp=tpl.max_hp,
            max_hp=tpl.max_hp,
            next_action_at=now + timedelta(seconds=COMBAT_ROUND_SECONDS),
        )
        # If heroes are already present in the lair room, engage immediately on spawn
        # so arrivals don't miss the first combat cadence while waiting for a later flusher.
        try_bind_monster_to_room_heroes(inst, room.pk, now)
        room.lair_last_instance_id = inst.pk
        room.lair_next_spawn_at = None
        room.save(update_fields=["lair_last_instance", "lair_next_spawn_at", "updated_at"])
        affected.add(room.pk)
    return affected


def _normalize_loot_partition_chances(chances: list[int]) -> list[int]:
    """Scale row weights down so their sum is at most 100 (single d100 partition)."""
    total = sum(chances)
    if total <= 0:
        return chances
    if total <= 100:
        return chances
    n = len(chances)
    scaled = [(100 * ch) // total for ch in chances]
    shortfall = 100 - sum(scaled)
    idx = 0
    while shortfall > 0 and n > 0:
        scaled[idx % n] += 1
        shortfall -= 1
        idx += 1
    return scaled


def _monster_loot_pick_partition(tpl: MonsterTemplate, room_id: int) -> tuple[Item, int] | None:
    """One d100 selects at most one loot row; quest_only rows need an eligible hero in room."""
    heroes = _heroes_in_room(room_id)
    rows: list[tuple[int, dict, Item]] = []
    for entry in tpl.loot_table or []:
        if not isinstance(entry, dict):
            continue
        slug = entry.get("slug") or entry.get("item_slug")
        if not slug:
            continue
        raw_ch = entry.get("chance", entry.get("pct"))
        ch = 100 if raw_ch is None else max(0, min(100, int(raw_ch)))
        quest_only = bool(entry.get("quest_only") or entry.get("quest"))
        item = Item.objects.filter(slug=str(slug)).first()
        if not item:
            continue
        if quest_only:
            eligible = any(
                not character_carries_item_template(h, item.pk) for h in heroes
            )
            if not eligible:
                ch = 0
        if ch > 0:
            rows.append((ch, entry, item))
    if not rows:
        return None
    chances = [c for c, _, _ in rows]
    norm = _normalize_loot_partition_chances(chances)
    if sum(norm) <= 0:
        return None
    r = roll_d100()
    cum = 0
    for i, ch in enumerate(norm):
        cum += ch
        if r <= cum:
            _, entry, item = rows[i]
            qty = max(1, int(entry.get("qty", entry.get("quantity", 1))))
            return item, qty
    return None


def _monster_pick_quest_drop(
    tpl: MonsterTemplate, room_id: int, heroes: list[Character]
) -> tuple[Item, int, int] | None:
    """Pick a quest drop row if any hero in room is eligible.

    Eligibility:
    - hero is currently in the configured quest_state_id
    - hero total carried quantity of the item template is below the cap
      (cap is inferred from QuestTransition.requires_item_quantity from that state + item)
    - row chance (default 100%) passes

    Returns (item, qty_to_drop, quest_state_id) or None.
    """
    rows = tpl.quest_drops or []
    if not rows or not heroes:
        return None

    hero_ids = [h.pk for h in heroes]
    # Cache: which heroes are in which quest states.
    state_to_hero_ids: dict[int, set[int]] = {}
    # Cache: (state_id, item_id) -> cap_qty
    cap_cache: dict[tuple[int, int], int] = {}

    for entry in rows:
        if not isinstance(entry, dict):
            continue
        qs_raw = entry.get("quest_state_id") or entry.get("state_id")
        try:
            quest_state_id = int(qs_raw)
        except (TypeError, ValueError):
            continue

        item_id = None
        if entry.get("item_id"):
            try:
                item_id = int(entry.get("item_id"))
            except (TypeError, ValueError):
                item_id = None
        if not item_id:
            slug = entry.get("item_slug") or entry.get("slug")
            if slug:
                it = Item.objects.filter(slug=str(slug)).only("id").first()
                item_id = it.id if it else None
        if not item_id:
            continue
        item = Item.objects.filter(pk=item_id).first()
        if not item:
            continue

        raw_ch = entry.get("chance", entry.get("pct"))
        ch = 100 if raw_ch is None else max(0, min(100, int(raw_ch)))
        if ch <= 0:
            continue
        per_kill_qty = max(
            1, int(entry.get("per_kill_qty", entry.get("qty", entry.get("quantity", 1))))
        )

        eligible_heroes = state_to_hero_ids.get(quest_state_id)
        if eligible_heroes is None:
            eligible_heroes = set(
                CharacterQuestProgress.objects.filter(
                    character_id__in=hero_ids,
                    current_state_id=quest_state_id,
                ).values_list("character_id", flat=True)
            )
            state_to_hero_ids[quest_state_id] = eligible_heroes
        if not eligible_heroes:
            continue

        cap_key = (quest_state_id, item_id)
        cap = cap_cache.get(cap_key)
        if cap is None:
            qs = (
                QuestTransition.objects.filter(
                    from_state_id=quest_state_id,
                    requires_item_id=item_id,
                )
                .only("requires_item_quantity")
                .order_by("-requires_item_quantity", "id")
            )
            tr = qs.first()
            cap = max(1, int(getattr(tr, "requires_item_quantity", 1) or 1)) if tr else 1
            cap_cache[cap_key] = cap

        # Choose any hero in room who still needs some.
        for h in heroes:
            if h.pk not in eligible_heroes:
                continue
            cur = character_item_template_quantity(h, item_id)
            if cur >= cap:
                continue
            if roll_d100() > ch:
                continue
            qty = min(per_kill_qty, cap - cur)
            qty = max(1, int(qty))
            return item, qty, quest_state_id

    return None


def award_kill(
    monster: MonsterInstance,
    room_id: int,
    now,
    killer: Character | None = None,
) -> None:
    tpl = monster.template
    heroes = _heroes_in_room(room_id)
    mname = tpl.name
    xp_val = int(tpl.xp_value or 0)

    xp_alloc: list[tuple[Character, int]] = []
    if heroes and xp_val > 0:
        # Product rule: split XP evenly among all heroes in the room, rounded up.
        # Examples: 11 XP => 2 heroes -> 6 each; 3 heroes -> 4 each.
        share = (xp_val + len(heroes) - 1) // len(heroes)
        for h in heroes:
            xp_alloc.append((h, share))
    elif heroes:
        xp_alloc = [(h, 0) for h in heroes]

    killer_eff = killer or (heroes[0] if len(heroes) == 1 else None)
    split_xp = sum(1 for _, a in xp_alloc if a > 0) > 1 if xp_alloc else False

    if heroes:
        for h, add in xp_alloc:
            if killer_eff and h.pk == killer_eff.pk:
                if add > 0 and xp_val > 0:
                    msg = (
                        f"You have slain the {mname}! Your share is {add} experience points!"
                        if split_xp
                        else f"You have slain the {mname}! You earn {add} experience points!"
                    )
                else:
                    msg = f"You have slain the {mname}!"
                _narrate(room_id, msg, target_character_id=h.pk)
            elif killer_eff:
                if add > 0 and xp_val > 0 and split_xp:
                    msg = f"{killer_eff.name} has slain the {mname}! Your share is {add} experience points!"
                else:
                    msg = f"{killer_eff.name} has slain the {mname}!"
                _narrate(room_id, msg, target_character_id=h.pk)
            else:
                if add > 0 and xp_val > 0 and split_xp:
                    msg = f"The {mname} is defeated! Your share is {add} experience points!"
                elif add > 0 and xp_val > 0:
                    msg = f"The {mname} is defeated! You earn {add} experience points!"
                else:
                    msg = f"The {mname} is defeated!"
                _narrate(room_id, msg, target_character_id=h.pk)

        for h, add in xp_alloc:
            if add > 0:
                h.xp = int(h.xp) + add
                h.save(update_fields=["xp", "updated_at"])

    gold = random.randint(int(tpl.gold_min), int(tpl.gold_max))
    if gold > 0:
        add_gold_to_room_floor(room_id, gold)
        _narrate(room_id, f"{tpl.name} drops {gold} gold.")

    quest_picked = _monster_pick_quest_drop(tpl, room_id, heroes)
    if quest_picked:
        item, qty, quest_state_id = quest_picked
        ItemInstance.objects.create(
            item=item,
            quantity=qty,
            room_id=room_id,
            owner_character=None,
            visible_quest_state_id=quest_state_id,
            neglect_count=0,
            floor_dropped_at=timezone.now(),
        )
        _narrate(room_id, f"The {tpl.name} drops {item.name}.")
    else:
        picked = _monster_loot_pick_partition(tpl, room_id)
        if picked:
            item, qty = picked
            ItemInstance.objects.create(
                item=item,
                quantity=qty,
                room_id=room_id,
                owner_character=None,
                neglect_count=0,
                floor_dropped_at=timezone.now(),
            )
            _narrate(room_id, f"The {tpl.name} drops {item.name}.")

    lair_room_id = monster.lair_room_id
    monster.delete()
    if lair_room_id:
        lr = Room.objects.filter(pk=lair_room_id).first()
        if lr and lr.monster_lair_template_id:
            tpl2 = lr.monster_lair_template
            lr.lair_last_instance_id = None
            lr.lair_next_spawn_at = now + timedelta(minutes=int(tpl2.spawn_cooldown_minutes))
            lr.save(update_fields=["lair_last_instance", "lair_next_spawn_at", "updated_at"])


def _resolve_monster_strike(monster: MonsterInstance, now) -> bool:
    """Resolve monster damage turn if due. Returns True if monster combat schedule should advance."""
    room_id = monster.current_room_id
    tgt_id = monster.engaged_character_id
    if not tgt_id:
        m2 = MonsterInstance.objects.select_related("template").get(pk=monster.pk)
        if try_bind_monster_to_room_heroes(m2, room_id, now):
            return True
        mname = m2.template.name
        _narrate(room_id, f"{mname} is spoiling for a fight.")
        return True
    hero = _character_for_combat(tgt_id)
    if not hero or hero.current_room_id != room_id:
        return False
    tpl = monster.template
    lo, hi = int(tpl.damage_min), int(tpl.damage_max)
    if hi < lo:
        lo, hi = hi, lo
    # Paper damage: one uniform roll on [damage_min, damage_max] inclusive.
    # resolve_physical_strike then applies ±L (L = max(1, template.level)), so
    # final pre-mitigation damage can exceed damage_max (e.g. 3 + L at level 1 → 4).
    paper_damage = random.randint(lo, hi)
    atk = monster_attacker_stats(tpl)
    dfn = hero_defender_stats(hero)
    res = resolve_physical_strike(atk, dfn, flat_base_damage=paper_damage)
    mname = monster.template.name
    wpn = (tpl.attack_weapon_label or "").strip()
    vrb = (getattr(tpl, "attack_verb", None) or "").strip()
    if res.outcome == "miss":
        if vrb:
            miss_you = f"{mname} {vrb} at you but misses!"
            miss_peer = f"{mname} {vrb} at {hero.name} but misses."
        else:
            miss_you = f"{mname} swings at you but misses!"
            miss_peer = f"{mname} swings at {hero.name} but misses."
        _narrate(
            room_id,
            miss_you,
            target_character_id=hero.pk,
            log_tone="miss",
        )
        for h in _heroes_in_room(room_id):
            if h.pk != hero.pk:
                _narrate(
                    room_id,
                    miss_peer,
                    target_character_id=h.pk,
                    log_tone="miss",
                )
        _finish_monster_strike_turn(monster.pk, room_id, now)
        return True

    dmg = res.damage
    nh = max(0, int(hero.cur_health) - dmg)
    Character.objects.filter(pk=hero.pk).update(cur_health=nh, updated_at=timezone.now())
    hero = Character.objects.get(pk=hero.pk)
    if wpn:
        if res.outcome == "crit":
            hit_you = f"The {mname} attacks you with its {wpn} for a critical hit — {dmg} damage!"
            hit_peer = f"The {mname} attacks {hero.name} with its {wpn} for a critical hit — {dmg} damage!"
        else:
            hit_you = f"The {mname} attacks you with its {wpn} for {dmg} damage!"
            hit_peer = f"The {mname} attacks {hero.name} with its {wpn} for {dmg} damage!"
    elif res.outcome == "crit":
        if vrb:
            hit_you = f"{mname} critically {vrb} you for {dmg} damage!"
            hit_peer = f"{mname} critically {vrb} {hero.name} for {dmg} damage!"
        else:
            hit_you = f"{mname} critically strikes you for {dmg} damage!"
            hit_peer = f"{mname} critically strikes {hero.name} for {dmg} damage!"
    else:
        if vrb:
            hit_you = f"{mname} {vrb} you for {dmg} damage!"
            hit_peer = f"{mname} {vrb} {hero.name} for {dmg} damage!"
        else:
            hit_you = f"{mname} strikes you for {dmg} damage!"
            hit_peer = f"{mname} strikes {hero.name} for {dmg} damage!"
    _narrate(room_id, hit_you, target_character_id=hero.pk, log_tone="enemy_hit")
    for h in _heroes_in_room(room_id):
        if h.pk != hero.pk:
            _narrate(
                room_id, hit_peer, target_character_id=h.pk, log_tone="enemy_hit"
            )
    if nh <= 0:
        _hero_die(hero, room_id, killer_monster_id=monster.pk)
    _finish_monster_strike_turn(monster.pk, room_id, now)
    return True


def _resolve_hero_strike(char: Character, now) -> None:
    mid = char.combat_target_monster_id
    if not mid:
        return
    monster = (
        MonsterInstance.objects.select_related("template")
        .filter(pk=mid, current_room_id=char.current_room_id)
        .first()
    )
    if not monster:
        return
    char = _character_for_combat(char.pk)
    if not char:
        return
    atk = hero_attacker_stats(char)
    dfn = monster_defender_stats(monster)
    res = resolve_physical_strike(atk, dfn)
    mname = monster.template.name
    rid = char.current_room_id
    mh = char.main_hand_item
    mh_item = mh.item if mh else None
    weapon_name = mh_item.name if mh_item else "fists"
    elem = (mh_item.element if mh_item else "") or ""
    verb_map = {"bludgeoning": "bludgeon", "slashing": "slash", "piercing": "pierce"}
    verb = verb_map.get(elem.lower(), "hit")
    verbs = f"{verb}s"
    if res.outcome == "miss":
        if hero_unlit_dark_area_for_combat(char):
            you_miss = (
                "You miss your attack — it's really hard to see in the dark!"
            )
            peer_miss = (
                f"{char.name} misses their attack — it's really hard to see in the dark!"
            )
        else:
            you_miss = f"Your attack misses the {mname}."
            peer_miss = f"{char.name}'s attack misses the {mname}."
        _narrate(rid, you_miss, target_character_id=char.pk, log_tone="miss")
        for h in _heroes_in_room(rid):
            if h.pk != char.pk:
                _narrate(rid, peer_miss, target_character_id=h.pk, log_tone="miss")
        return

    dmg = res.damage
    nm = max(0, int(monster.cur_hp) - dmg)
    MonsterInstance.objects.filter(pk=monster.pk).update(cur_hp=nm, updated_at=timezone.now())
    if dmg > 0:
        m2 = MonsterInstance.objects.get(pk=monster.pk)
        cdict = dict(m2.xp_contribution or {})
        # Damage drives XP weights today; party heal/shield/buff-on-ally hooks can add
        # contribution here when those actions exist (see monster plan: support XP).
        cdict[str(char.pk)] = int(cdict.get(str(char.pk), 0)) + dmg
        m2.xp_contribution = cdict
        m2.save(update_fields=["xp_contribution", "updated_at"])
    monster = MonsterInstance.objects.get(pk=monster.pk)
    if res.outcome == "crit":
        you = f"You critically {verb} the {mname} with your {weapon_name} for {dmg} damage!"
        peer = f"{char.name} critically {verbs} the {mname} with their {weapon_name} for {dmg} damage!"
    else:
        you = f"You {verb} the {mname} with your {weapon_name} for {dmg} damage!"
        peer = f"{char.name} {verbs} the {mname} with their {weapon_name} for {dmg} damage!"
    _narrate(rid, you, target_character_id=char.pk, log_tone="hero_hit")
    for h in _heroes_in_room(rid):
        if h.pk != char.pk:
            _narrate(rid, peer, target_character_id=h.pk, log_tone="hero_hit")
    if nm <= 0:
        award_kill(monster, rid, now, killer=char)
        Character.objects.filter(pk=char.pk).update(
            combat_target_monster_id=None,
            updated_at=timezone.now(),
        )


def hero_drop_all(hero: Character) -> None:
    rid = hero.current_room_id
    g = int(int(hero.gold) * 0.25)
    guts = int(modified_stats(hero)["guts"])
    keep_pct = min(
        GUTS_EQUIPMENT_KEEP_MAX_PCT,
        1 + guts // GUTS_EQUIPMENT_KEEP_GUTS_DIVISOR,
    )
    slot_attrs = (
        "head_item",
        "main_hand_item",
        "off_hand_item",
        "chest_item",
        "feet_item",
        "ring_item",
        "amulet_item",
    )
    if g > 0:
        hero.gold = max(0, int(hero.gold) - g)
        add_gold_to_room_floor(rid, g)
    for attr in slot_attrs:
        inst = getattr(hero, attr, None)
        if inst:
            if roll_d100() <= keep_pct:
                continue
            setattr(hero, attr, None)
            ItemInstance.objects.filter(pk=inst.pk).update(
                room_id=rid,
                owner_character_id=None,
                floor_dropped_at=timezone.now(),
            )
    inv = list(hero.inventory or [])
    hero.inventory = []
    for iid in inv:
        ItemInstance.objects.filter(pk=iid, owner_character_id=hero.pk).update(
            room_id=rid,
            owner_character_id=None,
            floor_dropped_at=timezone.now(),
        )
    hero.save(update_fields=["gold", "inventory", *slot_attrs])


def _hero_die(hero: Character, room_id: int, killer_monster_id: int | None = None) -> None:
    killer_label: str | None = None
    if killer_monster_id:
        killer = (
            MonsterInstance.objects.filter(pk=killer_monster_id)
            .select_related("template")
            .first()
        )
        if killer:
            killer_label = killer.template.name
    for h in _heroes_in_room(room_id):
        if h.pk == hero.pk:
            if killer_label:
                _narrate(
                    room_id,
                    f"The {killer_label} has slain you!",
                    target_character_id=h.pk,
                )
            else:
                _narrate(room_id, "You were slain!", target_character_id=h.pk)
        else:
            if killer_label:
                _narrate(
                    room_id,
                    f"The {killer_label} has slain {hero.name}!",
                    target_character_id=h.pk,
                )
            else:
                _narrate(room_id, f"{hero.name} was slain!", target_character_id=h.pk)
    hero_drop_all(hero)
    hero.refresh_from_db()
    _narrate(
        room_id,
        "Your inventory drops to the floor…",
        target_character_id=hero.pk,
    )
    hero.cur_health = 0
    hero.is_dead = True
    hero.died_at = timezone.now()
    hero.next_action_at = None
    hero.combat_target_monster_id = None
    hero.pending_leave_at = None
    hero.save(
        update_fields=[
            "cur_health",
            "is_dead",
            "died_at",
            "next_action_at",
            "combat_target_monster",
            "pending_leave_at",
            "updated_at",
        ]
    )
    MonsterInstance.objects.filter(engaged_character_id=hero.pk).update(
        engaged_character_id=None,
        updated_at=timezone.now(),
    )
    MonsterInstance.objects.filter(pursuit_target_character_id=hero.pk).update(
        pursuit_target_character_id=None,
        pursuit_path=[],
        next_pursuit_at=None,
        monster_strike_pending=False,
        updated_at=timezone.now(),
    )


def _revive_heroes(now) -> None:
    due = Character.objects.filter(
        is_dead=True,
        died_at__isnull=False,
        died_at__lte=now - timedelta(seconds=COMBAT_ROUND_SECONDS),
    ).order_by("id")
    for h in due:
        rid = h.spawn_room_id
        h.is_dead = False
        h.died_at = None
        h.cur_health = h.max_health
        h.current_room_id = rid
        h.save(
            update_fields=[
                "is_dead",
                "died_at",
                "cur_health",
                "current_room",
                "updated_at",
            ]
        )
        _narrate(
            rid,
            "The gods see in you an untapped market. Get back out there, consumer!",
            target_character_id=h.pk,
        )


def flush_pursuit_steps(now) -> set[int]:
    affected: set[int] = set()
    due = list(
        MonsterInstance.objects.filter(next_pursuit_at__lte=now)
        .select_related("template")
        .order_by("id")
    )
    for m in due:
        path = [int(x) for x in (m.pursuit_path or []) if x is not None]
        if not path:
            MonsterInstance.objects.filter(pk=m.pk).update(
                next_pursuit_at=None,
                updated_at=timezone.now(),
            )
            continue
        nxt = path[0]
        dest = Room.objects.filter(pk=nxt).first()
        if dest and dest.is_safe:
            # Do not skip through safe rooms; abandon pursuit instead of teleporting the path.
            pu = m.pursuit_target_character_id
            engaged_clear = {}
            if pu and m.engaged_character_id == pu:
                engaged_clear = {"engaged_character_id": None}
            MonsterInstance.objects.filter(pk=m.pk).update(
                pursuit_path=[],
                pursuit_target_character_id=None,
                next_pursuit_at=None,
                monster_strike_pending=False,
                **engaged_clear,
                updated_at=timezone.now(),
            )
            continue
        oid = m.current_room_id
        MonsterInstance.objects.filter(pk=m.pk).update(
            pursuit_path=path[1:],
            next_pursuit_at=now + timedelta(seconds=PURSUIT_STEP_SECONDS),
            updated_at=timezone.now(),
        )
        m = MonsterInstance.objects.get(pk=m.pk)
        monster_step_room(m, nxt)
        m.save(
            update_fields=[
                "current_room",
                "engaged_character",
                "pursuit_target_character",
                "updated_at",
            ]
        )
        affected.add(oid)
        affected.add(m.current_room_id)
    return affected


def flush_combat_rounds(now) -> set[int]:
    affected: set[int] = set()
    due_m = list(
        MonsterInstance.objects.filter(next_action_at__lte=now)
        .select_related("template")
        .order_by("id")
    )
    due_h = list(
        Character.objects.filter(next_action_at__lte=now, is_dead=False).order_by("id")
    )
    room_ids = {m.current_room_id for m in due_m} | {h.current_room_id for h in due_h}
    m_by_pk = {m.pk: m for m in due_m}
    h_by_pk = {h.pk: h for h in due_h}

    for room_id in sorted(room_ids):
        entries: list[tuple[str, int]] = []
        for m in due_m:
            if m.current_room_id == room_id:
                entries.append(("m", m.pk))
        for h in due_h:
            if h.current_room_id == room_id:
                entries.append(("h", h.pk))
        actors: list[tuple[int, str, int]] = []
        for kind, pk in entries:
            if kind == "m":
                mi = m_by_pk.get(pk)
                if mi:
                    actors.append((_initiative_roll_monster(mi), "m", pk))
            else:
                hi = h_by_pk.get(pk)
                if hi:
                    actors.append((_initiative_roll_hero(hi), "h", pk))
        actors.sort(key=lambda x: (-x[0], x[1], x[2]))

        # Each monster pk is processed at most once per room per tick (one strike cadence step).
        seen_m: set[int] = set()
        seen_h: set[int] = set()
        for _roll, kind, pk in actors:
            if kind == "m":
                if pk in seen_m:
                    continue
                m = MonsterInstance.objects.select_related("template").filter(pk=pk).first()
                if not m or not m.next_action_at or m.next_action_at > now:
                    continue
                seen_m.add(pk)
                if _resolve_monster_strike(m, now):
                    MonsterInstance.objects.filter(pk=m.pk).update(
                        next_action_at=now + timedelta(seconds=COMBAT_ROUND_SECONDS),
                        monster_strike_pending=False,
                        updated_at=timezone.now(),
                    )
                affected.add(m.current_room_id)
            else:
                if pk in seen_h:
                    continue
                h = Character.objects.filter(pk=pk, is_dead=False).first()
                if not h or not h.next_action_at or h.next_action_at > now:
                    continue
                seen_h.add(pk)
                _resolve_hero_strike(h, now)
                Character.objects.filter(pk=h.pk).update(
                    next_action_at=now + timedelta(seconds=COMBAT_ROUND_SECONDS),
                    updated_at=timezone.now(),
                )
                affected.add(h.current_room_id)
    return affected


def _boot_hero_to_lobby(hero: Character) -> set[int]:
    """Persist an out-of-realm transition for ``hero``: drop aggro, clear combat/pending, narrate.

    Returns room ids to notify (realm-wide fanned lines + all touched rooms).
    """
    _disengage_monsters_from_hero(hero, reset_hero_combat=False)
    rooms = broadcast_realm_depart(hero, f"{hero.name} vanishes from the realm.")
    Character.objects.filter(pk=hero.pk).update(
        next_action_at=None,
        combat_target_monster_id=None,
        pending_leave_at=None,
        is_in_realm=False,
        updated_at=timezone.now(),
    )
    return rooms


def flush_pending_leaves(now) -> set[int]:
    """Complete leaves for heroes whose pending_leave_at is due. Returns affected room ids."""
    affected: set[int] = set()
    due = Character.objects.filter(
        is_dead=False,
        is_in_realm=True,
        pending_leave_at__isnull=False,
        pending_leave_at__lte=now,
    ).order_by("id")
    for hero in due:
        affected |= _boot_hero_to_lobby(hero)
    return affected


def flush_afk_boots(now) -> set[int]:
    """Boot AFK heroes (last_activity_at older than ``AFK_LOBBY_KICK_MINUTES``) out of the realm.

    Mirrors the /leave completion path so peers + monsters see the player leave the realm
    instead of just disappearing from the visibility window.
    """
    from qff.constants import AFK_LOBBY_KICK_MINUTES

    threshold = now - timedelta(minutes=AFK_LOBBY_KICK_MINUTES)
    affected: set[int] = set()
    due = Character.objects.filter(
        is_dead=False,
        is_in_realm=True,
        last_activity_at__lt=threshold,
    ).order_by("id")
    for hero in due:
        affected |= _boot_hero_to_lobby(hero)
    return affected


def _earliest_time_based_lazy_sim_event(now) -> "timezone.datetime | None":
    """Real-time MIN aggregate over every time-gated lazy-sim trigger.

    Returns the earliest scheduled event timestamp across:

    * combat rounds (``MonsterInstance.next_action_at`` / ``Character.next_action_at``)
    * pursuit steps (``MonsterInstance.next_pursuit_at``)
    * pending leaves (``Character.pending_leave_at``)
    * AFK kicks (derived from ``Character.last_activity_at`` + ``AFK_LOBBY_KICK_MINUTES``)
    * lair respawns (``Room.lair_next_spawn_at`` when non-null), plus any lair room
      that is spawn-eligible with ``lair_next_spawn_at=NULL`` (dead/missing last
      instance — matches ``maybe_spawn_lairs`` instant-eligibility)
    * revive (derived from ``Character.died_at`` + ``COMBAT_ROUND_SECONDS``)

    ``flush_bind_monsters_with_room_heroes`` is event-driven (hero+monster sharing
    a room) and is intentionally excluded; it's checked separately and cheap when
    nothing is due. Each call hits the live tables (no caching) so freshness is
    strict.
    """
    from qff.constants import AFK_LOBBY_KICK_MINUTES

    candidates: list = []
    m_action = MonsterInstance.objects.filter(next_action_at__isnull=False).aggregate(
        m=Min("next_action_at")
    )["m"]
    if m_action:
        candidates.append(m_action)
    h_action = Character.objects.filter(
        is_dead=False, next_action_at__isnull=False
    ).aggregate(m=Min("next_action_at"))["m"]
    if h_action:
        candidates.append(h_action)
    m_pursuit = MonsterInstance.objects.filter(next_pursuit_at__isnull=False).aggregate(
        m=Min("next_pursuit_at")
    )["m"]
    if m_pursuit:
        candidates.append(m_pursuit)
    h_leave = Character.objects.filter(
        is_dead=False, is_in_realm=True, pending_leave_at__isnull=False
    ).aggregate(m=Min("pending_leave_at"))["m"]
    if h_leave:
        candidates.append(h_leave)
    h_afk = Character.objects.filter(
        is_dead=False, is_in_realm=True, last_activity_at__isnull=False
    ).aggregate(m=Min("last_activity_at"))["m"]
    if h_afk:
        candidates.append(h_afk + timedelta(minutes=AFK_LOBBY_KICK_MINUTES))
    lair_next = Room.objects.filter(
        monster_lair_template_id__isnull=False, lair_next_spawn_at__isnull=False
    ).aggregate(m=Min("lair_next_spawn_at"))["m"]
    if lair_next:
        candidates.append(lair_next)
    # Lairs can be spawn-eligible with ``lair_next_spawn_at=NULL`` (no delayed respawn
    # scheduled). MIN ignores those rows, so without this guard we'd skip
    # ``maybe_spawn_lairs`` forever when no other timed work exists.
    live_last_instance = Exists(
        MonsterInstance.objects.filter(pk=OuterRef("lair_last_instance_id"))
    )
    if Room.objects.filter(monster_lair_template_id__isnull=False).filter(
        Q(lair_last_instance_id__isnull=True) | ~live_last_instance
    ).filter(Q(lair_next_spawn_at__isnull=True) | Q(lair_next_spawn_at__lte=now)).exists():
        candidates.append(now)
    h_revive = Character.objects.filter(
        is_dead=True, died_at__isnull=False
    ).aggregate(m=Min("died_at"))["m"]
    if h_revive:
        candidates.append(h_revive + timedelta(seconds=COMBAT_ROUND_SECONDS))
    if not candidates:
        return None
    return min(candidates)


def _bind_monsters_has_work() -> bool:
    """Cheap event-driven check used to skip ``flush_bind_monsters_with_room_heroes``.

    Returns True when at least one active hero shares a room with a monster.
    Single SQL: ``EXISTS(...)`` on the join, no Python loop.
    """
    th = presence_threshold()
    return (
        Character.objects.filter(
            last_activity_at__gte=th,
            is_dead=False,
            current_room_id__in=MonsterInstance.objects.values("current_room_id"),
        )
        .exists()
    )


def run_lazy_simulation(now=None, *, notify_rooms: bool = True) -> list[int]:
    now = now or timezone.now()
    rooms: set[int] = set()
    profile_enabled = bool(getattr(settings, "QFF_LAZY_SIM_TIMING_LOG", False))
    profiler_rows: list[tuple[str, int, float]] = []
    with transaction.atomic():
        if connection.vendor == "postgresql":
            with connection.cursor() as cur:
                cur.execute("SELECT pg_try_advisory_xact_lock(%s)", [QFF_LAZY_SIM_LOCK_KEY])
                got = cur.fetchone()[0]
            if not got:
                logger.debug("run_lazy_simulation skipped: advisory lock not acquired")
                return []
        next_event_at = _earliest_time_based_lazy_sim_event(now)
        time_work_due = next_event_at is not None and next_event_at <= now
        if time_work_due:
            for label, fn in (
                ("spawn_lairs", maybe_spawn_lairs),
                ("pursuit_steps", flush_pursuit_steps),
                ("pending_leaves", flush_pending_leaves),
                ("afk_boots", flush_afk_boots),
                ("combat_rounds", flush_combat_rounds),
            ):
                t0 = time.perf_counter()
                touched = fn(now)
                elapsed = (time.perf_counter() - t0) * 1000
                rooms |= touched
                if profile_enabled:
                    profiler_rows.append((label, len(touched), elapsed))
            t0 = time.perf_counter()
            _revive_heroes(now)
            if profile_enabled:
                profiler_rows.append(("revive_heroes", 0, (time.perf_counter() - t0) * 1000))
        if _bind_monsters_has_work():
            t0 = time.perf_counter()
            touched = flush_bind_monsters_with_room_heroes(now)
            rooms |= touched
            if profile_enabled:
                profiler_rows.append(
                    (
                        "bind_monsters_with_room_heroes",
                        len(touched),
                        (time.perf_counter() - t0) * 1000,
                    )
                )
        elif profile_enabled:
            profiler_rows.append(("bind_monsters_with_room_heroes", 0, 0.0))
    if profile_enabled:
        row_str = " ".join(f"{n}=rooms:{cnt},ms:{ms:.2f}" for n, cnt, ms in profiler_rows)
        logger.info(
            "qff_lazy_sim_timing time_work_due=%s next_event_at=%s total_rooms=%s %s",
            time_work_due,
            next_event_at.isoformat() if next_event_at else None,
            len(rooms),
            row_str,
        )
    if rooms and notify_rooms:
        notify_qff_rooms(rooms)
    return list(rooms)


def on_spawn_room_enter(char: Character, room: Room) -> None:
    if room.is_spawn_point:
        if char.spawn_room_id != room.pk:
            char.spawn_room_id = room.pk
            char.save(update_fields=["spawn_room", "updated_at"])
