export const FAMILY_TREE_TAB_MIN_PEOPLE = 3;

export function friendHasVisibleFamilyTree({
  canViewFullProfile,
  peopleCount,
}: {
  canViewFullProfile: boolean;
  peopleCount: number | null | undefined;
}) {
  return Boolean(canViewFullProfile) && (peopleCount ?? 0) >= FAMILY_TREE_TAB_MIN_PEOPLE;
}

