from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Person(models.Model):
    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        OTHER = "other", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="people_owned",
    )
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    name = models.CharField(max_length=255)
    image_key = models.CharField(max_length=512, blank=True)
    relation_prefix_tokens = models.JSONField(default=list, blank=True)
    relation_core = models.CharField(max_length=32)
    relation_suffix_tokens = models.JSONField(default=list, blank=True)
    relation_alias = models.CharField(max_length=120, blank=True)
    birthday = models.CharField(max_length=10, null=True, blank=True)
    death_date = models.CharField(max_length=10, null=True, blank=True)
    gender = models.CharField(
        max_length=16,
        choices=Gender.choices,
        null=True,
        blank=True,
    )
    is_self = models.BooleanField(default=False)
    bio_mother = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="children_as_bio_mother",
    )
    bio_father = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="children_as_bio_father",
    )
    step_mother = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="children_as_step_mother",
    )
    step_father = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="children_as_step_father",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["owner_user"],
                condition=models.Q(is_self=True, deleted_at__isnull=True),
                name="people_person_one_active_self_per_owner",
            ),
        ]
        indexes = [
            models.Index(fields=["owner_user", "-updated_at"]),
            models.Index(fields=["owner_user", "deleted_at"]),
        ]

    def __str__(self) -> str:
        return self.name


class FamilyTreeLayout(models.Model):
    """Per-owner manual grid positions for the family tree canvas."""

    owner_user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="family_tree_layout",
    )
    positions = models.JSONField(default=dict, blank=True)
    min_col = models.IntegerField(default=0)
    min_row = models.IntegerField(default=0)
    max_col = models.IntegerField(default=6)
    max_row = models.IntegerField(default=6)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"FamilyTreeLayout(owner={self.owner_user_id})"


class PersonPartnership(models.Model):
    class Status(models.TextChoices):
        CURRENT = "current", "Current"
        FORMER = "former", "Former"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="people_partnerships",
    )
    person_a = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        related_name="partnerships_as_low",
    )
    person_b = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        related_name="partnerships_as_high",
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.CURRENT,
    )
    anniversary_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["owner_user", "status"]),
        ]

    def clean(self) -> None:
        if self.person_a_id and self.person_b_id and str(self.person_a_id) >= str(self.person_b_id):
            raise ValidationError("person_a_id must be strictly less than person_b_id (canonical ordering).")

    def save(self, *args, **kwargs):
        if self.person_a_id and self.person_b_id and str(self.person_a_id) >= str(self.person_b_id):
            self.person_a, self.person_b = self.person_b, self.person_a
        super().save(*args, **kwargs)


class PersonGuardianLink(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="people_guardian_links",
    )
    child = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        related_name="guardian_links",
    )
    guardian = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        related_name="ward_links",
    )
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["child", "guardian"],
                name="people_guardianlink_child_guardian_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["owner_user", "child"]),
        ]
