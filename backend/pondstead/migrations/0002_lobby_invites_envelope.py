import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def wrap_world_json_envelope(apps, schema_editor):
    PondsteadGameState = apps.get_model("pondstead", "PondsteadGameState")
    for st in PondsteadGameState.objects.all():
        wj = st.world_json
        if not isinstance(wj, dict):
            continue
        if "world" in wj:
            continue
        st.world_json = {"world": wj, "undoStacksBySeat": {"0": [], "1": []}}
        st.save(update_fields=["world_json"])


def set_game_owners_from_seat0(apps, schema_editor):
    PondsteadGame = apps.get_model("pondstead", "PondsteadGame")
    PondsteadPlayer = apps.get_model("pondstead", "PondsteadPlayer")
    for g in PondsteadGame.objects.all():
        if g.owner_id:
            continue
        p0 = PondsteadPlayer.objects.filter(game_id=g.id, seat_index=0).first()
        if p0 and p0.user_id:
            g.owner_id = p0.user_id
            g.save(update_fields=["owner_id"])


class Migration(migrations.Migration):
    dependencies = [
        ("pondstead", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="pondsteadgame",
            name="last_activity_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pondsteadgame",
            name="last_calendar_new_day_phx_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pondsteadgame",
            name="max_players",
            field=models.PositiveSmallIntegerField(default=2),
        ),
        migrations.AddField(
            model_name="pondsteadgame",
            name="owner",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="pondstead_owned_games",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="pondsteadgame",
            name="started_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="pondsteadgame",
            name="status",
            field=models.CharField(
                choices=[("lobby", "Lobby"), ("active", "Active"), ("finished", "Finished")],
                default="lobby",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="pondsteadplayer",
            name="faction_color",
            field=models.CharField(blank=True, default="", max_length=16),
        ),
        migrations.AlterUniqueTogether(
            name="pondsteadgamestate",
            unique_together=set(),
        ),
        migrations.AlterUniqueTogether(
            name="pondsteadplayer",
            unique_together=set(),
        ),
        migrations.AddConstraint(
            model_name="pondsteadgamestate",
            constraint=models.UniqueConstraint(fields=("game", "revision"), name="pondstead_state_game_revision_uniq"),
        ),
        migrations.AddConstraint(
            model_name="pondsteadplayer",
            constraint=models.UniqueConstraint(fields=("game", "seat_index"), name="pondstead_player_game_seat_uniq"),
        ),
        migrations.CreateModel(
            name="PondsteadCampaignInvite",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("accepted", "Accepted"),
                            ("declined", "Declined"),
                            ("revoked", "Revoked"),
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
                        to="pondstead.pondsteadgame",
                    ),
                ),
                (
                    "invitee",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="pondstead_campaign_invites",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="pondsteadcampaigninvite",
            constraint=models.UniqueConstraint(fields=("game", "invitee"), name="pondstead_invite_game_invitee_uniq"),
        ),
        migrations.RunPython(wrap_world_json_envelope, migrations.RunPython.noop),
        migrations.RunPython(set_game_owners_from_seat0, migrations.RunPython.noop),
    ]
