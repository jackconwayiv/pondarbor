import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def fill_host_secrets(apps, schema_editor):
    WhatIfSession = apps.get_model("whatif", "WhatIfSession")
    for row in WhatIfSession.objects.all():
        row.host_secret = uuid.uuid4()
        row.save(update_fields=["host_secret"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("whatif", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="whatifsession",
            name="host_secret",
            field=models.UUIDField(editable=False, null=True),
        ),
        migrations.AddField(
            model_name="whatifsession",
            name="owner",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="whatif_sessions_owned",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(fill_host_secrets, noop_reverse),
        migrations.AlterField(
            model_name="whatifsession",
            name="host_secret",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
