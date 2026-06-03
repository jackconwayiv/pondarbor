from django.db import migrations, models


def unseed_starters(apps, schema_editor):
    Game = apps.get_model("scorenado", "Game")
    Template = apps.get_model("scorenado", "ScoreboardTemplate")
    starter_ids = Template.objects.filter(is_system_starter=True).values_list("id", flat=True)
    Game.objects.filter(template_id__in=starter_ids).delete()
    Template.objects.filter(is_system_starter=True).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("scorenado", "0010_game_template_snapshot"),
    ]

    operations = [
        migrations.RunPython(unseed_starters, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name="scoreboardtemplate",
            name="uniq_scorenado_system_starter_name",
        ),
        migrations.RemoveField(
            model_name="scoreboardtemplate",
            name="is_system_starter",
        ),
    ]
