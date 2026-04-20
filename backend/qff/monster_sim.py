"""Lazy monster spawn, pursuit, and combat round simulation for QFF."""

from __future__ import annotations

import random
from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from qff.combat_math import (
    hero_attacker_stats,
    hero_defender_stats,
    monster_attacker_stats,
    monster_defender_stats,
    resolve_physical_strike,
)
from qff.constants import (
    COMBAT_ROUND_SECONDS,
    MONSTER_ENGAGEMENT_FIRST_TICK_SECONDS,
    GUTS_EQUIPMENT_KEEP_GUTS_DIVISOR,
    GUTS_EQUIPMENT_KEEP_MAX_PCT,
    MONSTER_SENSE_ADJACENT_DC,
    PURSUIT_STEP_SECONDS,
)
from qff.game_helpers import (
    encumbrance_excess,
    modified_stats,
    presence_threshold,
    roll_d100,
)
from qff.models import (
    Character,
    Item,
    ItemInstance,
    MonsterInstance,
    Room,
    RoomBroadcast,
    RoomExit,
    RoomGoldPile,
)
from qff.realtime import notify_qff_rooms


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


def _retarget_or_pursue_leaver(
    monster: MonsterInstance,
    leaver: Character,
    old_room_id: int,
    dest_room_id: int,
) -> None:
    heroes_here = [h for h in _heroes_in_room(old_room_id) if h.pk != leaver.pk]
    if heroes_here and random.random() < 0.5:
        new_t = _pick_engagement_target(old_room_id)
        if new_t and new_t.pk != leaver.pk:
            monster.engaged_character_id = new_t.pk
            monster.pursuit_target_character_id = new_t.pk
            mname = monster.template.name
            _narrate(
                old_room_id,
                f"{mname} turns its attention to you!",
                target_character_id=new_t.pk,
            )
            for h in heroes_here:
                if h.pk != new_t.pk:
                    _narrate(
                        old_room_id,
                        f"{mname} turns its attention toward {new_t.name}!",
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
        return
    if monster.pursuit_target_character_id in hero_ids:
        # Followed a hero here: keep combat cadence; only sync engagement FK.
        monster.engaged_character_id = monster.pursuit_target_character_id
        return
    if random.random() < 0.55:
        new_t = _pick_engagement_target(room_id)
        if new_t:
            monster.engaged_character_id = new_t.pk
            monster.pursuit_target_character_id = new_t.pk
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
            m.save(
                update_fields=[
                    "current_room",
                    "pursuit_path",
                    "engaged_character",
                    "pursuit_target_character",
                    "updated_at",
                ]
            )


def safe_room_disengage(hero: Character, room: Room) -> bool:
    if not room.is_safe:
        return False
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
    if not n:
        return False
    hero.next_action_at = None
    hero.combat_target_monster_id = None
    hero.save(
        update_fields=[
            "next_action_at",
            "combat_target_monster",
            "updated_at",
        ]
    )
    return True


def try_bind_monster_to_room_heroes(monster: MonsterInstance, room_id: int, now) -> bool:
    """Pick a living hero in ``room_id`` and start engagement + strike wind-up. Returns True if bound.

    If the monster was already pursuing/chasing the chosen hero and combat is armed
    (``next_action_at`` or ``monster_strike_pending``), only restore ``engaged_character``
    so pacing continues (e.g. followed into a new room).
    """
    if monster.current_room_id != room_id:
        return False
    if monster.engaged_character_id:
        return False
    heroes = _heroes_in_room(room_id)
    if not heroes:
        return False
    target = _pick_engagement_target(room_id)
    if not target:
        return False
    if monster.pursuit_target_character_id == target.pk and (
        monster.next_action_at is not None or monster.monster_strike_pending
    ):
        monster.engaged_character_id = target.pk
        monster.save(update_fields=["engaged_character", "updated_at"])
        return True
    monster.engaged_character_id = target.pk
    monster.pursuit_target_character_id = target.pk
    # False so the first combat flush runs wind-up ("prepares to strike"), not damage.
    monster.monster_strike_pending = False
    monster.next_action_at = now + timedelta(
        seconds=MONSTER_ENGAGEMENT_FIRST_TICK_SECONDS
    )
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
    monster.next_action_at = now + timedelta(seconds=MONSTER_ENGAGEMENT_FIRST_TICK_SECONDS)
    monster.save(
        update_fields=[
            "engaged_character",
            "pursuit_target_character",
            "monster_strike_pending",
            "next_action_at",
            "updated_at",
        ]
    )


def engage_monsters_for_new_arrivals(hero: Character, room_id: int) -> None:
    now = timezone.now()
    for m in MonsterInstance.objects.filter(current_room_id=room_id).select_related("template"):
        if m.engaged_character_id:
            continue
        if m.pursuit_target_character_id == hero.pk:
            _sync_or_bind_monster_to_arriving_hero(m, hero, room_id, now)
            continue
        try_bind_monster_to_room_heroes(m, room_id, now)


def sense_adjacent_monsters(hero: Character, room_id: int) -> None:
    exits = list(
        RoomExit.objects.filter(from_room_id=room_id).select_related("to_room"),
    )
    if not exits:
        return
    to_ids = [ex.to_room_id for ex in exits]
    occupied = set(
        MonsterInstance.objects.filter(current_room_id__in=to_ids).values_list(
            "current_room_id", flat=True
        )
    )
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
            _narrate(room_id, line, target_character_id=hero.pk)


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
        room.lair_last_instance_id = inst.pk
        room.lair_next_spawn_at = None
        room.save(update_fields=["lair_last_instance", "lair_next_spawn_at", "updated_at"])
        inst = MonsterInstance.objects.select_related("template").get(pk=inst.pk)
        try_bind_monster_to_room_heroes(inst, room.pk, now)
        affected.add(room.pk)
    return affected


def award_kill(monster: MonsterInstance, room_id: int, now) -> None:
    tpl = monster.template
    heroes = _heroes_in_room(room_id)
    xp_val = int(tpl.xp_value or 0)
    if heroes and xp_val:
        contrib = {str(k): int(v) for k, v in (monster.xp_contribution or {}).items()}
        weights = [max(0, contrib.get(str(h.pk), 0)) for h in heroes]
        total_w = sum(weights)
        if total_w <= 0:
            share = xp_val // len(heroes)
            rem = xp_val - share * len(heroes)
            for i, h in enumerate(heroes):
                add = share + (1 if i < rem else 0)
                h.xp = int(h.xp) + add
                h.save(update_fields=["xp", "updated_at"])
        else:
            amounts = []
            allocated = 0
            for w in weights:
                amt = (xp_val * w) // total_w
                amounts.append(amt)
                allocated += amt
            rem = xp_val - allocated
            for i in range(rem):
                amounts[i % len(heroes)] += 1
            for h, add in zip(heroes, amounts, strict=True):
                h.xp = int(h.xp) + add
                h.save(update_fields=["xp", "updated_at"])
    gold = random.randint(int(tpl.gold_min), int(tpl.gold_max))
    if gold > 0:
        add_gold_to_room_floor(room_id, gold)
        _narrate(room_id, f"{tpl.name} drops {gold} gold.")
    loot_rows: list[tuple[int, dict]] = []
    for entry in tpl.loot_table or []:
        if not isinstance(entry, dict):
            continue
        slug = entry.get("slug") or entry.get("item_slug")
        if not slug:
            continue
        raw_ch = entry.get("chance", entry.get("pct"))
        if raw_ch is None:
            ch = 100
        else:
            ch = max(0, min(100, int(raw_ch)))
        loot_rows.append((ch, entry))
    # One d100 per row, in template list order (do not reorder by chance).
    for ch, entry in loot_rows:
        if ch <= 0:
            continue
        if roll_d100() > ch:
            continue
        slug = entry.get("slug") or entry.get("item_slug")
        qty = max(1, int(entry.get("qty", entry.get("quantity", 1))))
        item = Item.objects.filter(slug=str(slug)).first()
        if not item:
            continue
        ItemInstance.objects.create(
            item=item,
            quantity=qty,
            room_id=room_id,
            owner_character=None,
            neglect_count=0,
            floor_dropped_at=timezone.now(),
        )
        _narrate(room_id, f"The {tpl.name} drops {item.name}.")
        break
    lair_room_id = monster.lair_room_id
    monster.delete()
    if lair_room_id:
        lr = Room.objects.filter(pk=lair_room_id).first()
        if lr and lr.monster_lair_template_id:
            tpl2 = lr.monster_lair_template
            lr.lair_last_instance_id = None
            lr.lair_next_spawn_at = now + timedelta(minutes=int(tpl2.spawn_cooldown_minutes))
            lr.save(update_fields=["lair_last_instance", "lair_next_spawn_at", "updated_at"])


def _resolve_monster_strike(monster: MonsterInstance, now) -> None:
    room_id = monster.current_room_id
    tgt_id = monster.engaged_character_id
    if not tgt_id:
        m2 = MonsterInstance.objects.select_related("template").get(pk=monster.pk)
        if try_bind_monster_to_room_heroes(m2, room_id, now):
            return
        mname = m2.template.name
        _narrate(room_id, f"{mname} is spoiling for a fight.")
        return
    hero = _character_for_combat(tgt_id)
    if not hero or hero.current_room_id != room_id:
        return
    tpl = monster.template
    lo, hi = int(tpl.damage_min), int(tpl.damage_max)
    if hi < lo:
        lo, hi = hi, lo
    rolled = random.randint(lo, hi)
    atk = monster_attacker_stats(tpl)
    dfn = hero_defender_stats(hero)
    res = resolve_physical_strike(atk, dfn, flat_base_damage=rolled)
    mname = monster.template.name
    if res.outcome == "miss":
        _narrate(
            room_id,
            f"{mname} swings at you but misses!",
            target_character_id=hero.pk,
            log_tone="miss",
        )
        for h in _heroes_in_room(room_id):
            if h.pk != hero.pk:
                _narrate(
                    room_id,
                    f"{mname} swings at {hero.name} but misses.",
                    target_character_id=h.pk,
                    log_tone="miss",
                )
        return
    if res.outcome == "dodge":
        _narrate(
            room_id,
            f"You dodge the {mname}'s attack!",
            target_character_id=hero.pk,
            log_tone="miss",
        )
        for h in _heroes_in_room(room_id):
            if h.pk != hero.pk:
                _narrate(
                    room_id,
                    f"{hero.name} dodges the {mname}.",
                    target_character_id=h.pk,
                    log_tone="miss",
                )
        return

    dmg = res.damage
    nh = max(0, int(hero.cur_health) - dmg)
    Character.objects.filter(pk=hero.pk).update(cur_health=nh, updated_at=timezone.now())
    hero = Character.objects.get(pk=hero.pk)
    if res.outcome == "crit":
        hit_you = f"{mname} critically strikes you for {dmg} damage!"
        hit_peer = f"{mname} critically strikes {hero.name} for {dmg} damage!"
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
    boundary = (
        char.next_action_at - timedelta(seconds=COMBAT_ROUND_SECONDS)
        if char.next_action_at
        else now - timedelta(seconds=COMBAT_ROUND_SECONDS)
    )
    if char.last_command_at and char.last_command_at > boundary:
        return
    char = _character_for_combat(char.pk)
    if not char:
        return
    atk = hero_attacker_stats(char)
    dfn = monster_defender_stats(monster)
    res = resolve_physical_strike(atk, dfn)
    mname = monster.template.name
    rid = char.current_room_id
    if res.outcome == "miss":
        _narrate(
            rid,
            f"You swing at the {mname} but miss.",
            target_character_id=char.pk,
            log_tone="miss",
        )
        for h in _heroes_in_room(rid):
            if h.pk != char.pk:
                _narrate(
                    rid,
                    f"{char.name} swings at the {mname} but misses.",
                    target_character_id=h.pk,
                    log_tone="miss",
                )
        return
    if res.outcome == "dodge":
        _narrate(
            rid,
            f"The {mname} evades your attack!",
            target_character_id=char.pk,
            log_tone="miss",
        )
        for h in _heroes_in_room(rid):
            if h.pk != char.pk:
                _narrate(
                    rid,
                    f"The {mname} evades {char.name}'s attack.",
                    target_character_id=h.pk,
                    log_tone="miss",
                )
        return

    dmg = res.damage
    nm = max(0, int(monster.cur_hp) - dmg)
    MonsterInstance.objects.filter(pk=monster.pk).update(cur_hp=nm, updated_at=timezone.now())
    if dmg > 0:
        m2 = MonsterInstance.objects.get(pk=monster.pk)
        cdict = dict(m2.xp_contribution or {})
        cdict[str(char.pk)] = int(cdict.get(str(char.pk), 0)) + dmg
        m2.xp_contribution = cdict
        m2.save(update_fields=["xp_contribution", "updated_at"])
    monster = MonsterInstance.objects.get(pk=monster.pk)
    if res.outcome == "crit":
        you = f"You land a critical hit on the {mname} for {dmg} damage!"
        peer = f"{char.name} critically strikes the {mname} for {dmg} damage!"
    else:
        you = f"You strike the {mname} for {dmg} damage!"
        peer = f"{char.name} strikes the {mname} for {dmg} damage!"
    _narrate(rid, you, target_character_id=char.pk, log_tone="hero_hit")
    for h in _heroes_in_room(rid):
        if h.pk != char.pk:
            _narrate(rid, peer, target_character_id=h.pk, log_tone="hero_hit")
    if nm <= 0:
        for h in _heroes_in_room(rid):
            if h.pk == char.pk:
                _narrate(
                    rid,
                    f"You have slain the {mname}!",
                    target_character_id=char.pk,
                )
            else:
                _narrate(
                    rid,
                    f"{char.name} has slain the {mname}!",
                    target_character_id=h.pk,
                )
        award_kill(monster, rid, now)
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
    for h in _heroes_in_room(room_id):
        if h.pk == hero.pk:
            _narrate(room_id, "You were slain!", target_character_id=h.pk)
        else:
            _narrate(room_id, f"{hero.name} was slain!", target_character_id=h.pk)
    hero_drop_all(hero)
    hero.refresh_from_db()
    hero.cur_health = 0
    hero.is_dead = True
    hero.died_at = timezone.now()
    hero.next_action_at = None
    hero.combat_target_monster_id = None
    hero.save(
        update_fields=[
            "cur_health",
            "is_dead",
            "died_at",
            "next_action_at",
            "combat_target_monster",
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
    if killer_monster_id:
        killer = (
            MonsterInstance.objects.select_related("template")
            .filter(pk=killer_monster_id)
            .first()
        )
        if killer and killer.current_room_id == room_id:
            try_bind_monster_to_room_heroes(killer, room_id, timezone.now())


def _revive_heroes(now) -> None:
    due = Character.objects.filter(
        is_dead=True,
        died_at__isnull=False,
        died_at__lte=now - timedelta(seconds=COMBAT_ROUND_SECONDS),
    )
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
                tgt = m.engaged_character_id
                if tgt and not m.monster_strike_pending:
                    mname = m.template.name
                    _narrate(
                        m.current_room_id,
                        f"The {mname} prepares to strike!",
                        target_character_id=tgt,
                    )
                    hc = Character.objects.filter(pk=tgt).first()
                    hn = hc.name if hc else "someone"
                    for h in _heroes_in_room(m.current_room_id):
                        if h.pk != tgt:
                            _narrate(
                                m.current_room_id,
                                f"The {mname} prepares to strike at {hn}!",
                                target_character_id=h.pk,
                            )
                    MonsterInstance.objects.filter(pk=m.pk).update(
                        monster_strike_pending=True,
                        next_action_at=now + timedelta(seconds=COMBAT_ROUND_SECONDS),
                        updated_at=timezone.now(),
                    )
                    affected.add(m.current_room_id)
                    continue
                _resolve_monster_strike(m, now)
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


def run_lazy_simulation(now=None, *, notify_rooms: bool = True) -> list[int]:
    now = now or timezone.now()
    rooms: set[int] = set()
    with transaction.atomic():
        rooms |= maybe_spawn_lairs(now)
        rooms |= flush_pursuit_steps(now)
        rooms |= flush_combat_rounds(now)
        _revive_heroes(now)
    if rooms and notify_rooms:
        notify_qff_rooms(rooms)
    return list(rooms)


def on_spawn_room_enter(char: Character, room: Room) -> None:
    if room.is_spawn_point:
        if char.spawn_room_id != room.pk:
            char.spawn_room_id = room.pk
            char.save(update_fields=["spawn_room", "updated_at"])
