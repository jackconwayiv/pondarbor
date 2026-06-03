from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("scorenado", "0005_template_setup_defaults"),
    ]

    operations = [
        migrations.AlterField(
            model_name="scoreboardtemplate",
            name="default_round_count",
            field=models.PositiveSmallIntegerField(
                default=3,
                help_text="Default number of rounds for scored_by_rounds templates.",
            ),
        ),
    ]
