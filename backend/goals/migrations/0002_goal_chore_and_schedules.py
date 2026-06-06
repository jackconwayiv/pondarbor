from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("goals", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="goal",
            name="schedule_interval_weeks",
            field=models.PositiveSmallIntegerField(default=2),
        ),
        migrations.AddField(
            model_name="goal",
            name="schedule_month_day",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="goal",
            name="schedule_weekday",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="goal",
            name="frequency_kind",
            field=models.CharField(
                choices=[
                    ("daily", "Daily"),
                    ("weekly", "Weekly"),
                    ("times_per_day", "Times per day"),
                    ("times_per_week", "Times per week"),
                    ("weekdays", "Weekdays"),
                    ("monthly", "Monthly"),
                    ("times_per_month", "Times per month"),
                    ("on_weekday", "On weekday"),
                    ("on_month_day", "On month day"),
                ],
                default="daily",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="goal",
            name="kind",
            field=models.CharField(
                choices=[
                    ("one_time", "One-time"),
                    ("continuous", "Continuous"),
                    ("chore", "Chore"),
                ],
                max_length=16,
            ),
        ),
    ]
