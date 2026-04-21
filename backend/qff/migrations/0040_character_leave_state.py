# Generated manually for Character.is_in_realm and Character.pending_leave_at.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0039_service_npcs_and_prompt"),
    ]

    operations = [
        migrations.AddField(
            model_name="character",
            name="is_in_realm",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="character",
            name="pending_leave_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
