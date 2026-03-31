from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from quotes.models import Quote, QuoteLabel, QuoteLabelAssignment
from users.models import Profile

User = get_user_model()


def _display_name_for_user(user: User) -> str:
    # Prefer profile display_name when present.
    try:
        return (user.profile.display_name or "").strip() or user.email
    except Profile.DoesNotExist:
        return user.email


class QuoteLabelInputSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(
        choices=[QuoteLabel.Kind.TAG.value, QuoteLabel.Kind.ATTRIBUTION.value]
    )
    # For kind=tag: must be provided by the client.
    name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    # For kind=attribution: optional. If provided and matches a site user, we link to it.
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)

    def validate(self, data):
        kind = data["kind"]
        name = (data.get("name") or "").strip()
        email = (data.get("email") or "").strip().lower() if data.get("email") else ""

        if kind == QuoteLabel.Kind.TAG:
            if not name:
                raise serializers.ValidationError({"name": "Required for tags."})
        else:
            # Attributions can be "plain text" (name only) or linked via email.
            if not name and not email:
                raise serializers.ValidationError(
                    {"name": "Provide `name` or `email` for attribution labels."}
                )

        return data


class QuoteLabelSerializer(serializers.ModelSerializer):
    linked_user_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = QuoteLabel
        fields = ["id", "kind", "name", "linked_user_id"]


class QuoteSerializer(serializers.ModelSerializer):
    owner = serializers.SerializerMethodField()
    labels = QuoteLabelSerializer(many=True, read_only=True)
    relationship_to_viewer = serializers.SerializerMethodField()

    class Meta:
        model = Quote
        fields = [
            "id",
            "owner",
            "body",
            "created_at",
            "date_of_quote",
            "visibility",
            "updated_at",
            "labels",
            "relationship_to_viewer",
        ]

    def get_owner(self, obj: Quote):
        return {
            "id": obj.owner_id,
            "email": obj.owner.email,
            "username": getattr(obj.owner, "username", "") or "",
        }

    def get_relationship_to_viewer(self, obj: Quote) -> str:
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return "public"

        if obj.owner_id == user.id:
            return "owner"

        # labels are prefetched for list endpoints; do not hit the DB here.
        labels = obj.labels.all()
        return "tagged" if any(l.linked_user_id == user.id for l in labels) else "public"


class QuoteCreateSerializer(serializers.Serializer):
    body = serializers.CharField()
    date_of_quote = serializers.DateField(required=False, allow_null=True)
    visibility = serializers.ChoiceField(
        choices=[Quote.Visibility.PRIVATE.value, Quote.Visibility.PUBLIC.value],
        required=False,
    )
    labels = QuoteLabelInputSerializer(many=True, required=False)

    def validate_body(self, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise serializers.ValidationError("`body` cannot be empty.")
        return trimmed

    @transaction.atomic
    def create(self, validated_data):
        request = self.context["request"]
        owner = request.user

        labels_in = validated_data.pop("labels", [])
        quote = Quote.objects.create(
            owner=owner,
            body=validated_data["body"],
            date_of_quote=validated_data.get("date_of_quote"),
            visibility=validated_data.get("visibility", Quote.Visibility.PRIVATE),
        )

        if labels_in:
            self._sync_labels(quote=quote, owner=owner, labels_in=labels_in)

        return quote

    def _sync_labels(self, *, quote: Quote, owner: User, labels_in: list[dict]):
        # Replace semantics: create needed labels + replace join rows.
        desired_label_ids: list[int] = []

        for item in labels_in:
            kind = item["kind"]
            email = (item.get("email") or "").strip().lower() if item.get("email") else ""
            name = (item.get("name") or "").strip()

            linked_user = None
            if email:
                linked_user = User.objects.filter(email__iexact=email).first()

            if not name:
                if linked_user is not None:
                    name = _display_name_for_user(linked_user)
                else:
                    # For unknown emails, preserve input "email" as the label name.
                    name = email

            if kind == QuoteLabel.Kind.ATTRIBUTION.value and linked_user is not None:
                linked_user_fk = linked_user
            else:
                linked_user_fk = None

            label, _ = QuoteLabel.objects.get_or_create(
                owner=owner,
                kind=kind,
                name=name,
                linked_user=linked_user_fk,
            )
            desired_label_ids.append(label.id)

        # Avoid duplicate join-row inserts (unique constraint on quote+label).
        desired_label_ids = list(dict.fromkeys(desired_label_ids))

        QuoteLabelAssignment.objects.filter(quote=quote).delete()
        QuoteLabelAssignment.objects.bulk_create(
            [
                QuoteLabelAssignment(quote=quote, label_id=label_id)
                for label_id in desired_label_ids
            ]
        )


class QuotePatchSerializer(serializers.Serializer):
    # All optional for partial updates.
    body = serializers.CharField(required=False)
    date_of_quote = serializers.DateField(required=False, allow_null=True)
    visibility = serializers.ChoiceField(
        choices=[Quote.Visibility.PRIVATE.value, Quote.Visibility.PUBLIC.value],
        required=False,
    )
    labels = QuoteLabelInputSerializer(many=True, required=False)

    def validate_body(self, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise serializers.ValidationError("`body` cannot be empty.")
        return trimmed

    @transaction.atomic
    def update(self, instance: Quote, validated_data):
        labels_in = validated_data.pop("labels", None)

        if "body" in validated_data:
            instance.body = validated_data["body"]
        if "date_of_quote" in validated_data:
            instance.date_of_quote = validated_data["date_of_quote"]
        if "visibility" in validated_data:
            instance.visibility = validated_data["visibility"]
        instance.save()

        if labels_in is not None:
            owner = instance.owner
            self._sync_labels(quote=instance, owner=owner, labels_in=labels_in)

        return instance

    def _sync_labels(self, *, quote: Quote, owner: User, labels_in: list[dict]):
        desired_label_ids: list[int] = []

        for item in labels_in:
            kind = item["kind"]
            email = (item.get("email") or "").strip().lower() if item.get("email") else ""
            name = (item.get("name") or "").strip()

            linked_user = None
            if email:
                linked_user = User.objects.filter(email__iexact=email).first()

            if not name:
                if linked_user is not None:
                    name = _display_name_for_user(linked_user)
                else:
                    name = email

            if kind == QuoteLabel.Kind.ATTRIBUTION.value and linked_user is not None:
                linked_user_fk = linked_user
            else:
                linked_user_fk = None

            label, _ = QuoteLabel.objects.get_or_create(
                owner=owner,
                kind=kind,
                name=name,
                linked_user=linked_user_fk,
            )
            desired_label_ids.append(label.id)

        desired_label_ids = list(dict.fromkeys(desired_label_ids))

        QuoteLabelAssignment.objects.filter(quote=quote).delete()
        QuoteLabelAssignment.objects.bulk_create(
            [
                QuoteLabelAssignment(quote=quote, label_id=label_id)
                for label_id in desired_label_ids
            ]
        )

