from django.contrib import admin

from whatif.models import (
    WhatIfGameResult,
    WhatIfPlayer,
    WhatIfQuestion,
    WhatIfQuestionSession,
    WhatIfSession,
)


@admin.register(WhatIfQuestion)
class WhatIfQuestionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "prompt",
        "review_status",
        "sessions_used_count",
        "total_responses",
        "total_scores",
        "total_skips",
        "is_active",
    )
    search_fields = ("prompt",)
    list_filter = ("is_active", "review_status")


@admin.register(WhatIfSession)
class WhatIfSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "short_code", "owner", "status", "challenge_mode", "state_version", "created_at")
    search_fields = ("short_code",)
    list_filter = ("status", "challenge_mode")
    raw_id_fields = ("owner",)


admin.site.register(WhatIfPlayer)
admin.site.register(WhatIfQuestionSession)
admin.site.register(WhatIfGameResult)

