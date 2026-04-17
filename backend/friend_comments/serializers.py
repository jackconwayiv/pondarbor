from django.contrib.auth import get_user_model
from rest_framework import serializers

from friend_comments.models import FriendComment
from songaday.serializers import user_row_for_songaday

User = get_user_model()


class FriendCommentReadSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()

    class Meta:
        model = FriendComment
        fields = ["id", "author", "body", "edited", "created_at", "updated_at"]

    def get_author(self, obj: FriendComment) -> dict:
        return user_row_for_songaday(obj.author)


class FriendCommentWriteSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=10000, allow_blank=False, required=False)
