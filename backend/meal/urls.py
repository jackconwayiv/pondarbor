from django.urls import path

from meal import views, views_partner

urlpatterns = [
    path("meals/", views.meal_list_create),
    path("meals/import/", views.meal_import_from_url),
    path("paprika/import/", views.meal_import_paprika),
    path("uploads/presign/", views.meal_uploads_presign),
    path("meals/<int:pk>/", views.meal_detail),
    path("templates/", views.template_list_create),
    path("templates/<int:pk>/", views.template_detail),
    path("templates/<int:pk>/grid/", views.template_grid),
    path("instances/", views.instance_list_create),
    path("instances/<int:pk>/", views.instance_detail),
    path("instances/<int:pk>/grid/", views.instance_grid),
    path("instances/<int:pk>/grocery/generate/", views.grocery_generate),
    path("grocery/<int:pk>/", views.grocery_detail),
    path("partner/disconnect/request/", views_partner.disconnect_request),
    path("partner/disconnect/cancel/", views_partner.disconnect_cancel),
    path("partner/disconnect/confirm/", views_partner.disconnect_confirm),
    path("partner/disconnect/pending/", views_partner.disconnect_pending),
    path("partner/request/decline/", views_partner.decline_incoming_partner_request),
]
