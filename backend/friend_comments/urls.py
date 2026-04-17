from django.urls import path

from friend_comments.views import comment_detail, comments_collection

urlpatterns = [
    path("", comments_collection),
    path("<int:comment_id>/", comment_detail),
]
