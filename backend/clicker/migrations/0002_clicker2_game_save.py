from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("clicker", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Clicker2GameSave",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("state", models.JSONField(default=dict)),
                ("schema_version", models.PositiveIntegerField(default=1)),
                ("last_played_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="clicker2_game_save",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Clicker2 game save",
                "verbose_name_plural": "Clicker2 game saves",
            },
        ),
    ]
