"""Process-local catalog cache with shared-cache (cross-worker) invalidation.

Why this exists
---------------
Every ``/qff/command/`` request rebuilds the session payload, which in turn
re-reads the same near-static rows over and over: ``Item``, ``Room``,
``RoomExit``, ``RoomItem``, ``Interactable``, ``Npc``, etc. None of those rows
change during normal play; they only change when staff hits a ``dm_*``
endpoint.

Each loader caches its result inside the worker process keyed on the *current
generation* (an integer in Django's shared cache). When a DM endpoint mutates
static data it calls :func:`bump_generation`, which atomically increments the
shared key. On the next read every worker observes the new generation and
rebuilds its local copy. Within a worker, rebuilds are serialized by a per
loader :class:`threading.Lock` so the moment after an invalidation a single
DB roundtrip refills the cache instead of N concurrent stampeders.

Tests should call :func:`reset_for_test` in ``setUp`` to drop the
process-local snapshot between cases.
"""

from __future__ import annotations

import functools
import threading
from typing import Any, Callable, TypeVar

from django.core.cache import cache

GENERATION_KEY = "qff:static_cache:generation"
_INITIAL_VALUE = 1

_T = TypeVar("_T")

_loader_locks: dict[str, threading.Lock] = {}
_loader_cache: dict[str, tuple[int, Any]] = {}


def current_generation() -> int:
    """Return the shared generation counter, lazily initialising on first read."""
    val = cache.get(GENERATION_KEY)
    if val is None:
        cache.add(GENERATION_KEY, _INITIAL_VALUE)
        val = cache.get(GENERATION_KEY) or _INITIAL_VALUE
    return int(val)


def bump_generation() -> int:
    """Atomically increment the shared generation counter.

    Called from every ``dm_*`` mutation that changes a row a loader caches.
    Returns the new generation value.
    """
    try:
        return int(cache.incr(GENERATION_KEY))
    except ValueError:
        cache.set(GENERATION_KEY, _INITIAL_VALUE + 1)
        return _INITIAL_VALUE + 1


def cached_loader(name: str) -> Callable[[Callable[[], _T]], Callable[[], _T]]:
    """Decorator: cache a zero-arg loader's output keyed on ``current_generation()``.

    Concurrent readers after an invalidation block on a single per-loader
    :class:`threading.Lock`; the first thread refills the cache and the rest
    return the freshly-cached value.
    """

    def decorator(fn: Callable[[], _T]) -> Callable[[], _T]:
        _loader_locks[name] = threading.Lock()

        @functools.wraps(fn)
        def wrapped() -> _T:
            gen = current_generation()
            cached = _loader_cache.get(name)
            if cached is not None and cached[0] == gen:
                return cached[1]
            with _loader_locks[name]:
                cached = _loader_cache.get(name)
                if cached is not None and cached[0] == gen:
                    return cached[1]
                value = fn()
                _loader_cache[name] = (gen, value)
                return value

        wrapped.invalidate = lambda: _loader_cache.pop(name, None)  # type: ignore[attr-defined]
        return wrapped

    return decorator


def reset_for_test() -> None:
    """Test hook: drop process-local caches so changes between tests are visible."""
    _loader_cache.clear()


@cached_loader("item_by_id")
def _load_item_by_id_map() -> dict[int, Any]:
    from qff.models import Item

    return {i.pk: i for i in Item.objects.order_by("id")}


def get_item_by_id(item_id: int | None):
    if not item_id:
        return None
    return _load_item_by_id_map().get(int(item_id))


@cached_loader("room_exit_rows")
def _load_room_exit_rows() -> tuple[Any, ...]:
    from qff.models import RoomExit

    return tuple(
        RoomExit.objects.select_related(
            "to_room",
            "quest_required_state",
            "key_item",
            "reveal_item",
            "reveal_quest_state",
        ).order_by("id")
    )


def get_room_exits_from_room(room_id: int) -> list[Any]:
    rid = int(room_id)
    return [ex for ex in _load_room_exit_rows() if ex.from_room_id == rid]


def get_room_exits_from_rooms(room_ids: list[int]) -> list[Any]:
    wanted = {int(rid) for rid in room_ids}
    if not wanted:
        return []
    return [ex for ex in _load_room_exit_rows() if ex.from_room_id in wanted]


@cached_loader("room_item_rows")
def _load_room_item_rows() -> tuple[Any, ...]:
    from qff.models import RoomItem

    return tuple(
        RoomItem.objects.select_related("item", "visible_quest_state").order_by("id")
    )


def get_room_items(room_id: int) -> list[Any]:
    rid = int(room_id)
    return [ri for ri in _load_room_item_rows() if ri.room_id == rid]


@cached_loader("interactable_rows")
def _load_interactable_rows() -> tuple[Any, ...]:
    from qff.models import Interactable

    return tuple(Interactable.objects.order_by("id"))


def get_room_interactables(room_id: int) -> list[Any]:
    rid = int(room_id)
    rows = [obj for obj in _load_interactable_rows() if obj.room_id == rid]
    rows.sort(key=lambda o: (o.name or "", o.pk))
    return rows


@cached_loader("npc_rows")
def _load_npc_rows() -> tuple[Any, ...]:
    from qff.models import Npc

    return tuple(Npc.objects.order_by("id"))


def get_room_npcs(room_id: int) -> list[Any]:
    rid = int(room_id)
    rows = [n for n in _load_npc_rows() if n.room_id == rid]
    rows.sort(key=lambda n: (n.name or "", n.pk))
    return rows
