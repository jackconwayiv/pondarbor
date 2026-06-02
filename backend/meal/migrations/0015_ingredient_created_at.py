import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("meal", "0014_useringredientinventory_location"),
    ]

    operations = [
        migrations.AddField(
            model_name="ingredient",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
    ]
