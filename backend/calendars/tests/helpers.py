from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from users.models import Profile

User = get_user_model()


class CalendarTestMixin:
    def create_users(self):
        self.alice = self._make_user("alice@example.com", approved=True, display_name="Alice")
        self.bob = self._make_user("bob@example.com", approved=True, display_name="Bob")
        self.pending = self._make_user("pending@example.com", approved=False)

        self.alice_client = APIClient()
        self.alice_client.force_login(self.alice)
        self.bob_client = APIClient()
        self.bob_client.force_login(self.bob)
        self.pending_client = APIClient()
        self.pending_client.force_login(self.pending)
        self.anon_client = APIClient()

    def _make_user(self, email: str, *, approved: bool, display_name: str = ""):
        user = User.objects.create_user(email=email, password="secret12345")
        user.account_status = (
            User.AccountStatus.APPROVED if approved else User.AccountStatus.PENDING
        )
        user.save(update_fields=["account_status"])
        Profile.objects.update_or_create(
            user=user,
            defaults={"display_name": display_name, "avatar_url": ""},
        )
        return user
