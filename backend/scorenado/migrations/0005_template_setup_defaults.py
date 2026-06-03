from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("scorenado", "0004_game_rounds"),
    ]

    operations = [
        migrations.AddField(
            model_name="scoreboardtemplate",
            name="min_players",
            field=models.PositiveSmallIntegerField(default=2),
        ),
        migrations.AddField(
            model_name="scoreboardtemplate",
            name="default_round_count",
            field=models.PositiveSmallIntegerField(default=1),
        ),
    ]
