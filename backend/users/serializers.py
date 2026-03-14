from django.contrib.auth.models import User
from rest_framework import serializers


class SessionUserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField(allow_blank=True)
    username = serializers.CharField()
    first_name = serializers.CharField(allow_blank=True)
    last_name = serializers.CharField(allow_blank=True)
    is_authenticated = serializers.BooleanField()
    is_approved = serializers.BooleanField()


class ProfileSerializer(serializers.Serializer):
    auth0_sub = serializers.CharField(allow_blank=True, allow_null=True)
    display_name = serializers.CharField(allow_blank=True)
    avatar_url = serializers.CharField(allow_blank=True)
    timezone = serializers.CharField(allow_blank=True)
    status = serializers.CharField(allow_blank=True)


class MeSerializer(serializers.Serializer):
    user = SessionUserSerializer()
    profile = ProfileSerializer()


class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    display_name = serializers.CharField(required=False, allow_blank=True)
    timezone = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
