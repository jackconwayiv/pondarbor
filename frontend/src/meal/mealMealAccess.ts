import type { SessionUser } from "../auth/AppSessionContext";
import type { Meal } from "./types";

/** True when the viewer may edit/delete via meal partner scope or ownership. */
export function canWriteMeal(meal: Meal, sessionUser: SessionUser): boolean {
  const myId = sessionUser.user.id;
  if (meal.owner_user === myId) return true;
  const partnerId = sessionUser.profile.meal_crud_partner_id;
  if (partnerId == null || meal.owner_user !== partnerId) return false;
  return Boolean(sessionUser.profile.meal_pair_mutual);
}
