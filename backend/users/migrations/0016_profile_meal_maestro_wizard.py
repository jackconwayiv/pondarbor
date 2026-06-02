from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0015_profile_meal_slots_per_day"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="meal_maestro_setup_completed",
            field=models.BooleanField(
                default=False,
                help_text="User finished the Meal Maestro setup wizard.",
            ),
        ),
        migrations.AddField(
            model_name="profile",
            name="meal_dietary_preferences",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Dietary labels from setup; seeds meal tags and default pantry dietary tags.",
            ),
        ),
    ]
