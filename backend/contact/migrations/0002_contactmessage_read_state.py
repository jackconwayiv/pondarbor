# ContactMessage read tracking for staff inbox.

from django.conf import settings
from django.db import migrations, models
from django.db.models import F
import django.db.models.deletion


def backfill_read_at_from_created(apps, schema_editor):
    """Legacy submissions treated as already seen so deploy does not spike bell counts."""
    ContactMessage = apps.get_model("contact", "ContactMessage")
    ContactMessage.objects.filter(read_at__isnull=True).update(read_at=F("created_at"))


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("contact", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="contactmessage",
            name="read_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="contactmessage",
            name="read_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="contact_messages_marked_read",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(backfill_read_at_from_created, noop_reverse),
    ]
