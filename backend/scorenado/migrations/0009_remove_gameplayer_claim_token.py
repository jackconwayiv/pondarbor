from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("scorenado", "0008_social_pass2"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="gameplayer",
            name="claim_token",
        ),
    ]
