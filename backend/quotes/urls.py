from django.urls import path

from quotes.views import (
    health,
    quote_create,
    quote_detail,
    quote_feed,
    quote_labels_autocomplete,
    quote_published,
)

urlpatterns = [
    path("health/", health),
    # Quick create (capture)
    path("", quote_create),
    # My feed (owned + implicitly shared via attribution links)
    path("feed/", quote_feed),
    # Published quotes (friends + own); legacy alias
    path("published/", quote_published),
    path("public/", quote_published),
    # Detail + owner-only edits
    path("<int:quote_id>/", quote_detail),
    # Autocomplete for owner-scoped tags/attributions
    path("quote-labels/", quote_labels_autocomplete),
]
