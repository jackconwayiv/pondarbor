import logging
import time

from django.core.cache import cache
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from contact.models import ContactMessage
from users.auth0_backend import Auth0TokenAuthentication
from users.permissions import IsApprovedUser, IsStaffUser

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

    ContactMessage.objects.create(from_user=user, message=message)
    logger.info("Contact form: stored message (user_id=%s)", user.id)

    return Response({"ok": True}, status=status.HTTP_200_OK)


def _serialize_contact_message_row(cm: ContactMessage) -> dict:
    profile = getattr(cm.from_user, "profile", None)
    display_name = getattr(profile, "display_name", None) or ""
    return {
        "id": cm.id,
        "message": cm.message,
        "created_at": cm.created_at,
        "from_user": {
            "id": cm.from_user_id,
            "email": cm.from_user.email,
            "display_name": display_name,
        },
    }


@api_view(["GET"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsAuthenticated, IsStaffUser])
def contact_staff_messages(request):
    qs = ContactMessage.objects.select_related("from_user", "from_user__profile").order_by(
        "-created_at"
    )
    return Response([_serialize_contact_message_row(cm) for cm in qs])
