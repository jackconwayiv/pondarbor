from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework.test import APIClient

from closet.models import BorrowRequest, Item, Loan
from friends.models import FriendRequest

User = get_user_model()


class ClosetTestMixin:
    def create_users(self):
        self.owner = User.objects.create_user(email="owner@example.com", password="secret12345")
        self.borrower = User.objects.create_user(email="borrower@example.com", password="secret12345")
        self.friend_two = User.objects.create_user(email="friendtwo@example.com", password="secret12345")
        self.other = User.objects.create_user(email="other@example.com", password="secret12345")
        for user in (self.owner, self.borrower, self.friend_two, self.other):
            user.account_status = User.AccountStatus.APPROVED
            user.save(update_fields=["account_status"])

        self.owner_client = APIClient()
        self.owner_client.force_login(self.owner)
        self.borrower_client = APIClient()
        self.borrower_client.force_login(self.borrower)
        self.friend_two_client = APIClient()
        self.friend_two_client.force_login(self.friend_two)
        self.other_client = APIClient()
        self.other_client.force_login(self.other)
        self.anon_client = APIClient()

    def make_friends(self, user_a, user_b):
        FriendRequest.objects.update_or_create(
            requester=user_a,
            requested=user_b,
            defaults={"is_accepted": True},
        )
        FriendRequest.objects.update_or_create(
            requester=user_b,
            requested=user_a,
            defaults={"is_accepted": True},
        )

    def clear_friendship(self, user_a, user_b):
        FriendRequest.objects.filter(
            Q(requester=user_a, requested=user_b) | Q(requester=user_b, requested=user_a)
        ).delete()

    def make_item(self, *, owner=None, holder=None, name="Item", category="", tags=None, image_key=""):
        owner_user = owner or self.owner
        holder_user = holder or owner_user
        return Item.objects.create(
            owner_user=owner_user,
            current_holder_user=holder_user,
            name=name,
            category=category or "",
            tags=list(tags) if tags is not None else [],
            image_key=image_key or "",
        )

    def make_request(self, *, item, requester=None, date_needed_by=None, message=""):
        return BorrowRequest.objects.create(
            item=item,
            requester_user=requester or self.borrower,
            date_needed_by=date_needed_by or timezone.localdate(),
            message=message,
            status=BorrowRequest.Status.PENDING,
        )

    def make_active_loan(self, *, item, owner=None, borrower=None):
        return Loan.objects.create(
            item=item,
            owner_user=owner or item.owner_user,
            borrower_user=borrower or self.borrower,
            status=Loan.Status.ACTIVE,
        )

    @property
    def today(self):
        return timezone.localdate()

    @property
    def tomorrow(self):
        return timezone.localdate() + timedelta(days=1)

    @property
    def yesterday(self):
        return timezone.localdate() - timedelta(days=1)

