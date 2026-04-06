from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("closet", "0002_borrowrequest_decline_message"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="custody_marked_returned_by_holder_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
