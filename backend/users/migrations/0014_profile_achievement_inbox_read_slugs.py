from django.db import migrations, models


def backfill_achievement_inbox_read_slugs(apps, schema_editor):
    """
    Seed existing unlocked achievements as read so deploy does not create a large
    unread bell count for legacy accounts.
    """

    Profile = apps.get_model("users", "Profile")
    UserAchievement = apps.get_model("achievements", "UserAchievement")

    # Build user_id -> set(slug) with one query.
    rows = (
        UserAchievement.objects.select_related("achievement")
        .values_list("user_id", "achievement__slug")
        .iterator()
    )
    by_user = {}
    for user_id, slug in rows:
        if not user_id or not slug:
            continue
        s = by_user.get(user_id)
        if s is None:
            s = set()
            by_user[user_id] = s
        s.add(slug)

    # Update profiles. Only touch rows that currently have null/empty.
    for profile in Profile.objects.all().only("id", "user_id", "achievement_inbox_read_slugs").iterator():
        if profile.achievement_inbox_read_slugs:
            continue
        slugs = sorted(by_user.get(profile.user_id, set()))
        if not slugs:
            continue
        Profile.objects.filter(pk=profile.pk).update(
            achievement_inbox_read_slugs=slugs
        )


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0013_profile_display_astro"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="achievement_inbox_read_slugs",
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_achievement_inbox_read_slugs, migrations.RunPython.noop),
    ]

