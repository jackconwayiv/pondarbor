from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("qff", "0045_character_torch_radius_sconce_narrative_areas"),
    ]

    operations = [
        migrations.AddField(
            model_name="roomexit",
            name="consume_key_on_pass",
            field=models.BooleanField(default=True),
        ),
    ]
