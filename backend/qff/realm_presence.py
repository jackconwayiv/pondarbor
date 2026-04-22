"""In-realm presence visibility and realm-wide (fanned) ``RoomBroadcast`` delivery."""

from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from qff.constants import AFK_LOBBY_KICK_MINUTES
from qff.models import Character, RoomBroadcast
from qff.realtime import schedule_notify_qff_rooms


def realm_presence_hero_qs():
    """Heroes considered present in the realm for global HUD and realm-wide broadcasts.

    Same recency window as ``others_here`` / ``active_heroes`` peers.
    """
    now = timezone.now()
    visible_threshold = now - timedelta(minutes=AFK_LOBBY_KICK_MINUTES)
    return Character.objects.filter(
        is_in_realm=True,
        last_activity_at__gte=visible_threshold,
    )


def _broadcast_realm_fanned(actor: Character, text: str) -> set[int]:
    """Create one ``RoomBroadcast`` (``scope=realm``) per distinct recipient ``current_room_id``.

    Recipients = all in-realm presence heroes except ``actor``. Notifies each affected room
    over WebSocket. Bumps the actor's ``last_room_broadcast_id`` if a row is written in the
    actor's current room (avoids the speaker getting stuck on unread ids in ``consume_``).

    Returns distinct room ids that received a row (for callers that batch WS).
    """
    t = (text or "").strip()[:500]
    if not t:
        return set()
    other = realm_presence_hero_qs().exclude(pk=actor.pk)
    room_ids = set(other.values_list("current_room_id", flat=True).distinct())
    if not room_ids:
        return set()
    created: dict[int, int] = {}
    for rid in sorted(room_ids):
        rb = RoomBroadcast.objects.create(
            room_id=rid,
            speaker_id=actor.pk,
            text=t,
            scope=RoomBroadcast.Scope.REALM,
        )
        created[rid] = rb.id
    ar = actor.current_room_id
    if ar in created:
        Character.objects.filter(pk=actor.pk).update(
            last_room_broadcast_id=created[ar],
            updated_at=timezone.now(),
        )
    schedule_notify_qff_rooms(created.keys())
    return set(created.keys())


def broadcast_realm_enter(actor: Character) -> set[int]:
    """All other in-realm heroes see that ``actor`` entered (lobby -> play)."""
    return _broadcast_realm_fanned(actor, f"{actor.name} has entered the realm.")


def broadcast_realm_depart(actor: Character, text: str) -> set[int]:
    """All other in-realm heroes see a departure line; call while ``actor`` is still in-realm."""
    return _broadcast_realm_fanned(actor, text)
