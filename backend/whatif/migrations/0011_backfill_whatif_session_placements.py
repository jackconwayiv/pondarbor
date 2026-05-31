from django.db import migrations


def backfill_placements(apps, schema_editor):
    from whatif.endgame import backfill_whatif_session_placements_from_history

    backfill_whatif_session_placements_from_history()


class Migration(migrations.Migration):

    dependencies = [
        ("whatif", "0010_whatifplayer_uniq_session_user_seat"),
    ]

    operations = [
        migrations.RunPython(backfill_placements, migrations.RunPython.noop),
    ]
