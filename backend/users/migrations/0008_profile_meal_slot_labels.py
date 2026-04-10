from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0007_profile_meal_maestro"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="meal_slot_labels",
            field=models.JSONField(blank=True, null=True),
        ),
    ]
