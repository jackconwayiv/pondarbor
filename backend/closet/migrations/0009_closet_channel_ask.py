from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("closet", "0008_efficiency_indexes"),
    ]

    operations = [
        migrations.CreateModel(
            name="ClosetChannelAsk",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("item_query", models.CharField(max_length=255)),
                ("quantity", models.PositiveIntegerField(blank=True, null=True)),
                ("raw_text", models.TextField()),
                ("date_needed_by", models.DateField()),
                ("slack_team_id", models.CharField(max_length=32)),
                ("slack_channel_id", models.CharField(max_length=32)),
                ("slack_message_ts", models.CharField(max_length=32)),
                ("slack_prompt_ts", models.CharField(blank=True, max_length=32)),
                ("status", models.CharField(choices=[("open", "Open"), ("closed", "Closed")], default="open", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "requester_user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="closet_channel_asks",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="ClosetChannelAskOffer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_item", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "ask",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="offers",
                        to="closet.closetchannelask",
                    ),
                ),
                (
                    "item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="channel_ask_offers",
                        to="closet.item",
                    ),
                ),
                (
                    "owner_user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="closet_channel_ask_offers",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name="closetchannelask",
            index=models.Index(fields=["slack_channel_id", "slack_message_ts"], name="closet_clos_slack_c_7a1e2f_idx"),
        ),
        migrations.AddIndex(
            model_name="closetchannelask",
            index=models.Index(fields=["requester_user", "status"], name="closet_clos_request_8b3c4d_idx"),
        ),
        migrations.AddIndex(
            model_name="closetchannelaskoffer",
            index=models.Index(fields=["ask", "owner_user"], name="closet_clos_ask_id_9e5f6a_idx"),
        ),
        migrations.AlterUniqueTogether(
            name="closetchannelaskoffer",
            unique_together={("ask", "owner_user")},
        ),
    ]
