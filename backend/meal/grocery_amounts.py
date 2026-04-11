"""
Combine ingredient amounts for merged grocery headlines (volume, mass, count).

Internal sums use US teaspoons for kitchen volume and grams for mass; metric ml/l
convert into those bases for mixing (e.g. tsp + ml).
"""

from __future__ import annotations

import math
import re
from typing import Literal

from meal.models import Ingredient
from meal.recipe_import import (
    ingredient_product_name,
    leading_count_quantity,
    parse_amount_to_float,
    parse_ingredient_line,
)

# US customary → teaspoons
_UNIT_TO_TSP = {
    "tsp": 1.0,
    "teaspoon": 1.0,
    "teaspoons": 1.0,
    "tbsp": 3.0,
    "tablespoon": 3.0,
    "tablespoons": 3.0,
    "t": 3.0,
    "cup": 48.0,
    "cups": 48.0,
    "c": 48.0,
    "fl oz": 6.0,
    "floz": 6.0,
    "fluid ounce": 6.0,
    "fluid ounces": 6.0,
    "pint": 96.0,
    "pints": 96.0,
    "quart": 192.0,
    "quarts": 192.0,
}

_ML_PER_TSP = 4.92892159375  # US teaspoon

# Mass → grams
_UNIT_TO_GRAMS = {
    "g": 1.0,
    "gram": 1.0,
    "grams": 1.0,
    "kg": 1000.0,
    "kilogram": 1000.0,
    "kilograms": 1000.0,
    "oz": 28.349523125,
    "ounce": 28.349523125,
    "ounces": 28.349523125,
    "lb": 453.59237,
    "lbs": 453.59237,
    "pound": 453.59237,
    "pounds": 453.59237,
}


def _norm_unit(u: str) -> str:
    u = (u or "").strip().lower().rstrip(".")
    u = re.sub(r"\s+", " ", u)
    return u


def _amount_to_tsp(amount: float, unit: str) -> float | None:
    u = _norm_unit(unit)
    if u in ("ml", "milliliter", "milliliters"):
        return amount / _ML_PER_TSP
    if u in ("l", "liter", "liters", "litre", "litres"):
        return amount * 1000.0 / _ML_PER_TSP
    m = _UNIT_TO_TSP.get(u)
    if m is None:
        return None
    return amount * m


def _amount_to_grams(amount: float, unit: str) -> float | None:
    u = _norm_unit(unit)
    m = _UNIT_TO_GRAMS.get(u)
    if m is None:
        return None
    return amount * m


def _fmt_qty(x: float) -> str:
    if abs(x - round(x)) < 1e-6:
        return str(int(round(x)))
    s = f"{x:.2f}".rstrip("0").rstrip(".")
    return s


def _format_volume_us_from_tsp(tsp: float) -> str:
    if tsp < 1e-6:
        return ""
    tsp = float(tsp)
    parts: list[str] = []
    cups = math.floor(tsp / 48.0 + 1e-9)
    rem = tsp - cups * 48.0
    if cups >= 1:
        parts.append(f"{_fmt_qty(cups)} cup" + ("" if cups == 1 else "s"))
    tbsp = math.floor(rem / 3.0 + 1e-9)
    rem2 = rem - tbsp * 3.0
    if tbsp >= 1:
        parts.append(f"{_fmt_qty(tbsp)} Tbsp")
    if rem2 >= 0.125:
        parts.append(f"{_fmt_qty(rem2)} tsp")
    if parts:
        return " + ".join(parts)
    return f"{_fmt_qty(tsp)} tsp"


def _format_mass_from_g(grams: float) -> str:
    if grams < 1e-6:
        return ""
    if grams >= 453.592:
        lb = grams / 453.59237
        return f"{_fmt_qty(lb)} lb"
    if grams >= 28.3495:
        oz = grams / 28.349523125
        return f"{_fmt_qty(oz)} oz"
    if grams >= 1000:
        return f"{_fmt_qty(grams / 1000.0)} kg"
    return f"{_fmt_qty(grams)} g"


def _extract_measure_from_contrib(c: dict) -> tuple[Literal["vol", "mass", "count"], float] | None:
    """Return family and scalar in base units (tsp, g) or count total."""
    raw = (c.get("raw_line") or "").strip()
    display = (c.get("display") or "").strip()
    q = (c.get("quantity") or "").strip()
    u = (c.get("unit") or "").strip()

    if q and u:
        amt = parse_amount_to_float(q)
        if amt is None:
            return None
        uu = _norm_unit(u)
        tsp = _amount_to_tsp(amt, uu)
        if tsp is not None:
            return ("vol", tsp)
        g = _amount_to_grams(amt, uu)
        if g is not None:
            return ("mass", g)
        return None

    seen: set[str] = set()
    for text in (raw, display):
        if not text or text in seen:
            continue
        seen.add(text)
        p = parse_ingredient_line(text)
        qa = (p.get("amount") or "").strip()
        ua = (p.get("unit") or "").strip()
        if qa and ua:
            amt = parse_amount_to_float(qa)
            if amt is not None:
                uu = _norm_unit(ua)
                tsp = _amount_to_tsp(amt, uu)
                if tsp is not None:
                    return ("vol", tsp)
                g = _amount_to_grams(amt, uu)
                if g is not None:
                    return ("mass", g)

        lc = leading_count_quantity(text)
        if lc is not None:
            return ("count", lc)

    return None


def _product_name_for_merge(ing_obj: Ingredient | None, contribs: list[dict]) -> str:
    if ing_obj and (ing_obj.name or "").strip():
        cat = (ing_obj.name or "").strip()
        cleaned = ingredient_product_name(cat)
        return (cleaned or cat)[:255]
    for c in contribs:
        text = (c.get("raw_line") or c.get("display") or "").strip()
        pn = ingredient_product_name(text)
        if pn:
            return pn[:255]
    return "items"


def combine_quantities_for_headline(contribs: list[dict]) -> str | None:
    """
    Sum compatible measures across contributions; return a quantity string for the headline
    (e.g. ``4 tsp``, ``2 cups``, ``350 g``, ``5`` for count-only).
    Returns None if lines use incompatible dimensions.
    """
    if len(contribs) < 2:
        return None
    parsed: list[tuple[Literal["vol", "mass", "count"], float]] = []
    for c in contribs:
        m = _extract_measure_from_contrib(c)
        if m is None:
            return None
        parsed.append(m)
    fams = {p[0] for p in parsed}
    if len(fams) != 1:
        return None
    fam = fams.pop()
    total = sum(p[1] for p in parsed)
    if fam == "vol":
        return _format_volume_us_from_tsp(total)
    if fam == "mass":
        return _format_mass_from_g(total)
    if fam == "count":
        return _fmt_qty(total)
    return None


def build_merged_grocery_display_text(
    *,
    n: int,
    ing_obj: Ingredient | None,
    contribs: list[dict],
) -> str:
    """
    Single recipe line unchanged. Merged rows: ``<combined qty> <product>`` when possible,
    else ``N <product>`` for count-style items.
    """
    if n == 1:
        return (contribs[0].get("display") or "")[:512]

    name = _product_name_for_merge(ing_obj, contribs)
    qty = combine_quantities_for_headline(contribs)
    if qty:
        return f"{qty} {name}"[:512]
    return f"{n} {name}"[:512]
