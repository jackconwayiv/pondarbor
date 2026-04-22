"""Quest state, dialogue selection, transitions, and effects."""

from __future__ import annotations

from datetime import timedelta

from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.utils import timezone

from qff.constants import XP_PER_LEVEL
from qff.exits import _set_character_unlock, _set_realm_unlock
from qff.game_helpers import display_name_for_instance
from qff.models import (
    Character,
    CharacterQuestProgress,
    Interactable,
    ItemInstance,
    Npc,
    NpcDialogue,
    QuestEffect,
    QuestState,
    QuestTransition,
    RoomExit,
    RoomItem,
    RoomItemCharacterClaim,
    RoomItemSpawn,
)

SLOT_ATTRS = (
    "head_item",
    "main_hand_item",
    "off_hand_item",
    "chest_item",
    "feet_item",
    "ring_item",
    "amulet_item",
)


def character_item_template_quantity(character: Character, item_id: int) -> int:
    """Total quantity of an item template carried across inventory stacks + equipped.

    - Inventory: sums `ItemInstance.quantity` for matching template rows.
    - Equipped: counts 1 per equipped instance (equipped items are non-stackable).
    """
    total = 0
    for iid in character.inventory or []:
        inst = ItemInstance.objects.filter(pk=iid, owner_character_id=character.pk).first()
        if not inst or inst.item_id != item_id:
            continue
        total += max(1, int(inst.quantity or 1))
    for attr in SLOT_ATTRS:
        inst = getattr(character, attr, None)
        if inst and inst.item_id == item_id:
            total += 1
    return total


def character_has_item_template_quantity(
    character: Character, item_id: int, needed_qty: int
) -> bool:
    return character_item_template_quantity(character, item_id) >= max(1, int(needed_qty or 1))


def container_interactable_active_for_character(
    character: Character, interactable_id: int | None
) -> bool:
    """True if this hero may see contents keyed to a container interactable (opened or focused)."""
    if not interactable_id:
        return False
    if character.opened_container_interactable_id == interactable_id:
        return True
    if character.container_focus_interactable_id != interactable_id:
        return False
    exp = character.container_focus_expires_at
    if exp and timezone.now() >= exp:
        return False
    return True


def floor_item_visible_to_character(character: Character, inst: ItemInstance) -> bool:
    """Unowned floor item visibility.

    Floor items should never be hidden from a hero once they exist (except container focus rules).
    Quest progress and inventory quantity should control *generation* of quest drops, not visibility.
    """
    if inst.owner_character_id is not None:
        return True
    if inst.container_interactable_id:
        cid = inst.container_interactable_id
        if not container_interactable_active_for_character(character, cid):
            return False
    return True


def unowned_floor_item_template_ids_in_room(room_id: int) -> set[int]:
    """Item template ids with at least one unowned floor instance in the room (for room-slot suppression)."""
    return set(
        ItemInstance.objects.filter(
            room_id=room_id,
            owner_character__isnull=True,
            container_interactable__isnull=True,
        ).values_list("item_id", flat=True)
    )


def room_item_visible_to_character(
    character: Character,
    room_item: RoomItem,
    floor_template_ids_in_room: set[int],
) -> bool:
    """Room slot: quest gate (if set), not carrying template, no unowned floor instance of template."""
    if room_item.interactable_id:
        if not container_interactable_active_for_character(
            character, room_item.interactable_id
        ):
            return False
    if room_item.visible_quest_state_id:
        try:
            st = room_item.visible_quest_state
        except ObjectDoesNotExist:
            return False
        if not CharacterQuestProgress.objects.filter(
            character=character,
            quest_id=st.quest_id,
            current_state_id=st.id,
        ).exists():
            return False
    if not room_item.allow_repeat_while_carrying and character_carries_item_template(
        character, room_item.item_id
    ):
        return False
    if room_item.mint_policy == RoomItem.MintPolicy.ONCE_EVER:
        if RoomItemCharacterClaim.objects.filter(
            room_item_id=room_item.id, character_id=character.id
        ).exists():
            return False
    elif not room_item.allow_repeat_while_carrying and RoomItemSpawn.objects.filter(
        room_item_id=room_item.id, character_id=character.id
    ).exists():
        return False
    if room_item.item_id in floor_template_ids_in_room:
        return False
    return True


def character_carries_item_template(character: Character, item_id: int) -> bool:
    for iid in character.inventory or []:
        inst = ItemInstance.objects.filter(pk=iid, owner_character_id=character.pk).first()
        if inst and inst.item_id == item_id:
            return True
    for attr in SLOT_ATTRS:
        inst = getattr(character, attr, None)
        if inst and inst.item_id == item_id:
            return True
    return False


def can_spawn_search_quest_floor_item(
    character: Character,
    room_id: int,
    item_id: int,
    quest_state_id: int,
) -> bool:
    """Eligible to mint a quest search floor item (quest state + while-instance duplicate rules)."""
    st = QuestState.objects.filter(pk=quest_state_id).only("id", "quest_id").first()
    if not st:
        return False
    if not CharacterQuestProgress.objects.filter(
        character=character,
        quest_id=st.quest_id,
        current_state_id=st.id,
    ).exists():
        return False
    if character_carries_item_template(character, item_id):
        return False
    if ItemInstance.objects.filter(
        room_id=room_id,
        owner_character__isnull=True,
        container_interactable__isnull=True,
        item_id=item_id,
    ).exists():
        return False
    return True


def ensure_quests_started_from_npc(character: Character, npc: Npc) -> None:
    """Create CharacterQuestProgress at initial state for quests referenced by this NPC's dialogues."""
    quest_ids = (
        NpcDialogue.objects.filter(npc=npc, quest_id__isnull=False)
        .values_list("quest_id", flat=True)
        .distinct()
    )
    for qid in quest_ids:
        if CharacterQuestProgress.objects.filter(character=character, quest_id=qid).exists():
            continue
        initial = QuestState.objects.filter(quest_id=qid, is_initial=True).first()
        if not initial:
            initial = QuestState.objects.filter(quest_id=qid).order_by("sort_order", "id").first()
        if initial:
            CharacterQuestProgress.objects.get_or_create(
                character=character,
                quest_id=qid,
                defaults={"current_state": initial},
            )


def _npc_says_line(npc: Npc, utterance: str) -> str:
    """Format as: Name says: utterance. (single trailing period)"""
    u = (utterance or "").strip()
    if not u:
        u = "…"
    u = u.rstrip(".")
    return f"{npc.name} says: {u}."


def _with_trainer_xp_hint(character: Character, npc: Npc, line: str) -> str:
    if not npc.is_trainer:
        return line
    need = int(character.level) * XP_PER_LEVEL
    trimmed = (line or "").rstrip()
    if trimmed.endswith("."):
        trimmed = trimmed[:-1]
    return f"{trimmed} (Training requires {need} XP; you have {character.xp})."


def resolve_npc_dialogue(character: Character, npc: Npc) -> str:
    cqps = {
        p.quest_id: p
        for p in CharacterQuestProgress.objects.filter(character=character).select_related(
            "current_state"
        )
    }
    dialogues = NpcDialogue.objects.filter(npc=npc).select_related("quest", "quest_state").order_by(
        "-priority", "id"
    )
    for d in dialogues:
        if d.quest_id is None:
            raw = (d.text or "").strip()
            return _with_trainer_xp_hint(
                character, npc, _npc_says_line(npc, raw or "I'm here.")
            )
        cqp = cqps.get(d.quest_id)
        if not cqp:
            continue
        if d.quest_state_id and cqp.current_state_id != d.quest_state_id:
            continue
        return _with_trainer_xp_hint(
            character, npc, _npc_says_line(npc, (d.text or "").strip() or "…")
        )
    return _with_trainer_xp_hint(
        character, npc, _npc_says_line(npc, "I don't have much to say.")
    )


def try_item_transitions_on_talk(character: Character, npc: Npc) -> list[str]:
    """Fire quest transitions that require an item in inventory, tied to this NPC via dialogue."""
    lines: list[str] = []
    for cqp in CharacterQuestProgress.objects.filter(character=character).select_related(
        "quest", "current_state"
    ):
        transitions = QuestTransition.objects.filter(
            quest=cqp.quest,
            from_state=cqp.current_state,
            requires_item__isnull=False,
        ).order_by("sort_order", "id")
        for tr in transitions:
            if not character_has_item_template_quantity(
                character, tr.requires_item_id, getattr(tr, "requires_item_quantity", 1)
            ):
                continue
            if not NpcDialogue.objects.filter(
                npc=npc,
                quest_id=cqp.quest_id,
                quest_state_id=cqp.current_state_id,
            ).exists():
                continue
            lines.extend(apply_transition(character, tr))
            return lines
    return lines


@transaction.atomic
def apply_transition(character: Character, transition: QuestTransition) -> list[str]:
    """Move quest state and run effects. Caller should reload character after."""
    cqp = CharacterQuestProgress.objects.select_for_update().get(
        character=character,
        quest=transition.quest,
    )
    if cqp.current_state_id != transition.from_state_id:
        return ["Nothing happens."]
    out: list[str] = []
    cqp.current_state = transition.to_state
    if transition.revert_after_minutes:
        mins = max(1, int(transition.revert_after_minutes))
        rid = transition.revert_to_state_id or transition.from_state_id
        cqp.quest_revert_at = timezone.now() + timedelta(minutes=mins)
        cqp.quest_revert_to_state_id = rid
    else:
        cqp.quest_revert_at = None
        cqp.quest_revert_to_state_id = None
    cqp.save(
        update_fields=[
            "current_state",
            "updated_at",
            "quest_revert_at",
            "quest_revert_to_state",
        ]
    )
    character = Character.objects.select_for_update().get(pk=character.pk)
    req_id = transition.requires_item_id
    if req_id:
        has_remove_effect = transition.effects.filter(
            kind=QuestEffect.Kind.REMOVE_ITEM_TEMPLATE,
            item_id=req_id,
        ).exists()
        if not has_remove_effect:
            qty = max(1, int(getattr(transition, "requires_item_quantity", 1) or 1))
            removed_labels = _remove_item_template_quantity(character, req_id, qty)
            for label in removed_labels:
                out.append(f"You give up the {label}.")
            character = Character.objects.select_for_update().get(pk=character.pk)
    for eff in transition.effects.order_by("sort_order", "id"):
        out.extend(_apply_effect(character, eff))
    return out


def apply_due_quest_reverts(character: Character) -> None:
    """Silent rewind of quest state when scheduled revert time has passed."""
    now = timezone.now()
    with transaction.atomic():
        for cqp in CharacterQuestProgress.objects.select_for_update().filter(
            character_id=character.pk,
            quest_revert_at__isnull=False,
            quest_revert_at__lte=now,
        ):
            target_id = cqp.quest_revert_to_state_id
            cqp.quest_revert_at = None
            cqp.quest_revert_to_state_id = None
            if target_id:
                cqp.current_state_id = target_id
                cqp.save(
                    update_fields=[
                        "current_state",
                        "quest_revert_at",
                        "quest_revert_to_state",
                        "updated_at",
                    ]
                )
            else:
                cqp.save(update_fields=["quest_revert_at", "quest_revert_to_state", "updated_at"])


def sync_character_world_before_session(character: Character) -> Character:
    """Apply due quest reverts and clear expired container focus; return a fresh Character row."""
    apply_due_quest_reverts(character)
    ch = Character.objects.select_related(
        "spawn_room", "character_class", "current_room", "current_room__area"
    ).get(pk=character.pk)
    if (
        ch.container_focus_interactable_id
        and ch.container_focus_expires_at
        and timezone.now() >= ch.container_focus_expires_at
    ):
        ch.container_focus_interactable_id = None
        ch.container_focus_expires_at = None
        ch.save(
            update_fields=[
                "container_focus_interactable",
                "container_focus_expires_at",
                "updated_at",
            ]
        )
    return ch


def _apply_effect(character: Character, eff: QuestEffect) -> list[str]:
    out: list[str] = []
    kind = eff.kind
    if kind == QuestEffect.Kind.GRANT_XP:
        n = max(0, int(eff.amount))
        if n:
            character.xp = int(character.xp) + n
            character.save(update_fields=["xp", "updated_at"])
            out.append(f"You gain {n} XP.")
    elif kind == QuestEffect.Kind.GRANT_GOLD:
        n = max(0, int(eff.amount))
        if n:
            character.gold = int(character.gold) + n
            character.save(update_fields=["gold", "updated_at"])
            out.append(f"You gain {n} gold.")
    elif kind == QuestEffect.Kind.GRANT_ITEM:
        if eff.item_id:
            inst = ItemInstance.objects.create(
                item_id=eff.item_id,
                owner_character=character,
                room=None,
            )
            inv = list(character.inventory or [])
            character.inventory = [inst.pk] + [x for x in inv if x != inst.pk]
            character.save(update_fields=["inventory", "updated_at"])
            out.append(f"You receive {display_name_for_instance(inst)}.")
    elif kind == QuestEffect.Kind.REMOVE_ITEM_TEMPLATE:
        if eff.item_id:
            qty = max(1, int(eff.amount or 1))
            removed_labels = _remove_item_template_quantity(character, eff.item_id, qty)
            for label in removed_labels:
                out.append(f"You give up the {label}.")
    elif kind == QuestEffect.Kind.REALM_UNLOCK_EXIT_TIMED:
        if eff.room_exit_id:
            ex = RoomExit.objects.get(pk=eff.room_exit_id)
            seconds = max(1, int(eff.amount) * 60) if eff.amount else int(ex.unlock_duration_seconds)
            _set_realm_unlock(ex, seconds=seconds)
            out.append("Something gives way.")
    elif kind == QuestEffect.Kind.CHARACTER_UNLOCK_EXIT:
        if eff.room_exit_id:
            ex = RoomExit.objects.get(pk=eff.room_exit_id)
            _set_character_unlock(character, ex)
            out.append("Something gives way.")
    return out


def _remove_one_instance_of_template(character: Character, item_template_id: int) -> str | None:
    for iid in character.inventory or []:
        inst = ItemInstance.objects.filter(pk=iid, owner_character_id=character.pk).first()
        if inst and inst.item_id == item_template_id:
            return _delete_instance_from_character(character, inst)
    for attr in SLOT_ATTRS:
        inst = getattr(character, attr, None)
        if inst and inst.item_id == item_template_id:
            return _delete_instance_from_character(character, inst)
    return None


def _remove_item_template_quantity(
    character: Character, item_template_id: int, qty: int
) -> list[str]:
    """Remove up to `qty` quantity of a template across inventory stacks + equipped.

    Returns display labels (one per affected instance removal/decrement) for narration.
    """
    remaining = max(0, int(qty or 0))
    if remaining <= 0:
        return []
    labels: list[str] = []

    # Prefer inventory stacks first (so equipped doesn't unexpectedly pop off).
    for iid in list(character.inventory or []):
        if remaining <= 0:
            break
        inst = ItemInstance.objects.select_for_update().filter(
            pk=iid, owner_character_id=character.pk
        ).first()
        if not inst or inst.item_id != item_template_id:
            continue
        held = max(1, int(inst.quantity or 1))
        if held <= remaining:
            labels.append(display_name_for_instance(inst))
            _delete_instance_from_character(character, inst)
            remaining -= held
            character = Character.objects.select_for_update().get(pk=character.pk)
            continue
        # Partial decrement on stack.
        inst.quantity = held - remaining
        inst.save(update_fields=["quantity", "updated_at"])
        labels.append(display_name_for_instance(inst))
        remaining = 0

    # Then equipped (each counts as 1).
    if remaining > 0:
        character = Character.objects.select_for_update().get(pk=character.pk)
    for attr in SLOT_ATTRS:
        if remaining <= 0:
            break
        inst = getattr(character, attr, None)
        if not inst or inst.item_id != item_template_id:
            continue
        labels.append(display_name_for_instance(inst))
        _delete_instance_from_character(character, inst)
        remaining -= 1
        character = Character.objects.select_for_update().get(pk=character.pk)

    return labels


def _delete_instance_from_character(character: Character, inst: ItemInstance) -> str:
    label = display_name_for_instance(inst)
    char = Character.objects.select_for_update().get(pk=character.pk)
    inst = ItemInstance.objects.select_for_update().get(pk=inst.pk)
    for attr in SLOT_ATTRS:
        cur = getattr(char, attr, None)
        if cur and cur.pk == inst.pk:
            setattr(char, attr, None)
            break
    inv = list(char.inventory or [])
    if inst.pk in inv:
        inv = [x for x in inv if x != inst.pk]
        char.inventory = inv
    inst.delete()
    char.save()
    return label


def name_token_prefix_match(name_lower: str, q: str) -> bool:
    """True if any whitespace-separated token in ``name_lower`` starts with ``q``."""
    return any(tok.startswith(q) for tok in name_lower.split())


def find_npc_in_room(character: Character, query: str) -> Npc | None:
    q = (query or "").strip().lower()
    if not q:
        return None
    npcs = Npc.objects.filter(room_id=character.current_room_id)
    for n in npcs.order_by("id"):
        if n.name.lower() == q or n.slug.lower() == q:
            return n
    for n in npcs.order_by("id"):
        if n.name.lower().startswith(q) or n.slug.lower().startswith(q):
            return n
    for n in npcs.order_by("id"):
        if name_token_prefix_match(n.name.lower(), q):
            return n
    return None


def find_interactable_in_room(character: Character, query: str) -> Interactable | None:
    q = (query or "").strip().lower()
    if not q:
        return None
    objs = Interactable.objects.filter(room_id=character.current_room_id)
    for o in objs.order_by("id"):
        if o.name.lower() == q or o.slug.lower() == q:
            return o
    for o in objs.order_by("id"):
        if o.name.lower().startswith(q) or o.slug.lower().startswith(q):
            return o
    for o in objs.order_by("id"):
        if name_token_prefix_match(o.name.lower(), q):
            return o
    return None


def _natural_join_phrases(items: list[str]) -> str:
    if len(items) == 1:
        return items[0]
    if len(items) == 2:
        return f"{items[0]} and {items[1]}"
    return ", ".join(items[:-1]) + ", and " + items[-1]


@transaction.atomic
def handle_interactable_use(character: Character, obj: Interactable) -> list[str]:
    assert isinstance(obj, Interactable)
    char = Character.objects.select_for_update().get(pk=character.pk)
    out: list[str] = []
    k = obj.kind
    if k == Interactable.Kind.SCONCE:
        aid = char.current_room.area_id
        area_ids = [int(x) for x in (char.sconce_full_narrative_area_ids or [])]
        if aid in area_ids:
            out.append("The lights are already on in this zone.")
        else:
            area_ids.append(aid)
            char.sconce_full_narrative_area_ids = area_ids
            char.save(update_fields=["sconce_full_narrative_area_ids", "updated_at"])
            out.append(f"Using the {obj.name} permanently lights up this zone.")
    elif k == Interactable.Kind.MAP:
        now = timezone.now()
        active = (
            char.minimap_full_reveal_area_id == char.current_room.area_id
            and char.minimap_full_reveal_until
            and now < char.minimap_full_reveal_until
        )
        if active:
            char.minimap_full_reveal_until = None
            char.minimap_full_reveal_area = None
            char.save(
                update_fields=[
                    "minimap_full_reveal_until",
                    "minimap_full_reveal_area",
                    "updated_at",
                ]
            )
            out.append("You fold the map away; the maze closes back into shadow.")
        else:
            mins = max(1, int(obj.map_reveal_minutes or 60))
            char.minimap_full_reveal_until = now + timedelta(minutes=mins)
            char.minimap_full_reveal_area_id = char.current_room.area_id
            char.save(
                update_fields=[
                    "minimap_full_reveal_until",
                    "minimap_full_reveal_area",
                    "updated_at",
                ]
            )
            out.append("The passages you've seen are laid bare on your map.")
    elif k == Interactable.Kind.CONTAINER:
        char.opened_container_interactable_id = obj.pk
        char.container_focus_interactable_id = obj.pk
        char.container_focus_expires_at = None
        char.save(
            update_fields=[
                "opened_container_interactable",
                "container_focus_interactable",
                "container_focus_expires_at",
                "updated_at",
            ]
        )
        out.append(f"You open the {obj.name}.")
        floor_ids = unowned_floor_item_template_ids_in_room(char.current_room_id)
        inside: list[str] = []
        for inst in ItemInstance.objects.filter(
            room_id=char.current_room_id,
            container_interactable_id=obj.pk,
            owner_character__isnull=True,
        ).select_related("item", "visible_quest_state"):
            if floor_item_visible_to_character(char, inst):
                inside.append(display_name_for_instance(inst))
        for ri in RoomItem.objects.filter(
            room_id=char.current_room_id,
            interactable_id=obj.pk,
        ).select_related("item", "visible_quest_state"):
            if room_item_visible_to_character(char, ri, floor_ids):
                inside.append(ri.nickname if ri.nickname else ri.item.name)
        if inside:
            out.append(f"Inside: {_natural_join_phrases(inside)}.")
        else:
            out.append("It's empty.")

    character = char
    if obj.unlocks_exit_id:
        ex = RoomExit.objects.get(pk=obj.unlocks_exit_id)
        _set_realm_unlock(ex, seconds=int(ex.unlock_duration_seconds))
        if obj.unlocks_exit_secondary_id:
            ex2 = RoomExit.objects.get(pk=obj.unlocks_exit_secondary_id)
            _set_realm_unlock(ex2, seconds=int(ex2.unlock_duration_seconds))
        out.append("You work the mechanism. Something shifts.")
    if obj.quest_transition_id:
        tr = QuestTransition.objects.select_related("from_state", "to_state", "quest").get(
            pk=obj.quest_transition_id
        )
        cqp = CharacterQuestProgress.objects.filter(
            character=character, quest=tr.quest_id
        ).first()
        if not cqp or cqp.current_state_id != tr.from_state_id:
            if not out:
                out.append("Nothing happens.")
            return out
        if tr.requires_item_id and not character_has_item_template_quantity(
            character,
            tr.requires_item_id,
            getattr(tr, "requires_item_quantity", 1),
        ):
            if not out:
                out.append("Nothing happens.")
            return out
        out.extend(apply_transition(character, tr))
    if not out:
        out.append("Nothing happens.")
    return out
