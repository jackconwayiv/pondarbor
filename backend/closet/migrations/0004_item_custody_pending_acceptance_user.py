import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("closet", "0003_item_custody_marked_returned_by_holder_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="custody_pending_acceptance_user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="closet_custody_pending_items",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
