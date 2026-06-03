import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("scorenado", "0006_alter_default_round_count_default"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="scoreboardtemplate",
            name="is_published",
            field=models.BooleanField(
                default=False,
                help_text="When true, any user may start games from this template (read-only).",
            ),
        ),
        migrations.CreateModel(
            name="GameInvite",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("accepted", "Accepted"),
                            ("declined", "Declined"),
                        ],
                        default="pending",
                        max_length=16,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "game",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="invites",
                        to="scorenado.game",
                    ),
                ),
                (
                    "invitee",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="scorenado_game_invites",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="gameinvite",
            index=models.Index(
                fields=["invitee", "status"],
                name="scorenado_ga_invitee_7f0e0d_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="gameinvite",
            constraint=models.UniqueConstraint(
                fields=("game", "invitee"),
                name="uniq_scorenado_game_invitee",
            ),
        ),
    ]
