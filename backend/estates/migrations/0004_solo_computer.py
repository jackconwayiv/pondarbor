# Generated manually for solo vs computer

from django.conf import settings
from django.db import migrations, models


def create_computer_user(apps, schema_editor):
    User = apps.get_model(settings.AUTH_USER_MODEL)
    Profile = apps.get_model("users", "Profile")
    email = "estates-computer@pondarbor.invalid"
    user, created = User.objects.get_or_create(
        email=email,
        defaults={
            "username": "estates-computer",
            "password": "!",
            "account_status": "approved",
            "is_active": True,
            "is_staff": False,
            "is_superuser": False,
        },
    )
    if not created and not str(getattr(user, "password", "") or "").startswith("!"):
        user.password = "!"
        user.save(update_fields=["password"])
    Profile.objects.update_or_create(
        user=user,
        defaults={"display_name": "Computer", "avatar_url": ""},
    )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("estates", "0003_game_completion_outcome"),
        ("users", "0012_remove_display_to_friends_only"),
    ]

    operations = [
        migrations.AddField(
            model_name="estatesgame",
            name="computer_difficulty",
            field=models.CharField(blank=True, default="", max_length=16),
        ),
        migrations.AddField(
            model_name="estatesgame",
            name="computer_persona",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
        migrations.AddField(
            model_name="estatesroundstate",
            name="pending_computer_action_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(create_computer_user, noop_reverse),
    ]
