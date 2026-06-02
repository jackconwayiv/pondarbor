from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("meal", "0013_alter_grocerylist_hide_checked"),
    ]

    operations = [
        migrations.AddField(
            model_name="useringredientinventory",
            name="location",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.RemoveConstraint(
            model_name="useringredientinventory",
            name="meal_useringredientinventory_owner_ingredient_uniq",
        ),
        migrations.AddConstraint(
            model_name="useringredientinventory",
            constraint=models.UniqueConstraint(
                fields=("owner_user", "ingredient", "location"),
                name="meal_useringredientinventory_owner_ingredient_location_uniq",
            ),
        ),
    ]
