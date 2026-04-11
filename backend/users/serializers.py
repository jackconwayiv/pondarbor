from django.contrib.auth import get_user_model
from rest_framework import serializers
from closet.serializers import closet_image_key_owned_by_user, closet_item_image_url


UserModel = get_user_model()

# Meal Maestro: must match frontend `MEAL_SLOT_NAME_OPTIONS` in `frontend/src/meal/mealSlotLabels.ts`.
ALLOWED_MEAL_SLOT_NAMES = frozenset(
    {
        "Breakfast",
        "Lunch",
        "Dinner",
        "Brunch",
        "Snack",
        "Supper",
        "Second breakfast",
        "Happy hour",
    }
)
MEAL_SLOT_LABEL_COUNT_KEYS = frozenset({"1", "2", "3", "4", "5"})


def validate_meal_slot_labels_payload(value):
    """Returns normalized dict or None. Raises ValidationError."""
    if value is None:
        return None
    if not isinstance(value, dict):
        raise serializers.ValidationError("meal_slot_labels must be an object or null.")
    for key, labels in value.items():
        if key not in MEAL_SLOT_LABEL_COUNT_KEYS:
            raise serializers.ValidationError(
                f"Invalid meal_slot_labels key {key!r}; use 1–5 as strings."
            )
        n = int(key)
        if not isinstance(labels, list):
            raise serializers.ValidationError(f"meal_slot_labels[{key}] must be a list.")
        if len(labels) != n:
            raise serializers.ValidationError(
                f"meal_slot_labels[{key}] must have length {n}, got {len(labels)}."
            )
        for item in labels:
            if not isinstance(item, str) or item not in ALLOWED_MEAL_SLOT_NAMES:
                raise serializers.ValidationError(
                    "Each meal slot label must be one of the allowed preset names."
                )
    return value


class SessionUserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField(allow_blank=True)
    username = serializers.CharField(allow_blank=True)
    first_name = serializers.CharField(allow_blank=True)
    last_name = serializers.CharField(allow_blank=True)
    is_authenticated = serializers.BooleanField()
    is_approved = serializers.BooleanField()
    is_staff = serializers.BooleanField()
    auth0_sub = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    account_status = serializers.CharField()
    deleted_at = serializers.DateTimeField(allow_null=True, required=False)
    date_joined = serializers.CharField(allow_blank=True, allow_null=True, required=False)


class ProfileSerializer(serializers.Serializer):
    display_name = serializers.CharField(allow_blank=True)
    avatar_url = serializers.CharField(allow_blank=True)
    timezone = serializers.CharField(allow_blank=True)
    birth_date = serializers.DateField(allow_null=True)
    whatif_completed_session = serializers.BooleanField()
    meal_week_starts_on = serializers.IntegerField()
    meal_crud_partner_id = serializers.IntegerField(allow_null=True, required=False)
    meal_crud_partner_label = serializers.CharField(allow_blank=True, required=False)
    meal_pair_mutual = serializers.BooleanField()
    meal_partner_incoming_pending = serializers.BooleanField()
    meal_slot_labels = serializers.JSONField(allow_null=True, required=False)
    meal_pantry_enabled = serializers.BooleanField()


class AchievementSummarySerializer(serializers.Serializer):
    slug = serializers.SlugField()
    title = serializers.CharField()
    description = serializers.CharField()
    category = serializers.CharField(allow_blank=True)
    unlocked_at = serializers.DateTimeField()
    display_group = serializers.CharField(allow_blank=True)
    display_group_order = serializers.IntegerField()
    visible_to_friends = serializers.BooleanField(allow_null=True, required=False)


class AchievementVisibilityPatchSerializer(serializers.Serializer):
    """True or null -> show to friends (stored as null); false -> hidden from friends."""

    visible_to_friends = serializers.BooleanField(allow_null=True, required=True)


class MeSerializer(serializers.Serializer):
    user = SessionUserSerializer()
    profile = ProfileSerializer()
    achievements = AchievementSummarySerializer(many=True)


class ProfileUpdateSerializer(serializers.Serializer):
    display_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    avatar_url = serializers.URLField(
        required=False, allow_blank=True, max_length=2048
    )
    timezone = serializers.CharField(required=False, allow_blank=True, max_length=64)
    birth_date = serializers.DateField(required=False, allow_null=True)
    meal_week_starts_on = serializers.IntegerField(
        required=False, min_value=0, max_value=6
    )
    meal_crud_partner_id = serializers.IntegerField(allow_null=True, required=False)
    meal_slot_labels = serializers.JSONField(required=False, allow_null=True)
    meal_pantry_enabled = serializers.BooleanField(required=False)
    avatar_image_key = serializers.CharField(
        required=False, allow_blank=True, max_length=1024, write_only=True
    )

    def validate_meal_slot_labels(self, value):
        return validate_meal_slot_labels_payload(value)

    def validate_avatar_image_key(self, value: str) -> str:
        key = value.strip()
        if not key:
            return ""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user:
            raise serializers.ValidationError("Could not validate avatar image key.")
        if not closet_image_key_owned_by_user(key, user.id):
            raise serializers.ValidationError("Avatar image key must belong to your account prefix.")
        return key

    def validate(self, attrs):
        key = attrs.pop("avatar_image_key", None)
        if key is not None:
            attrs["avatar_url"] = closet_item_image_url(key) if key else ""
        return attrs


class UpcomingBirthdaySerializer(serializers.Serializer):
    display_name = serializers.CharField()
    birth_month = serializers.IntegerField(min_value=1, max_value=12)
    birth_day = serializers.IntegerField(min_value=1, max_value=31)


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


class StaffAccountStatusPatchSerializer(serializers.Serializer):
    account_status = serializers.ChoiceField(choices=UserModel.AccountStatus.choices)
