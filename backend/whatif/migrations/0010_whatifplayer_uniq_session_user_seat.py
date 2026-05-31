from django.db import migrations, models
from django.db.models import Count, Q


def dedupe_user_seats(apps, schema_editor):
    WhatIfPlayer = apps.get_model("whatif", "WhatIfPlayer")
    WhatIfSession = apps.get_model("whatif", "WhatIfSession")
    lobby_statuses = {"open", "pre_lobby"}

    dup_groups = (
        WhatIfPlayer.objects.filter(user_id__isnull=False)
        .values("session_id", "user_id")
        .annotate(c=Count("id"))
        .filter(c__gt=1)
    )
    for group in dup_groups:
        session_id = group["session_id"]
        user_id = group["user_id"]
        players = list(
            WhatIfPlayer.objects.filter(session_id=session_id, user_id=user_id).order_by(
                "created_at", "id"
            )
        )
        if len(players) <= 1:
            continue
        session = WhatIfSession.objects.get(id=session_id)
        extras = players[1:]
        if session.status in lobby_statuses:
            for player in extras:
                player.delete()
        else:
            for player in extras:
                player.user_id = None
                player.save(update_fields=["user_id"])


class Migration(migrations.Migration):
    dependencies = [
        ("whatif", "0009_whatifsessionplacement"),
    ]

    operations = [
        migrations.RunPython(dedupe_user_seats, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="whatifplayer",
            constraint=models.UniqueConstraint(
                condition=Q(("user__isnull", False)),
                fields=("session", "user"),
                name="uniq_whatif_session_user_seat",
            ),
        ),
    ]
