"""
Parse fixed-layout natal chart text exports into natal_chart JSON.

Supports tab-separated rows like:
  Sun 11°37' Libra
  Chiron 22°10' Я Taurus
  Sun House 7   (also: second column may be a single cell "House 7", two columns total)
  Body / Sign / decimal longitude / optional house (spreadsheet-style)
  House 1 28°17' Pisces
  Sun Conjunction Saturn Orb 1°03'
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

_SIGN_ORDER = [
    "aries",
    "taurus",
    "gemini",
    "cancer",
    "leo",
    "virgo",
    "libra",
    "scorpio",
    "sagittarius",
    "capricorn",
    "aquarius",
    "pisces",
]

_SIGN_TITLE = [s.title() for s in _SIGN_ORDER]
_SIGN_INDEX = {s: i for i, s in enumerate(_SIGN_ORDER)}

# Minutes may omit the trailing quote (some exports use `10°28` instead of `10°28'`).
_DEG_MIN_RE = re.compile(r"^(?P<deg>\d+)°(?P<min>\d+)'?$")
_DECIMAL_LON_RE = re.compile(r"^(?P<lon>\d+(\.\d+)?)$")

_HEADING_SKIP_RES = (
    re.compile(r"^Planets\s+in\s+Houses\*?\s*$", re.I),
    re.compile(r"^Positions\s+of\s+Houses\s*$", re.I),
    re.compile(r"^List\s+of\s+Planetary\s+Aspects\s*$", re.I),
)


def _strip_inline_comment(line: str) -> str:
    """Remove `//`-style pasted suffixes (often errors/warnings pasted with export)."""
    if "//" in line:
        line = line.split("//", 1)[0].strip()
    return line


def _should_skip_noise_line(line: str) -> bool:
    ln = line.strip()
    if not ln:
        return True
    if ln.startswith("#"):
        return True
    if ln.startswith("//"):
        return True
    for rx in _HEADING_SKIP_RES:
        if rx.match(ln):
            return True
    if ln.startswith("* In keeping with the common practice"):
        return True
    return False


# Space-separated row: Body D°M' [Я|R] Sign (body may be multiple words, e.g. Part Of Fortune)
_SPACE_LON_RE = re.compile(
    r"^(?P<body>.+?)\s+(?P<dm>\d+°\d+'?)\s+(?:(?P<retro>[ЯRr])\s+)?(?P<sign>[A-Za-z]+)\s*$"
)
_SPACE_HOUSE_CUSP_RE = re.compile(
    r"^House\s+(?P<n>\d+)\s+(?P<dm>\d+°\d+'?)\s+(?P<sign>[A-Za-z]+)\s*$",
    re.I,
)
_SPACE_BODY_HOUSE_RE = re.compile(r"^(?P<body>.+?)\s+House\s+(?P<hn>\d+)\s*$", re.I)


def _try_parse_space_separated_lon_row(
    line: str,
    *,
    points: dict,
    angles: dict,
) -> bool:
    m = _SPACE_LON_RE.match(line.strip())
    if not m:
        return False
    body_raw = m.group("body").strip()
    dm = _parse_deg_min(m.group("dm"))
    if not dm:
        return False
    retro = bool(m.group("retro"))
    sign_raw = m.group("sign")
    if sign_raw.title() not in _SIGN_TITLE:
        return False
    bk = _normalize_body_key(body_raw)
    if not bk:
        return False
    deg, minute = dm
    lon = _longitude_deg(sign_raw.lower(), deg, minute)
    sig = sign_raw.lower()
    pt = {"longitude_deg": lon, "sign": sig, "retrograde": retro}
    _assign_point_or_angle(bk, pt, points=points, angles=angles)
    return True


def _try_parse_space_separated_house_cusp(
    line: str,
    *,
    cusps: list[float | None],
) -> bool:
    m = _SPACE_HOUSE_CUSP_RE.match(line.strip())
    if not m:
        return False
    n = int(m.group("n"))
    dm = _parse_deg_min(m.group("dm"))
    sign_raw = m.group("sign")
    if (
        not dm
        or sign_raw.title() not in _SIGN_TITLE
        or not 1 <= n <= 12
    ):
        return False
    deg, minute = dm
    cusps[n - 1] = _longitude_deg(sign_raw.lower(), deg, minute)
    return True


def _try_parse_space_separated_body_house(line: str, house_by_body: dict) -> bool:
    m = _SPACE_BODY_HOUSE_RE.match(line.strip())
    if not m:
        return False
    body_k = _normalize_body_key(m.group("body").strip())
    hn = int(m.group("hn"))
    if not body_k or not 1 <= hn <= 12:
        return False
    house_by_body[body_k] = hn
    return True


_ASPECT_MAP = {
    "Conjunction": ("conjunction", 0.0),
    "Opposition": ("opposition", 180.0),
    "Opposite": ("opposition", 180.0),
    "Square": ("square", 90.0),
    "Trine": ("trine", 120.0),
    "Sextile": ("sextile", 60.0),
    "SemiSquare": ("semi_square", 45.0),
    "Semi-Square": ("semi_square", 45.0),
    "SesquiQuadrate": ("sesqui_square", 135.0),
    "Sesqui-Square": ("sesqui_square", 135.0),
    "Quintile": ("quintile", 72.0),
    "BiQuintile": ("bi_quintile", 144.0),
    "Bi-Quintile": ("bi_quintile", 144.0),
    "SemiSextile": ("semi_sextile", 30.0),
    "Semi-Sextile": ("semi_sextile", 30.0),
    # Some exports label the quincunx / 150° aspect this way:
    "Inconjunction": ("quincunx", 150.0),
    "Quincunx": ("quincunx", 150.0),
}


def _longitude_deg(sign_lower: str, deg: int, minute: int) -> float:
    idx = _SIGN_INDEX[sign_lower.lower()]
    return round(idx * 30 + deg + minute / 60.0, 6) % 360.0


def _normalize_body_key(raw: str) -> str | None:
    r = raw.strip()
    mapping = {
        "Sun": "sun",
        "Moon": "moon",
        "Mercury": "mercury",
        "Venus": "venus",
        "Mars": "mars",
        "Jupiter": "jupiter",
        "Saturn": "saturn",
        "Uranus": "uranus",
        "Neptune": "neptune",
        "Pluto": "pluto",
        "Chiron": "chiron",
        "Ceres": "ceres",
        "Pallas": "pallas",
        "Juno": "juno",
        "Vesta": "vesta",
        "Node": "north_node",
        "North Node": "north_node",
        "South Node": "south_node",
        "Lilith": "lilith",
        "Fortune": "part_of_fortune",
        "Part Of Fortune": "part_of_fortune",
        "Part of Fortune": "part_of_fortune",
        "AS": "ascendant",
        "Ascendant": "ascendant",
        "ASC": "ascendant",
        "MC": "midheaven",
        "Midheaven": "midheaven",
    }
    if r in mapping:
        return mapping[r]
    rt = " ".join(r.title().split())
    if rt in mapping:
        return mapping[rt]
    rl = " ".join(r.lower().split())
    lower_aliases = {
        "north node": "north_node",
        "south node": "south_node",
        "part of fortune": "part_of_fortune",
    }
    return lower_aliases.get(rl)


def _normalize_aspect_body(raw: str) -> str:
    raw = raw.strip()
    k = _normalize_body_key(raw)
    if k:
        return k
    return raw.lower().replace(" ", "_")


def _parse_deg_min(part: str) -> tuple[int, int] | None:
    m = _DEG_MIN_RE.match(part.strip())
    if not m:
        return None
    return int(m.group("deg")), int(m.group("min"))


def _parse_orb(orb_str: str) -> float | None:
    m = re.match(r"^(?P<deg>\d+)°(?P<min>\d+)'?$", orb_str.strip())
    if not m:
        return None
    d = int(m.group("deg"))
    mn = int(m.group("min"))
    return round(d + mn / 60.0, 6)


def _split_nonempty_tabs(line: str) -> list[str]:
    return [c.strip() for c in line.split("\t") if c.strip()]


def _parse_house_column(cell: str) -> int | None:
    """House index 1–12 from export column, or None if empty / em dash / unknown."""
    s = cell.strip()
    if not s:
        return None
    if s in ("—", "–", "-", "?", "…"):
        return None
    if s.isdigit():
        n = int(s)
        if 1 <= n <= 12:
            return n
    return None


def _assign_point_or_angle(
    body_key: str | None,
    pt: dict,
    *,
    points: dict,
    angles: dict,
) -> None:
    if not body_key:
        return
    if body_key in ("ascendant", "midheaven"):
        angles[body_key] = pt
    else:
        points[body_key] = pt


def _normalize_vertical_chart_export(raw: str) -> str:
    """
    Many apps export one field per line (blank lines optional). Convert runs of
    body / degree / sign (and multiline aspects / house cusps) into tab-separated
    rows the rest of this parser already understands.
    """
    lines: list[str] = []
    for ln in raw.splitlines():
        s = _strip_inline_comment(ln.strip())
        if s and not _should_skip_noise_line(s):
            lines.append(s)
    if not lines:
        return ""
    out: list[str] = []
    i = 0
    n = len(lines)

    while i < n:
        line = lines[i]

        # Aspect: Body \\n AspectName \\n Body \\n Orb \\n N°MM'
        # Do not require aspect name to be pre-listed — validate after merge (supports
        # Inconjunction, SesquiQuadrate, etc.).
        if i + 4 < n and lines[i + 3].strip().lower() == "orb":
            if _parse_orb(lines[i + 4].strip()) is not None:
                out.append("\t".join(lines[i : i + 5]))
                i += 5
                continue

        # House cusp: House N \\t D°M' \\t Sign
        hm = re.match(r"^House\s+(\d+)$", line, re.I)
        if hm and i + 2 < n:
            dm = _parse_deg_min(lines[i + 1])
            sign_raw = lines[i + 2]
            if dm and sign_raw.title() in _SIGN_TITLE:
                out.append("\t".join([line, lines[i + 1], lines[i + 2]]))
                i += 3
                continue

        # Body + House N on next line (e.g. Sun \\n House 7)
        bk_h = _normalize_body_key(line)
        if bk_h and i + 1 < n:
            hm_h = re.match(r"^House\s+(\d+)\s*$", lines[i + 1].strip(), re.I)
            if hm_h:
                out.append("\t".join([line, lines[i + 1]]))
                i += 2
                continue

        # Planet / angle longitude: Body \\t D°M' \\t [Я] \\t Sign
        bk = _normalize_body_key(line)
        if bk and i + 2 < n and _parse_deg_min(lines[i + 1]):
            parts_lin = [line, lines[i + 1]]
            j = i + 2
            if j < n and lines[j] in ("Я", "R", "r"):
                parts_lin.append(lines[j])
                j += 1
            if j < n and lines[j].title() in _SIGN_TITLE:
                parts_lin.append(lines[j])
                out.append("\t".join(parts_lin))
                i = j + 1
                continue

        out.append(line)
        i += 1

    return "\n".join(out)


def _parse_aspect_line(line: str, warnings: list[str]) -> dict | None:
    """Return aspect dict or None."""
    # Normalize tabs to spaces for regex flexibility
    if "Orb" not in line:
        return None
    # Tab style: Sun Conjunction Saturn Orb 1°03'
    parts = _split_nonempty_tabs(line)
    if len(parts) >= 5 and parts[-2].lower() == "orb":
        a_raw, asp_name, b_raw = parts[0], parts[1], parts[2]
        orb_s = parts[-1]
    else:
        m = re.match(
            r"^(?P<a>.+?)\s+(?P<aspect>[A-Za-z][a-zA-Z0-9]*)\s+(?P<b>.+?)\s+Orb\s+(?P<orb>\d+°\d+'?)",
            line.replace("\t", " ").strip(),
        )
        if not m:
            return None
        a_raw = m.group("a").strip()
        asp_name = m.group("aspect").strip()
        b_raw = m.group("b").strip()
        orb_s = m.group("orb").strip()

    if asp_name not in _ASPECT_MAP:
        warnings.append(f"Unknown aspect type '{asp_name}', skipping.")
        return None
    typ, nominal = _ASPECT_MAP[asp_name]
    orb_val = _parse_orb(orb_s)
    if orb_val is None:
        warnings.append(f"Bad orb in aspect line: {line[:80]}")
        return None
    return {
        "body_a": _normalize_aspect_body(a_raw),
        "body_b": _normalize_aspect_body(b_raw),
        "type": typ,
        "nominal_angle_deg": nominal,
        "orb_deg": orb_val,
    }


def parse_chart_export_v1(text: str) -> tuple[dict, list[str]]:
    """
    Returns (natal_chart dict, warnings).
    Raises ValueError on missing required bodies/cusps.
    """
    text = _normalize_vertical_chart_export(text)
    warnings: list[str] = []
    points: dict = {}
    angles: dict = {}
    house_by_body: dict[str, int] = {}
    cusps: list[float | None] = [None] * 12
    aspects: list[dict] = []

    for raw_line in text.splitlines():
        line = _strip_inline_comment(raw_line.strip())
        if _should_skip_noise_line(line):
            continue

        asp = _parse_aspect_line(line, warnings)
        if asp is not None:
            aspects.append(asp)
            continue

        parts = _split_nonempty_tabs(line)
        if not parts:
            continue

        # Skip spreadsheet header row (Body / Sign / Longitude / House)
        if parts[0].lower() == "body":
            continue

        # House cusp: House N D°M' Sign (first cell may be "House 1")
        if parts[0].startswith("House "):
            hm_tab = re.match(r"^House\s+(\d+)$", parts[0])
            house_parsed = False
            if hm_tab and len(parts) >= 3:
                n = int(hm_tab.group(1))
                dm = _parse_deg_min(parts[1])
                sign_raw = parts[-1]
                if (
                    dm
                    and sign_raw.title() in _SIGN_TITLE
                    and 1 <= n <= 12
                ):
                    deg, minute = dm
                    lon = _longitude_deg(sign_raw.lower(), deg, minute)
                    cusps[n - 1] = lon
                    house_parsed = True
            elif "\t" not in line and _try_parse_space_separated_house_cusp(
                line, cusps=cusps
            ):
                house_parsed = True
            if house_parsed:
                continue

        # Body House N — three cells: Sun \t House \t 7
        if len(parts) >= 3 and parts[1] == "House":
            try:
                hn = int(parts[2])
            except ValueError:
                hn = 0
            body_k = _normalize_body_key(parts[0])
            if body_k and 1 <= hn <= 12:
                house_by_body[body_k] = hn
            continue

        # Body House N — two cells: Sun \t House 7 (second column is one field)
        if len(parts) >= 2:
            hm_one = re.match(r"^House\s+(\d+)\s*$", parts[1].strip(), re.I)
            body_k = _normalize_body_key(parts[0])
            if hm_one and body_k:
                hn = int(hm_one.group(1))
                if 1 <= hn <= 12:
                    house_by_body[body_k] = hn
                    continue

        # Longitude row — classic: Body \t D°M' \t Sign ...
        if len(parts) >= 3:
            body_raw = parts[0]
            dm = _parse_deg_min(parts[1])
            if dm:
                retro = False
                sign_idx = 2
                if len(parts) >= 4 and parts[2] in ("Я", "R", "r"):
                    retro = True
                    sign_idx = 3
                sign_raw = parts[sign_idx]
                if sign_raw.title() not in _SIGN_TITLE:
                    warnings.append(f"Unknown sign on line: {line[:80]}")
                    continue
                deg, minute = dm
                lon = _longitude_deg(sign_raw.lower(), deg, minute)
                sig = sign_raw.lower()
                pt = {"longitude_deg": lon, "sign": sig, "retrograde": retro}
                bk = _normalize_body_key(body_raw)
                _assign_point_or_angle(bk, pt, points=points, angles=angles)
                continue

            # Longitude row — spreadsheet: Body \t Sign \t decimal_lon \t [house]
            sign_cell = parts[1].strip()
            if sign_cell.title() in _SIGN_TITLE:
                lon_m = _DECIMAL_LON_RE.match(parts[2].strip())
                if lon_m:
                    lon = float(lon_m.group("lon")) % 360.0
                    sig = sign_cell.lower()
                    pt = {
                        "longitude_deg": round(lon, 6),
                        "sign": sig,
                        "retrograde": False,
                    }
                    if len(parts) >= 4:
                        hk = _parse_house_column(parts[3])
                        if hk is not None:
                            pt["house"] = hk
                    bk = _normalize_body_key(parts[0])
                    if bk is None:
                        warnings.append(f"Unknown body on line: {line[:80]}")
                        continue
                    _assign_point_or_angle(bk, pt, points=points, angles=angles)
                    continue

        if "\t" not in line:
            if _try_parse_space_separated_house_cusp(line, cusps=cusps):
                continue
            if _try_parse_space_separated_body_house(line, house_by_body):
                continue
            if _try_parse_space_separated_lon_row(line, points=points, angles=angles):
                continue

        warnings.append(f"Unrecognized line: {line[:80]}")

    for bk, hn in house_by_body.items():
        if bk in points:
            points[bk]["house"] = hn
        elif bk in angles:
            angles[bk]["house"] = hn

    missing = []
    if "sun" not in points:
        missing.append("Sun")
    if "moon" not in points:
        missing.append("Moon")
    if "ascendant" not in angles:
        missing.append("AS (Ascendant)")
    if any(c is None for c in cusps):
        missing.append("complete house cusps (House 1–12)")
    if missing:
        raise ValueError(
            "Chart export is missing required data: " + ", ".join(missing)
        )

    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    natal_chart = {
        "schema_version": 1,
        "meta": {
            "zodiac": "tropical",
            "house_system": "placidus",
            "source": {
                "kind": "staff_paste",
                "parser": "chart_export_v1",
                "parsed_at": now,
            },
        },
        "points": points,
        "angles": angles,
        "houses": {
            "system": "placidus",
            "cusps_longitude_deg": [float(c) for c in cusps],
        },
        "aspects": aspects,
    }

    return natal_chart, warnings
