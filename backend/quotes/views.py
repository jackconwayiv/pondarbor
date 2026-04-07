from django.contrib.auth import get_user_model
from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_201_CREATED, HTTP_204_NO_CONTENT

from users.auth0_backend import Auth0TokenAuthentication
from users.permissions import IsApprovedUser
from users.models import User as SiteUser
from friends.services import are_friends, friend_ids_for_user

from achievements.services import evaluate_quote_achievements_for_user
from quotes.models import Quote, QuoteLabel
from quotes.serializers import (
    QuoteCreateSerializer,
    QuotePatchSerializer,
    QuoteSerializer,
)

User = get_user_model()


def _quote_list_queryset(base_queryset, *, request):
    # Keep the response N+1-safe:
    # - Quote.owner is FK: select_related
    # - Quote.labels is M2M via through: prefetch_related, including linked_user.
    return (
        base_queryset.filter(deleted_at__isnull=True)
        .select_related("owner")
        .prefetch_related(
            Prefetch(
                "labels",
                queryset=QuoteLabel.objects.select_related("linked_user"),
            )
        )
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"app": "quotes", "ok": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def quote_create(request):
    serializer = QuoteCreateSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    quote = serializer.save()
    evaluate_quote_achievements_for_user(quote.owner_id)
    return Response(
        QuoteSerializer(quote, context={"request": request}).data,
        status=HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def quote_feed(request):
    user = request.user
    if user.account_status != SiteUser.AccountStatus.APPROVED:
        qs = Quote.objects.filter(owner=user)
    else:
        friend_ids = friend_ids_for_user(user=user)
        qs = Quote.objects.filter(
            Q(owner=user)
            | (
                Q(owner_id__in=friend_ids)
                & (Q(visibility=Quote.Visibility.PUBLISHED) | Q(labels__linked_user=user))
            )
        ).distinct()
    qs = _quote_list_queryset(qs, request=request).order_by("-created_at")
    return Response(QuoteSerializer(qs, many=True, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([IsApprovedUser])
def quote_published(request):
    """Friends' published quotes plus the viewer's own published quotes."""
    user = request.user
    friend_ids = friend_ids_for_user(user=user)
    qs = Quote.objects.filter(
        Q(owner=user, visibility=Quote.Visibility.PUBLISHED)
        | (Q(owner_id__in=friend_ids) & Q(visibility=Quote.Visibility.PUBLISHED))
    ).distinct()
    qs = _quote_list_queryset(qs, request=request).order_by("-updated_at", "-created_at")
    return Response(QuoteSerializer(qs, many=True, context={"request": request}).data)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def quote_detail(request, quote_id: int):
    user = request.user

    if request.method == "GET":
        if user.account_status != SiteUser.AccountStatus.APPROVED:
            qs = Quote.objects.filter(owner=user).filter(deleted_at__isnull=True)
        else:
            friend_ids = friend_ids_for_user(user=user)
            qs = Quote.objects.filter(
                Q(owner=user)
                | (
                    Q(owner_id__in=friend_ids)
                    & (
                        Q(visibility=Quote.Visibility.PUBLISHED)
                        | Q(labels__linked_user=user)
                    )
                )
            ).filter(deleted_at__isnull=True)

        quote = get_object_or_404(qs, id=quote_id)
        qs = _quote_list_queryset(Quote.objects.filter(id=quote.id), request=request)
        quote = qs.first() or quote
        return Response(QuoteSerializer(quote, context={"request": request}).data, status=HTTP_200_OK)

    # PATCH/DELETE: owner only.
    quote = get_object_or_404(Quote, id=quote_id, owner=request.user, deleted_at__isnull=True)

    if request.method == "PATCH":
        serializer = QuotePatchSerializer(
            instance=quote, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        evaluate_quote_achievements_for_user(quote.owner_id)
        quote = (
            Quote.objects.select_related("owner")
            .prefetch_related(
                Prefetch(
                    "labels",
                    queryset=QuoteLabel.objects.select_related("linked_user"),
                )
            )
            .get(id=quote.id)
        )
        return Response(QuoteSerializer(quote, context={"request": request}).data, status=HTTP_200_OK)

    owner_id = quote.owner_id
    quote.deleted_at = timezone.now()
    quote.save(update_fields=["deleted_at", "updated_at"])
    evaluate_quote_achievements_for_user(owner_id)
    return Response(status=HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def quote_labels_autocomplete(request):
    user = request.user
    kind = request.query_params.get("kind")
    search = (request.query_params.get("search") or "").strip()

    qs = QuoteLabel.objects.filter(owner=user)
    if kind:
        qs = qs.filter(kind=kind)
    if search:
        qs = qs.filter(name__icontains=search)

    qs = qs.order_by("kind", "name")[:20]
    from quotes.serializers import QuoteLabelSerializer

    return Response(QuoteLabelSerializer(qs, many=True).data)


def _friend_profile_quotes_queryset(*, owner, request):
    """
    Owner's published quotes; if the viewer is authenticated, also include any visibility
    quote by that owner that tags the viewer (labels__linked_user), matching feed semantics.
    """
    base = Quote.objects.filter(owner=owner)
    viewer = getattr(request, "user", None)
    if viewer is not None and getattr(viewer, "is_authenticated", False):
        if viewer.id != owner.id and (
            viewer.account_status != SiteUser.AccountStatus.APPROVED
            or not are_friends(user_a=viewer, user_b=owner)
        ):
            return Quote.objects.none()
        qs = base.filter(
            Q(visibility=Quote.Visibility.PUBLISHED) | Q(labels__linked_user=viewer)
        ).distinct()
    else:
        qs = Quote.objects.none()
    return qs


def _user_public_quotes_response(request, *, user):
    qs = _friend_profile_quotes_queryset(owner=user, request=request)
    qs = _quote_list_queryset(qs, request=request).order_by("-created_at")
    return Response(QuoteSerializer(qs, many=True, context={"request": request}).data)


@api_view(["GET"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsAuthenticated])
def user_public_quotes(request, email: str):
    user = get_object_or_404(User.objects.all(), email__iexact=email)
    return _user_public_quotes_response(request, user=user)


@api_view(["GET"])
@authentication_classes([Auth0TokenAuthentication, SessionAuthentication])
@permission_classes([IsAuthenticated])
def user_public_quotes_by_id(request, user_id: int):
    user = get_object_or_404(User.objects.all(), pk=user_id)
    return _user_public_quotes_response(request, user=user)
