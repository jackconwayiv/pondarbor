from __future__ import annotations

from typing import Any

from people.models import FamilyTreeLayout, Person


def layout_payload(row: FamilyTreeLayout | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "positions": row.positions or {},
        "min_col": row.min_col,
        "min_row": row.min_row,
        "max_col": row.max_col,
        "max_row": row.max_row,
    }


def get_layout_for_owner(owner_id: int) -> FamilyTreeLayout | None:
    return FamilyTreeLayout.objects.filter(owner_user_id=owner_id).first()


def remove_person_from_layout(owner_id: int, person_id) -> None:
    row = get_layout_for_owner(owner_id)
    if not row:
        return
    key = str(person_id)
    positions = dict(row.positions or {})
    if key not in positions:
        return
    del positions[key]
    row.positions = positions
    row.save(update_fields=["positions", "updated_at"])


def validate_layout_payload(
    *,
    owner_id: int,
    positions: dict,
    min_col: int,
    min_row: int,
    max_col: int,
    max_row: int,
) -> dict[str, str]:
    errors: dict[str, str] = {}
    if min_col > max_col:
        errors["bounds"] = "min_col must be <= max_col."
    if min_row > max_row:
        errors["bounds"] = "min_row must be <= max_row."

    active_ids = set(
        str(x)
        for x in Person.objects.filter(owner_user_id=owner_id, deleted_at__isnull=True).values_list(
            "id", flat=True
        )
    )
    if not isinstance(positions, dict):
        errors["positions"] = "positions must be an object."
        return errors

    seen: set[str] = set()
    for pid, coord in positions.items():
        pid_s = str(pid)
        if pid_s not in active_ids:
            errors["positions"] = f"Unknown or inactive person id: {pid_s}."
            break
        if pid_s in seen:
            errors["positions"] = "Duplicate person id in positions."
            break
        seen.add(pid_s)
        if not isinstance(coord, dict):
            errors["positions"] = "Each position must be an object with col and row."
            break
        col = coord.get("col")
        row = coord.get("row")
        if not isinstance(col, int) or not isinstance(row, int):
            errors["positions"] = "col and row must be integers."
            break
        if col < min_col or col > max_col or row < min_row or row > max_row:
            errors["positions"] = "Position outside grid bounds."
            break

    missing = active_ids - seen
    if missing and "positions" not in errors:
        errors["positions"] = "Every active person must appear exactly once in positions."

    return errors
