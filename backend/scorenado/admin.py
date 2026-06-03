from django.contrib import admin

from scorenado.models import Game, GameCategory, GamePlayer, GameTag, Score, ScoreboardTemplate, TemplateCategory


class TemplateCategoryInline(admin.TabularInline):
    model = TemplateCategory
    extra = 0


class GameCategoryInline(admin.TabularInline):
    model = GameCategory
    extra = 0


@admin.register(ScoreboardTemplate)
class ScoreboardTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "owner_user", "is_published", "updated_at")
    inlines = [TemplateCategoryInline]


class GamePlayerInline(admin.TabularInline):
    model = GamePlayer
    extra = 0


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "snapshot_template_name",
        "template",
        "owner_user",
        "is_finalized",
        "updated_at",
    )
    inlines = [GameCategoryInline, GamePlayerInline]


@admin.register(Score)
class ScoreAdmin(admin.ModelAdmin):
    list_display = ("game", "category", "player", "value")


@admin.register(GameTag)
class GameTagAdmin(admin.ModelAdmin):
    list_display = ("game", "player", "label", "created_at")
