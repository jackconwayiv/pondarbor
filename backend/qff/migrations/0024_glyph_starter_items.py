# Glyph-starter items 01-08 (chest by first glyph, weapon by second).

from django.db import migrations


def seed_glyph_starter_items(apps, schema_editor):
    Item = apps.get_model("qff", "Item")

    armors = [
        {
            "slug": "stained-jerkin",
            "name": "Stained Jerkin",
            "armor": 2,
            "description": "A rough leather jerkin with old stains.",
        },
        {
            "slug": "tattered-cloak",
            "name": "Tattered Cloak",
            "armor": 2,
            "description": "A cloak worn thin at the edges.",
        },
        {
            "slug": "stuffy-robe",
            "name": "Stuffy Robe",
            "armor": 1,
            "description": "Heavy fabric that catches every draft.",
        },
        {
            "slug": "threadbare-gown",
            "name": "Threadbare Gown",
            "armor": 1,
            "description": "Soft cloth, faded from long use.",
        },
    ]

    weapons = [
        {
            "slug": "rusty-sword",
            "name": "Rusty Sword",
            "damage": 2,
            "description": "A notched blade with spots of rust.",
        },
        {
            "slug": "chipped-knife",
            "name": "Chipped Knife",
            "damage": 2,
            "description": "A short blade with a chipped edge.",
        },
        {
            "slug": "bent-staff",
            "name": "Bent Staff",
            "damage": 1,
            "description": "A wooden staff with a slight bend.",
        },
        {
            "slug": "dull-scepter",
            "name": "Dull Scepter",
            "damage": 1,
            "description": "A ceremonial rod with a dull metal head.",
        },
    ]

    for d in armors:
        Item.objects.update_or_create(
            slug=d["slug"],
            defaults={
                "name": d["name"],
                "item_type": "armor",
                "slot": "chest",
                "description": d["description"],
                "lore": "",
                "lore_chance": None,
                "cost": 1,
                "armor": d["armor"],
                "damage": 0,
                "dmg_type": "physical",
                "consumable": False,
            },
        )

    for d in weapons:
        Item.objects.update_or_create(
            slug=d["slug"],
            defaults={
                "name": d["name"],
                "item_type": "weapon",
                "slot": "main_hand",
                "description": d["description"],
                "lore": "",
                "lore_chance": None,
                "cost": 1,
                "armor": 0,
                "damage": d["damage"],
                "dmg_type": "physical",
                "consumable": False,
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0023_character_glyphs_and_glyph_classes"),
    ]

    operations = [
        migrations.RunPython(seed_glyph_starter_items, migrations.RunPython.noop),
    ]
