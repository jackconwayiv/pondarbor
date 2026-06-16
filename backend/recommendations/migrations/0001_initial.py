import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

from recommendations.constants import PRESET_CATEGORIES


def seed_preset_categories(apps, schema_editor):
    Category = apps.get_model("recommendations", "RecommendationCategory")
    for row in PRESET_CATEGORIES:
        Category.objects.get_or_create(
            slug=row["slug"],
            defaults={
                "name": row["name"],
                "emoji": row["emoji"],
                "is_preset": True,
            },
        )


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="RecommendationCategory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(max_length=64, unique=True)),
                ("name", models.CharField(max_length=120)),
                ("emoji", models.CharField(blank=True, max_length=16)),
                ("is_preset", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="recommendation_categories_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name_plural": "recommendation categories",
                "ordering": ["is_preset", "name"],
            },
        ),
        migrations.CreateModel(
            name="Entry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=512)),
                ("link", models.URLField(blank=True, max_length=2048)),
                ("link_normalized", models.CharField(blank=True, db_index=True, max_length=2048)),
                ("image_url", models.URLField(blank=True, max_length=2048)),
                ("address", models.CharField(blank=True, max_length=512)),
                ("location_label", models.CharField(blank=True, max_length=128)),
                ("google_place_id", models.CharField(blank=True, db_index=True, max_length=256)),
                ("latitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("longitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "category",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="entries",
                        to="recommendations.recommendationcategory",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="recommendation_entries_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name_plural": "entries",
            },
        ),
        migrations.CreateModel(
            name="Review",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("rating", models.DecimalField(decimal_places=2, max_digits=4)),
                ("body", models.TextField()),
                ("date_recommended", models.DateField()),
                ("edited_at", models.DateTimeField(blank=True, null=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "entry",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="reviews",
                        to="recommendations.entry",
                    ),
                ),
                (
                    "reviewer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="recommendation_reviews",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name="entry",
            index=models.Index(fields=["category", "-updated_at"], name="recommendat_categor_6f0b0d_idx"),
        ),
        migrations.AddIndex(
            model_name="review",
            index=models.Index(fields=["entry", "-created_at"], name="recommendat_entry_i_7d8f6a_idx"),
        ),
        migrations.AddIndex(
            model_name="review",
            index=models.Index(fields=["reviewer", "-created_at"], name="recommendat_reviewe_91e2b1_idx"),
        ),
        migrations.AddConstraint(
            model_name="entry",
            constraint=models.UniqueConstraint(
                condition=models.Q(("link_normalized__gt", "")),
                fields=("link_normalized",),
                name="uniq_entry_link_normalized",
            ),
        ),
        migrations.AddConstraint(
            model_name="entry",
            constraint=models.UniqueConstraint(
                condition=models.Q(("google_place_id__gt", "")),
                fields=("google_place_id",),
                name="uniq_entry_google_place_id",
            ),
        ),
        migrations.AddConstraint(
            model_name="review",
            constraint=models.UniqueConstraint(
                condition=models.Q(("deleted_at__isnull", True)),
                fields=("entry", "reviewer"),
                name="uniq_active_review_per_reviewer",
            ),
        ),
        migrations.RunPython(seed_preset_categories, migrations.RunPython.noop),
    ]
