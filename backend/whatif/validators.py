import re

DISPLAY_NAME_RE = re.compile(r"^[A-Za-z0-9 ]{1,12}$")

# Disallow ASCII control characters (except common whitespace handled by strip).
_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


def validate_display_name(value: str) -> str:
    s = value.strip()
    if not s:
        raise ValueError("Display name is required.")
    if not DISPLAY_NAME_RE.fullmatch(s):
        raise ValueError(
            "Display name must be 1–12 characters: letters, digits, and spaces only."
        )
    return s


def validate_question_text_field(name: str, value: str, *, max_length: int) -> str:
    s = value.strip()
    if len(s) > max_length:
        raise ValueError(f"{name} must be at most {max_length} characters.")
    if _CONTROL_CHAR_RE.search(s):
        raise ValueError(f"{name} contains unsupported characters.")
    return s
