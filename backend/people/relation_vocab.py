"""Allowed relation modifiers and cores for Person (server validation)."""

from __future__ import annotations

RELATION_PREFIX_TOKENS: frozenset[str] = frozenset(
    {
        "great",
        "step",
        "half",
        "adopted",
        "adoptive",
        "distant",
        "god",
        "younger",
        "older",
        "foster",
        "twin",
        "triplet",
    }
)

RELATION_SUFFIX_TOKENS: frozenset[str] = frozenset({"in_law", "best"})

RELATION_CORE_CHOICES: tuple[tuple[str, str], ...] = (
    ("self", "Self"),
    ("mother", "Mother"),
    ("father", "Father"),
    ("aunt", "Aunt"),
    ("uncle", "Uncle"),
    ("niece", "Niece"),
    ("nephew", "Nephew"),
    ("cousin", "Cousin"),
    ("spouse", "Spouse"),
    ("partner", "Partner"),
    ("significant_other", "Significant other"),
    ("brother", "Brother"),
    ("sister", "Sister"),
    ("grandpa", "Grandpa"),
    ("grandma", "Grandma"),
    ("friend", "Friend"),
    ("pet", "Pet"),
    ("child", "Child"),
    ("son", "Son"),
    ("daughter", "Daughter"),
)

RELATION_CORE_VALUES: frozenset[str] = frozenset(c for c, _ in RELATION_CORE_CHOICES)


def default_alias_for_core(core: str) -> str:
    return dict(RELATION_CORE_CHOICES).get(core, core.replace("_", " "))


def validate_prefix_tokens(tokens: list | None) -> list[str]:
    if not tokens:
        return []
    if not isinstance(tokens, list):
        raise ValueError("relation_prefix_tokens must be a list.")
    out: list[str] = []
    for t in tokens:
        s = str(t).strip().lower()
        if not s:
            continue
        if s not in RELATION_PREFIX_TOKENS:
            raise ValueError(f"Unknown relation prefix token: {t!r}.")
        out.append(s)
    return out


def validate_suffix_tokens(tokens: list | None, *, relation_core: str) -> list[str]:
    if not tokens:
        return []
    if not isinstance(tokens, list):
        raise ValueError("relation_suffix_tokens must be a list.")
    out: list[str] = []
    for t in tokens:
        s = str(t).strip().lower()
        if not s:
            continue
        if s not in RELATION_SUFFIX_TOKENS:
            raise ValueError(f"Unknown relation suffix token: {t!r}.")
        if s == "best" and relation_core != "friend":
            raise ValueError("Suffix 'best' is only allowed when relation_core is 'friend'.")
        out.append(s)
    return out
