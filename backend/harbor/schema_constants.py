"""Canonical lists of allowed enum values mirrored by the frontend engine.

When `extra` JSON values reference one of these keys (e.g. `metric_effects`
keys), the staff editor restricts the field to valid options. The catalog
schema endpoint (`GET /api/v1/harbor/staff/schema/`) returns these to the
client so the editor UI doesn't need to hard-code them.
"""

RESOURCES = [
    "food",
    "timber",
    "stone",
    "metal",
    "oil",
    "rareMinerals",
    "wealth",
]

METRICS = [
    "population",
    "prestige",
    "influence",
    "morale",
    "security",
    "sanitation",
    "readiness",
    "congestion",
]

VOYAGE_TYPES = ["trade", "patrol", "diplomacy", "industry", "relief"]

OPERATION_KINDS = ["voyage", "recruit", "repair", "convert", "public_works"]

SHIP_ROLES = [
    "cargo",
    "passenger",
    "security",
    "diplomatic",
    "industrial",
    "emergency",
    "flagship",
]

BUILDING_DISTRICTS = [
    "Harbor",
    "Civic",
    "Industry",
    "Diplomacy",
    "Defense",
    "Shipyard",
    "Wonder",
]

ARRIVAL_KINDS = ["trade", "refugee", "diplomatic", "industrial", "military"]

EVENT_SEVERITIES = ["minor", "serious", "crisis"]

CONSEQUENCE_SOURCE_KINDS = ["arrival", "operation", "policy", "event"]

PRESSURE_BANDS = ["low", "neutral", "high"]

STAGES = list(range(1, 13))
