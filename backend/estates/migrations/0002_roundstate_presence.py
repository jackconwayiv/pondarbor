from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("estates", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="estatesroundstate",
            name="connections_seat_1",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="estatesroundstate",
            name="connections_seat_2",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="estatesroundstate",
            name="is_paused",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="estatesroundstate",
            name="disconnected_seat",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
    ]
