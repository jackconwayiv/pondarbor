from django.apps import AppConfig


class HarborConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "harbor"
    verbose_name = "Harbormaster"

    def ready(self) -> None:
        from .signals import register_catalog_version_signals

        register_catalog_version_signals()
