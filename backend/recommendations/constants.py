from django.db import models


class CategoryGroup(models.TextChoices):
    PLACES = "places", "Places"
    MEDIA = "media", "Media"
    LINKS = "links", "Links"


# Leaf categories shown under the home menu groups.
PRESET_CATEGORIES = [
    {"slug": "restaurants", "name": "Restaurants", "emoji": "🍽️", "group": CategoryGroup.PLACES},
    {"slug": "businesses", "name": "Businesses", "emoji": "🏪", "group": CategoryGroup.PLACES},
    {"slug": "destinations", "name": "Destinations", "emoji": "🎡", "group": CategoryGroup.PLACES},
    {"slug": "books", "name": "Books", "emoji": "📚", "group": CategoryGroup.MEDIA},
    {"slug": "tv", "name": "TV", "emoji": "📺", "group": CategoryGroup.MEDIA},
    {"slug": "films", "name": "Films", "emoji": "🎬", "group": CategoryGroup.MEDIA},
    {"slug": "music", "name": "Music", "emoji": "🎵", "group": CategoryGroup.MEDIA},
    {"slug": "links", "name": "Links", "emoji": "🔗", "group": CategoryGroup.LINKS},
]

PRESET_SLUGS = frozenset(row["slug"] for row in PRESET_CATEGORIES)

# Sort order for location_label grouping (Phoenix metro first).
LOCATION_LABEL_SORT_ORDER = {
    "phoenix": 0,
    "phx": 0,
    "scottsdale": 1,
    "tempe": 2,
    "mesa": 3,
    "glendale": 4,
    "chandler": 5,
    "tucson": 10,
    "flagstaff": 11,
    "flag": 11,
    "sedona": 12,
}

GEO_CATEGORY_SLUGS = frozenset({"restaurants", "businesses", "destinations"})

# Display order within each group on the home menu.
GROUP_CATEGORY_ORDER = {
    CategoryGroup.PLACES: ["restaurants", "businesses", "destinations"],
    CategoryGroup.MEDIA: ["books", "tv", "films", "music"],
    CategoryGroup.LINKS: ["links"],
}
