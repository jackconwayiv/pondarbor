from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("goals", "0002_goal_chore_and_schedules"),
    ]

    operations = [
        migrations.AddField(
            model_name="goal",
            name="schedule_interval_months",
            field=models.PositiveSmallIntegerField(default=2),
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
                    ("every_n_months", "Every N months"),
                    ("on_weekday", "On weekday"),
                    ("on_month_day", "On month day"),
                ],
                default="daily",
                max_length=20,
            ),
        ),
    ]
