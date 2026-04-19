import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0027_interactables_extended"),
    ]

    operations = [
        migrations.AddField(
            model_name="qffineffectiveinput",
            name="room",
            field=models.ForeignKey(
                blank=True,
                help_text="Room the character was in when the command was issued (may be null if deleted).",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="qff_ineffective_inputs",
                to="qff.room",
            ),
        ),
        migrations.AddField(
            model_name="qffineffectiveinput",
            name="room_name",
            field=models.CharField(
                blank=True,
                help_text="Snapshot of room name at log time (for display even if room is renamed).",
                max_length=200,
            ),
        ),
    ]
