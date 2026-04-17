from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from friend_comments.models import FriendComment
from friend_comments.permissions import TARGET_SONGADAY_SONGRESPONSE, resolve_target
from friend_comments.serializers import FriendCommentReadSerializer, FriendCommentWriteSerializer
from songaday.access import can_view_song_response
from songaday.models import SongResponse
from users.permissions import IsApprovedUser

User = get_user_model()


def _parse_target(request):
    target_type = (request.query_params.get("target_type") or "").strip().lower()
    raw_id = request.query_params.get("object_id")
    if not target_type or raw_id is None or raw_id == "":
        return None, Response({"detail": "target_type and object_id query params are required."}, status=400)
    try:
        oid = int(raw_id)
    except (TypeError, ValueError):
        return None, Response({"detail": "object_id must be an integer."}, status=400)
    obj = resolve_target(target_type=target_type, object_id=oid)
    if obj is None:
        return None, Response({"detail": "Unknown target_type."}, status=400)
    return (target_type, oid, obj), None


@api_view(["GET", "POST"])
@permission_classes([IsApprovedUser])
def comments_collection(request):
    parsed, err = _parse_target(request)
    if err:
        return err
    target_type, _oid, obj = parsed
    viewer = request.user

    if target_type != TARGET_SONGADAY_SONGRESPONSE or not isinstance(obj, SongResponse):
        return Response({"detail": "Not found."}, status=404)
    if not can_view_song_response(viewer=viewer, response=obj):
        return Response({"detail": "Not found."}, status=404)

    ct = ContentType.objects.get_for_model(SongResponse)
    if request.method == "GET":
        qs = (
            FriendComment.objects.filter(content_type=ct, object_id=obj.pk)
            .select_related("author", "author__profile")
            .order_by("created_at", "id")
        )
        return Response(FriendCommentReadSerializer(qs, many=True).data)

    ser = FriendCommentWriteSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    raw_body = ser.validated_data.get("body")
    if raw_body is None:
        return Response({"detail": "body is required."}, status=400)
    body = raw_body.strip()
    if not body:
        return Response({"detail": "body must not be empty."}, status=400)

    row = FriendComment.objects.create(
        content_type=ct,
        object_id=obj.pk,
        author=viewer,
        body=body,
    )
    row = FriendComment.objects.select_related("author", "author__profile").get(pk=row.pk)
    return Response(FriendCommentReadSerializer(row).data, status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsApprovedUser])
def comment_detail(request, comment_id: int):
    row = get_object_or_404(
        FriendComment.objects.select_related("author", "author__profile"),
        pk=comment_id,
    )
    obj = row.content_object
    if not isinstance(obj, SongResponse):
        return Response({"detail": "Not found."}, status=404)
    if not can_view_song_response(viewer=request.user, response=obj):
        return Response({"detail": "Not found."}, status=404)

    if request.method == "DELETE":
        if row.author_id != request.user.id:
            return Response({"detail": "Forbidden."}, status=403)
        row.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if row.author_id != request.user.id:
        return Response({"detail": "Forbidden."}, status=403)
    ser = FriendCommentWriteSerializer(data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    body = ser.validated_data.get("body")
    if body is None:
        return Response({"detail": "body is required."}, status=400)
    body = body.strip()
    if not body:
        return Response({"detail": "body must not be empty."}, status=400)
    if body != row.body:
        row.body = body
        row.edited = True
        row.save(update_fields=["body", "edited", "updated_at"])
    row = FriendComment.objects.select_related("author", "author__profile").get(pk=row.pk)
    return Response(FriendCommentReadSerializer(row).data)
