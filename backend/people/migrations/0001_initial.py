# Generated manually for people app

import uuid

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
            name="Person",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("name", models.CharField(max_length=255)),
                ("image_key", models.CharField(blank=True, max_length=512)),
                ("relation_prefix_tokens", models.JSONField(blank=True, default=list)),
                ("relation_core", models.CharField(max_length=32)),
                ("relation_suffix_tokens", models.JSONField(blank=True, default=list)),
                ("relation_alias", models.CharField(blank=True, max_length=120)),
                ("birthday", models.DateField(blank=True, null=True)),
                ("death_date", models.DateField(blank=True, null=True)),
                ("gender", models.CharField(blank=True, max_length=16, null=True)),
                ("is_self", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "bio_father",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="children_as_bio_father",
                        to="people.person",
                    ),
                ),
                (
                    "bio_mother",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="children_as_bio_mother",
                        to="people.person",
                    ),
                ),
                (
                    "owner_user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="people_owned",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="PersonPartnership",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("status", models.CharField(default="current", max_length=16)),
                ("anniversary_date", models.DateField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "owner_user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="people_partnerships",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "person_a",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="partnerships_as_low",
                        to="people.person",
                    ),
                ),
                (
                    "person_b",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="partnerships_as_high",
                        to="people.person",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="PersonGuardianLink",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("note", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "child",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="guardian_links",
                        to="people.person",
                    ),
                ),
                (
                    "guardian",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="ward_links",
                        to="people.person",
                    ),
                ),
                (
                    "owner_user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="people_guardian_links",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name="person",
            index=models.Index(fields=["owner_user", "-updated_at"], name="people_perso_owner_u_idx"),
        ),
        migrations.AddIndex(
            model_name="person",
            index=models.Index(fields=["owner_user", "deleted_at"], name="people_perso_owner_u_del_idx"),
        ),
        migrations.AddConstraint(
            model_name="person",
            constraint=models.UniqueConstraint(
                condition=models.Q(is_self=True, deleted_at__isnull=True),
                fields=("owner_user",),
                name="people_person_one_active_self_per_owner",
            ),
        ),
        migrations.AddIndex(
            model_name="personpartnership",
            index=models.Index(fields=["owner_user", "status"], name="people_perso_owner_u_sta_idx"),
        ),
        migrations.AddConstraint(
            model_name="personguardianlink",
            constraint=models.UniqueConstraint(fields=("child", "guardian"), name="people_guardianlink_child_guardian_uniq"),
        ),
        migrations.AddIndex(
            model_name="personguardianlink",
            index=models.Index(fields=["owner_user", "child"], name="people_perso_owner_u_chi_idx"),
        ),
    ]
