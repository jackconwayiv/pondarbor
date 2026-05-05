"""Development aid: EXPLAIN canonical query shapes used by lazy sim and session payload.

Does not connect timing data from production — run against a representative DB when
investigating seq scans. See ``monster_sim._earliest_time_based_lazy_sim_event`` and
migration ``0053_lazy_sim_indexes``.
"""

from django.core.management.base import BaseCommand

from qff.game_helpers import presence_threshold
from qff.models import Character, MonsterInstance, Room


class Command(BaseCommand):
    help = "Print Postgres EXPLAIN plans for hot QFF query shapes (lazy sim + session)."

    def handle(self, *args, **options):
        th = presence_threshold()
        room_pk = Room.objects.values_list("pk", flat=True).first()
        self.stdout.write("=== MonsterInstance: due combat (next_action_at) ===")
        self.stdout.write(
            MonsterInstance.objects.filter(next_action_at__isnull=False)
            .order_by("id")
            .explain(verbose=True)
        )
        self.stdout.write("\n=== Character: active realm heroes for bind check join ===")
        self.stdout.write(
            Character.objects.filter(
                last_activity_at__gte=th,
                is_dead=False,
                current_room_id__in=MonsterInstance.objects.values("current_room_id"),
            )
            .explain(verbose=True)
        )
        if room_pk:
            self.stdout.write(
                "\n=== MonsterInstance: room occupants (session monsters list) ==="
            )
            self.stdout.write(
                MonsterInstance.objects.filter(current_room_id=int(room_pk))
                .select_related("template")
                .order_by("id")
                .explain(verbose=True)
            )
        else:
            self.stdout.write(
                "\n(no Room rows — seed DB before expecting session-shaped plans)"
            )
