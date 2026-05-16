from django.contrib import admin

from people.models import Person, PersonGuardianLink, PersonPartnership


@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = ("name", "owner_user", "relation_core", "is_self", "deleted_at", "updated_at")
    list_filter = ("is_self", "relation_core")
    search_fields = ("name", "id")
    raw_id_fields = ("owner_user", "bio_mother", "bio_father")


@admin.register(PersonPartnership)
class PersonPartnershipAdmin(admin.ModelAdmin):
    list_display = ("id", "owner_user", "person_a", "person_b", "status", "updated_at")
    raw_id_fields = ("owner_user", "person_a", "person_b")


@admin.register(PersonGuardianLink)
class PersonGuardianLinkAdmin(admin.ModelAdmin):
    list_display = ("id", "child", "guardian", "owner_user")
    raw_id_fields = ("owner_user", "child", "guardian")
