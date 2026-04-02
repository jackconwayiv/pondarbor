import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("whatif", "0006_whatifplayer_paused"),
    ]

    operations = [
        migrations.AddField(
            model_name="whatifquestion",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="whatifquestion",
            name="review_status",
            field=models.CharField(
                choices=[
                    ("approved", "Approved"),
                    ("pending", "Pending"),
                    ("rejected", "Rejected"),
                ],
                db_index=True,
                default="approved",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="whatifquestion",
            name="proposed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="whatif_questions_proposed",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="whatifquestionsession",
            name="skipped_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
