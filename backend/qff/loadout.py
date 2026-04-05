"""Starting equipment for new characters — driven by CharacterClass starter Item FKs."""

from __future__ import annotations

from django.db import transaction

from qff.models import Character, CharacterClass, Item, ItemInstance

# Fallback when class has no chest/main templates (jacket + stick).
DEFAULT_STARTER_SLUGS = ("denim-jacket", "wooden-stick")


def _items_from_slugs() -> tuple[Item | None, Item | None]:
    jacket = Item.objects.filter(slug=DEFAULT_STARTER_SLUGS[0]).first()
    stick = Item.objects.filter(slug=DEFAULT_STARTER_SLUGS[1]).first()
    return jacket, stick


@transaction.atomic
def apply_starting_loadout(character: Character) -> None:
    """Equip this class's chest + main-hand starters (no head). Idempotent for new chars."""
    if character.chest_item_id or character.main_hand_item_id:
        return

    cc = CharacterClass.objects.select_related(
        "starter_chest_item",
        "starter_main_hand_item",
    ).get(pk=character.character_class_id)

    chest_it = cc.starter_chest_item
    mh_it = cc.starter_main_hand_item

    if not (chest_it and mh_it):
        jacket, stick = _items_from_slugs()
        if not (jacket and stick):
            return
        chest_it, mh_it = jacket, stick

    chest_inst = ItemInstance.objects.create(
        item=chest_it,
        owner_character=character,
        room=None,
    )
    main_inst = ItemInstance.objects.create(
        item=mh_it,
        owner_character=character,
        room=None,
    )
    character.chest_item = chest_inst
    character.main_hand_item = main_inst
    character.inventory = character.inventory or []
    character.save(
        update_fields=[
            "chest_item_id",
            "main_hand_item_id",
            "inventory",
            "updated_at",
        ]
    )
