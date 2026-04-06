from django.conf import settings
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from django.db.models.deletion import ProtectedError

from .models import PROFILE_TIMEZONE_DEFAULT, Profile


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(
            user=instance,
            display_name=(instance.email.split("@")[0] if instance.email else ""),
            timezone=PROFILE_TIMEZONE_DEFAULT,
        )


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def hide_closet_when_user_disabled(sender, instance, created, **kwargs):
    if created:
        return
    from closet.services import soft_hide_owned_closet_data_for_user

    soft_hide_owned_closet_data_for_user(instance)


@receiver(pre_delete, sender=settings.AUTH_USER_MODEL)
def block_user_hard_delete(sender, instance, **kwargs):
    if getattr(settings, "ALLOW_USER_HARD_DELETE", False):
        return
    raise ProtectedError(
        "Users cannot be hard-deleted. Deactivate by setting deleted_at or non-approved account_status; "
        "closet data is soft-removed automatically.",
        {instance},
    )
