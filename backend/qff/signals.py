"""QFF model signals."""

from __future__ import annotations

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from qff.models import (
    Area,
    AreaCell,
    CharacterClass,
    Interactable,
    Item,
    MonsterTemplate,
    Npc,
    NpcDialogue,
    NpcShop,
    NpcShopStockLine,
    Quest,
    QuestEffect,
    QuestState,
    QuestTransition,
    Room,
    RoomExit,
    RoomItem,
)
from qff.static_cache import bump_generation

_STATIC_CACHE_MODELS = (
    Area,
    AreaCell,
    Room,
    RoomExit,
    Item,
    MonsterTemplate,
    CharacterClass,
    Quest,
    QuestState,
    QuestTransition,
    QuestEffect,
    Npc,
    NpcDialogue,
    NpcShop,
    NpcShopStockLine,
    Interactable,
    RoomItem,
)


@receiver(post_save)
def _invalidate_qff_static_cache_on_save(sender, **kwargs):
    if sender in _STATIC_CACHE_MODELS:
        bump_generation()


@receiver(post_delete)
def _invalidate_qff_static_cache_on_delete(sender, **kwargs):
    if sender in _STATIC_CACHE_MODELS:
        bump_generation()
