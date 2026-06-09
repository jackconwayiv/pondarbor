from django.conf import settings
from django.db import migrations, models


def backfill_avatar_image_keys(apps, schema_editor):
    Profile = apps.get_model("users", "Profile")
    base = (getattr(settings, "CLOSET_R2_PUBLIC_BASE_URL", "") or "").strip().rstrip("/")
    prefix = f"{base}/" if base else ""
    for profile in Profile.objects.exclude(avatar_url="").iterator():
        url = (profile.avatar_url or "").strip()
        if not url:
            continue
        if prefix and url.startswith(prefix):
            key = url[len(prefix) :].lstrip("/")
            if key:
                profile.avatar_image_key = key
                profile.avatar_url = ""
                profile.save(update_fields=["avatar_image_key", "avatar_url"])


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0016_profile_meal_maestro_wizard"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="avatar_image_key",
            field=models.CharField(blank=True, default="", max_length=1024),
        ),
        migrations.RunPython(backfill_avatar_image_keys, migrations.RunPython.noop),
    ]
