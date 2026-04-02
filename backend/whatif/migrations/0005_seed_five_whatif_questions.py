from django.db import migrations


def seed_questions(apps, schema_editor):
    WhatIfQuestion = apps.get_model("whatif", "WhatIfQuestion")

    # Replace all existing prompts with the canonical starter set.
    WhatIfQuestion.objects.all().delete()

    seed_rows = [
        {
            "prompt": "What if {subject} were a kind of fruit? Which would they be?",
            "answer_1": "Apple",
            "answer_2": "Orange",
            "answer_3": "Banana",
            "answer_4": "Pineapple",
            "answer_5": "Cherry",
            "answer_6": "Apricot",
        },
        {
            "prompt": "What if {subject} were choosing a weekend plan?",
            "answer_1": "Hiking a trail",
            "answer_2": "Binge a TV series",
            "answer_3": "Host a dinner",
            "answer_4": "Go to a museum",
            "answer_5": "Try a new cafe",
            "answer_6": "Sleep all day",
        },
        {
            "prompt": "What if {subject} got a surprise day off work?",
            "answer_1": "Deep clean the house",
            "answer_2": "Start a new hobby",
            "answer_3": "Road trip",
            "answer_4": "Watch movies",
            "answer_5": "Call friends",
            "answer_6": "Take a long nap",
        },
        {
            "prompt": "What if {subject} had to pick a party role?",
            "answer_1": "DJ",
            "answer_2": "Photographer",
            "answer_3": "Chef",
            "answer_4": "Games organizer",
            "answer_5": "Storyteller",
            "answer_6": "Quiet observer",
        },
        {
            "prompt": "What if {subject} were selecting a dream pet?",
            "answer_1": "Golden retriever",
            "answer_2": "Cat",
            "answer_3": "Parrot",
            "answer_4": "Turtle",
            "answer_5": "Bunny",
            "answer_6": "Fish tank",
        },
    ]

    WhatIfQuestion.objects.bulk_create([WhatIfQuestion(**row) for row in seed_rows])


class Migration(migrations.Migration):
    dependencies = [
        ("whatif", "0004_whatifgameresult_winner_display_name"),
    ]

    operations = [
        migrations.RunPython(seed_questions, migrations.RunPython.noop),
    ]
