"""Models for Harbormaster.

The split is intentional:
  * `HarborGame` is a named save slot per user (many rows per player).
  * The eight `Harbor*Def` tables are the staff-editable game catalog.

The catalog tables share a common skeleton (slug, name, description,
stage_min/max, tags, extra, enabled, sort_order) so the staff CRUD views
can DRY most fields. Type-specific fields live in `extra` (a JSONField)
during design iteration; promote stable keys to real columns later.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models


class HarborGame(models.Model):
    """Named harbor save; client-authoritative `state` JSON (frontend normalizer)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="harbor_games",
    )
    name = models.CharField(max_length=80)
    state = models.JSONField(default=dict)
    schema_version = models.PositiveIntegerField(default=1)
    catalog_version = models.PositiveIntegerField(default=0)
    last_played_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Harbor game"
        verbose_name_plural = "Harbor games"
        ordering = ["-updated_at", "id"]

    def __str__(self) -> str:
        return f"HarborGame({self.user_id}, {self.name!r})"


class HarborCatalogVersion(models.Model):
    """Single-row counter bumped whenever any catalog row is saved or deleted.

    Lets the player client detect catalog drift without polling individual
    tables. The post-save / post-delete signal in `signals.py` increments the
    `version` field of the row with id=1.
    """

    version = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Harbor catalog version"
        verbose_name_plural = "Harbor catalog version"

    def __str__(self) -> str:
        return f"HarborCatalogVersion(v={self.version})"


class _HarborDefBase(models.Model):
    """Common skeleton for catalog tables. Type-specific fields go in `extra`."""

    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    stage_min = models.PositiveSmallIntegerField(default=1)
    stage_max = models.PositiveSmallIntegerField(null=True, blank=True)
    tags = models.JSONField(default=list, blank=True)
    extra = models.JSONField(default=dict, blank=True)
    enabled = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ["sort_order", "slug"]

    def __str__(self) -> str:
        return f"{self.__class__.__name__}({self.slug})"


class HarborShipDef(_HarborDefBase):
    """A ship template players can have in reserve, berthed, or voyaging.

    extra: { role, capacity, base_cost, hull }
    """


class HarborBuildingDef(_HarborDefBase):
    """A building players construct or upgrade in their harbor.

    extra: { district, max_level, level_costs: [..], level_effects: [..],
             prerequisites: [slug, ...] }
    """


class HarborOperationDef(_HarborDefBase):
    """Anything the player can spend Command on as a one-shot or multi-day action.

    extra: { kind: "voyage"|"recruit"|"repair"|"convert"|"public_works",
             voyage_type?, command_cost, duration_days, cost, rewards,
             metric_effects, risk, prerequisites,
             requires_building?, grants_ship_slug? }
    """


class HarborArrivalDef(_HarborDefBase):
    """An incoming opportunity (trade, refugee, envoy, etc.).

    extra: { kind, command_cost, offer, request, metric_effects,
             spawn_weight, gives_ship_slug? }
    """


class HarborEventDef(_HarborDefBase):
    """A problem that lands on the player and persists until resolved.

    extra: { severity, command_cost, cost, metric_effects,
             trigger: { random_weight, pressure: { metric, band } },
             on_resolve_metric_effects }
    """


class HarborConsequenceDef(_HarborDefBase):
    """A delayed event scheduled by a prior player decision.

    extra: { source_kind: "arrival"|"operation"|"policy"|"event",
             source_slug, delay_days_min, delay_days_max,
             probability, fires_event_slug }
    """


class HarborPolicyDef(_HarborDefBase):
    """A persistent toggle the player turns on, mutually exclusive within a group.

    extra: { exclusive_group, per_day_metric_effects, per_day_resource_effects?,
             modifiers, command_cost_to_toggle }
    """


class HarborDoctrineDef(_HarborDefBase):
    """A permanent endgame identity (stage 12).

    extra: { permanent_metric_effects, permanent_modifiers }
    """


# Public list used by signals + views to iterate every catalog table.
HARBOR_DEF_MODELS = [
    HarborShipDef,
    HarborBuildingDef,
    HarborOperationDef,
    HarborArrivalDef,
    HarborEventDef,
    HarborConsequenceDef,
    HarborPolicyDef,
    HarborDoctrineDef,
]
