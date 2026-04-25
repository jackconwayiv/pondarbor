import logging
from datetime import datetime
from urllib.parse import parse_qsl
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import transaction
from django.http import HttpResponseForbidden, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response

from songaday.models import SongPrompt
from songaday.submission import (
    SongadaySubmissionError,
    create_song_response_from_validated_data,
    validate_song_response_payload,
)
from slack_integration.models import SlackIdentity, SongadaySlackDailyPromptState
from slack_integration.slack_api import slack_chat_post_message, slack_users_info
from slack_integration.slack_verify import verify_slack_request_signature
from slack_integration.song_from_text import build_serializer_data_from_slack_text
from users.auth0_backend import Auth0TokenAuthentication
from users.models import User
from users.permissions import IsApprovedUser

logger = logging.getLogger(__name__)


def _slack_ephemeral(text: str) -> JsonResponse:
    return JsonResponse({"response_type": "ephemeral", "text": text})


def _slack_in_channel(text: str) -> JsonResponse:
    return JsonResponse({"response_type": "in_channel", "text": text})


def _today_for_songaday_slack() -> datetime.date:
    tz_name = getattr(settings, "SONGADAY_SLACK_PROMPT_TIMEZONE", "UTC") or "UTC"
    try:
        tz = ZoneInfo(tz_name.strip())
    except Exception:
        tz = ZoneInfo("UTC")
    return datetime.now(tz).date()


def _resolve_user_for_slack(team_id: str, slack_user_id: str) -> tuple[User | None, str | None]:
    ident = SlackIdentity.objects.filter(team_id=team_id, slack_user_id=slack_user_id).select_related("user").first()
    if ident:
        return ident.user, None

    info = slack_users_info(slack_user_id=slack_user_id)
    if not info.get("ok"):
        err = info.get("error", "unknown")
        logger.warning("Slack users.info failed: %s", err)
        return None, f"Could not look up your Slack profile ({err}). Ask an admin to grant `users:read.email`."

    prof = (info.get("user") or {}).get("profile") or {}
    email = (prof.get("email") or "").strip().lower()
    if not email:
        return None, "Slack did not return an email for your account. Use the same email as on PondArbor or contact support."

    user = User.objects.filter(email__iexact=email).first()
    if not user:
        return (
            None,
            "No PondArbor account matches your Slack email. Sign up or log in at the site first (try “Sign up with Slack” if enabled).",
        )

    SlackIdentity.objects.update_or_create(
        team_id=team_id,
        slack_user_id=slack_user_id,
        defaults={"user": user},
    )
    return user, None


@csrf_exempt
@require_POST
def slack_commands(request):
    raw_body = request.body
    if not verify_slack_request_signature(
        body=raw_body,
        timestamp=request.headers.get("X-Slack-Request-Timestamp"),
        signature=request.headers.get("X-Slack-Signature"),
    ):
        return HttpResponseForbidden("invalid signature")

    try:
        params = dict(parse_qsl(raw_body.decode("utf-8"), strict_parsing=False))
    except UnicodeDecodeError:
        return _slack_ephemeral("Invalid request body.")

    if params.get("ssl_check") == "1":
        return JsonResponse({})

    command = (params.get("command") or "").strip()
    text = params.get("text") or ""
    team_id = (params.get("team_id") or "").strip()
    slack_user_id = (params.get("user_id") or "").strip()

    if command != "/song":
        return _slack_ephemeral("Unknown command.")

    user, err = _resolve_user_for_slack(team_id, slack_user_id)
    if err or not user:
        return _slack_ephemeral(err or "Could not resolve your account.")

    if user.account_status != User.AccountStatus.APPROVED:
        return _slack_ephemeral("Your PondArbor account is still pending approval.")

    today = _today_for_songaday_slack()
    prompt = SongPrompt.objects.filter(month=today.month, day=today.day).first()
    if prompt is None:
        return _slack_ephemeral("There is no Song-a-day prompt for today’s calendar entry.")

    try:
        payload = build_serializer_data_from_slack_text(
            text=text,
            entry_date=today,
            prompt_snapshot=prompt.prompt,
        )
        data = validate_song_response_payload(payload)
        create_song_response_from_validated_data(user=user, data=data)
    except DRFValidationError as e:
        detail = e.detail if hasattr(e, "detail") else str(e)
        if isinstance(detail, dict):
            parts = [f"{k}: {v}" for k, v in detail.items()]
            msg = "; ".join(parts) if parts else str(detail)
        elif isinstance(detail, list):
            msg = "; ".join(str(x) for x in detail)
        else:
            msg = str(detail)
        return _slack_ephemeral(msg)
    except SongadaySubmissionError as e:
        return _slack_ephemeral(e.message)
    except ValueError as e:
        return _slack_ephemeral(str(e))
    except Exception:
        logger.exception("Slack /song handler failed")
        return _slack_ephemeral("Something went wrong saving your song. Try again later.")

    # Success should be visible in the channel so others can discover picks.
    raw = (text or "").strip() or "(no link provided)"
    mention = f"<@{slack_user_id}>" if slack_user_id else "Someone"
    msg = (
        f":musical_note: {mention} posted their Song-a-day pick for *{today.isoformat()}*.\n"
        f">{prompt.prompt}\n"
        f"{raw}"
    )
    return _slack_in_channel(msg)


@api_view(["POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def songaday_slack_daily_prompt_sync(request):
    channel = (getattr(settings, "SLACK_PROMPTS_CHANNEL_ID", None) or "").strip()
    token = (getattr(settings, "SLACK_BOT_TOKEN", None) or "").strip()
    if not channel or not token:
        return Response(
            {"posted": False, "reason": "not_configured"},
            status=status.HTTP_200_OK,
        )

    today = _today_for_songaday_slack()
    prompt = SongPrompt.objects.filter(month=today.month, day=today.day).first()
    if not prompt:
        return Response({"posted": False, "reason": "no_prompt_today"}, status=status.HTTP_200_OK)

    message = f"*Song a day — {today.isoformat()}*\n{prompt.prompt}"

    with transaction.atomic():
        SongadaySlackDailyPromptState.objects.get_or_create(
            id=1,
            defaults={"last_posted_on": None},
        )
        state = SongadaySlackDailyPromptState.objects.select_for_update().get(pk=1)
        if state.last_posted_on == today:
            return Response({"posted": False, "reason": "already_posted_today"}, status=status.HTTP_200_OK)

        data = slack_chat_post_message(channel=channel, text=message)
        if not data.get("ok"):
            logger.warning("Slack chat.postMessage failed: %s", data)
            return Response(
                {"posted": False, "reason": "slack_error", "detail": data.get("error")},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        state.last_posted_on = today
        state.save(update_fields=["last_posted_on"])

    return Response({"posted": True, "slack_ts": data.get("ts")}, status=status.HTTP_200_OK)
