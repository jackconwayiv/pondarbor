from django.urls import path

from . import staff_content, views

urlpatterns = [
    path("games/", views.harbor_games),
    path("games/<int:game_id>/", views.harbor_game_delete),
    path("games/<int:game_id>/state/", views.harbor_game_state),
    path("catalog/", views.catalog),
    path("staff/schema/", views.staff_schema),
    path("staff/<str:def_type>/export/", staff_content.staff_def_export),
    path("staff/<str:def_type>/import/", staff_content.staff_def_import),
    path("staff/<str:def_type>/<int:pk>/", staff_content.staff_def_detail),
    path("staff/<str:def_type>/", staff_content.staff_def_list_create),
]
