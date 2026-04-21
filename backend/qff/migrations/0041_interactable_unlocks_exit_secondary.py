from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("qff", "0040_character_leave_state"),
    ]

    operations = [
        migrations.AddField(
            model_name="interactable",
            name="unlocks_exit_secondary",
            field=models.ForeignKey(
                blank=True,
                help_text="Optional return leg: must be the mutual opposite of unlocks_exit (B→A if primary is A→B).",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="interactable_unlocks_secondary",
                to="qff.roomexit",
            ),
        ),
    ]
