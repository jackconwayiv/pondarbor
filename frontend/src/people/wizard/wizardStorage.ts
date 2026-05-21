const AUTO_OPEN_KEY = "pond.people.setupWizard.autoOpenDisabled.v1";

export function autoOpenDisabledStorageKey(userId: number): string {
  return `${AUTO_OPEN_KEY}:${userId}`;
}

export function isWizardAutoOpenDisabled(userId: number): boolean {
  try {
    return localStorage.getItem(autoOpenDisabledStorageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function setWizardAutoOpenDisabled(userId: number): void {
  try {
    localStorage.setItem(autoOpenDisabledStorageKey(userId), "1");
  } catch {
    /* ignore */
  }
}
