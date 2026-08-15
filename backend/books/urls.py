from django.urls import path

from books import views

urlpatterns = [
    path("status/", views.books_status),
    path("link/", views.books_link),
    path("unlink/", views.books_unlink),
    path("shelves/", views.books_shelves),
]
