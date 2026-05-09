import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("users", "0012_remove_display_to_friends_only"),
    ]

    operations = [
        migrations.CreateModel(
            name="AstroProfile",
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
                (
                    "chart_status",
                    models.CharField(
                        choices=[
                            ("waiting_staff_chart", "Waiting for staff chart"),
                            ("ready", "Chart ready"),
                        ],
                        default="waiting_staff_chart",
                        max_length=32,
                    ),
                ),
                ("birth_date", models.DateField(blank=True, null=True)),
                ("birth_time", models.TimeField(blank=True, null=True)),
                ("country_code", models.CharField(default="US", max_length=2)),
                ("admin_area", models.CharField(blank=True, max_length=128)),
                ("locality", models.CharField(blank=True, max_length=256)),
                ("postal_code", models.CharField(blank=True, max_length=32)),
                (
                    "latitude",
                    models.DecimalField(
                        blank=True, decimal_places=6, max_digits=9, null=True
                    ),
                ),
                (
                    "longitude",
                    models.DecimalField(
                        blank=True, decimal_places=6, max_digits=9, null=True
                    ),
                ),
                ("iana_timezone", models.CharField(blank=True, max_length=64)),
                ("natal_chart", models.JSONField(blank=True, null=True)),
                ("sun_sign", models.CharField(blank=True, max_length=16)),
                ("moon_sign", models.CharField(blank=True, max_length=16)),
                ("rising_sign", models.CharField(blank=True, max_length=16)),
                ("waiting_submitted_at", models.DateTimeField(blank=True, null=True)),
                ("chart_ready_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "staff_imported_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="astro_chart_imports",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="astro_profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Astro profile",
                "verbose_name_plural": "Astro profiles",
            },
        ),
    ]
