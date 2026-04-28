from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("pondstead", "0003_pondsteadplayerprivatestate"),
    ]

    operations = [
        migrations.AddField(
            model_name="pondsteadgame",
            name="name",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
    ]
