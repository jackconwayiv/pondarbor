export const MEAL_WIZARD_STEP_ORDER = [
  "partner",
  "slotsCount",
  "slotNames",
  "weekStart",
  "dietary",
  "pantry",
  "tour",
] as const;

export type MealWizardStepId = (typeof MEAL_WIZARD_STEP_ORDER)[number];

export const MEAL_WIZARD_STEP_HEADINGS: Record<MealWizardStepId, string> = {
  partner: "Share pantry with a partner?",
  slotsCount: "Meals per day",
  slotNames: "Name your meal times",
  weekStart: "Week starts on",
  dietary: "Dietary preferences",
  pantry: "Pantry tracking",
  tour: "What you can do in Meal Maestro",
};

export function mealWizardStepIndex(step: MealWizardStepId): number {
  return MEAL_WIZARD_STEP_ORDER.indexOf(step);
}

export function mealWizardHasPrior(step: MealWizardStepId): boolean {
  return mealWizardStepIndex(step) > 0;
}

export function mealWizardHasNext(step: MealWizardStepId): boolean {
  return mealWizardStepIndex(step) < MEAL_WIZARD_STEP_ORDER.length - 1;
}

export function mealWizardNextStep(step: MealWizardStepId): MealWizardStepId | null {
  const i = mealWizardStepIndex(step);
  if (i < 0 || i >= MEAL_WIZARD_STEP_ORDER.length - 1) return null;
  return MEAL_WIZARD_STEP_ORDER[i + 1];
}

export function mealWizardPriorStep(step: MealWizardStepId): MealWizardStepId | null {
  const i = mealWizardStepIndex(step);
  if (i <= 0) return null;
  return MEAL_WIZARD_STEP_ORDER[i - 1];
}
