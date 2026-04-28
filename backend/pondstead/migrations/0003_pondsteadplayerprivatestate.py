import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("pondstead", "0002_lobby_invites_envelope"),
    ]

    operations = [
        migrations.CreateModel(
            name="PondsteadPlayerPrivateState",
            fields=[
                (
                    "player",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        primary_key=True,
                        related_name="private_state_row",
                        serialize=False,
                        to="pondstead.pondsteadplayer",
                    ),
                ),
                ("data", models.JSONField(default=dict)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
    ]
