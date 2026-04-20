"""Starting equipment for new characters — glyph-based starters or CharacterClass starter Item FKs."""

from __future__ import annotations

from django.db import transaction

from qff.glyph_starting_items import resolve_starter_item_slugs
from qff.models import Character, CharacterClass, Item, ItemInstance


def _equip_chest_and_main(character: Character, chest_it: Item, mh_it: Item) -> None:
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


@transaction.atomic
def apply_starting_loadout(character: Character) -> None:
    """Equip chest + main-hand starters (no head). Idempotent for new chars."""
    if character.chest_item_id or character.main_hand_item_id:
        return

    pair = resolve_starter_item_slugs(character.glyphs)
    if pair:
        chest_slug, mh_slug = pair
        chest_it = Item.objects.filter(slug=chest_slug).first()
        mh_it = Item.objects.filter(slug=mh_slug).first()
        if chest_it and mh_it:
            _equip_chest_and_main(character, chest_it, mh_it)
            return

    cc = CharacterClass.objects.select_related(
        "starter_chest_item",
        "starter_main_hand_item",
    ).get(pk=character.character_class_id)

    chest_it = cc.starter_chest_item
    mh_it = cc.starter_main_hand_item

    if not (chest_it and mh_it):
        return

    _equip_chest_and_main(character, chest_it, mh_it)
