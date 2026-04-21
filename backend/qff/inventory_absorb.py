"""Merge item quantities into a character's inventory (stacking)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from qff.models import ItemInstance

if TYPE_CHECKING:
    from qff.models import Character, Item


def effective_max_stack(item: "Item") -> int:
    if not item.stackable:
        return 1
    return max(1, min(9999, int(item.max_stack or 99)))


def _merge_meta_compatible(inst: ItemInstance, donor: ItemInstance | None) -> bool:
    if donor is None:
        return (
            not (inst.nickname or "").strip()
            and not inst.unlocked
            and not (inst.chars_failed_to_inspect or [])
        )
    return (
        (inst.nickname or "") == (donor.nickname or "")
        and bool(inst.unlocked) == bool(donor.unlocked)
        and list(inst.chars_failed_to_inspect or [])
        == list(donor.chars_failed_to_inspect or [])
    )


def _donor_instance_defaults(donor: ItemInstance | None) -> dict:
    if donor is None:
        return {}
    return {
        "nickname": donor.nickname,
        "unlocked": donor.unlocked,
        "chars_failed_to_inspect": list(donor.chars_failed_to_inspect or []),
        "visible_quest_state_id": donor.visible_quest_state_id,
    }


def absorb_item_quantity(
    character: "Character",
    item: "Item",
    qty: int,
    donor: ItemInstance | None = None,
) -> tuple[list[int], list[int]]:
    """Add qty units of template `item` to character inventory.

    Merges into existing locked stacks where possible.

    Returns ``(destination_pks, newly_created_pks)`` where:

    - ``destination_pks`` — every ItemInstance that received any of the absorbed
      quantity (merged-into stacks first, then new rows), deduplicated in order.
    - ``newly_created_pks`` — only rows created in this call (caller should
      ``_prepend_inv`` these in reverse order).

    ``character`` must already be select_for_update locked.
    """
    if qty < 1:
        return ([], [])

    if not item.stackable:
        new_pks: list[int] = []
        for _ in range(qty):
            inst = ItemInstance.objects.create(
                item=item,
                owner_character=character,
                room=None,
                quantity=1,
                **_donor_instance_defaults(donor),
            )
            new_pks.append(inst.pk)
        return (new_pks, new_pks)

    max_s = effective_max_stack(item)
    remaining = qty
    inv = list(character.inventory or [])
    merged_into: list[int] = []

    for iid in inv:
        if remaining <= 0:
            break
        inst = (
            ItemInstance.objects.select_for_update()
            .filter(pk=iid, owner_character_id=character.pk)
            .first()
        )
        if not inst or inst.item_id != item.id:
            continue
        if not _merge_meta_compatible(inst, donor):
            continue
        space = max_s - inst.quantity
        if space <= 0:
            continue
        add = min(space, remaining)
        inst.quantity = int(inst.quantity) + add
        ufields = ["quantity", "updated_at"]
        if donor is not None and donor.visible_quest_state_id:
            inst.visible_quest_state_id = donor.visible_quest_state_id
            ufields.append("visible_quest_state_id")
        inst.save(update_fields=ufields)
        merged_into.append(inst.pk)
        remaining -= add

    new_pks: list[int] = []
    defaults = _donor_instance_defaults(donor)
    while remaining > 0:
        chunk = min(max_s, remaining)
        inst = ItemInstance.objects.create(
            item=item,
            owner_character=character,
            room=None,
            quantity=chunk,
            **defaults,
        )
        new_pks.append(inst.pk)
        remaining -= chunk

    # Preserve order: merged stacks (first touch order), then new rows; dedupe.
    destination_pks = list(dict.fromkeys(merged_into + new_pks))
    return (destination_pks, new_pks)
