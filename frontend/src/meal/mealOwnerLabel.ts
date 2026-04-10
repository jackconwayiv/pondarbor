import type { SessionUser } from "../auth/AppSessionContext";

/**
 * Human-readable label for a Django user id on meal-owned objects.
 * Uses your profile display name when you own the row; "Partner" when it matches your meal partner.
 */
export function mealOwnerLabel(ownerUserId: number, sessionUser: SessionUser | null): string {
  if (!sessionUser) {
    return `User #${ownerUserId}`;
  }
  if (ownerUserId === sessionUser.user.id) {
    const display = (sessionUser.profile.display_name ?? "").trim();
    if (display) return display;
    const email = (sessionUser.user.email ?? "").trim();
    if (email) return email;
    return "You";
  }
  const partnerId = sessionUser.profile.meal_crud_partner_id;
  if (partnerId != null && ownerUserId === partnerId) {
    return "Partner";
  }
  return `User #${ownerUserId}`;
}
