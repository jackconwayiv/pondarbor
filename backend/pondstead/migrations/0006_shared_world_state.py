import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("pondstead", "0005_player_unique_user_per_game"),
    ]

    operations = [
        migrations.CreateModel(
            name="PondsteadSharedWorldState",
            fields=[
                (
                    "game",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        primary_key=True,
                        related_name="shared_world_row",
                        serialize=False,
                        to="pondstead.pondsteadgame",
                    ),
                ),
                ("revision", models.PositiveIntegerField(default=0)),
                ("data", models.JSONField(default=dict)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
    ]

