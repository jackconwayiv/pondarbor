from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("zodiac", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="astroprofile",
            name="birth_time_unknown",
            field=models.BooleanField(default=False),
        ),
    ]
