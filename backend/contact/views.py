import logging
import time

from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.permissions import IsApprovedUser

logger = logging.getLogger(__name__)

CONTACT_MESSAGE_MAX_LEN = 4000
CONTACT_RATE_PER_HOUR = 3


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedUser])
def contact_submit(request):
    """
    POST JSON: { "message": "..." }
    Optional honeypot: { "website": "" } — must be empty/absent.
    """
    data = request.data if isinstance(request.data, dict) else {}
    honeypot = (data.get("website") or "").strip()
    if honeypot:
        return Response({"detail": "Invalid request."}, status=status.HTTP_400_BAD_REQUEST)

    message = (data.get("message") or "").strip()
    if not message:
        return Response(
            {"message": ["Message is required."]},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if len(message) > CONTACT_MESSAGE_MAX_LEN:
        return Response(
            {"message": [f"Message must be at most {CONTACT_MESSAGE_MAX_LEN} characters."]},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = request.user
    bucket = int(time.time() // 3600)
    rate_key = f"contact:submit:{user.id}:{bucket}"
    try:
        n = cache.incr(rate_key)
    except ValueError:
        cache.add(rate_key, 1, timeout=3600)
        n = 1
    if n > CONTACT_RATE_PER_HOUR:
        return Response(
            {"detail": "Too many contact submissions. Try again later."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    inbox = getattr(settings, "CONTACT_INBOX_EMAIL", "") or ""
    if not inbox:
        return Response(
            {"detail": "Contact is not configured on the server."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    subject = f"PondArbor contact from {user.email}"
    body = f"From: {user.email} (user id {user.id})\n\n{message}"

    backend = (getattr(settings, "EMAIL_BACKEND", "") or "").lower()
    if "console" in backend:
        logger.warning(
            "Contact form: EMAIL_BACKEND is console — message is not sent over SMTP; "
            "it appears only in server logs. Configure SMTP (or switch EMAIL_BACKEND) in production.",
        )

    try:
        send_mail(
            subject,
            body,
            settings.DEFAULT_FROM_EMAIL,
            [inbox],
            fail_silently=False,
        )
    except Exception:
        logger.exception(
            "Contact form: send_mail failed (user_id=%s to inbox=%s)",
            user.id,
            inbox,
        )
        return Response(
            {
                "detail": "The message could not be delivered by email. Please try again later.",
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    logger.info("Contact form: email handed off successfully (user_id=%s)", user.id)

    return Response({"ok": True}, status=status.HTTP_200_OK)
