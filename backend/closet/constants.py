# Keep in sync with frontend/src/closet/categories.ts (CLOSET_CATEGORY_PRESETS).

CANONICAL_CLOSET_CATEGORIES = (
    "Clothing",
    "Accessories",
    "Books/Media",
    "Sports/Outdoors",
    "Tools",
    "Board Games",
)

CANONICAL_CLOSET_CATEGORY_SET = frozenset(CANONICAL_CLOSET_CATEGORIES)

# items_friends ?category=… — keep in sync with frontend/src/closet/categories.ts (CLOSET_FRIENDS_CATEGORY_OTHER).
FRIENDS_ITEMS_CATEGORY_OTHER = "__other__"
