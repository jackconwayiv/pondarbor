from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("achievements", "0005_closet_achievements"),
    ]

    operations = [
        migrations.AddField(
            model_name="userachievement",
            name="visible_to_friends",
            field=models.BooleanField(blank=True, null=True),
        ),
    ]
