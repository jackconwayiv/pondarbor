from django.db import migrations, models


def migrate_frequency_to_interval(apps, schema_editor):
    Goal = apps.get_model("goals", "Goal")
    mapping = {
        "daily": ("day", True),
        "times_per_day": ("day", False),
        "weekdays": ("weekdays", True),
        "weekly": ("week", True),
        "times_per_week": ("week", False),
        "monthly": ("month", True),
        "times_per_month": ("month", False),
        "every_n_months": ("months", True),
        "on_weekday": ("weekday", True),
        "on_month_day": ("month_day", True),
    }
    for goal in Goal.objects.all().iterator():
        fk = goal.frequency_kind
        interval, reset_count = mapping.get(fk, ("day", True))
        goal.schedule_interval_kind = interval
        if reset_count:
            goal.frequency_count = 1
        goal.save(
            update_fields=["schedule_interval_kind", "frequency_count"],
        )


class Migration(migrations.Migration):
    dependencies = [
        ("goals", "0003_goal_every_n_months"),
    ]

    operations = [
        migrations.AddField(
            model_name="goal",
            name="schedule_interval_kind",
            field=models.CharField(
                choices=[
                    ("day", "Day"),
                    ("weekdays", "Weekdays"),
                    ("weekday", "Weekday"),
                    ("week", "Week"),
                    ("weeks", "Weeks"),
                    ("month", "Month"),
                    ("months", "Months"),
                    ("month_day", "Month day"),
                ],
                default="day",
                max_length=16,
            ),
        ),
        migrations.RunPython(migrate_frequency_to_interval, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="goal",
            name="frequency_kind",
        ),
        migrations.AlterField(
            model_name="goal",
            name="schedule_interval_weeks",
            field=models.PositiveSmallIntegerField(default=1),
        ),
    ]
