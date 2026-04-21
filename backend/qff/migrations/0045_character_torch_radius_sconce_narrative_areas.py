from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("qff", "0044_roomitem_mint_policy_and_claim"),
    ]

    operations = [
        migrations.AddField(
            model_name="character",
            name="dark_minimap_torch_radius",
            field=models.PositiveSmallIntegerField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="character",
            name="sconce_full_narrative_area_ids",
            field=models.JSONField(default=list, blank=True),
        ),
    ]
