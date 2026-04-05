# Generated manually — starting Item templates + loadout for existing characters.

from django.db import migrations


def seed_items_and_loadout(apps, schema_editor):
    Item = apps.get_model("qff", "Item")
    ItemInstance = apps.get_model("qff", "ItemInstance")
    Character = apps.get_model("qff", "Character")

    defs = [
        {
            "slug": "baseball-cap",
            "name": "Baseball Cap",
            "slot": "head",
            "item_type": "armor",
            "description": "A worn-in cap with a mysterious stain.",
            "lore": "It once belonged to someone who never missed a game.",
            "lore_chance": 40,
        },
        {
            "slug": "denim-jacket",
            "name": "Denim Jacket",
            "slot": "chest",
            "item_type": "armor",
            "description": "Classic blue denim. Smells faintly of adventure.",
            "lore": "Stitched with thread from the first quest-giver's coat.",
            "lore_chance": 45,
        },
        {
            "slug": "wooden-stick",
            "name": "Wooden Stick",
            "slot": "main_hand",
            "item_type": "weapon",
            "description": "A sturdy branch. Better than nothing.",
            "damage": 2,
            "lore": "Carved from the World Tree's smallest cousin.",
            "lore_chance": 35,
        },
    ]

    slug_to_item = {}
    for d in defs:
        obj, _ = Item.objects.update_or_create(
            slug=d["slug"],
            defaults={
                "name": d["name"],
                "item_type": d.get("item_type", ""),
                "slot": d["slot"],
                "description": d.get("description", ""),
                "lore": d.get("lore", ""),
                "lore_chance": d.get("lore_chance"),
                "damage": d.get("damage", 0),
            },
        )
        slug_to_item[d["slug"]] = obj

    for char in Character.objects.all():
        if char.head_item_id:
            continue
        cap = ItemInstance.objects.create(
            item=slug_to_item["baseball-cap"],
            owner_character=char,
            room=None,
        )
        jacket = ItemInstance.objects.create(
            item=slug_to_item["denim-jacket"],
            owner_character=char,
            room=None,
        )
        stick = ItemInstance.objects.create(
            item=slug_to_item["wooden-stick"],
            owner_character=char,
            room=None,
        )
        char.head_item_id = cap.id
        char.chest_item_id = jacket.id
        char.main_hand_item_id = stick.id
        char.inventory = []
        char.save(
            update_fields=[
                "head_item_id",
                "chest_item_id",
                "main_hand_item_id",
                "inventory",
                "updated_at",
            ]
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0006_items_stats_broadcasts"),
    ]

    operations = [
        migrations.RunPython(seed_items_and_loadout, noop_reverse),
    ]
