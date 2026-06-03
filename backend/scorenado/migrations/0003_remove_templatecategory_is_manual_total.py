from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("scorenado", "0002_system_starter_templates"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="templatecategory",
            name="is_manual_total",
        ),
    ]
