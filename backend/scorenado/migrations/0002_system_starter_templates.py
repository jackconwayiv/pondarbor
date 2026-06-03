from django.db import migrations, models


def seed_starters(apps, schema_editor):
    pass


def unseed_starters(apps, schema_editor):
    Template = apps.get_model("scorenado", "ScoreboardTemplate")
    Template.objects.filter(is_system_starter=True).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("scorenado", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="scoreboardtemplate",
            name="owner_user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.CASCADE,
                related_name="scorenado_templates",
                to="users.user",
            ),
        ),
        migrations.AddField(
            model_name="scoreboardtemplate",
            name="is_system_starter",
            field=models.BooleanField(
                default=False,
                help_text="Built-in template (Wingspan, Dominion) available to all users.",
            ),
        ),
        migrations.AddConstraint(
            model_name="scoreboardtemplate",
            constraint=models.UniqueConstraint(
                condition=models.Q(("is_system_starter", True)),
                fields=("name",),
                name="uniq_scorenado_system_starter_name",
            ),
        ),
        migrations.RunPython(seed_starters, unseed_starters),
    ]
