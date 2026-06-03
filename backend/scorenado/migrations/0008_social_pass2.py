import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def assign_claim_tokens(apps, schema_editor):
    GamePlayer = apps.get_model("scorenado", "GamePlayer")
    for row in GamePlayer.objects.all():
        row.claim_token = uuid.uuid4()
        row.save(update_fields=["claim_token"])


class Migration(migrations.Migration):

    dependencies = [
        ("scorenado", "0007_template_visibility"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.DeleteModel(
            name="GameInvite",
        ),
        migrations.AddField(
            model_name="gameplayer",
            name="claim_token",
            field=models.UUIDField(default=uuid.uuid4, editable=False, null=True),
        ),
        migrations.RunPython(assign_claim_tokens, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="gameplayer",
            name="claim_token",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AddField(
            model_name="gameplayer",
            name="claimed_user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="scorenado_claimed_seats",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="gameplayer",
            name="invite_status",
            field=models.CharField(
                blank=True,
                choices=[
                    ("pending", "Pending"),
                    ("accepted", "Accepted"),
                    ("rejected", "Rejected"),
                    ("cancelled", "Cancelled"),
                ],
                max_length=16,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="gameplayer",
            name="invited_user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="scorenado_seat_invites_received",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.CreateModel(
            name="GameTag",
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
                ("label", models.CharField(max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "game",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tags",
                        to="scorenado.game",
                    ),
                ),
                (
                    "player",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tags",
                        to="scorenado.gameplayer",
                    ),
                ),
            ],
            options={
                "ordering": ["created_at", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="gameplayer",
            index=models.Index(
                fields=["invited_user", "invite_status"],
                name="scorenado_ga_invited_8a1b2c_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="gameplayer",
            index=models.Index(
                fields=["claimed_user"],
                name="scorenado_ga_claimed_9d3e4f_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="gametag",
            index=models.Index(
                fields=["game", "created_at"],
                name="scorenado_ga_game_id_1a2b3c_idx",
            ),
        ),
    ]
