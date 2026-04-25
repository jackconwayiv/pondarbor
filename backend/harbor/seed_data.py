"""Starter content for Harbormaster.

Loaded by the `seed_harbor_content` management command and the initial data
migration. Each section is a list of upserts keyed by `slug`. The shape of
`extra` mirrors what the frontend engine reads at runtime.

Stage 1 (Dock) and stage 12 (Endgame) get the most attention; intermediate
stages share generic content via `stage_min` so a new harbor at any stage
has something to do until designers add stage-specific content.
"""

from __future__ import annotations

SHIP_DEFS = [
    {
        "slug": "skiff",
        "name": "Skiff",
        "description": "A small wooden boat. Hauls a few crates without complaint.",
        "stage_min": 1,
        "tags": ["starter"],
        "extra": {"role": "cargo", "capacity": 1, "base_cost": 0, "hull": 1},
        "sort_order": 10,
    },
    {
        "slug": "fishing-boat",
        "name": "Fishing Boat",
        "description": "Short coastal runs. Reliable food from the sea.",
        "stage_min": 1,
        "tags": ["starter", "age1"],
        "extra": {
            "role": "fishing",
            "capacity": 1,
            "base_cost": 0,
            "hull": 1,
            "voyage_yield": {"food": 5},
            "voyage_nights": 1,
        },
        "sort_order": 11,
    },
    {
        "slug": "timber-skiff",
        "name": "Timber Skiff",
        "description": "Hauls cordwood from upriver camps.",
        "stage_min": 1,
        "tags": ["starter", "age1"],
        "extra": {
            "role": "cargo",
            "capacity": 1,
            "base_cost": 0,
            "hull": 1,
            "voyage_yield": {"timber": 5},
            "voyage_nights": 1,
        },
        "sort_order": 12,
    },
    {
        "slug": "merchant-sloop",
        "name": "Merchant Sloop",
        "description": "Small trade runs for coin.",
        "stage_min": 1,
        "tags": ["starter", "age1"],
        "extra": {
            "role": "cargo",
            "capacity": 1,
            "base_cost": 0,
            "hull": 1,
            "voyage_yield": {"wealth": 5},
            "voyage_nights": 1,
        },
        "sort_order": 13,
    },
    {
        "slug": "coastal-trader",
        "name": "Coastal Trader",
        "description": "Reliable two-mast cargo ship for short hops along the coast.",
        "stage_min": 1,
        "tags": ["trade"],
        "extra": {"role": "cargo", "capacity": 2, "base_cost": 6, "hull": 2},
        "sort_order": 20,
    },
    {
        "slug": "patrol-cutter",
        "name": "Patrol Cutter",
        "description": "Light armed vessel that keeps smugglers honest.",
        "stage_min": 3,
        "tags": ["security"],
        "extra": {"role": "security", "capacity": 1, "base_cost": 8, "hull": 2},
        "sort_order": 30,
    },
    {
        "slug": "envoy-galley",
        "name": "Envoy Galley",
        "description": "A graceful ship rigged for diplomatic missions.",
        "stage_min": 4,
        "tags": ["diplomacy"],
        "extra": {"role": "diplomatic", "capacity": 1, "base_cost": 10, "hull": 2},
        "sort_order": 40,
    },
    {
        "slug": "deep-hauler",
        "name": "Deep Hauler",
        "description": "Heavy cargo ship for long industrial routes.",
        "stage_min": 5,
        "tags": ["industry"],
        "extra": {"role": "industrial", "capacity": 4, "base_cost": 16, "hull": 3},
        "sort_order": 50,
    },
    {
        "slug": "lifeline",
        "name": "Lifeline",
        "description": "Outfitted for relief: medical bays, dry rations, blankets.",
        "stage_min": 6,
        "tags": ["relief"],
        "extra": {"role": "emergency", "capacity": 2, "base_cost": 14, "hull": 2},
        "sort_order": 60,
    },
    {
        "slug": "flagship",
        "name": "Harbor Flagship",
        "description": "Symbol of the harbor's identity. Permanent berth, no upkeep.",
        "stage_min": 12,
        "tags": ["endgame"],
        "extra": {"role": "flagship", "capacity": 0, "base_cost": 0, "hull": 5},
        "sort_order": 100,
    },
]

BUILDING_DEFS = [
    {
        "slug": "fishing-hut",
        "name": "Fishing Hut",
        "description": "Smokehouse and racks. Expands how much food you can store.",
        "stage_min": 1,
        "tags": ["age1"],
        "extra": {
            "district": "Harbor",
            "max_level": 1,
            "level_costs": [{"timber": 10, "wealth": 10}],
            "level_effects": [{"caps": {"food": 50}}],
            "prerequisites": [],
        },
        "sort_order": 5,
    },
    {
        "slug": "lumberyard",
        "name": "Lumberyard",
        "description": "Sheds and stacks. Expands timber storage.",
        "stage_min": 1,
        "tags": ["age1"],
        "extra": {
            "district": "Harbor",
            "max_level": 1,
            "level_costs": [{"food": 10, "wealth": 10}],
            "level_effects": [{"caps": {"timber": 50}}],
            "prerequisites": [],
        },
        "sort_order": 6,
    },
    {
        "slug": "harbormasters-quarters",
        "name": "Harbormaster's Quarters",
        "description": "A proper office. You can coordinate more each day.",
        "stage_min": 1,
        "tags": ["age1"],
        "extra": {
            "district": "Civic",
            "max_level": 1,
            "level_costs": [{"food": 30, "timber": 30, "wealth": 30}],
            "level_effects": [{"command": 1}],
            "prerequisites": [],
        },
        "sort_order": 7,
    },
    {
        "slug": "second-berth",
        "name": "Second Berth",
        "description": "Mooring for a second arrival each turn.",
        "stage_min": 1,
        "tags": ["age1"],
        "extra": {
            "district": "Harbor",
            "max_level": 1,
            "level_costs": [{"food": 20, "timber": 20, "wealth": 20}],
            "level_effects": [{"berth_cap_delta": 1}],
            "prerequisites": [],
        },
        "sort_order": 8,
    },
    {
        "slug": "warehouse",
        "name": "Warehouse",
        "description": "Stores food and timber. Each level expands resource caps.",
        "stage_min": 2,
        "extra": {
            "district": "Harbor",
            "max_level": 4,
            "level_costs": [
                {"timber": 4},
                {"timber": 8, "stone": 2},
                {"timber": 12, "stone": 6},
                {"timber": 18, "stone": 10},
            ],
            "level_effects": [
                {"caps": {"food": 20, "timber": 20}},
                {"caps": {"food": 40, "timber": 40}},
                {"caps": {"food": 70, "timber": 70}},
                {"caps": {"food": 110, "timber": 110}},
            ],
            "prerequisites": [],
        },
        "sort_order": 10,
    },
    {
        "slug": "fishery",
        "name": "Fishery",
        "description": "Generates food daily. Higher levels feed bigger populations.",
        "stage_min": 2,
        "extra": {
            "district": "Harbor",
            "max_level": 3,
            "level_costs": [{"timber": 3}, {"timber": 7}, {"timber": 12, "stone": 4}],
            "level_effects": [
                {"per_day_resource_effects": {"food": 2}},
                {"per_day_resource_effects": {"food": 4}, "metric_effects": {"morale": 1}},
                {"per_day_resource_effects": {"food": 7}, "metric_effects": {"morale": 2}},
            ],
            "prerequisites": [],
        },
        "sort_order": 20,
    },
    {
        "slug": "council-hall",
        "name": "Council Hall",
        "description": "+1 Command per day. Required for diplomacy operations.",
        "stage_min": 2,
        "extra": {
            "district": "Civic",
            "max_level": 3,
            "level_costs": [{"timber": 6, "stone": 4}, {"stone": 10}, {"stone": 16, "metal": 4}],
            "level_effects": [
                {"command": 1},
                {"command": 2, "metric_effects": {"prestige": 1}},
                {"command": 3, "metric_effects": {"prestige": 2, "influence": 1}},
            ],
            "prerequisites": [],
        },
        "sort_order": 30,
    },
    {
        "slug": "shipyard",
        "name": "Shipyard",
        "description": "Build new ships here. Upgrades unlock larger hulls.",
        "stage_min": 2,
        "extra": {
            "district": "Shipyard",
            "max_level": 4,
            "level_costs": [
                {"timber": 8, "stone": 4},
                {"timber": 14, "stone": 8, "metal": 2},
                {"timber": 20, "stone": 12, "metal": 6},
                {"timber": 30, "stone": 20, "metal": 12},
            ],
            "level_effects": [
                {"unlocks_operation_slugs": ["build-coastal-trader"]},
                {"unlocks_operation_slugs": ["build-coastal-trader", "build-patrol-cutter"]},
                {
                    "unlocks_operation_slugs": [
                        "build-coastal-trader",
                        "build-patrol-cutter",
                        "build-envoy-galley",
                    ]
                },
                {
                    "unlocks_operation_slugs": [
                        "build-coastal-trader",
                        "build-patrol-cutter",
                        "build-envoy-galley",
                        "build-deep-hauler",
                    ]
                },
            ],
            "prerequisites": [],
        },
        "sort_order": 40,
    },
    {
        "slug": "lighthouse",
        "name": "Lighthouse",
        "description": "Stage 12 wonder. Permanent prestige and ready berth.",
        "stage_min": 12,
        "extra": {
            "district": "Wonder",
            "max_level": 1,
            "level_costs": [{"stone": 40, "metal": 12, "rareMinerals": 3}],
            "level_effects": [
                {
                    "metric_effects": {"prestige": 5, "morale": 2},
                    "command": 1,
                }
            ],
            "prerequisites": [],
        },
        "sort_order": 100,
    },
]

OPERATION_DEFS = [
    {
        "slug": "coastal-run",
        "name": "Coastal Run",
        "description": "Send a cargo ship up the coast. Returns with food or wealth.",
        "stage_min": 2,
        "extra": {
            "kind": "voyage",
            "voyage_type": "trade",
            "command_cost": 1,
            "duration_days": 2,
            "cost": {"food": 2},
            "rewards": {"wealth": 4},
            "metric_effects": {"morale": 1},
            "risk": 0.1,
            "prerequisites": [],
        },
        "sort_order": 10,
    },
    {
        "slug": "harbor-patrol",
        "name": "Harbor Patrol",
        "description": "Daily patrol of nearby waters. Boosts security.",
        "stage_min": 3,
        "extra": {
            "kind": "voyage",
            "voyage_type": "patrol",
            "command_cost": 1,
            "duration_days": 1,
            "cost": {},
            "rewards": {},
            "metric_effects": {"security": 2, "readiness": 1},
            "risk": 0.05,
            "prerequisites": [],
        },
        "sort_order": 20,
    },
    {
        "slug": "build-coastal-trader",
        "name": "Build Coastal Trader",
        "description": "Construct a Coastal Trader at the shipyard.",
        "stage_min": 2,
        "extra": {
            "kind": "recruit",
            "command_cost": 1,
            "duration_days": 3,
            "cost": {"timber": 6, "wealth": 4},
            "rewards": {},
            "metric_effects": {},
            "risk": 0,
            "requires_building": {"slug": "shipyard", "min_level": 1},
            "grants_ship_slug": "coastal-trader",
            "prerequisites": [],
        },
        "sort_order": 30,
    },
    {
        "slug": "build-patrol-cutter",
        "name": "Build Patrol Cutter",
        "description": "Construct a Patrol Cutter at the shipyard.",
        "stage_min": 3,
        "extra": {
            "kind": "recruit",
            "command_cost": 1,
            "duration_days": 4,
            "cost": {"timber": 8, "metal": 2, "wealth": 6},
            "rewards": {},
            "metric_effects": {},
            "risk": 0,
            "requires_building": {"slug": "shipyard", "min_level": 2},
            "grants_ship_slug": "patrol-cutter",
            "prerequisites": [],
        },
        "sort_order": 40,
    },
    {
        "slug": "build-envoy-galley",
        "name": "Build Envoy Galley",
        "description": "Construct an Envoy Galley at the shipyard.",
        "stage_min": 4,
        "extra": {
            "kind": "recruit",
            "command_cost": 1,
            "duration_days": 4,
            "cost": {"timber": 10, "wealth": 8},
            "rewards": {},
            "metric_effects": {},
            "risk": 0,
            "requires_building": {"slug": "shipyard", "min_level": 3},
            "grants_ship_slug": "envoy-galley",
            "prerequisites": [],
        },
        "sort_order": 50,
    },
    {
        "slug": "build-deep-hauler",
        "name": "Build Deep Hauler",
        "description": "Construct a Deep Hauler at the shipyard.",
        "stage_min": 5,
        "extra": {
            "kind": "recruit",
            "command_cost": 1,
            "duration_days": 5,
            "cost": {"timber": 16, "metal": 6, "wealth": 12},
            "rewards": {},
            "metric_effects": {},
            "risk": 0,
            "requires_building": {"slug": "shipyard", "min_level": 4},
            "grants_ship_slug": "deep-hauler",
            "prerequisites": [],
        },
        "sort_order": 60,
    },
    {
        "slug": "repair-hull",
        "name": "Repair Hull",
        "description": "Patch up a damaged ship in the shipyard.",
        "stage_min": 2,
        "extra": {
            "kind": "repair",
            "command_cost": 1,
            "duration_days": 1,
            "cost": {"timber": 2},
            "rewards": {},
            "metric_effects": {},
            "risk": 0,
            "prerequisites": [],
        },
        "sort_order": 70,
    },
    {
        "slug": "harbor-festival",
        "name": "Harbor Festival",
        "description": "Throw a festival. Costs food, lifts morale across the harbor.",
        "stage_min": 2,
        "extra": {
            "kind": "public_works",
            "command_cost": 2,
            "duration_days": 1,
            "cost": {"food": 6, "wealth": 4},
            "rewards": {},
            "metric_effects": {"morale": 4, "prestige": 1},
            "risk": 0,
            "prerequisites": [],
        },
        "sort_order": 80,
    },
]

ARRIVAL_DEFS = [
    {
        "slug": "freighter-cargo",
        "name": "Freighter at the entrance",
        "description": "A freighter wants to drop wealth in exchange for food.",
        "stage_min": 2,
        "extra": {
            "kind": "trade",
            "command_cost": 1,
            "offer": {"wealth": 6},
            "request": {"food": 4},
            "metric_effects": {"morale": 1},
            "spawn_weight": 100,
        },
        "sort_order": 10,
    },
    {
        "slug": "refugee-skiff",
        "name": "Refugee skiff",
        "description": "Cold and hungry. Take them in or send them on?",
        "stage_min": 2,
        "extra": {
            "kind": "refugee",
            "command_cost": 1,
            "offer": {},
            "request": {"food": 6},
            "metric_effects": {"population": 3, "morale": -2, "prestige": 1},
            "spawn_weight": 60,
        },
        "sort_order": 20,
    },
    {
        "slug": "envoy-courtesy",
        "name": "Diplomatic envoy",
        "description": "A neighboring city sends a courtesy delegation.",
        "stage_min": 4,
        "extra": {
            "kind": "diplomatic",
            "command_cost": 2,
            "offer": {},
            "request": {"wealth": 6},
            "metric_effects": {"influence": 3, "prestige": 2},
            "spawn_weight": 40,
        },
        "sort_order": 30,
    },
    {
        "slug": "drifting-skiff",
        "name": "Abandoned skiff drifts in",
        "description": "Empty hull tied off at the breakwater. Salvage rights yours.",
        "stage_min": 1,
        "extra": {
            "kind": "trade",
            "command_cost": 1,
            "offer": {},
            "request": {},
            "metric_effects": {},
            "spawn_weight": 20,
            "gives_ship_slug": "skiff",
        },
        "sort_order": 40,
    },
]

EVENT_DEFS = [
    {
        "slug": "spoiled-grain",
        "name": "Spoiled grain in the warehouse",
        "description": "Rats. Mold. Spend timber and food to fix it.",
        "stage_min": 1,
        "extra": {
            "severity": "minor",
            "command_cost": 1,
            "cost": {"timber": 2, "food": 2},
            "metric_effects": {"morale": -1},
            "trigger": {"random_weight": 30, "pressure": None},
            "on_resolve_metric_effects": {"morale": 1},
        },
        "sort_order": 10,
    },
    {
        "slug": "morale-slump",
        "name": "Morale slump on the docks",
        "description": "A festival or wage bump would settle things down.",
        "stage_min": 2,
        "extra": {
            "severity": "serious",
            "command_cost": 2,
            "cost": {"food": 4, "wealth": 4},
            "metric_effects": {"morale": -2},
            "trigger": {"random_weight": 0, "pressure": {"metric": "morale", "band": "low"}},
            "on_resolve_metric_effects": {"morale": 3},
        },
        "sort_order": 20,
    },
    {
        "slug": "smuggler-ring",
        "name": "Smuggler ring exposed",
        "description": "Ignore it and security tanks; bust it and you spend Command.",
        "stage_min": 3,
        "extra": {
            "severity": "serious",
            "command_cost": 2,
            "cost": {"wealth": 4},
            "metric_effects": {"security": -3},
            "trigger": {
                "random_weight": 0,
                "pressure": {"metric": "security", "band": "low"},
            },
            "on_resolve_metric_effects": {"security": 4, "prestige": 1},
        },
        "sort_order": 30,
    },
]

CONSEQUENCE_DEFS = [
    {
        "slug": "refugee-fallout",
        "name": "Fallout from refused refugees",
        "description": "Word travels. Influence and prestige slip days later.",
        "stage_min": 2,
        "extra": {
            "source_kind": "arrival",
            "source_slug": "refugee-skiff",
            "delay_days_min": 3,
            "delay_days_max": 5,
            "probability": 0.5,
            "fires_event_slug": "morale-slump",
        },
        "sort_order": 10,
    },
]

POLICY_DEFS = [
    {
        "slug": "strict-customs",
        "name": "Strict Customs",
        "description": "Inspections slow trade but make smuggling harder.",
        "stage_min": 3,
        "extra": {
            "exclusive_group": "customs",
            "per_day_metric_effects": {"security": 1, "morale": -1},
            "modifiers": {"voyage_costs": {"trade": {"food": 1}}},
            "command_cost_to_toggle": 1,
        },
        "sort_order": 10,
    },
    {
        "slug": "open-customs",
        "name": "Open Customs",
        "description": "Trade flows freely; smugglers do too.",
        "stage_min": 3,
        "extra": {
            "exclusive_group": "customs",
            "per_day_metric_effects": {"morale": 1, "security": -1},
            "modifiers": {"spawn_weights": {"trade": 1.25, "industrial": 1.1}},
            "command_cost_to_toggle": 1,
        },
        "sort_order": 20,
    },
]

DOCTRINE_DEFS = [
    {
        "slug": "trade-republic",
        "name": "Trade Republic",
        "description": "Endgame identity centered on commerce.",
        "stage_min": 12,
        "extra": {
            "permanent_metric_effects": {"prestige": 2, "influence": 2},
            "permanent_modifiers": {"spawn_weights": {"trade": 1.5}},
        },
        "sort_order": 10,
    },
    {
        "slug": "naval-bastion",
        "name": "Naval Bastion",
        "description": "Endgame identity centered on security and readiness.",
        "stage_min": 12,
        "extra": {
            "permanent_metric_effects": {"security": 3, "readiness": 2},
            "permanent_modifiers": {"voyage_risk": {"patrol": 0.5}},
        },
        "sort_order": 20,
    },
    {
        "slug": "humanitarian-port",
        "name": "Humanitarian Port",
        "description": "Endgame identity centered on relief and morale.",
        "stage_min": 12,
        "extra": {
            "permanent_metric_effects": {"morale": 3, "prestige": 1, "population": 5},
            "permanent_modifiers": {"spawn_weights": {"refugee": 1.5}},
        },
        "sort_order": 30,
    },
]


# (def_type, list_of_rows) - matches DEF_MODEL_BY_SLUG keys.
SEED_BUNDLE = [
    ("ships", SHIP_DEFS),
    ("buildings", BUILDING_DEFS),
    ("operations", OPERATION_DEFS),
    ("arrivals", ARRIVAL_DEFS),
    ("events", EVENT_DEFS),
    ("consequences", CONSEQUENCE_DEFS),
    ("policies", POLICY_DEFS),
    ("doctrines", DOCTRINE_DEFS),
]


def upsert_all(apps_or_none=None) -> dict:
    """Idempotent upsert of every seed row.

    Pass `apps` (from a RunPython migration) to use the historical models;
    otherwise the current models are used.
    """
    if apps_or_none is None:
        from . import models as _models

        registry = {
            "ships": _models.HarborShipDef,
            "buildings": _models.HarborBuildingDef,
            "operations": _models.HarborOperationDef,
            "arrivals": _models.HarborArrivalDef,
            "events": _models.HarborEventDef,
            "consequences": _models.HarborConsequenceDef,
            "policies": _models.HarborPolicyDef,
            "doctrines": _models.HarborDoctrineDef,
        }
    else:
        registry = {
            "ships": apps_or_none.get_model("harbor", "HarborShipDef"),
            "buildings": apps_or_none.get_model("harbor", "HarborBuildingDef"),
            "operations": apps_or_none.get_model("harbor", "HarborOperationDef"),
            "arrivals": apps_or_none.get_model("harbor", "HarborArrivalDef"),
            "events": apps_or_none.get_model("harbor", "HarborEventDef"),
            "consequences": apps_or_none.get_model("harbor", "HarborConsequenceDef"),
            "policies": apps_or_none.get_model("harbor", "HarborPolicyDef"),
            "doctrines": apps_or_none.get_model("harbor", "HarborDoctrineDef"),
        }

    summary = {}
    for def_type, rows in SEED_BUNDLE:
        model_cls = registry[def_type]
        created = 0
        updated = 0
        for row in rows:
            obj, was_created = model_cls.objects.update_or_create(
                slug=row["slug"],
                defaults={
                    "name": row["name"],
                    "description": row.get("description", ""),
                    "stage_min": row.get("stage_min", 1),
                    "stage_max": row.get("stage_max"),
                    "tags": row.get("tags", []),
                    "extra": row.get("extra", {}),
                    "enabled": row.get("enabled", True),
                    "sort_order": row.get("sort_order", 0),
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1
        summary[def_type] = {"created": created, "updated": updated}
    return summary
