"""Parse Paprika `.paprikarecipes` (zip) and single `.paprikarecipe` (gzip JSON) exports."""

from __future__ import annotations

import base64
import gzip
import io
import json
import zipfile
from typing import Any

from meal.recipe_import import parse_ingredient_line


def _paprika_blurb(obj: dict[str, Any]) -> str:
    parts: list[str] = []
    notes = (obj.get("notes") or "").strip()
    if notes:
        parts.append(notes)
    servings = (obj.get("servings") or "").strip()
    if servings:
        parts.append(servings)
    nut = (obj.get("nutritional_info") or "").strip()
    if nut:
        parts.append(nut)
    return "\n\n".join(parts)[:2000]


def paprika_object_to_meal_payload(obj: dict[str, Any]) -> dict[str, Any]:
    """Build kwargs-compatible dict for Meal + ingredients list."""
    title = (obj.get("name") or "").strip()[:255]
    ing_raw = (obj.get("ingredients") or "").strip()
    ingredient_lines: list[dict[str, str]] = []
    if ing_raw:
        for line in ing_raw.split("\n"):
            line = line.strip()
            if not line:
                continue
            ingredient_lines.append(parse_ingredient_line(line))
        ingredient_lines = [x for x in ingredient_lines if x.get("raw_line")]
    directions = (obj.get("directions") or "").strip()
    source_url = (obj.get("source_url") or "").strip()[:2048]
    blurb = _paprika_blurb(obj)
    photo_b64 = obj.get("photo_data")
    photo_str = photo_b64 if isinstance(photo_b64, str) else ""
    return {
        "title": title,
        "blurb": blurb,
        "directions": directions,
        "source_url": source_url,
        "ingredients": ingredient_lines,
        # Popped by import view before persisting the meal row.
        "photo_data_base64": photo_str.strip() or None,
    }


def _decode_one_paprikarecipe_payload(raw: bytes) -> dict[str, Any]:
    if len(raw) >= 2 and raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    return json.loads(raw.decode("utf-8"))


def iter_paprika_recipes_from_bytes(*, data: bytes, filename: str) -> list[dict[str, Any]]:
    """
    Return list of Paprika recipe JSON dicts from an uploaded file.

    Accepts:
    - Zip archive (`.paprikarecipes` / `.zip`) containing `*.paprikarecipe` members
    - A single gzip-compressed JSON file (`.paprikarecipe`)
    """
    name = (filename or "").lower()
    recipes: list[dict[str, Any]] = []

    is_zip = len(data) >= 4 and data[:4] == b"PK\x03\x04"
    if is_zip or name.endswith(".paprikarecipes") or name.endswith(".zip"):
        try:
            zf = zipfile.ZipFile(io.BytesIO(data))
        except zipfile.BadZipFile as e:
            raise ValueError("Invalid Paprika zip file.") from e
        with zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                if not info.filename.lower().endswith(".paprikarecipe"):
                    continue
                raw = zf.read(info.filename)
                recipes.append(_decode_one_paprikarecipe_payload(raw))
        if not recipes:
            raise ValueError("No .paprikarecipe entries found in this zip.")
        return recipes

    if name.endswith(".paprikarecipe") or (len(data) >= 2 and data[:2] == b"\x1f\x8b"):
        recipes.append(_decode_one_paprikarecipe_payload(data))
        return recipes

    raise ValueError(
        "Unsupported file. Use a Paprika export (.paprikarecipes zip) or a single .paprikarecipe file.",
    )


def decode_paprika_photo_base64(b64: str) -> bytes | None:
    if not b64 or not str(b64).strip():
        return None
    raw = str(b64).strip()
    if raw.startswith("data:") and "," in raw:
        raw = raw.split(",", 1)[1]
    try:
        return base64.b64decode(raw, validate=False)
    except Exception:
        return None
