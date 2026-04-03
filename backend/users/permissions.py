from rest_framework.permissions import BasePermission

from users.models import User


class IsApprovedUser(BasePermission):
    message = "Your account is pending approval."

    def has_permission(self, request, view):
        user = request.user

        return bool(
            user
            and user.is_authenticated
            and user.account_status == User.AccountStatus.APPROVED
        )


class IsStaffUser(BasePermission):
    message = "Staff access required."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and getattr(user, "is_staff", False)
        )
