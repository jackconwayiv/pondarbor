from django.conf import settings
from django.db import models


class Quote(models.Model):
    class Visibility(models.TextChoices):
        PRIVATE = "private", "Private"
        PUBLISHED = "published", "Published"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="quotes",
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    date_of_quote = models.DateField(null=True, blank=True)
    visibility = models.CharField(
        max_length=20,
        choices=Visibility.choices,
        default=Visibility.PRIVATE,
    )
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Many-to-many labels/attributions; assignment through table allows future metadata.
    labels = models.ManyToManyField(
        "QuoteLabel",
        through="QuoteLabelAssignment",
        related_name="quotes",
    )

    def __str__(self) -> str:
        return (self.body[:50] + "…") if len(self.body) > 50 else self.body


class QuoteLabel(models.Model):
    class Kind(models.TextChoices):
        TAG = "tag", "Tag"
        ATTRIBUTION = "attribution", "Attribution"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="quote_labels",
    )
    kind = models.CharField(max_length=30, choices=Kind.choices)
    # Display text used by the owner (e.g., "Mary Oliver", "grief").
    name = models.CharField(max_length=255)
    # Only meaningful for kind=attribution; set when email resolves to a site user.
    linked_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="quotes_tagged_in",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "kind", "name", "linked_user"],
                name="uniq_quote_label_owner_kind_name_linked",
            )
        ]

    def __str__(self) -> str:
        suffix = f" (linked:{self.linked_user_id})" if self.linked_user_id else ""
        return f"{self.kind}:{self.name}{suffix}"


class QuoteLabelAssignment(models.Model):
    quote = models.ForeignKey(
        Quote,
        on_delete=models.CASCADE,
        related_name="label_assignments",
    )
    label = models.ForeignKey(
        QuoteLabel,
        on_delete=models.CASCADE,
        related_name="quote_assignments",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["quote", "label"],
                name="uniq_quote_label_assignment",
            )
        ]

