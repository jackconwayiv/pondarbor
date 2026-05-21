/** Wizard page identifiers in display order. */
export type WizardPageId =
  | "you"
  | "parents"
  | "siblings"
  | "children"
  | "grandparents"
  | "spouse"
  | "aunts"
  | "cousins"
  | "nieces"
  | "friends";

export const WIZARD_PAGE_ORDER: WizardPageId[] = [
  "you",
  "spouse",
  "children",
  "parents",
  "siblings",
  "nieces",
  "grandparents",
  "aunts",
  "cousins",
  "friends",
];

export const WIZARD_PAGE_HEADINGS: Record<WizardPageId, string> = {
  you: "You",
  parents: "Parents",
  siblings: "Siblings",
  children: "Children & pets",
  grandparents: "Grandparents",
  spouse: "Spouse or partner",
  aunts: "Aunts & uncles",
  cousins: "Cousins",
  nieces: "Nieces & nephews",
  friends: "Friends",
};

export function activeWizardPages(hasSiblings: boolean): WizardPageId[] {
  return WIZARD_PAGE_ORDER.filter((id) => id !== "nieces" || hasSiblings);
}

export function pageIndexInActive(active: WizardPageId[], pageId: WizardPageId): number {
  const i = active.indexOf(pageId);
  return i >= 0 ? i : 0;
}
