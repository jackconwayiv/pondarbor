# Generated for goals app

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
            name="Goal",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("kind", models.CharField(choices=[("one_time", "One-time"), ("continuous", "Continuous")], max_length=16)),
                (
                    "status",
                    models.CharField(
                        choices=[("active", "Active"), ("completed", "Completed"), ("paused", "Paused")],
                        default="active",
                        max_length=16,
                    ),
                ),
                (
                    "frequency_kind",
                    models.CharField(
                        choices=[
                            ("daily", "Daily"),
                            ("weekly", "Weekly"),
                            ("times_per_day", "Times per day"),
                            ("times_per_week", "Times per week"),
                        ],
                        default="daily",
                        max_length=20,
                    ),
                ),
                ("frequency_count", models.PositiveSmallIntegerField(default=1)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("last_check_in_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("last_completion_event_at", models.DateTimeField(blank=True, null=True)),
                (
                    "last_completion_event_type",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("check_in", "Check-in"),
                            ("checkpoint_completed", "Checkpoint completed"),
                            ("goal_completed", "Goal completed"),
                        ],
                        max_length=24,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "owner_user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="goals_owned",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="Checkpoint",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=255)),
                ("sort_order", models.IntegerField(default=0)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "goal",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="checkpoints",
                        to="goals.goal",
                    ),
                ),
            ],
            options={
                "ordering": ["sort_order", "created_at"],
            },
        ),
        migrations.CreateModel(
            name="CheckIn",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("occurred_at", models.DateTimeField(db_index=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "checkpoint",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="check_ins",
                        to="goals.checkpoint",
                    ),
                ),
                (
                    "goal",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="check_ins",
                        to="goals.goal",
                    ),
                ),
                (
                    "owner_user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="goal_check_ins",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-occurred_at", "-created_at"],
            },
        ),
        migrations.AddField(
            model_name="goal",
            name="last_completion_checkpoint",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="goals.checkpoint",
            ),
        ),
        migrations.AddIndex(
            model_name="goal",
            index=models.Index(fields=["owner_user", "status"], name="goals_goal_owner_u_8e0b0d_idx"),
        ),
        migrations.AddIndex(
            model_name="goal",
            index=models.Index(fields=["owner_user", "-last_check_in_at"], name="goals_goal_owner_u_2f4a1a_idx"),
        ),
        migrations.AddIndex(
            model_name="checkin",
            index=models.Index(fields=["goal", "occurred_at"], name="goals_check_goal_id_6c8f2a_idx"),
        ),
        migrations.AddIndex(
            model_name="checkin",
            index=models.Index(fields=["owner_user", "occurred_at"], name="goals_check_owner_u_9a1b3c_idx"),
        ),
    ]
