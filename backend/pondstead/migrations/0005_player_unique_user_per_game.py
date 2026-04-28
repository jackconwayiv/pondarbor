from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("pondstead", "0004_pondsteadgame_name"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="pondsteadplayer",
            constraint=models.UniqueConstraint(
                condition=models.Q(user__isnull=False),
                fields=("game", "user"),
                name="pondstead_player_game_user_uniq",
            ),
        ),
    ]

