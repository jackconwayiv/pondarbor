import json
import logging
from datetime import datetime
from types import SimpleNamespace
from urllib.parse import parse_qsl
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import IntegrityError, transaction
from django.http import HttpResponseForbidden, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response

from achievements.services import evaluate_quote_achievements_for_user
from quotes.discoverable import random_discoverable_published_quote
from quotes.models import Quote
from quotes.serializers import QuoteCreateSerializer
from songaday.models import SongPrompt
from songaday.submission import (
    SongadaySubmissionError,
    create_song_response_from_validated_data,
    validate_song_response_payload,
)
from slack_integration.models import (
    SlackEventReceipt,
    SlackIdentity,
    SlackSongadayIngestTrace,
    SongadaySlackDailyPromptState,
)
from slack_integration.slack_api import (
    slack_chat_post_ephemeral,
    slack_chat_post_message,
    slack_users_info,
 )
from slack_integration.slack_verify import verify_slack_request_signature
from slack_integration.closet_commands import handle_slack_closet_command, handle_slack_loans_command
from slack_integration.quote_from_text import parse_slack_quote_command_text
from slack_integration.quote_slack_format import format_random_quote_slack_message
from slack_integration.song_from_text import (
    build_serializer_data_from_slack_text,
    extract_first_slack_url,
    extract_slack_message_notes,
)
from users.auth0_backend import Auth0TokenAuthentication
from users.models import User
from users.permissions import IsApprovedUser

logger = logging.getLogger(__name__)


def _slack_songaday_channel_id() -> str:
    return (
        (getattr(settings, "SLACK_SONGADAY_CHANNEL_ID", None) or "").strip()
        or (getattr(settings, "SLACK_PROMPTS_CHANNEL_ID", None) or "").strip()
    )


def _extract_first_url(text: str) -> str:
    return extract_first_slack_url(text)


def _create_account_blocks(*, url: str) -> list[dict]:
    return [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "Want to save Song-a-day picks from Slack? Create a PondArbor account (you can sign up with Slack).",
            },
        },
        {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "Create account"},
                    "style": "primary",
                    "url": url,
                }
            ],
        },
    ]


def _slack_ephemeral(text: str) -> JsonResponse:
    return JsonResponse({"response_type": "ephemeral", "text": text})


def _slack_in_channel(text: str) -> JsonResponse:
    return JsonResponse({"response_type": "in_channel", "text": text})


def _slack_debug_channel_id() -> str:
    return (getattr(settings, "SLACK_DEBUG_CHANNEL_ID", None) or "").strip()


def _post_debug(*, text: str) -> None:
    """
    Optional debug channel message for failures.

    Best-effort: do not raise; do not block the Events API ack.
    """
    channel = _slack_debug_channel_id()
    if not channel:
        return
    try:
        resp = slack_chat_post_message(channel=channel, text=text)
        if not resp.get("ok"):
            logger.warning("Slack debug chat.postMessage failed: %s", resp)
    except Exception:
        logger.exception("Slack debug chat.postMessage exception")


def _truncate(s: str, n: int) -> str:
    raw = (s or "").strip()
    if len(raw) <= n:
        return raw
    return raw[: max(0, n - 1)] + "…"


def _trace(
    *,
    outcome: str,
    event_id: str = "",
    team_id: str = "",
    channel_id: str = "",
    slack_user_id: str = "",
    raw_text: str = "",
    extracted_url: str = "",
    user: User | None = None,
    song_response_id: int | None = None,
    detail: str = "",
) -> None:
    """
    Best-effort trace row; must never raise.
    """
    try:
        SlackSongadayIngestTrace.objects.create(
            outcome=outcome,
            event_id=_truncate(event_id, 128),
            team_id=_truncate(team_id, 32),
            channel_id=_truncate(channel_id, 32),
            slack_user_id=_truncate(slack_user_id, 32),
            raw_text=_truncate(raw_text, 512),
            extracted_url=_truncate(extracted_url, 512),
            user=user,
            song_response_id=song_response_id,
            detail=_truncate(detail, 512),
        )
    except Exception:
        logger.exception("SlackSongadayIngestTrace create failed")


def _today_for_songaday_slack() -> datetime.date:
    tz_name = getattr(settings, "SONGADAY_SLACK_PROMPT_TIMEZONE", "UTC") or "UTC"
    try:
        tz = ZoneInfo(tz_name.strip())
    except Exception:
        tz = ZoneInfo("UTC")
    return datetime.now(tz).date()


def _format_songaday_prompt_message(*, today: datetime.date, prompt_text: str) -> str:
    mmdd = today.strftime("%m/%d")
    text = (prompt_text or "").strip()
    return f"Song-a-Day Prompt for {mmdd}: '*{text}*'"


def _today_songaday_prompt() -> tuple[datetime.date, SongPrompt | None]:
    today = _today_for_songaday_slack()
    prompt = SongPrompt.objects.filter(month=today.month, day=today.day).first()
    return today, prompt


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


def _slack_ephemeral_drf_validation(e: DRFValidationError) -> JsonResponse:
    detail = e.detail if hasattr(e, "detail") else str(e)
    if isinstance(detail, dict):
        parts = [f"{k}: {v}" for k, v in detail.items()]
        msg = "; ".join(parts) if parts else str(detail)
    elif isinstance(detail, list):
        msg = "; ".join(str(x) for x in detail)
    else:
        msg = str(detail)
    return _slack_ephemeral(msg)


def _handle_slack_randomquote_command() -> JsonResponse:
    quote = random_discoverable_published_quote()
    if quote is None:
        return _slack_ephemeral("No published quotes are available right now.")
    return _slack_in_channel(format_random_quote_slack_message(quote))


def _handle_slack_prompt_command() -> JsonResponse:
    today, prompt = _today_songaday_prompt()
    if prompt is None:
        return _slack_ephemeral("There is no Song-a-day prompt for today's calendar entry.")
    return _slack_in_channel(_format_songaday_prompt_message(today=today, prompt_text=prompt.prompt))


def _handle_slack_song_command(
    *,
    text: str,
    team_id: str,
    slack_user_id: str,
) -> JsonResponse:
    user, err = _resolve_user_for_slack(team_id, slack_user_id)
    if err or not user:
        return _slack_ephemeral(err or "Could not resolve your account.")

    if user.account_status != User.AccountStatus.APPROVED:
        return _slack_ephemeral("Your PondArbor account is still pending approval.")

    today, prompt = _today_songaday_prompt()
    if prompt is None:
        return _slack_ephemeral("There is no Song-a-day prompt for today's calendar entry.")

    try:
        url = extract_first_slack_url(text)
        link_text = url or (text or "").strip()
        notes = extract_slack_message_notes(text, url=url)
        payload = build_serializer_data_from_slack_text(
            text=link_text,
            entry_date=today,
            prompt_snapshot=prompt.prompt,
            notes=notes,
        )
        data = validate_song_response_payload(payload)
        create_song_response_from_validated_data(user=user, data=data)
    except DRFValidationError as e:
        return _slack_ephemeral_drf_validation(e)
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


def _handle_slack_quote_command(
    *,
    text: str,
    team_id: str,
    slack_user_id: str,
) -> JsonResponse:
    user, err = _resolve_user_for_slack(team_id, slack_user_id)
    if err or not user:
        return _slack_ephemeral(err or "Could not resolve your account.")

    body, attribution = parse_slack_quote_command_text(text)
    if not body:
        return _slack_ephemeral(
            "Add quote text after `/quote`, e.g. `/quote here's my quote -billy`."
        )

    payload: dict = {
        "body": body,
        "visibility": Quote.Visibility.PRIVATE.value,
    }
    if attribution:
        payload["labels"] = [{"kind": "attribution", "name": attribution}]

    try:
        serializer = QuoteCreateSerializer(
            data=payload,
            context={"request": SimpleNamespace(user=user)},
        )
        serializer.is_valid(raise_exception=True)
        quote = serializer.save()
        evaluate_quote_achievements_for_user(quote.owner_id)
    except DRFValidationError as e:
        return _slack_ephemeral_drf_validation(e)
    except Exception:
        logger.exception("Slack /quote handler failed")
        return _slack_ephemeral("Something went wrong saving your quote. Try again later.")

    if attribution:
        return _slack_ephemeral(f"Saved your quote (attributed to {attribution}).")
    return _slack_ephemeral("Saved your quote.")


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

    from slack_integration.dm_digest import dm_throttle_enabled, flush_due_digests

    if dm_throttle_enabled():
        try:
            flush_due_digests()
        except Exception:
            logger.exception("flush_due_digests at slack_commands entry failed")

    command = (params.get("command") or "").strip()
    text = params.get("text") or ""
    team_id = (params.get("team_id") or "").strip()
    slack_user_id = (params.get("user_id") or "").strip()

    if command == "/randomquote":
        return _handle_slack_randomquote_command()
    if command == "/quote":
        return _handle_slack_quote_command(
            text=text,
            team_id=team_id,
            slack_user_id=slack_user_id,
        )
    if command == "/prompt":
        return _handle_slack_prompt_command()
    if command == "/song":
        return _handle_slack_song_command(
            text=text,
            team_id=team_id,
            slack_user_id=slack_user_id,
        )
    if command == "/closet":
        user, err = _resolve_user_for_slack(team_id, slack_user_id)
        return handle_slack_closet_command(user=user, err=err)
    if command == "/loans":
        user, err = _resolve_user_for_slack(team_id, slack_user_id)
        return handle_slack_loans_command(user=user, err=err)
    return _slack_ephemeral("Unknown command.")


@csrf_exempt
@require_POST
def slack_events(request):
    """
    Slack Events API receiver. Subscribed to `message.channels` and restricted to the Song-a-day channel.
    """
    raw_body = request.body
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        return JsonResponse({"ok": False}, status=400)

    # URL verification handshake
    if payload.get("type") == "url_verification":
        # Slack expects a plain JSON body containing the exact `challenge` string.
        # Allow this handshake to succeed even before the signing secret is configured.
        return JsonResponse({"challenge": payload.get("challenge")})

    # Non-handshake requests must be verified.
    event_id = (payload.get("event_id") or "").strip()
    team_id = (payload.get("team_id") or "").strip()
    if not verify_slack_request_signature(
        body=raw_body,
        timestamp=request.headers.get("X-Slack-Request-Timestamp"),
        signature=request.headers.get("X-Slack-Signature"),
    ):
        _trace(outcome=SlackSongadayIngestTrace.Outcome.signature_invalid, event_id=event_id, team_id=team_id)
        return HttpResponseForbidden("invalid signature")

    if payload.get("type") != "event_callback":
        return JsonResponse({"ok": True})

    event = payload.get("event") or {}
    if not isinstance(event, dict):
        return JsonResponse({"ok": True})

    if (event.get("type") or "") != "message":
        return JsonResponse({"ok": True})

    # Parse the relevant fields before dedupe so duplicate_event traces are still informative.
    channel_id = (event.get("channel") or "").strip()
    slack_user_id = (event.get("user") or "").strip()
    text = (event.get("text") or "").strip()
    url = _extract_first_url(text)
    subtype = str(event.get("subtype") or "").strip()
    bot_id = str(event.get("bot_id") or "").strip()

    if event_id:
        try:
            SlackEventReceipt.objects.create(event_id=event_id)
        except IntegrityError:
            _trace(
                outcome=SlackSongadayIngestTrace.Outcome.duplicate_event,
                event_id=event_id,
                team_id=team_id,
                channel_id=channel_id,
                slack_user_id=slack_user_id,
                raw_text=text,
                extracted_url=url,
                detail=f"subtype={subtype} bot_id={bot_id}",
            )
            return JsonResponse({"ok": True})
        except Exception as e:
            # If dedupe fails for non-duplicate reasons, do not continue to avoid double-saves.
            _trace(
                outcome=SlackSongadayIngestTrace.Outcome.exception,
                event_id=event_id,
                team_id=team_id,
                channel_id=channel_id,
                slack_user_id=slack_user_id,
                raw_text=text,
                extracted_url=url,
                detail=f"event_receipt_create_failed: {e!r}",
            )
            _post_debug(
                text=f"[songaday_ingest] outcome=exception event_id={event_id} team={team_id} channel={channel_id} user={slack_user_id} url={url} detail=event_receipt_create_failed"
            )
            return JsonResponse({"ok": True})

    # Ignore bots / message edits / joins etc.
    if event.get("subtype"):
        logger.info("slack_events ignored subtype=%s channel=%s", event.get("subtype"), event.get("channel"))
        _trace(
            outcome=SlackSongadayIngestTrace.Outcome.ignored_subtype,
            event_id=event_id,
            team_id=team_id,
            channel_id=channel_id,
            slack_user_id=slack_user_id,
            raw_text=text,
            extracted_url=url,
            detail=subtype,
        )
        return JsonResponse({"ok": True})
    if event.get("bot_id"):
        logger.info("slack_events ignored bot_id channel=%s", event.get("channel"))
        _trace(
            outcome=SlackSongadayIngestTrace.Outcome.ignored_bot,
            event_id=event_id,
            team_id=team_id,
            channel_id=channel_id,
            slack_user_id=slack_user_id,
            raw_text=text,
            extracted_url=url,
            detail=bot_id,
        )
        return JsonResponse({"ok": True})

    if not channel_id:
        return JsonResponse({"ok": True})
    allowed_channel = _slack_songaday_channel_id()
    if allowed_channel and channel_id != allowed_channel:
        logger.info("slack_events ignored channel=%s allowed=%s", channel_id, allowed_channel)
        _trace(
            outcome=SlackSongadayIngestTrace.Outcome.ignored_channel,
            event_id=event_id,
            team_id=team_id,
            channel_id=channel_id,
            slack_user_id=slack_user_id,
            raw_text=text,
            extracted_url=url,
            detail=f"allowed_channel={allowed_channel}",
        )
        return JsonResponse({"ok": True})

    if not slack_user_id:
        return JsonResponse({"ok": True})

    if not url:
        logger.info("slack_events no_url channel=%s user=%s text=%r", channel_id, slack_user_id, text[:200])
        _trace(
            outcome=SlackSongadayIngestTrace.Outcome.no_url,
            event_id=event_id,
            team_id=team_id,
            channel_id=channel_id,
            slack_user_id=slack_user_id,
            raw_text=text,
        )
        return JsonResponse({"ok": True})

    user, err = _resolve_user_for_slack(team_id, slack_user_id)
    if err or not user:
        _trace(
            outcome=SlackSongadayIngestTrace.Outcome.unlinked_user,
            event_id=event_id,
            team_id=team_id,
            channel_id=channel_id,
            slack_user_id=slack_user_id,
            raw_text=text,
            extracted_url=url,
            detail=err or "",
        )
        _post_debug(
            text=f"[songaday_ingest] outcome=unlinked_user event_id={event_id} team={team_id} channel={channel_id} user={slack_user_id} url={url} detail={_truncate(err or '', 120)}"
        )
        create_url = (getattr(settings, "SLACK_CREATE_ACCOUNT_URL", None) or "").strip()
        if create_url:
            resp = slack_chat_post_ephemeral(
                channel=channel_id,
                user=slack_user_id,
                text=err
                or "To submit Song-a-day from Slack, create a PondArbor account.",
                blocks=_create_account_blocks(url=create_url),
            )
            if not resp.get("ok"):
                logger.warning("Slack postEphemeral failed (unlinked): %s", resp)
            return JsonResponse({"ok": True})
        resp = slack_chat_post_ephemeral(
            channel=channel_id,
            user=slack_user_id,
            text=err
            or "To submit Song-a-day from Slack, sign up or log in to PondArbor (try “Sign up with Slack”).",
        )
        if not resp.get("ok"):
            logger.warning("Slack postEphemeral failed (unlinked fallback): %s", resp)
        return JsonResponse({"ok": True})

    if user.account_status != User.AccountStatus.APPROVED:
        _trace(
            outcome=SlackSongadayIngestTrace.Outcome.pending_approval,
            event_id=event_id,
            team_id=team_id,
            channel_id=channel_id,
            slack_user_id=slack_user_id,
            raw_text=text,
            extracted_url=url,
            user=user,
        )
        _post_debug(
            text=f"[songaday_ingest] outcome=pending_approval event_id={event_id} team={team_id} channel={channel_id} user={slack_user_id} pond_user_id={getattr(user, 'id', None)} url={url}"
        )
        resp = slack_chat_post_ephemeral(
            channel=channel_id,
            user=slack_user_id,
            text="Your PondArbor account is still pending approval.",
        )
        if not resp.get("ok"):
            logger.warning("Slack postEphemeral failed (pending): %s", resp)
        return JsonResponse({"ok": True})

    today = _today_for_songaday_slack()
    prompt = SongPrompt.objects.filter(month=today.month, day=today.day).first()
    if not prompt:
        msg = f"No Song-a-Day prompt is configured for {today.isoformat()}."
        _trace(
            outcome=SlackSongadayIngestTrace.Outcome.no_prompt_today,
            event_id=event_id,
            team_id=team_id,
            channel_id=channel_id,
            slack_user_id=slack_user_id,
            raw_text=text,
            extracted_url=url,
            user=user,
            detail=msg,
        )
        _post_debug(
            text=f"[songaday_ingest] outcome=no_prompt_today event_id={event_id} team={team_id} channel={channel_id} user={slack_user_id} pond_user_id={getattr(user, 'id', None)} today={today.isoformat()} url={url}"
        )
        resp = slack_chat_post_ephemeral(channel=channel_id, user=slack_user_id, text=msg)
        if not resp.get("ok"):
            logger.warning("Slack postEphemeral failed (no prompt today): %s", resp)
        return JsonResponse({"ok": True})

    try:
        notes = extract_slack_message_notes(text, url=url)
        payload2 = build_serializer_data_from_slack_text(
            text=url,
            entry_date=today,
            prompt_snapshot=prompt.prompt,
            notes=notes,
        )
        data = validate_song_response_payload(payload2)
        row = create_song_response_from_validated_data(user=user, data=data)
        _trace(
            outcome=SlackSongadayIngestTrace.Outcome.saved,
            event_id=event_id,
            team_id=team_id,
            channel_id=channel_id,
            slack_user_id=slack_user_id,
            raw_text=text,
            extracted_url=url,
            user=user,
            song_response_id=getattr(row, "id", None),
        )
        logger.info(
            "slack_songaday_ingest outcome=saved event_id=%s channel=%s slack_user=%s pond_user=%s response_id=%s",
            event_id,
            channel_id,
            slack_user_id,
            getattr(user, "id", None),
            getattr(row, "id", None),
        )
        resp = slack_chat_post_ephemeral(
            channel=channel_id,
            user=slack_user_id,
            text=f"Saved your Song-a-day pick for {today.isoformat()}.",
        )
        if not resp.get("ok"):
            logger.warning("Slack postEphemeral failed (saved): %s", resp)
    except SongadaySubmissionError as e:
        # Most commonly: already submitted today.
        outcome = (
            SlackSongadayIngestTrace.Outcome.already_submitted
            if getattr(e, "status_code", None) == 409
            else SlackSongadayIngestTrace.Outcome.validation_error
        )
        _trace(
            outcome=outcome,
            event_id=event_id,
            team_id=team_id,
            channel_id=channel_id,
            slack_user_id=slack_user_id,
            raw_text=text,
            extracted_url=url,
            user=user,
            detail=e.message,
        )
        _post_debug(
            text=f"[songaday_ingest] outcome={outcome} event_id={event_id} team={team_id} channel={channel_id} user={slack_user_id} pond_user_id={getattr(user, 'id', None)} url={url} detail={_truncate(e.message, 120)}"
        )
        resp = slack_chat_post_ephemeral(channel=channel_id, user=slack_user_id, text=e.message)
        if not resp.get("ok"):
            logger.warning("Slack postEphemeral failed (submission error): %s", resp)
    except Exception:
        logger.exception("Slack message URL parse submit failed")
        _trace(
            outcome=SlackSongadayIngestTrace.Outcome.exception,
            event_id=event_id,
            team_id=team_id,
            channel_id=channel_id,
            slack_user_id=slack_user_id,
            raw_text=text,
            extracted_url=url,
            user=user,
        )
        _post_debug(
            text=f"[songaday_ingest] outcome=exception event_id={event_id} team={team_id} channel={channel_id} user={slack_user_id} pond_user_id={getattr(user, 'id', None)} url={url}"
        )
        resp = slack_chat_post_ephemeral(
            channel=channel_id,
            user=slack_user_id,
            text="Could not save that link as a Song-a-day pick. Try `/song <url>`.",
        )
        if not resp.get("ok"):
            logger.warning("Slack postEphemeral failed (exception): %s", resp)

    return JsonResponse({"ok": True})


@api_view(["POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def songaday_slack_daily_prompt_sync(request):
    if settings.DEBUG:
        return Response(
            {"posted": False, "reason": "disabled_in_dev"},
            status=status.HTTP_200_OK,
        )

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

    message = _format_songaday_prompt_message(today=today, prompt_text=prompt.prompt)

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
