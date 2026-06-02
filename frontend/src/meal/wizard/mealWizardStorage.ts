const AUTO_OPEN_KEY = "pond.meal.setupWizard.autoOpenDisabled.v1";

export function mealWizardAutoOpenDisabledStorageKey(userId: number): string {
  return `${AUTO_OPEN_KEY}:${userId}`;
}

export function isMealWizardAutoOpenDisabled(userId: number): boolean {
  try {
    return localStorage.getItem(mealWizardAutoOpenDisabledStorageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function setMealWizardAutoOpenDisabled(userId: number): void {
  try {
    localStorage.setItem(mealWizardAutoOpenDisabledStorageKey(userId), "1");
  } catch {
    /* ignore */
  }
}
