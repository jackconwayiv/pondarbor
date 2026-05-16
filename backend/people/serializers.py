from __future__ import annotations

from typing import Any

from django.db.models import Prefetch
from rest_framework import serializers

from closet.serializers import _validate_closet_image_key_for_user, closet_item_image_url
from people.models import Person, PersonGuardianLink, PersonPartnership
from people.relation_vocab import (
    RELATION_CORE_VALUES,
    validate_prefix_tokens,
    validate_suffix_tokens,
)
from people.services import partnership_initial_status


def _person_queryset_for_owner(owner_id: int):
    return (
        Person.objects.filter(owner_user_id=owner_id, deleted_at__isnull=True)
        .select_related("bio_mother", "bio_father", "step_mother", "step_father")
        .prefetch_related(
            Prefetch(
                "partnerships_as_low",
                queryset=PersonPartnership.objects.select_related("person_b"),
            ),
            Prefetch(
                "partnerships_as_high",
                queryset=PersonPartnership.objects.select_related("person_a"),
            ),
            Prefetch(
                "guardian_links",
                queryset=PersonGuardianLink.objects.select_related("guardian"),
            ),
        )
    )


def person_image_url(obj: Person) -> str:
    return closet_item_image_url(obj.image_key or "")


class PersonSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    bio_mother_id = serializers.SerializerMethodField()
    bio_father_id = serializers.SerializerMethodField()
    step_mother_id = serializers.SerializerMethodField()
    step_father_id = serializers.SerializerMethodField()
    partnerships = serializers.SerializerMethodField()
    guardian_links = serializers.SerializerMethodField()

    class Meta:
        model = Person
        fields = [
            "id",
            "name",
            "image_key",
            "image_url",
            "relation_prefix_tokens",
            "relation_core",
            "relation_suffix_tokens",
            "relation_alias",
            "birthday",
            "death_date",
            "gender",
            "is_self",
            "bio_mother_id",
            "bio_father_id",
            "step_mother_id",
            "step_father_id",
            "partnerships",
            "guardian_links",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "is_self", "created_at", "updated_at", "image_url", "partnerships", "guardian_links"]

    def get_bio_mother_id(self, obj: Person) -> str | None:
        return str(obj.bio_mother_id) if obj.bio_mother_id else None

    def get_bio_father_id(self, obj: Person) -> str | None:
        return str(obj.bio_father_id) if obj.bio_father_id else None

    def get_step_mother_id(self, obj: Person) -> str | None:
        return str(obj.step_mother_id) if obj.step_mother_id else None

    def get_step_father_id(self, obj: Person) -> str | None:
        return str(obj.step_father_id) if obj.step_father_id else None

    def get_image_url(self, obj: Person) -> str:
        return person_image_url(obj)

    def get_partnerships(self, obj: Person) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for row in obj.partnerships_as_low.all():
            out.append(
                {
                    "id": str(row.id),
                    "other_person_id": str(row.person_b_id),
                    "status": row.status,
                    "anniversary_date": row.anniversary_date,
                }
            )
        for row in obj.partnerships_as_high.all():
            out.append(
                {
                    "id": str(row.id),
                    "other_person_id": str(row.person_a_id),
                    "status": row.status,
                    "anniversary_date": row.anniversary_date,
                }
            )
        return out

    def get_guardian_links(self, obj: Person) -> list[dict[str, Any]]:
        return [
            {
                "id": str(link.id),
                "guardian_id": str(link.guardian_id),
                "note": link.note,
            }
            for link in obj.guardian_links.all()
        ]


class PersonCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    image_key = serializers.CharField(required=False, allow_blank=True, max_length=512)
    relation_prefix_tokens = serializers.ListField(child=serializers.CharField(), required=False)
    relation_suffix_tokens = serializers.ListField(child=serializers.CharField(), required=False)
    relation_core = serializers.CharField(max_length=32)
    relation_alias = serializers.CharField(required=False, allow_blank=True, max_length=120)
    birthday = serializers.DateField(required=False, allow_null=True)
    death_date = serializers.DateField(required=False, allow_null=True)
    gender = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=16)
    bio_mother_id = serializers.UUIDField(required=False, allow_null=True)
    bio_father_id = serializers.UUIDField(required=False, allow_null=True)
    step_mother_id = serializers.UUIDField(required=False, allow_null=True)
    step_father_id = serializers.UUIDField(required=False, allow_null=True)

    def validate_name(self, value: str) -> str:
        t = value.strip()
        if not t:
            raise serializers.ValidationError("Name is required.")
        return t

    def validate_relation_core(self, value: str) -> str:
        v = value.strip().lower()
        if v not in RELATION_CORE_VALUES:
            raise serializers.ValidationError("Invalid relation_core.")
        if v == "self":
            raise serializers.ValidationError("Cannot create additional self person.")
        return v

    def validate_gender(self, value: str | None) -> str:
        if value is None or not str(value).strip():
            return ""
        v = str(value).strip().lower()
        if v not in {x[0] for x in Person.Gender.choices}:
            raise serializers.ValidationError("Invalid gender.")
        return v

    def validate(self, attrs):
        request = self.context["request"]
        core = attrs["relation_core"]
        try:
            attrs["relation_prefix_tokens"] = validate_prefix_tokens(attrs.get("relation_prefix_tokens"))
            attrs["relation_suffix_tokens"] = validate_suffix_tokens(
                attrs.get("relation_suffix_tokens"),
                relation_core=core,
            )
        except ValueError as e:
            raise serializers.ValidationError(str(e)) from e
        attrs["image_key"] = _validate_closet_image_key_for_user(attrs.get("image_key") or "", request)
        uid = request.user.id
        for fk in ("bio_mother_id", "bio_father_id", "step_mother_id", "step_father_id"):
            pid = attrs.get(fk)
            if pid is None:
                continue
            if not Person.objects.filter(
                id=pid,
                owner_user_id=uid,
                deleted_at__isnull=True,
            ).exists():
                raise serializers.ValidationError({fk: "Person not found."})
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        alias = (validated_data.pop("relation_alias", "") or "").strip()[:120]
        gender = validated_data.pop("gender", "") or ""
        gval = gender if gender else None
        return Person.objects.create(
            owner_user=user,
            relation_alias=alias,
            gender=gval,
            **validated_data,
        )


class PersonPatchSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=False)
    image_key = serializers.CharField(required=False, allow_blank=True, max_length=512)
    relation_prefix_tokens = serializers.ListField(child=serializers.CharField(), required=False)
    relation_suffix_tokens = serializers.ListField(child=serializers.CharField(), required=False)
    relation_core = serializers.CharField(max_length=32, required=False)
    relation_alias = serializers.CharField(required=False, allow_blank=True, max_length=120)
    birthday = serializers.DateField(required=False, allow_null=True)
    death_date = serializers.DateField(required=False, allow_null=True)
    gender = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=16)
    bio_mother_id = serializers.UUIDField(required=False, allow_null=True)
    bio_father_id = serializers.UUIDField(required=False, allow_null=True)
    step_mother_id = serializers.UUIDField(required=False, allow_null=True)
    step_father_id = serializers.UUIDField(required=False, allow_null=True)

    def validate_name(self, value: str) -> str:
        t = value.strip()
        if not t:
            raise serializers.ValidationError("Name is required.")
        return t

    def validate_relation_core(self, value: str) -> str:
        v = value.strip().lower()
        if v not in RELATION_CORE_VALUES:
            raise serializers.ValidationError("Invalid relation_core.")
        return v

    def validate_gender(self, value: str | None) -> str:
        if value is None or not str(value).strip():
            return ""
        v = str(value).strip().lower()
        if v not in {x[0] for x in Person.Gender.choices}:
            raise serializers.ValidationError("Invalid gender.")
        return v

    def validate(self, attrs):
        request = self.context["request"]
        instance: Person = self.context["person"]
        core = attrs.get("relation_core", instance.relation_core)
        if "relation_prefix_tokens" in attrs or "relation_suffix_tokens" in attrs or "relation_core" in attrs:
            try:
                if "relation_prefix_tokens" in attrs:
                    attrs["relation_prefix_tokens"] = validate_prefix_tokens(attrs.get("relation_prefix_tokens"))
                if "relation_suffix_tokens" in attrs:
                    attrs["relation_suffix_tokens"] = validate_suffix_tokens(
                        attrs.get("relation_suffix_tokens"),
                        relation_core=core,
                    )
            except ValueError as e:
                raise serializers.ValidationError(str(e)) from e
        if "image_key" in attrs:
            attrs["image_key"] = _validate_closet_image_key_for_user(attrs.get("image_key") or "", request)
        uid = request.user.id
        for fk in ("bio_mother_id", "bio_father_id", "step_mother_id", "step_father_id"):
            if fk not in attrs:
                continue
            pid = attrs.get(fk)
            if pid is None:
                continue
            if not Person.objects.filter(id=pid, owner_user_id=uid, deleted_at__isnull=True).exists():
                raise serializers.ValidationError({fk: "Person not found."})
        return attrs

    def update(self, instance: Person, validated_data):
        if instance.is_self and "relation_core" in validated_data:
            if validated_data["relation_core"] != "self":
                raise serializers.ValidationError(
                    {"relation_core": "Cannot change self relation_core."}
                )
            validated_data.pop("relation_core", None)
        gender = validated_data.pop("gender", serializers.empty)
        if gender is not serializers.empty:
            instance.gender = gender if gender else None
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        return instance


class PartnershipCreateSerializer(serializers.Serializer):
    person_one_id = serializers.UUIDField()
    person_two_id = serializers.UUIDField()
    status = serializers.ChoiceField(choices=PersonPartnership.Status.choices, required=False)
    anniversary_date = serializers.DateField(required=False, allow_null=True)

    def validate(self, attrs):
        request = self.context["request"]
        uid = request.user.id
        a = attrs["person_one_id"]
        b = attrs["person_two_id"]
        if a == b:
            raise serializers.ValidationError("Partners must be two different people.")
        if not Person.objects.filter(id=a, owner_user_id=uid, deleted_at__isnull=True).exists():
            raise serializers.ValidationError({"person_one_id": "Not found."})
        if not Person.objects.filter(id=b, owner_user_id=uid, deleted_at__isnull=True).exists():
            raise serializers.ValidationError({"person_two_id": "Not found."})
        low, high = (a, b) if str(a) < str(b) else (b, a)
        attrs["_low"], attrs["_high"] = low, high
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        uid = request.user.id
        low = validated_data["_low"]
        high = validated_data["_high"]
        status = validated_data.get("status")
        if status is None:
            status = partnership_initial_status(owner_user_id=uid, person_a_id=low, person_b_id=high)
        return PersonPartnership.objects.create(
            owner_user_id=uid,
            person_a_id=low,
            person_b_id=high,
            status=status,
            anniversary_date=validated_data.get("anniversary_date"),
        )


class GuardianLinkSerializer(serializers.Serializer):
    guardian_id = serializers.UUIDField()
    note = serializers.CharField(required=False, allow_blank=True, max_length=255)

    def validate_guardian_id(self, value):
        request = self.context["request"]
        child: Person = self.context["child"]
        uid = request.user.id
        if value == child.id:
            raise serializers.ValidationError("Guardian cannot be the same as child.")
        if not Person.objects.filter(id=value, owner_user_id=uid, deleted_at__isnull=True).exists():
            raise serializers.ValidationError("Guardian not found.")
        return value

    def create(self, validated_data):
        request = self.context["request"]
        child: Person = self.context["child"]
        g, _ = PersonGuardianLink.objects.get_or_create(
            owner_user=request.user,
            child=child,
            guardian_id=validated_data["guardian_id"],
            defaults={"note": (validated_data.get("note") or "").strip()[:255]},
        )
        return g


def graph_bundle_for_owner(*, owner_id: int) -> dict[str, Any]:
    people = list(_person_queryset_for_owner(owner_id))
    ser = PersonSerializer(people, many=True)
    pships = (
        PersonPartnership.objects.filter(owner_user_id=owner_id)
        .select_related("person_a", "person_b")
        .order_by("-updated_at")
    )
    partnership_rows = [
        {
            "id": str(p.id),
            "person_a_id": str(p.person_a_id),
            "person_b_id": str(p.person_b_id),
            "status": p.status,
            "anniversary_date": p.anniversary_date,
        }
        for p in pships
    ]
    glinks = (
        PersonGuardianLink.objects.filter(owner_user_id=owner_id)
        .select_related("child", "guardian")
        .order_by("created_at")
    )
    guardian_rows = [
        {
            "id": str(g.id),
            "child_id": str(g.child_id),
            "guardian_id": str(g.guardian_id),
            "note": g.note,
        }
        for g in glinks
    ]
    return {
        "count": len(people),
        "people": ser.data,
        "partnerships": partnership_rows,
        "guardian_links": guardian_rows,
    }
