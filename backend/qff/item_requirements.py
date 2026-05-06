"""Helpers for item glyph requirement normalization and checks."""

from __future__ import annotations

from qff.glyph_class_map import GLYPHS, normalize_glyph

VALID_REQUIRED_GLYPH_MODES = frozenset({"and", "or"})


def normalize_required_glyphs(raw: object) -> list[str]:
    """Normalize and clamp required glyph list to up to two new glyphs."""
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for entry in raw:
        g = normalize_glyph(entry)
        if g not in GLYPHS:
            continue
        if g in out:
            continue
        out.append(g)
        if len(out) >= 2:
            break
    return out


def normalize_required_glyphs_mode(raw: object, *, default: str = "and") -> str:
    mode = str(raw or "").strip().lower()
    if mode in VALID_REQUIRED_GLYPH_MODES:
        return mode
    return default


def character_meets_glyph_requirements(
    character_glyphs: list[str] | None,
    required_glyphs: list[str] | None,
    required_mode: str,
) -> bool:
    req = normalize_required_glyphs(list(required_glyphs or []))
    if not req:
        return True
    have = set(normalize_glyph(g) for g in list(character_glyphs or []))
    if len(req) == 1:
        return req[0] in have
    mode = normalize_required_glyphs_mode(required_mode)
    if mode == "or":
        return any(g in have for g in req)
    return all(g in have for g in req)
