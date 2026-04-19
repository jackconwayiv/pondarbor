from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0025_item_stacking_consumable_extra_roomitem_repeat"),
    ]

    operations = [
        migrations.AddField(
            model_name="area",
            name="is_dark_minimap",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="room",
            name="permanent_minimap_light",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="room",
            name="reset_dark_lighting_on_enter",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="character",
            name="dark_minimap_lit_room_ids",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
