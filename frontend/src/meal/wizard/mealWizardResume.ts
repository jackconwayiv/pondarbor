import type { Profile } from "../../auth/AppSessionContext";
import {
  MEAL_WIZARD_STEP_ORDER,
  type MealWizardStepId,
} from "./mealWizardSteps";

export function firstIncompleteMealWizardStep(profile: Profile): MealWizardStepId {
  if (profile.meal_partner_incoming_pending) {
    return "partner";
  }
  const slots = profile.meal_slots_per_day ?? 3;
  if (slots < 1 || slots > 5) {
    return "slotsCount";
  }
  const labels = profile.meal_slot_labels?.[String(slots)];
  if (!labels || labels.length !== slots) {
    return "slotNames";
  }
  if (profile.meal_maestro_setup_completed) {
    return "tour";
  }
  return "partner";
}

export function mealWizardStepFromId(id: string): MealWizardStepId {
  if ((MEAL_WIZARD_STEP_ORDER as readonly string[]).includes(id)) {
    return id as MealWizardStepId;
  }
  return "partner";
}
