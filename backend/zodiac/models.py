from django.conf import settings
from django.db import models


class AstroProfile(models.Model):
    """User birth inputs + optional parsed natal chart (staff-imported text export)."""

    class ChartStatus(models.TextChoices):
        WAITING_STAFF_CHART = "waiting_staff_chart", "Waiting for staff chart"
        READY = "ready", "Chart ready"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="astro_profile",
    )
    chart_status = models.CharField(
        max_length=32,
        choices=ChartStatus.choices,
        default=ChartStatus.WAITING_STAFF_CHART,
    )

    birth_date = models.DateField(null=True, blank=True)
    birth_time = models.TimeField(null=True, blank=True)
    country_code = models.CharField(max_length=2, default="US")
    admin_area = models.CharField(max_length=128, blank=True)
    locality = models.CharField(max_length=256, blank=True)
    postal_code = models.CharField(max_length=32, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    iana_timezone = models.CharField(max_length=64, blank=True)

    natal_chart = models.JSONField(null=True, blank=True)
    sun_sign = models.CharField(max_length=16, blank=True)
    moon_sign = models.CharField(max_length=16, blank=True)
    rising_sign = models.CharField(max_length=16, blank=True)
    birth_time_unknown = models.BooleanField(
        default=False,
        verbose_name="Birth time unknown",
        help_text="Staff: no reliable birth time; member UI hides houses/angles.",
    )

    waiting_submitted_at = models.DateTimeField(null=True, blank=True)
    chart_ready_at = models.DateTimeField(null=True, blank=True)
    staff_imported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="astro_chart_imports",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Astro profile"
        verbose_name_plural = "Astro profiles"

    def __str__(self) -> str:
        return f"AstroProfile({self.user_id})"
