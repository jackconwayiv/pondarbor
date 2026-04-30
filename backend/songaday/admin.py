from django.contrib import admin

from songaday.models import SongPrompt, SongResponse, SongResponseHeart


@admin.register(SongPrompt)
class SongPromptAdmin(admin.ModelAdmin):
    list_display = ("id", "month", "day", "prompt_preview", "created_at", "updated_at")
    search_fields = ("prompt",)
    readonly_fields = ("created_at", "updated_at")
    ordering = ("month", "day")

    @admin.display(description="Prompt")
    def prompt_preview(self, obj: SongPrompt) -> str:
        text = (obj.prompt or "").strip()
        if len(text) <= 80:
            return text
        return f"{text[:77]}..."


@admin.register(SongResponse)
class SongResponseAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "entry_date",
        "artist",
        "title",
        "has_youtube",
        "has_spotify",
        "has_apple",
        "edited",
        "created_at",
    )
    list_filter = ("entry_date", "edited", "created_at")
    search_fields = ("artist", "title", "raw_label", "user__email", "prompt_snapshot")
    raw_id_fields = ("user", "prompt")
    readonly_fields = ("created_at", "updated_at")

    @admin.display(boolean=True, description="YouTube")
    def has_youtube(self, obj: SongResponse) -> bool:
        return bool((obj.youtube_video_id or "").strip())

    @admin.display(boolean=True, description="Spotify")
    def has_spotify(self, obj: SongResponse) -> bool:
        return bool((obj.spotify_url or "").strip())

    @admin.display(boolean=True, description="Apple")
    def has_apple(self, obj: SongResponse) -> bool:
        return bool((obj.apple_music_url or "").strip())


@admin.register(SongResponseHeart)
class SongResponseHeartAdmin(admin.ModelAdmin):
    list_display = ("id", "response", "user", "created_at")
    raw_id_fields = ("response", "user")
    readonly_fields = ("created_at",)
