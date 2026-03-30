from django.contrib.auth import get_user_model
from rest_framework import serializers


UserModel = get_user_model()


class SessionUserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField(allow_blank=True)
    username = serializers.CharField(allow_blank=True)
    first_name = serializers.CharField(allow_blank=True)
    last_name = serializers.CharField(allow_blank=True)
    is_authenticated = serializers.BooleanField()
    is_approved = serializers.BooleanField()
    auth0_sub = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    account_status = serializers.CharField()


class ProfileSerializer(serializers.Serializer):
    display_name = serializers.CharField(allow_blank=True)
    avatar_url = serializers.CharField(allow_blank=True)
    timezone = serializers.CharField(allow_blank=True)


class MeSerializer(serializers.Serializer):
    user = SessionUserSerializer()
    profile = ProfileSerializer()


class ProfileUpdateSerializer(serializers.Serializer):
    display_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    avatar_url = serializers.URLField(
        required=False, allow_blank=True, max_length=2048
    )
    timezone = serializers.CharField(required=False, allow_blank=True, max_length=64)


class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    display_name = serializers.CharField(required=False, allow_blank=True)
    timezone = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, value):
        email = UserModel.objects.normalize_email(value).lower()
        if UserModel.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
