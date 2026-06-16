import logging
from datetime import timedelta

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db import IntegrityError
from django.db.models import Count, Max
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from contact.models import ContactMessage

from .auth0_backend import Auth0TokenAuthentication
from .avatar_url import profile_avatar_url
from .models import PROFILE_TIMEZONE_DEFAULT, Profile
from .permissions import IsApprovedUser, IsStaffUser
from friends.models import FriendRequest
from friends.services import (
    are_friends,
    friend_ids_for_user,
    friends_queryset_for_user,
    order_users_by_recent_activity,
)
from friends.views import friend_user_row_dict
from meal.partner import incoming_meal_partner_pending, mutual_meal_pair
from achievements.services import achievements_payload_for_user, evaluate_meal_maestro_partner_for_user

from achievements.models import UserAchievement

from .serializers import (
    AchievementInboxMarkReadSerializer,
    AchievementVisibilityPatchSerializer,
    LoginSerializer,
    MeSerializer,
    UpcomingBirthdaySerializer,
    ProfileUpdateSerializer,
    SignupSerializer,
    StaffAccountStatusPatchSerializer,
)

UserModel = get_user_model()

SESSION_AUTH_BACKEND = "django.contrib.auth.backends.ModelBackend"

logger = logging.getLogger(__name__)


def get_or_create_profile(user):
    """Users created before Profile existed can lack a row; prevents 500 in /me and sync."""
    display_name_max = Profile._meta.get_field("display_name").max_length
    default_display_name = (user.email.split("@")[0] if user.email else "")
    default_display_name = (
        default_display_name
        if len(default_display_name) <= display_name_max
        else default_display_name[:display_name_max]
    )
    try:
        profile, _ = Profile.objects.get_or_create(
            user=user,
            defaults={
                "display_name": default_display_name,
                "timezone": PROFILE_TIMEZONE_DEFAULT,
            },
        )
    except IntegrityError:
        # Concurrent bootstrap calls can race on profile creation.
        profile = Profile.objects.get(user=user)
    return profile


def meal_crud_partner_label_for_profile(profile) -> str:
    pid = profile.meal_crud_partner_id
    if not pid:
        return ""
    partner = UserModel.objects.filter(pk=pid).first()
    if not partner:
        return ""
    partner_profile = get_or_create_profile(partner)
    nick = (partner_profile.display_name or "").strip()
    if nick:
        return nick
    email = (partner.email or "").strip()
    if email and "@" in email:
        return email.split("@")[0].strip()
    return ""


def serialize_me(user):
    profile = get_or_create_profile(user)
    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username or "",
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_authenticated": True,
            "is_approved": user.account_status == UserModel.AccountStatus.APPROVED,
            "is_staff": user.is_staff,
            "auth0_sub": user.auth0_sub or None,
            "account_status": user.account_status,
            "deleted_at": user.deleted_at,
            "date_joined": user.date_joined.isoformat() if user.date_joined else None,
        },
        "profile": {
            "display_name": profile.display_name,
            "avatar_url": profile_avatar_url(profile),
            "avatar_image_key": profile.avatar_image_key or "",
            "timezone": profile.timezone,
            "birth_date": profile.birth_date,
            "whatif_completed_session": profile.whatif_completed_session,
            "meal_week_starts_on": profile.meal_week_starts_on,
            "meal_crud_partner_id": profile.meal_crud_partner_id,
            "meal_crud_partner_label": meal_crud_partner_label_for_profile(profile),
            "meal_pair_mutual": mutual_meal_pair(user=user),
            "meal_partner_incoming_pending": incoming_meal_partner_pending(user=user),
            "meal_slot_labels": profile.meal_slot_labels,
            "meal_pantry_enabled": profile.meal_pantry_enabled,
            "meal_slots_per_day": profile.meal_slots_per_day,
            "meal_maestro_setup_completed": profile.meal_maestro_setup_completed,
            "meal_dietary_preferences": profile.meal_dietary_preferences or [],
            "display_astro": profile.display_astro,
            "social_publish_visibility": profile.social_publish_visibility,
            "social_read_scope": profile.social_read_scope,
            "songaday_visibility": profile.songaday_visibility,
            "achievement_inbox_read_slugs": profile.achievement_inbox_read_slugs
            or [],
            "home_starred_app_paths": profile.home_starred_app_paths,
            "calendar_display_source_names": profile.calendar_display_source_names,
            "onboarding_completed": profile.onboarding_completed,
            "onboarding_step": profile.onboarding_step,
        },
        "achievements": achievements_payload_for_user(user, public_only=False),
    }


def _upcoming_birthdays_raw_rows(user):
    """Same friend birthday window as upcoming_birthdays; returns rows for UpcomingBirthdaySerializer."""
    today = timezone.localdate()
    window_offsets_by_month_day = {}
    for offset in range(-2, 8):
        day = today + timedelta(days=offset)
        window_offsets_by_month_day[(day.month, day.day)] = offset

    friend_ids = friend_ids_for_user(user=user)
    profiles = Profile.objects.select_related("user").filter(
        user_id__in=friend_ids,
        user__account_status=UserModel.AccountStatus.APPROVED,
        user__deleted_at__isnull=True,
        birth_date__isnull=False,
    )

    rows = []
    for profile in profiles:
        birth_date = profile.birth_date
        month_day = (birth_date.month, birth_date.day)
        offset = window_offsets_by_month_day.get(month_day)
        if offset is None:
            continue
        rows.append(
            {
                "offset": offset,
                "display_name": profile.display_name,
                "birth_month": birth_date.month,
                "birth_day": birth_date.day,
            }
        )

    rows.sort(key=lambda row: (row["offset"], row["display_name"].lower()))
    return [
        {
            "display_name": row["display_name"],
            "birth_month": row["birth_month"],
            "birth_day": row["birth_day"],
        }
        for row in rows
    ]


def _pending_incoming_friend_request_count(user):
    """Count only — avoids loading full friends graph for shell inbox."""
    return FriendRequest.objects.filter(
        requested=user,
        is_accepted=False,
        ignored_by_requester=False,
        ignored_by_requested=False,
    ).count()


def _staff_pending_summary_payload():
    """Same JSON object as GET staff/pending-summary/."""
    from whatif.models import WhatIfQuestion
    from zodiac.models import AstroProfile

    pending_members = UserModel.objects.filter(
        account_status=UserModel.AccountStatus.PENDING
    ).count()
    pending_whatif = WhatIfQuestion.objects.filter(
        review_status=WhatIfQuestion.ReviewStatus.PENDING,
        deleted_at__isnull=True,
    ).count()
    unread_messages = ContactMessage.objects.filter(read_at__isnull=True)
    contact_agg = unread_messages.aggregate(
        contact_messages_count=Count("id"),
        latest_contact_message_id=Max("id"),
    )
    pending_zodiac_charts = AstroProfile.objects.filter(
        chart_status=AstroProfile.ChartStatus.WAITING_STAFF_CHART
    ).count()

    return {
        "pending_members": pending_members,
        "pending_whatif_questions": pending_whatif,
        "contact_messages_count": contact_agg["contact_messages_count"] or 0,
        "latest_contact_message_id": contact_agg["latest_contact_message_id"],
        "pending_zodiac_charts": pending_zodiac_charts,
    }


def inbox_bootstrap_payload(request):
    """
    Shell inbox summary for notification bell / home prompts.
    Mirrors permission gates of the separate inbox endpoints (approved-only slices).
    """
    user = request.user
    approved = user.account_status == UserModel.AccountStatus.APPROVED
    if approved:
        raw_birthdays = _upcoming_birthdays_raw_rows(user)
        upcoming = UpcomingBirthdaySerializer(raw_birthdays, many=True).data
        # Deferred import: closet views pull many models; keep users.views import graph light.
        from closet.views import _closet_action_summary_payload
        from scorenado.inbox import pending_seat_invites_payload

        return {
            "upcoming_birthdays": upcoming,
            "pending_friend_count": _pending_incoming_friend_request_count(user),
            "pending_scorenado_seat_invites": pending_seat_invites_payload(user=user),
            "closet": _closet_action_summary_payload(user),
            "staff_pending_summary": _staff_pending_summary_payload()
            if user.is_staff
            else None,
        }

    return {
        "upcoming_birthdays": [],
        "pending_friend_count": 0,
        "pending_scorenado_seat_invites": [],
        "closet": {"outstanding_actions_count": 0},
        "staff_pending_summary": _staff_pending_summary_payload()
        if user.is_staff
        else None,
    }


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(MeSerializer(serialize_me(request.user)).data)


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def approved_check(request):
    return Response({"ok": True, "message": "You are approved."})


@api_view(["GET"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsApprovedUser])
def upcoming_birthdays(request):
    payload = _upcoming_birthdays_raw_rows(request.user)
    return Response(UpcomingBirthdaySerializer(payload, many=True).data)


@api_view(["POST"])
@permission_classes([AllowAny])
def signup(request):
    serializer = SignupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data["email"]
    password = serializer.validated_data["password"]
    display_name = serializer.validated_data.get("display_name", "").strip()
    timezone = (
        serializer.validated_data.get("timezone", "").strip()
        or PROFILE_TIMEZONE_DEFAULT
    )

    user = UserModel.objects.create_user(
        email=email,
        password=password,
    )

    profile = get_or_create_profile(user)
    profile.display_name = display_name or email.split("@")[0]
    profile.timezone = timezone
    profile.save()

    login(request, user, backend=SESSION_AUTH_BACKEND)

    return Response(
        MeSerializer(serialize_me(user)).data, status=status.HTTP_201_CREATED
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = UserModel.objects.normalize_email(
        serializer.validated_data["email"].strip().lower()
    )
    password = serializer.validated_data["password"]

    user_obj = UserModel.objects.filter(email__iexact=email).first()
    if not user_obj:
        return Response(
            {"detail": "Invalid credentials."}, status=status.HTTP_400_BAD_REQUEST
        )

    user = authenticate(request, username=user_obj.email, password=password)
    if not user:
        return Response(
            {"detail": "Invalid credentials."}, status=status.HTTP_400_BAD_REQUEST
        )

    login(request, user, backend=SESSION_AUTH_BACKEND)
    return Response(MeSerializer(serialize_me(user)).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf(request):
    return Response({"ok": True})


def _public_user_summary_response(*, request, user):
    profile = get_or_create_profile(user)
    viewer = getattr(request, "user", None)
    is_viewer_authenticated = bool(
        viewer and getattr(viewer, "is_authenticated", False)
    )
    is_owner = is_viewer_authenticated and viewer.id == user.id
    viewer_approved = is_viewer_authenticated and (
        viewer.account_status == UserModel.AccountStatus.APPROVED
    )
    is_friend = is_owner or (viewer_approved and are_friends(user_a=viewer, user_b=user))
    owner_publish = profile.social_publish_visibility or Profile.SocialPublishVisibility.ALL_APPROVED
    can_view_full_profile = bool(
        is_owner
        or (
            viewer_approved
            and (
                owner_publish == Profile.SocialPublishVisibility.ALL_APPROVED
                or (owner_publish == Profile.SocialPublishVisibility.FRIENDS_ONLY and is_friend)
            )
        )
    )
    friendship_status = "none"
    if is_owner:
        friendship_status = "self"
    elif is_friend:
        friendship_status = "friends"
    elif viewer_approved:
        direct = FriendRequest.objects.filter(requester=viewer, requested=user).first()
        reverse = FriendRequest.objects.filter(requester=user, requested=viewer).first()
        direct_active = bool(
            direct
            and not direct.is_accepted
            and not direct.ignored_by_requester
            and not direct.ignored_by_requested
        )
        reverse_active = bool(
            reverse
            and not reverse.is_accepted
            and not reverse.ignored_by_requester
            and not reverse.ignored_by_requested
        )
        if reverse_active:
            friendship_status = "incoming_pending"
        elif direct_active:
            friendship_status = "outgoing_pending"

    nickname = (profile.display_name or "").strip() or user.email.split("@")[0]
    payload = {
        "id": user.id,
        "nickname": nickname,
        "avatar_url": profile_avatar_url(profile),
        "is_friend": bool(is_friend),
        "can_view_full_profile": bool(can_view_full_profile),
        "friendship_status": friendship_status,
    }
    if can_view_full_profile:
        payload["display_name"] = (profile.display_name or "").strip()
    # Email remains friend-only to avoid widening sensitive identifiers.
    if is_friend:
        payload["email"] = user.email
    if is_friend and not is_owner:
        from closet.models import Item
        from closet.services import owner_eligible_for_closet_publication_q

        payload["closet_items_count"] = (
            Item.objects.filter(deleted_at__isnull=True, owner_user=user)
            .filter(owner_eligible_for_closet_publication_q())
            .count()
        )
        from recommendations.services import active_reviews_qs

        payload["recommendations_count"] = active_reviews_qs().filter(reviewer=user).count()
    if can_view_full_profile:
        from people.models import Person
        from zodiac.models import AstroProfile

        payload["people_count"] = Person.objects.filter(
            owner_user=user, deleted_at__isnull=True
        ).count()
        if profile.birth_date is not None:
            payload["birth_date"] = profile.birth_date.isoformat()
        try:
            astro = AstroProfile.objects.get(user=user)
        except AstroProfile.DoesNotExist:
            astro = None
        if profile.display_astro and astro and astro.chart_status == AstroProfile.ChartStatus.READY:
            if astro.sun_sign:
                payload["sun_sign"] = astro.sun_sign
            if astro.moon_sign:
                payload["moon_sign"] = astro.moon_sign
            if astro.rising_sign:
                payload["rising_sign"] = astro.rising_sign
            nc = astro.natal_chart or {}
            pts = nc.get("points") or {}
            for key, sign_field in (
                ("mercury", "mercury_sign"),
                ("venus", "venus_sign"),
                ("mars", "mars_sign"),
            ):
                pt = pts.get(key)
                if isinstance(pt, dict) and pt.get("sign"):
                    payload[sign_field] = pt["sign"]
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def user_friends_list_for_viewer(request, user_id: int):
    """Approved friends of `user_id`, only when the viewer is friends with that user.

    The viewer is omitted from the list so you never see yourself under a friend's friends.
    """
    viewer = request.user
    target = get_object_or_404(UserModel.objects.all(), pk=user_id)
    if not are_friends(user_a=viewer, user_b=target):
        return Response(
            {"detail": "You can only view friends of users you are friends with."},
            status=status.HTTP_403_FORBIDDEN,
        )
    qs = order_users_by_recent_activity(
        friends_queryset_for_user(user=target)
        .exclude(pk=viewer.pk)
        .select_related("profile")
    )
    return Response([friend_user_row_dict(friend) for friend in qs])


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_public_summary_by_id(request, user_id: int):
    """Friend profile summary; non-friends receive only nickname + avatar."""
    user = get_object_or_404(UserModel.objects.all(), pk=user_id)
    return _public_user_summary_response(request=request, user=user)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_public_summary_by_email(request, email: str):
    user = get_object_or_404(UserModel.objects.all(), email__iexact=email)
    return _public_user_summary_response(request=request, user=user)


@api_view(["POST"])
@authentication_classes([Auth0TokenAuthentication])
@permission_classes([IsAuthenticated])
def sync_profile(request):
    """Bootstrap session after Auth0 login. Identity is enforced in Auth0TokenAuthentication."""
    try:
        return Response(MeSerializer(serialize_me(request.user)).data)
    except Exception:
        logger.exception(
            "sync_profile failed user_pk=%s",
            getattr(request.user, "pk", None),
        )
        raise


@api_view(["POST"])
@authentication_classes([Auth0TokenAuthentication])
@permission_classes([IsAuthenticated])
def bootstrap_session(request):
    """
    Single round-trip: session (MeSerializer) + shell inbox summary for bell/home prompts.
    Same authentication contract as sync_profile.
    """
    try:
        user = request.user
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        session_data = MeSerializer(serialize_me(user)).data
        inbox_data = inbox_bootstrap_payload(request)
        return Response({"session": session_data, "inbox": inbox_data})
    except Exception:
        logger.exception(
            "bootstrap_session failed user_pk=%s",
            getattr(request.user, "pk", None),
        )
        raise


@api_view(["PATCH"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsAuthenticated])
def patch_me_profile(request):
    """Update only the authenticated user's profile preferences."""
    profile = get_or_create_profile(request.user)
    serializer = ProfileUpdateSerializer(data=request.data, partial=True, context={"request": request})
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    if "meal_crud_partner_id" in data:
        target = data["meal_crud_partner_id"]
        if target is None:
            if profile.meal_crud_partner_id and mutual_meal_pair(user=request.user):
                return Response(
                    {
                        "detail": "Use Meal Maestro disconnect flow to end a mutual partnership.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            if target == request.user.id:
                return Response(
                    {"detail": "Invalid meal partner."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if target not in friend_ids_for_user(user=request.user):
                return Response(
                    {"detail": "Meal partner must be an approved friend."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            target_user = get_object_or_404(UserModel.objects.all(), pk=target)
            target_profile = get_or_create_profile(target_user)
            tpid = target_profile.meal_crud_partner_id
            if tpid is not None and tpid != request.user.id:
                return Response(
                    {
                        "detail": "That friend already has another meal partner choice. They can change it in Meal Maestro settings.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
    allowed = {
        "display_name",
        "avatar_url",
        "avatar_image_key",
        "timezone",
        "birth_date",
        "meal_week_starts_on",
        "social_publish_visibility",
        "social_read_scope",
    }
    for field in allowed:
        if field in data:
            setattr(profile, field, data[field])
    if "meal_crud_partner_id" in data:
        profile.meal_crud_partner_id = data["meal_crud_partner_id"]
    if "meal_slot_labels" in data:
        incoming = data["meal_slot_labels"]
        if incoming is None:
            profile.meal_slot_labels = None
        else:
            profile.meal_slot_labels = {**(profile.meal_slot_labels or {}), **incoming}
    if "meal_pantry_enabled" in data:
        profile.meal_pantry_enabled = bool(data["meal_pantry_enabled"])
    if "meal_maestro_setup_completed" in data:
        profile.meal_maestro_setup_completed = bool(data["meal_maestro_setup_completed"])
    if "meal_dietary_preferences" in data:
        from meal.pantry_access import normalize_dietary_preference_list

        profile.meal_dietary_preferences = normalize_dietary_preference_list(
            data["meal_dietary_preferences"],
        )
    slots_per_day_changed = False
    if "meal_slots_per_day" in data:
        new_n = int(data["meal_slots_per_day"])
        if new_n < 1 or new_n > 5:
            return Response(
                {"detail": "meal_slots_per_day must be between 1 and 5."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if new_n != profile.meal_slots_per_day:
            profile.meal_slots_per_day = new_n
            slots_per_day_changed = True
    if "display_astro" in data:
        profile.display_astro = bool(data["display_astro"])
    if "calendar_display_source_names" in data:
        profile.calendar_display_source_names = bool(
            data["calendar_display_source_names"]
        )
    if "songaday_visibility" in data:
        profile.songaday_visibility = data["songaday_visibility"]
    if "home_starred_app_paths" in data:
        profile.home_starred_app_paths = data["home_starred_app_paths"]
    onboarding_just_completed = False
    if "onboarding_completed" in data:
        was_completed = profile.onboarding_completed
        profile.onboarding_completed = bool(data["onboarding_completed"])
        onboarding_just_completed = profile.onboarding_completed and not was_completed
    if "onboarding_step" in data:
        profile.onboarding_step = int(data["onboarding_step"])
    profile.save()
    if slots_per_day_changed:
        from meal.grid import rebuild_all_instances_for_user

        rebuild_all_instances_for_user(owner=request.user, slots_per_day=profile.meal_slots_per_day)
    if "birth_date" in data:
        from zodiac.birth_sync import sync_birth_date_across_profiles

        sync_birth_date_across_profiles(user=request.user, birth_date=profile.birth_date)
    if "meal_crud_partner_id" in data:
        evaluate_meal_maestro_partner_for_user(request.user.id)
    if onboarding_just_completed:
        from achievements.services import evaluate_welcome_to_pond_arbor_for_user

        evaluate_welcome_to_pond_arbor_for_user(request.user.id)
    return Response(MeSerializer(serialize_me(request.user)).data)


@api_view(["PATCH"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsAuthenticated])
def patch_me_achievement_visibility(request, slug: str):
    """Set whether an unlocked achievement appears on friends’ profiles (false = hidden)."""
    ua = get_object_or_404(
        UserAchievement.objects.select_related("achievement"),
        user=request.user,
        achievement__slug=slug,
    )
    serializer = AchievementVisibilityPatchSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    raw = serializer.validated_data["visible_to_friends"]
    if raw is False:
        ua.visible_to_friends = False
    else:
        ua.visible_to_friends = None
    ua.save(update_fields=["visible_to_friends"])
    return Response(MeSerializer(serialize_me(request.user)).data)


@api_view(["POST"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsAuthenticated])
def mark_me_achievement_inbox_read(request):
    """
    Mark achievement "Unlocked: ..." bell notices as read for the account.
    Stored on Profile so the state persists across devices.
    """
    profile = get_or_create_profile(request.user)
    serializer = AchievementInboxMarkReadSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    incoming = serializer.validated_data["slugs"]

    existing = set(profile.achievement_inbox_read_slugs or [])
    before = len(existing)
    for slug in incoming:
        if slug:
            existing.add(slug)
    if len(existing) != before:
        profile.achievement_inbox_read_slugs = sorted(existing)
        profile.save(update_fields=["achievement_inbox_read_slugs"])
    return Response(MeSerializer(serialize_me(request.user)).data)


def _serialize_staff_user_row(user):
    profile = get_or_create_profile(user)
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username or "",
        "account_status": user.account_status,
        "is_staff": user.is_staff,
        "display_name": profile.display_name,
        "date_joined": user.date_joined,
    }


@api_view(["GET"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsAuthenticated, IsStaffUser])
def staff_pending_summary(request):
    return Response(_staff_pending_summary_payload())


@api_view(["GET"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsAuthenticated, IsStaffUser])
def staff_users_list(request):
    users = UserModel.objects.select_related("profile").order_by("-date_joined", "-id")
    return Response([_serialize_staff_user_row(u) for u in users])


@api_view(["PATCH"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsAuthenticated, IsStaffUser])
def staff_user_patch(request, user_id: int):
    # Do not allow changing your own approval status (avoids accidental self-lockout).
    if user_id == request.user.id:
        return Response(
            {"detail": "You cannot change your own account status here."},
            status=status.HTTP_403_FORBIDDEN,
        )
    target = get_object_or_404(UserModel.objects.all(), pk=user_id)
    serializer = StaffAccountStatusPatchSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    target.account_status = serializer.validated_data["account_status"]
    target.save(update_fields=["account_status"])
    return Response(_serialize_staff_user_row(target))
