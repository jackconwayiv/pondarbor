from django.urls import path

from qff import views

urlpatterns = [
    path("session/", views.session_view),
    path("character/", views.character_create),
    path("command/", views.command_view),
    path("dm/areas/", views.dm_area_list_create),
    path("dm/areas/<int:pk>/", views.dm_area_detail),
    path("dm/areas/<int:area_id>/exits/", views.dm_area_exit_list),
    path("dm/areas/<int:area_id>/rooms-export/", views.dm_area_rooms_export_json),
    path("dm/areas/<int:area_id>/rooms-import/", views.dm_area_rooms_import_json),
    path("dm/areas/<int:area_id>/cells/", views.dm_cell_list_create),
    path("dm/cells/<int:pk>/", views.dm_cell_detail),
    path("dm/areas/<int:area_id>/rooms/", views.dm_room_list_create),
    path("dm/rooms/<int:pk>/", views.dm_room_detail),
    path("dm/rooms/<int:room_id>/exits/", views.dm_exit_list_create),
    path("dm/exits/<int:pk>/", views.dm_exit_detail),
]
