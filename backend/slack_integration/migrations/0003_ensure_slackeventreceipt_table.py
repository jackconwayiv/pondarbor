from django.db import migrations

from slack_integration.repair import ensure_slackeventreceipt_table


class Migration(migrations.Migration):
    dependencies = [
        ("slack_integration", "0002_slacksongadayingesttrace"),
    ]

    operations = [
        migrations.RunPython(ensure_slackeventreceipt_table, migrations.RunPython.noop),
    ]
