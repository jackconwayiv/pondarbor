import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PondsteadGame",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("active", "Active"), ("finished", "Finished")], default="active", max_length=16)),
                ("config", models.JSONField(default=dict)),
                ("current_day", models.PositiveIntegerField(default=1)),
                ("winner_player_id", models.PositiveIntegerField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["-updated_at", "-id"]},
        ),
        migrations.CreateModel(
            name="PondsteadPlayer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("seat_index", models.PositiveSmallIntegerField()),
                ("display_name", models.CharField(blank=True, max_length=120)),
                ("points", models.IntegerField(default=0)),
                ("eliminated", models.BooleanField(default=False)),
                ("game", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="players", to="pondstead.pondsteadgame")),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="pondstead_players",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["seat_index"], "unique_together": {("game", "seat_index")}},
        ),
        migrations.CreateModel(
            name="PondsteadGameState",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("revision", models.PositiveIntegerField()),
                ("world_json", models.JSONField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("game", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="states", to="pondstead.pondsteadgame")),
            ],
            options={"ordering": ["-revision", "-id"], "unique_together": {("game", "revision")}},
        ),
        migrations.CreateModel(
            name="PondsteadDayLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("day", models.PositiveIntegerField()),
                ("log_json", models.JSONField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("game", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="day_logs", to="pondstead.pondsteadgame")),
            ],
            options={"ordering": ["-day", "-id"]},
        ),
    ]
