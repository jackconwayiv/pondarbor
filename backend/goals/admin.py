from django.contrib import admin

from goals.models import CheckIn, Checkpoint, Goal


class CheckpointInline(admin.TabularInline):
    model = Checkpoint
    extra = 0


@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    list_display = ("title", "owner_user", "kind", "status", "created_at")
    list_filter = ("kind", "status")
    inlines = [CheckpointInline]


@admin.register(CheckIn)
class CheckInAdmin(admin.ModelAdmin):
    list_display = ("goal", "owner_user", "occurred_at", "checkpoint")
