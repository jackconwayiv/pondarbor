# Generated manually: multi-slot HarborGame replaces HarborGameSave.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def copy_legacy_saves(apps, schema_editor):
    Old = apps.get_model("harbor", "HarborGameSave")
    New = apps.get_model("harbor", "HarborGame")
    for row in Old.objects.all():
        New.objects.create(
            user_id=row.user_id,
            name="My harbor",
            state=row.state or {},
            schema_version=row.schema_version,
            catalog_version=row.catalog_version,
            last_played_at=row.last_played_at,
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("harbor", "0002_seed_starter_content"),
    ]

    operations = [
        migrations.CreateModel(
            name="HarborGame",
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
                ("name", models.CharField(max_length=80)),
                ("state", models.JSONField(default=dict)),
                (
                    "schema_version",
                    models.PositiveIntegerField(default=1),
                ),
                (
                    "catalog_version",
                    models.PositiveIntegerField(default=0),
                ),
                ("last_played_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="harbor_games",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Harbor game",
                "verbose_name_plural": "Harbor games",
                "ordering": ["-updated_at", "id"],
            },
        ),
        migrations.RunPython(copy_legacy_saves, noop_reverse),
        migrations.DeleteModel(name="HarborGameSave"),
    ]
