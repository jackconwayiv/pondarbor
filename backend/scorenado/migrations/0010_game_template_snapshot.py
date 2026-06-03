from __future__ import annotations

import uuid

from django.db import migrations, models
import django.db.models.deletion


def snapshot_existing_games(apps, schema_editor):
    Game = apps.get_model("scorenado", "Game")
    GameCategory = apps.get_model("scorenado", "GameCategory")
    TemplateCategory = apps.get_model("scorenado", "TemplateCategory")
    Score = apps.get_model("scorenado", "Score")

    for game in Game.objects.select_related("template").iterator():
        template = game.template
        game.snapshot_template_name = template.name
        game.snapshot_scored_by_rounds = template.scored_by_rounds
        game.snapshot_low_score_wins = template.low_score_wins
        game.save(
            update_fields=[
                "snapshot_template_name",
                "snapshot_scored_by_rounds",
                "snapshot_low_score_wins",
            ]
        )

        template_cat_to_game_cat: dict = {}
        for tc in TemplateCategory.objects.filter(template_id=template.id).order_by(
            "sort_order", "id"
        ):
            gc = GameCategory.objects.create(
                game_id=game.id,
                name=tc.name,
                description=tc.description,
                sort_order=tc.sort_order,
                is_scored=tc.is_scored,
            )
            template_cat_to_game_cat[tc.id] = gc.id

        for score in Score.objects.filter(game_id=game.id):
            new_category_id = template_cat_to_game_cat.get(score.category_id)
            if new_category_id:
                score.game_category_id = new_category_id
                score.save(update_fields=["game_category_id"])

    Score.objects.filter(game_category_id__isnull=True).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("scorenado", "0009_remove_gameplayer_claim_token"),
    ]

    operations = [
        migrations.CreateModel(
            name="GameCategory",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("sort_order", models.IntegerField(default=0)),
                ("is_scored", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "game",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="categories",
                        to="scorenado.game",
                    ),
                ),
            ],
            options={
                "ordering": ["sort_order", "id"],
            },
        ),
        migrations.AddField(
            model_name="game",
            name="snapshot_low_score_wins",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="game",
            name="snapshot_scored_by_rounds",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="game",
            name="snapshot_template_name",
            field=models.CharField(default="", max_length=255),
        ),
        migrations.AddField(
            model_name="score",
            name="game_category",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="scores_new",
                to="scorenado.gamecategory",
            ),
        ),
        migrations.RunPython(snapshot_existing_games, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name="score",
            name="uniq_scorenado_score_game_cat_player_round",
        ),
        migrations.RemoveIndex(
            model_name="score",
            name="scorenado_s_game_id_de132e_idx",
        ),
        migrations.RemoveField(
            model_name="score",
            name="category",
        ),
        migrations.RenameField(
            model_name="score",
            old_name="game_category",
            new_name="category",
        ),
        migrations.AlterField(
            model_name="score",
            name="category",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="scores",
                to="scorenado.gamecategory",
            ),
        ),
        migrations.AddConstraint(
            model_name="score",
            constraint=models.UniqueConstraint(
                fields=("game", "category", "player", "round_number"),
                name="uniq_scorenado_score_game_cat_player_round",
            ),
        ),
        migrations.AddIndex(
            model_name="score",
            index=models.Index(
                fields=["game", "category"],
                name="scorenado_s_game_id_de132e_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="gamecategory",
            index=models.Index(
                fields=["game", "sort_order"],
                name="scorenado_ga_game_id_8f2a1c_idx",
            ),
        ),
    ]
