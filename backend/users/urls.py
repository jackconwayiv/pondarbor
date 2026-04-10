from django.urls import path

from users.views import (
    approved_check,
    csrf,
    health,
    login_view,
    logout_view,
    me,
    patch_me_achievement_visibility,
    patch_me_profile,
    signup,
    staff_pending_summary,
    staff_user_patch,
    staff_users_list,
    sync_profile,
    upcoming_birthdays,
    user_friends_list_for_viewer,
    user_public_summary_by_email,
    user_public_summary_by_id,
)
from achievements.views import user_public_achievements, user_public_achievements_by_id
from quotes.views import user_public_quotes, user_public_quotes_by_id

urlpatterns = [
    path("health/", health),
    path("csrf/", csrf),
    path("me/", me),
    path("me/profile/", patch_me_profile),
    path("me/achievements/<slug:slug>/", patch_me_achievement_visibility),
    path("approved-check/", approved_check),
    path("upcoming-birthdays/", upcoming_birthdays),
    path("signup/", signup),
    path("login/", login_view),
    path("logout/", logout_view),
    path("sync-profile/", sync_profile),
    path("staff/pending-summary/", staff_pending_summary),
    path("staff/users/<int:user_id>/", staff_user_patch),
    path("staff/users/", staff_users_list),
    path("<int:user_id>/public/", user_public_summary_by_id),
    path("<int:user_id>/friends/", user_friends_list_for_viewer),
    path("<int:user_id>/public-quotes/", user_public_quotes_by_id),
    path("<int:user_id>/achievements/", user_public_achievements_by_id),
    path("<str:email>/public/", user_public_summary_by_email),
    path("<str:email>/public-quotes/", user_public_quotes),
    path("<str:email>/achievements/", user_public_achievements),
]
