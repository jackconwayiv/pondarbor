# Generated manually for glyph-based classes

from django.db import migrations, models


GLYPH_CLASSES = [
    (
        "bulwark",
        "Bulwark",
        "A brutal frontliner who overwhelms enemies with sheer force, heavy armor, and relentless pressure.",
        10,
    ),
    (
        "scoundrel",
        "Scoundrel",
        "A stealthy finesse fighter who relies on speed, evasion, and quick strikes.",
        11,
    ),
    (
        "magister",
        "Magister",
        "A dedicated spellcaster focused on magical damage and arcane knowledge.",
        12,
    ),
    (
        "devotee",
        "Devotee",
        "A supportive mystic focused on awareness, protection, and sustaining magic.",
        13,
    ),
    (
        "skirmisher",
        "Skirmisher",
        "A fast, aggressive fighter who blends force with mobility and precision.",
        14,
    ),
    (
        "wayfarer",
        "Wayfarer",
        "A capable survivor who combines martial skill with adaptability and awareness.",
        15,
    ),
    (
        "savant",
        "Savant",
        "A battle-mage who pairs physical force with destructive magic.",
        16,
    ),
    (
        "spellblade",
        "Spellblade",
        "A close-range combatant who combines weapon skill with offensive spells.",
        17,
    ),
    (
        "warden",
        "Warden",
        "A durable protector who mixes martial strength with awareness and support magic.",
        18,
    ),
    (
        "champion",
        "Champion",
        "A devoted frontliner who holds the line, absorbs pressure, and rallies those beside them.",
        19,
    ),
    (
        "virtuoso",
        "Virtuoso",
        "A clever arcane duelist who uses finesse, precision, and magical control.",
        20,
    ),
    (
        "tinker",
        "Tinker",
        "A nimble problem-solver who mixes practical knowledge, quick hands, and magic.",
        21,
    ),
    (
        "firebrand",
        "Firebrand",
        "A swift zealot who fights with speed, conviction, and relentless pressure.",
        22,
    ),
    (
        "seeker",
        "Seeker",
        "An alert scout who uses finesse and awareness to pursue hidden things.",
        23,
    ),
    (
        "physicker",
        "Physicker",
        "A healer and support caster with deep practical and magical knowledge.",
        24,
    ),
    (
        "visionary",
        "Visionary",
        "An insightful mystic who blends devotion, knowledge, and supernatural perception.",
        25,
    ),
]


def seed_glyph_classes(apps, schema_editor):
    CharacterClass = apps.get_model("qff", "CharacterClass")
    template = (
        CharacterClass.objects.filter(slug__in=["nurse", "gym_rat"]).order_by("sort_order").first()
    )
    chest_id = getattr(template, "starter_chest_item_id", None) if template else None
    mh_id = getattr(template, "starter_main_hand_item_id", None) if template else None
    p1 = template.priority_stat_1 if template else "gains"
    p2 = template.priority_stat_2 if template else "guts"

    for slug, name, description, sort_order in GLYPH_CLASSES:
        CharacterClass.objects.get_or_create(
            slug=slug,
            defaults={
                "name": name,
                "description": description,
                "sort_order": sort_order,
                "starter_chest_item_id": chest_id,
                "starter_main_hand_item_id": mh_id,
                "priority_stat_1": p1,
                "priority_stat_2": p2,
                "extra_data": {},
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0022_qff_ineffective_input"),
    ]

    operations = [
        migrations.AddField(
            model_name="character",
            name="glyphs",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Ordered glyph ids from character creation: war, survival, study, devotion.",
            ),
        ),
        migrations.RunPython(seed_glyph_classes, migrations.RunPython.noop),
    ]
