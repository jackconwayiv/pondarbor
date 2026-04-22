# RoomBroadcast scope: room (default) vs realm fanout; reserved party/guild.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("qff", "0051_monstertemplate_attack_verb"),
    ]

    operations = [
        migrations.AddField(
            model_name="roombroadcast",
            name="scope",
            field=models.CharField(
                choices=[
                    ("room", "Room"),
                    ("realm", "Realm"),
                    ("party", "Party"),
                    ("guild", "Guild"),
                ],
                default="room",
                max_length=16,
            ),
        ),
    ]
