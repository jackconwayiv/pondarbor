from django.db import migrations


OLD_STARTER_SLUGS = (
    "soiled-suitcoat",
    "oil-stained-smock",
    "hospital-gown",
    "space-blanket",
    "wet-rags",
    "chipped-gavel",
    "greasy-wrench",
    "rusty-hacksaw",
    "stolen-blaster",
    "dessicated-branch",
)


def replace_starter_items(apps, schema_editor):
    Item = apps.get_model("qff", "Item")

    Item.objects.filter(slug__in=OLD_STARTER_SLUGS).delete()

    armors = [
        ("soiled-leathers", "Soiled Leathers"),
        ("fleabitten-cloak", "Fleabitten Cloak"),
        ("unwashed-robe", "Unwashed Robe"),
        ("bloodstained-jacket", "Bloodstained Jacket"),
    ]
    weapons = [
        ("rusty-sword", "Rusty Sword"),
        ("dented-knife", "Dented Knife"),
        ("broken-wand", "Broken Wand"),
        ("wooden-spoon", "Wooden Spoon"),
    ]

    for slug, name in armors:
        Item.objects.update_or_create(
            slug=slug,
            defaults={
                "name": name,
                "item_type": "armor",
                "slot": "chest",
                "description": "",
                "lore": "",
                "lore_chance": None,
                "cost": 1,
                "armor": 1,
                "damage": 0,
                "dmg_type": "physical",
                "element": "",
                "consumable": False,
            },
        )

    for slug, name in weapons:
        Item.objects.update_or_create(
            slug=slug,
            defaults={
                "name": name,
                "item_type": "weapon",
                "slot": "main_hand",
                "description": "",
                "lore": "",
                "lore_chance": None,
                "cost": 1,
                "armor": 0,
                "damage": 1,
                "dmg_type": "physical",
                "element": "",
                "consumable": False,
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("qff", "0056_item_required_glyphs"),
    ]

    operations = [
        migrations.RunPython(replace_starter_items, migrations.RunPython.noop),
    ]
