from rest_framework.permissions import BasePermission


class IsApprovedUser(BasePermission):
    message = "Your account is pending approval."

    def has_permission(self, request, view):
        user = request.user

        return bool(
            user
            and user.is_authenticated
            and hasattr(user, "profile")
            and user.profile.status == "approved"
        )
