from django.apps import AppConfig


class QffConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "qff"
    verbose_name = "Quest for Fat IV"

    def ready(self):
        from . import signals  # noqa: F401
