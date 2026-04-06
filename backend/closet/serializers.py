from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from friends.services import are_friends
from closet.models import BorrowRequest, Item, Loan

User = get_user_model()


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

    def get_pending_request_count(self, obj: Item) -> int:
        return obj.borrow_requests.filter(status=BorrowRequest.Status.PENDING).count()

    def get_my_pending_request(self, obj: Item):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return None
        row = (
            obj.borrow_requests.filter(
                requester_user=user,
                status=BorrowRequest.Status.PENDING,
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
            )
            .order_by("-responded_at", "-updated_at", "-created_at")
            .first()
        )
        if not row:
            return None
        return BorrowRequestSerializer(row).data

    def get_active_loan_id(self, obj: Item):
        row = obj.loans.filter(status=Loan.Status.ACTIVE).only("id").first()
        return row.id if row else None

    def get_active_loan_marked_returned_by_borrower(self, obj: Item):
        row = (
            obj.loans.filter(status=Loan.Status.ACTIVE)
            .only("marked_returned_by_borrower_at")
            .first()
        )
        return bool(row and row.marked_returned_by_borrower_at)

    def get_custody_marked_returned_by_holder(self, obj: Item) -> bool:
        if obj.loans.filter(status=Loan.Status.ACTIVE).exists():
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
        borrow_request, _ = BorrowRequest.objects.update_or_create(
            item=item,
            requester_user=user,
            status=BorrowRequest.Status.PENDING,
            defaults={
                "date_needed_by": validated_data["date_needed_by"],
                "message": validated_data.get("message", ""),
            },
        )
        return borrow_request


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

