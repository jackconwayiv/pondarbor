from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0009_ingredient_grocery_pantry"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="songaday_visibility",
            field=models.CharField(
                choices=[
                    ("private", "Private (only me)"),
                    ("friends_only", "Friends only"),
                    ("all_approved", "All approved users"),
                ],
                default="friends_only",
                max_length=20,
            ),
        ),
    ]
