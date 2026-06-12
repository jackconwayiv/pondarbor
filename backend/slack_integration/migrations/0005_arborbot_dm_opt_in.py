from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("slack_integration", "0004_slack_dm_throttle"),
    ]

    operations = [
        migrations.AddField(
            model_name="slackidentity",
            name="arborbot_dms_enabled",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="slackdmqueueitem",
            name="event_type",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="slackdmqueueitem",
            name="ref_key",
            field=models.CharField(blank=True, db_index=True, default="", max_length=128),
        ),
        migrations.AddIndex(
            model_name="slackdmqueueitem",
            index=models.Index(
                fields=["event_type", "ref_key", "sent_at"],
                name="slack_integ_event_t_8a1f2d_idx",
            ),
        ),
    ]
