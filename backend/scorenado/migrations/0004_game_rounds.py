from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("scorenado", "0003_remove_templatecategory_is_manual_total"),
    ]

    operations = [
        migrations.AddField(
            model_name="game",
            name="round_count",
            field=models.PositiveSmallIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="score",
            name="round_number",
            field=models.PositiveSmallIntegerField(default=1),
        ),
        migrations.RemoveConstraint(
            model_name="score",
            name="uniq_scorenado_score_game_category_player",
        ),
        migrations.AddConstraint(
            model_name="score",
            constraint=models.UniqueConstraint(
                fields=("game", "category", "player", "round_number"),
                name="uniq_scorenado_score_game_cat_player_round",
            ),
        ),
    ]
