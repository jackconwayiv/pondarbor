import hashlib
import hmac
import time

from django.conf import settings


def verify_slack_request_signature(*, body: bytes, timestamp: str | None, signature: str | None) -> bool:
    secret = (getattr(settings, "SLACK_SIGNING_SECRET", None) or "").strip()
    if not secret or not timestamp or not signature:
        return False
    try:
        ts = int(timestamp)
    except (TypeError, ValueError):
        return False
    if abs(int(time.time()) - ts) > 60 * 5:
        return False
    basestring = f"v0:{timestamp}:{body.decode('utf-8')}"
    digest = hmac.new(
        secret.encode("utf-8"),
        basestring.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    expected = f"v0:{digest}"
    return hmac.compare_digest(expected, signature)
