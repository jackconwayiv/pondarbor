"""Switch Event to a date-only "busy" model.

The calendar is being reframed as binary busy/free per day. We drop all
time-of-day columns and any human-readable text imported from shared
calendars. iCal sources never store text. This migration is destructive on
purpose: any rows that already existed are best re-pulled from their iCal
feed (or recreated as manual events) under the new schema.
"""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("calendars", "0001_initial"),
    ]

    operations = [
        # The check constraint and indexes reference the old datetime columns;
        # drop them first so the column removals don't fail.
        migrations.RemoveConstraint(
            model_name="event",
            name="event_end_at_after_start_at",
        ),
        migrations.RemoveIndex(
            model_name="event",
            name="calendars_e_owner_i_fd796e_idx",
        ),
        migrations.RemoveIndex(
            model_name="event",
            name="calendars_e_source__1d00f6_idx",
        ),
        # Drop everything we no longer want to keep about an event.
        migrations.RemoveField(model_name="event", name="all_day"),
        migrations.RemoveField(model_name="event", name="end_at"),
        migrations.RemoveField(model_name="event", name="location"),
        migrations.RemoveField(model_name="event", name="notes"),
        migrations.RemoveField(model_name="event", name="source_timezone"),
        migrations.RemoveField(model_name="event", name="start_at"),
        # Title becomes optional; non-manual sources store "" (enforced in
        # the model's save()/clean()).
        migrations.AlterField(
            model_name="event",
            name="title",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
        # New date-only schema. Defaults are required for AddField on a
        # non-null column with existing rows; the value is irrelevant because
        # we expect no rows to be carried over (manual events will be
        # recreated, iCal will resync).
        migrations.AddField(
            model_name="event",
            name="start_date",
            field=models.DateField(default="2000-01-01"),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="event",
            name="end_date",
            field=models.DateField(default="2000-01-01"),
            preserve_default=False,
        ),
        migrations.AddIndex(
            model_name="event",
            index=models.Index(
                fields=["owner", "start_date"],
                name="calendars_e_owner_i_c9e113_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="event",
            index=models.Index(
                fields=["source", "start_date"],
                name="calendars_e_source__e60cd9_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="event",
            constraint=models.CheckConstraint(
                condition=models.Q(("end_date__gte", models.F("start_date"))),
                name="event_end_date_after_start_date",
            ),
        ),
        migrations.AlterModelOptions(
            name="event",
            options={"ordering": ["start_date", "id"]},
        ),
    ]
