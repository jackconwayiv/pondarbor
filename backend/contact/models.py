from django.conf import settings
from django.db import models


class ContactMessage(models.Model):
    """About/contact form submission stored for staff review (no email)."""

    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="contact_messages",
    )
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"ContactMessage(id={self.pk}, from_user_id={self.from_user_id})"
