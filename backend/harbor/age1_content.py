"""Static Age 1 ship upgrade defs merged into GET /api/v1/harbor/catalog/ (not DB-backed yet)."""

from __future__ import annotations

# Shape matches frontend CatalogDef + yield_bonus / cost in extra.
SHIP_UPGRADE_DEFS: list[dict] = [
    {
        "id": 1,
        "slug": "fishing-nets",
        "name": "Fishing Nets",
        "description": "Adds +5 fish to each voyage yield.",
        "stage_min": 1,
        "stage_max": None,
        "tags": ["age1", "ship_upgrade"],
        "extra": {
            "yield_bonus": {"food": 5},
            "cost": {"food": 15, "wealth": 15},
        },
        "enabled": True,
        "sort_order": 1,
    },
    {
        "id": 2,
        "slug": "lumber-loft",
        "name": "Lumber Loft",
        "description": "Adds +5 timber to each voyage yield.",
        "stage_min": 1,
        "stage_max": None,
        "tags": ["age1", "ship_upgrade"],
        "extra": {
            "yield_bonus": {"timber": 5},
            "cost": {"timber": 15, "wealth": 15},
        },
        "enabled": True,
        "sort_order": 2,
    },
    {
        "id": 3,
        "slug": "ships-manifest",
        "name": "Ship's Manifest",
        "description": "Adds +5 wealth to each voyage yield.",
        "stage_min": 1,
        "stage_max": None,
        "tags": ["age1", "ship_upgrade"],
        "extra": {
            "yield_bonus": {"wealth": 5},
            "cost": {"wealth": 30},
        },
        "enabled": True,
        "sort_order": 3,
    },
]
