"""Bump HarborCatalogVersion whenever any catalog row changes.

The single-row `HarborCatalogVersion(id=1)` lets the client detect when its
cached catalog is stale without polling each table.
"""

from __future__ import annotations

from django.db.models.signals import post_delete, post_save

from .models import HARBOR_DEF_MODELS, HarborCatalogVersion, HarborStageUnlock


def _bump_catalog_version() -> None:
    row, _created = HarborCatalogVersion.objects.get_or_create(
        id=1,
        defaults={"version": 1},
    )
    HarborCatalogVersion.objects.filter(id=row.id).update(version=row.version + 1)


def _on_def_changed(sender, **_kwargs):
    _bump_catalog_version()


def register_catalog_version_signals() -> None:
    for model_cls in HARBOR_DEF_MODELS:
        post_save.connect(
            _on_def_changed,
            sender=model_cls,
            dispatch_uid=f"harbor_def_save_{model_cls.__name__}",
        )
        post_delete.connect(
            _on_def_changed,
            sender=model_cls,
            dispatch_uid=f"harbor_def_delete_{model_cls.__name__}",
        )
    post_save.connect(
        _on_def_changed,
        sender=HarborStageUnlock,
        dispatch_uid="harbor_stage_unlock_save",
    )
    post_delete.connect(
        _on_def_changed,
        sender=HarborStageUnlock,
        dispatch_uid="harbor_stage_unlock_delete",
    )
