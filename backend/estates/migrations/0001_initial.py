from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="EstatesGame",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("status", models.CharField(choices=[("lobby", "Lobby"), ("active", "Active"), ("completed", "Completed")], default="lobby", max_length=16)),
                ("round", models.PositiveIntegerField(default=1)),
                ("is_solo", models.BooleanField(default=False)),
                ("victory_score", models.PositiveSmallIntegerField(default=7)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "player_1",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="estates_games_as_player_1", to=settings.AUTH_USER_MODEL),
                ),
                (
                    "player_2",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="estates_games_as_player_2", to=settings.AUTH_USER_MODEL),
                ),
                (
                    "winner_user",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="estates_games_won", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={
                "ordering": ["-updated_at", "-created_at"],
            },
        ),
        migrations.CreateModel(
            name="EstatesRoundState",
            fields=[
                (
                    "game",
                    models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, primary_key=True, related_name="round_state", serialize=False, to="estates.estatesgame"),
                ),
                ("round_number", models.PositiveIntegerField(default=1)),
                ("phase", models.CharField(choices=[("lobby", "Lobby"), ("placement", "Placement"), ("scoring", "Scoring"), ("cleanup", "Cleanup"), ("completed", "Completed")], default="lobby", max_length=16)),
                ("turn_player_seat", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("actions_taken_by_seat", models.JSONField(blank=True, default=dict)),
                ("placements_by_zone", models.JSONField(blank=True, default=dict)),
                ("pending_actor_seat", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("pending_action", models.CharField(blank=True, default="", max_length=64)),
                ("pending_payload", models.JSONField(blank=True, default=dict)),
                ("phase_started_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("status_message", models.CharField(blank=True, default="", max_length=255)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="EstatesPlayerState",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("seat_index", models.PositiveSmallIntegerField()),
                ("deck", models.JSONField(blank=True, default=list)),
                ("hand", models.JSONField(blank=True, default=list)),
                ("discard", models.JSONField(blank=True, default=list)),
                ("draw_bonus", models.PositiveSmallIntegerField(default=0)),
                ("is_starting_player", models.BooleanField(default=False)),
                ("score", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("game", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="player_states", to="estates.estatesgame")),
                (
                    "user",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="estates_player_states", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={
                "ordering": ["seat_index"],
            },
        ),
        migrations.CreateModel(
            name="EstatesGameEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sequence", models.PositiveIntegerField()),
                ("event_type", models.CharField(max_length=64)),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("game", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="events", to="estates.estatesgame")),
            ],
            options={
                "ordering": ["sequence", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="estatesgame",
            index=models.Index(fields=["status", "-updated_at"], name="estates_est_status_bed168_idx"),
        ),
        migrations.AddIndex(
            model_name="estatesgame",
            index=models.Index(fields=["player_1", "-updated_at"], name="estates_est_player__39fd0e_idx"),
        ),
        migrations.AddIndex(
            model_name="estatesgame",
            index=models.Index(fields=["player_2", "-updated_at"], name="estates_est_player__26ee0a_idx"),
        ),
        migrations.AddConstraint(
            model_name="estatesplayerstate",
            constraint=models.UniqueConstraint(fields=("game", "seat_index"), name="estates_player_state_game_seat_uniq"),
        ),
        migrations.AddConstraint(
            model_name="estatesplayerstate",
            constraint=models.UniqueConstraint(fields=("game", "user"), name="estates_player_state_game_user_uniq"),
        ),
        migrations.AddConstraint(
            model_name="estatesgameevent",
            constraint=models.UniqueConstraint(fields=("game", "sequence"), name="estates_game_event_game_sequence_uniq"),
        ),
        migrations.AddIndex(
            model_name="estatesgameevent",
            index=models.Index(fields=["game", "event_type"], name="estates_est_game_id_853dc8_idx"),
        ),
    ]

