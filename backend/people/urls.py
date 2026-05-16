from django.urls import path

from people import views

urlpatterns = [
    path("summary/", views.people_summary),
    path("users/<int:owner_user_id>/", views.people_friend_bundle),
    path("partnerships/", views.people_partnerships),
    path("partnerships/<uuid:partnership_id>/", views.people_partnership_detail),
    path("<uuid:person_id>/guardians/<uuid:link_id>/", views.people_guardian_detail),
    path("<uuid:person_id>/guardians/", views.people_guardian_create),
    path("<uuid:person_id>/", views.people_detail),
    path("", views.people_collection),
]
