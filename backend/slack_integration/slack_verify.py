import hashlib
import hmac
import time

from django.conf import settings


def verify_slack_request_signature(*, body: bytes, timestamp: str | None, signature: str | None) -> bool:
    secret = (getattr(settings, "SLACK_SIGNING_SECRET", None) or "").strip()
    if not secret or not timestamp or not signature:
        return False
    try:
        ts = int(str(timestamp).strip())
    except (TypeError, ValueError):
        return False
    # Slack recommends a 5 minute window; use 10 minutes to be resilient to minor clock skew.
    if abs(int(time.time()) - ts) > 60 * 10:
        return False
    # Compute HMAC over the exact raw request body bytes.
    # Slack spec: basestring is "v0:{timestamp}:{raw_body}".
    basestring = b"v0:" + str(timestamp).encode("utf-8") + b":" + body
    digest = hmac.new(secret.encode("utf-8"), basestring, hashlib.sha256).hexdigest()
    # Slack sends signatures like "v0=<hex>".
    expected = f"v0={digest}"
    sig = str(signature).strip()
    # Be lenient for any old tokens/logs that used ":" formatting.
    return hmac.compare_digest(expected, sig) or hmac.compare_digest(f"v0:{digest}", sig)
