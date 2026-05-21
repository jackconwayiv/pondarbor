from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("estates", "0004_solo_computer"),
    ]

    operations = [
        migrations.AddField(
            model_name="estatesgame",
            name="stats_recorded_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name="EstatesUserStats",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("games_completed", models.PositiveIntegerField(default=0)),
                ("pvp_wins", models.PositiveIntegerField(default=0)),
                ("solo_wins", models.PositiveIntegerField(default=0)),
                ("zone_farm_wins", models.PositiveIntegerField(default=0)),
                ("zone_road_wins", models.PositiveIntegerField(default=0)),
                ("zone_tower_wins", models.PositiveIntegerField(default=0)),
                ("zone_gate_wins", models.PositiveIntegerField(default=0)),
                ("zone_throne_wins", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="estates_stats",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name_plural": "Estates user stats",
            },
        ),
    ]
