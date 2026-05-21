from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("people", "0002_person_step_parents"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="FamilyTreeLayout",
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
                ("positions", models.JSONField(blank=True, default=dict)),
                ("min_col", models.IntegerField(default=0)),
                ("min_row", models.IntegerField(default=0)),
                ("max_col", models.IntegerField(default=6)),
                ("max_row", models.IntegerField(default=6)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "owner_user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="family_tree_layout",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
    ]
