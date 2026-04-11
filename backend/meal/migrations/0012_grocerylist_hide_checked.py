from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("meal", "0011_backfill_mealingredient_ingredient"),
    ]

    operations = [
        migrations.AddField(
            model_name="grocerylist",
            name="hide_checked",
            field=models.BooleanField(default=False),
        ),
    ]
