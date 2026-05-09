from django.contrib import admin

from zodiac.models import AstroProfile


@admin.register(AstroProfile)
class AstroProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "chart_status", "waiting_submitted_at", "chart_ready_at")
    list_filter = ("chart_status",)
    raw_id_fields = ("user", "staff_imported_by")
