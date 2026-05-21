from django.db import migrations, models

import people.partial_dates


def _copy_dates_to_char(apps, schema_editor):
    Person = apps.get_model("people", "Person")
    for person in Person.objects.all():
        updates = []
        if person.birthday is not None:
            person.birthday_new = people.partial_dates.date_to_partial(person.birthday)
            updates.append("birthday_new")
        if person.death_date is not None:
            person.death_date_new = people.partial_dates.date_to_partial(person.death_date)
            updates.append("death_date_new")
        if updates:
            person.save(update_fields=updates)


class Migration(migrations.Migration):
    dependencies = [
        ("people", "0003_family_tree_layout"),
    ]

    operations = [
        migrations.AddField(
            model_name="person",
            name="birthday_new",
            field=models.CharField(blank=True, max_length=10, null=True),
        ),
        migrations.AddField(
            model_name="person",
            name="death_date_new",
            field=models.CharField(blank=True, max_length=10, null=True),
        ),
        migrations.RunPython(_copy_dates_to_char, migrations.RunPython.noop),
        migrations.RemoveField(model_name="person", name="birthday"),
        migrations.RemoveField(model_name="person", name="death_date"),
        migrations.RenameField(
            model_name="person",
            old_name="birthday_new",
            new_name="birthday",
        ),
        migrations.RenameField(
            model_name="person",
            old_name="death_date_new",
            new_name="death_date",
        ),
    ]
