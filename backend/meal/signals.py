from django.db.models.signals import post_save
from django.dispatch import receiver

from meal.models import Meal


@receiver(post_save, sender=Meal)
def meal_post_save_evaluate_smorgasbord(sender, instance, created, **kwargs):
    if not created:
        return
    from achievements.services import evaluate_meal_maestro_smorgasbord_for_user

    evaluate_meal_maestro_smorgasbord_for_user(instance.owner_user_id)
