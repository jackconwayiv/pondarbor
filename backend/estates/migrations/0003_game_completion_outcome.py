from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("estates", "0002_roundstate_presence"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="estatesgame",
            name="completion_outcome",
            field=models.CharField(
                blank=True,
                choices=[("victory_score", "Victory score"), ("concession", "Concession")],
                default="",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="estatesgame",
            name="conceded_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name="estates_games_conceded",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
