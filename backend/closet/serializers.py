import re

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from closet.constants import CANONICAL_CLOSET_CATEGORY_SET
from closet.models import BorrowRequest, Item, Loan
from friends.services import are_friends

_CLOSET_CATEGORY_CUSTOM_RE = re.compile(r"^[A-Za-z/]+$")


def _validate_closet_category(value) -> str:
    if value is None:
        return ""
    trimmed = str(value).strip()
    if not trimmed:
        return ""
    if trimmed in CANONICAL_CLOSET_CATEGORY_SET:
        return trimmed
    if _CLOSET_CATEGORY_CUSTOM_RE.fullmatch(trimmed):
        return trimmed
    raise serializers.ValidationError(
        "Category must be a suggested option or only letters and / with no spaces."
    )

User = get_user_model()


def closet_item_image_url(image_key: str) -> str:
    base = getattr(settings, "CLOSET_R2_PUBLIC_BASE_URL", "") or ""
    key = (image_key or "").strip()
    if not base or not key:
        return ""
    return f"{base.rstrip('/')}/{key.lstrip('/')}"


def expected_closet_image_key_prefix(user_id: int) -> str:
    prefix = getattr(settings, "CLOSET_R2_KEY_PREFIX", "closet") or "closet"
    prefix = str(prefix).strip().strip("/") or "closet"
    return f"{prefix}/{user_id}/"


def _validate_closet_image_key_for_user(value, request) -> str:
    raw = "" if value is None else str(value).strip()
    if not raw:
        return ""
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        raise serializers.ValidationError("Authentication required.")
    expected = expected_closet_image_key_prefix(user.id)
    if not raw.startswith(expected):
        raise serializers.ValidationError(
            "Image key must come from a closet upload for your account.",
        )
    return raw


def _user_summary(user):
    profile = getattr(user, "profile", None)
    return {
        "id": user.id,
        "email": user.email,
        "display_name": (getattr(profile, "display_name", "") or "").strip(),
        "avatar_url": getattr(profile, "avatar_url", "") or "",
    }


class ItemSerializer(serializers.ModelSerializer):
    owner_user = serializers.SerializerMethodField()
    current_holder_user = serializers.SerializerMethodField()
    pending_request_count = serializers.SerializerMethodField()
    my_pending_request = serializers.SerializerMethodField()
    my_declined_request = serializers.SerializerMethodField()
    active_loan_id = serializers.SerializerMethodField()
    active_loan_marked_returned_by_borrower = serializers.SerializerMethodField()
    custody_marked_returned_by_holder = serializers.SerializerMethodField()
    pending_custody_user = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = [
            "id",
            "owner_user",
            "current_holder_user",
            "pending_custody_user",
            "name",
            "description",
            "category",
            "tags",
            "image_key",
            "image_url",
            "custody_disputed",
            "pending_request_count",
            "my_pending_request",
            "my_declined_request",
            "active_loan_id",
            "active_loan_marked_returned_by_borrower",
            "custody_marked_returned_by_holder",
            "created_at",
            "updated_at",
        ]

    def get_owner_user(self, obj: Item):
        return _user_summary(obj.owner_user)

    def get_current_holder_user(self, obj: Item):
        return _user_summary(obj.current_holder_user)

    def get_pending_custody_user(self, obj: Item):
        u = obj.custody_pending_acceptance_user
        return _user_summary(u) if u else None

    def get_image_url(self, obj: Item) -> str:
        return closet_item_image_url(obj.image_key)

    def get_pending_request_count(self, obj: Item) -> int:
        return obj.borrow_requests.filter(
            status=BorrowRequest.Status.PENDING,
            deleted_at__isnull=True,
        ).count()

    def get_my_pending_request(self, obj: Item):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return None
        row = (
            obj.borrow_requests.filter(
                requester_user=user,
                status=BorrowRequest.Status.PENDING,
                deleted_at__isnull=True,
            )
            .order_by("date_needed_by", "-created_at")
            .first()
        )
        if not row:
            return None
        return BorrowRequestSerializer(row).data

    def get_my_declined_request(self, obj: Item):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return None
        row = (
            obj.borrow_requests.filter(
                requester_user=user,
                status=BorrowRequest.Status.DECLINED,
                deleted_at__isnull=True,
            )
            .order_by("-responded_at", "-updated_at", "-created_at")
            .first()
        )
        if not row:
            return None
        return BorrowRequestSerializer(row).data

    def get_active_loan_id(self, obj: Item):
        row = (
            obj.loans.filter(status=Loan.Status.ACTIVE, deleted_at__isnull=True).only("id").first()
        )
        return row.id if row else None

    def get_active_loan_marked_returned_by_borrower(self, obj: Item):
        row = (
            obj.loans.filter(status=Loan.Status.ACTIVE, deleted_at__isnull=True)
            .only("marked_returned_by_borrower_at")
            .first()
        )
        return bool(row and row.marked_returned_by_borrower_at)

    def get_custody_marked_returned_by_holder(self, obj: Item) -> bool:
        if obj.loans.filter(status=Loan.Status.ACTIVE, deleted_at__isnull=True).exists():
            return False
        return bool(
            obj.custody_marked_returned_by_holder_at
            and obj.current_holder_user_id != obj.owner_user_id
        )


class ItemCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    category = serializers.CharField(required=False, allow_blank=True, max_length=120)
    tags = serializers.ListField(
        child=serializers.CharField(max_length=64),
        required=False,
        allow_empty=True,
    )
    image_key = serializers.CharField(required=False, allow_blank=True, max_length=512)

    def validate_name(self, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise serializers.ValidationError("Name is required.")
        return trimmed

    def validate_tags(self, value):
        return [str(tag).strip() for tag in value if str(tag).strip()]

    def validate_category(self, value):
        return _validate_closet_category(value)

    def validate_image_key(self, value):
        return _validate_closet_image_key_for_user(value, self.context["request"])

    def create(self, validated_data):
        user = self.context["request"].user
        return Item.objects.create(
            owner_user=user,
            current_holder_user=user,
            custody_disputed=False,
            **validated_data,
        )


class ItemPatchSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    category = serializers.CharField(required=False, allow_blank=True, max_length=120)
    tags = serializers.ListField(
        child=serializers.CharField(max_length=64),
        required=False,
        allow_empty=True,
    )
    image_key = serializers.CharField(required=False, allow_blank=True, max_length=512)

    def validate_name(self, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise serializers.ValidationError("Name cannot be empty.")
        return trimmed

    def validate_tags(self, value):
        return [str(tag).strip() for tag in value if str(tag).strip()]

    def validate_category(self, value):
        return _validate_closet_category(value)

    def validate_image_key(self, value):
        return _validate_closet_image_key_for_user(value, self.context["request"])

    def update(self, instance: Item, validated_data):
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        return instance


class BorrowRequestSerializer(serializers.ModelSerializer):
    requester_user = serializers.SerializerMethodField()

    class Meta:
        model = BorrowRequest
        fields = [
            "id",
            "item_id",
            "requester_user",
            "status",
            "date_needed_by",
            "message",
            "decline_message",
            "created_at",
            "updated_at",
            "responded_at",
        ]

    def get_requester_user(self, obj: BorrowRequest):
        return _user_summary(obj.requester_user)


class BorrowRequestCreateSerializer(serializers.Serializer):
    date_needed_by = serializers.DateField()
    message = serializers.CharField(required=False, allow_blank=True)

    def validate_date_needed_by(self, value):
        if value < timezone.localdate():
            raise serializers.ValidationError("Need-by date cannot be in the past.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        request = self.context["request"]
        item: Item = self.context["item"]
        user = request.user
        if item.owner_user_id == user.id:
            raise serializers.ValidationError("Owners cannot borrow their own items.")
        if item.current_holder_user_id == user.id:
            raise serializers.ValidationError("You are already borrowing this item.")
        if not are_friends(user_a=user, user_b=item.owner_user):
            raise serializers.ValidationError("You can only request items from friends.")
        existing = (
            BorrowRequest.objects.filter(
                item=item,
                requester_user=user,
                status=BorrowRequest.Status.PENDING,
                deleted_at__isnull=True,
            )
            .order_by("date_needed_by", "-created_at")
            .first()
        )
        if existing:
            existing.date_needed_by = validated_data["date_needed_by"]
            existing.message = validated_data.get("message", "")
            existing.save(update_fields=["date_needed_by", "message", "updated_at"])
            return existing
        return BorrowRequest.objects.create(
            item=item,
            requester_user=user,
            status=BorrowRequest.Status.PENDING,
            date_needed_by=validated_data["date_needed_by"],
            message=validated_data.get("message", ""),
        )


class LoanSerializer(serializers.ModelSerializer):
    owner_user = serializers.SerializerMethodField()
    borrower_user = serializers.SerializerMethodField()

    class Meta:
        model = Loan
        fields = [
            "id",
            "item_id",
            "owner_user",
            "borrower_user",
            "status",
            "checkout_at",
            "returned_at",
            "marked_returned_by_borrower_at",
            "marked_returned_by_owner_at",
        ]

    def get_owner_user(self, obj: Loan):
        return _user_summary(obj.owner_user)

    def get_borrower_user(self, obj: Loan):
        return _user_summary(obj.borrower_user)

