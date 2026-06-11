/**
 * User-facing PondClicker Redux labels.
 * Code identifiers (specialties.ts, owned_specialties, etc.) stay unchanged.
 */
export const EVOLUTIONS_LABEL = "Evolutions";
export const EVOLUTION_LABEL = "Evolution";
export const EVOLUTIONS_LABEL_LOWER = "evolutions";
export const MUTAGEN_LABEL = "Mutagen";
export const MUTAGENS_LABEL = "Mutagens";

/** "1 Mutagen" or "N Mutagens" (0 uses plural). */
export function mutagenCountLabel(count: number): string {
  const n = Math.max(0, Math.floor(count));
  const word = n === 1 ? MUTAGEN_LABEL : MUTAGENS_LABEL;
  return `${n.toLocaleString()} ${word}`;
}

/** Depth-chart mutate button hover text. */
export function mutagenLevelUpTooltip(
  denizenName: string,
  cost: number,
  nextLevel: number,
): string {
  const word = cost === 1 ? MUTAGEN_LABEL : MUTAGENS_LABEL;
  return `Spend ${cost.toLocaleString()} ${word} to level ${denizenName} to ${nextLevel}`;
}
export const MUTATION_LABEL = "Mutation";
export const MUTATIONS_LABEL = "Mutations";
export const MILESTONE_LABEL = "Milestone";
export const MILESTONES_LABEL = "Milestones";
export const STRATUM_LABEL = "Stratum";
export const STRATA_LABEL = "Strata";
export const TO_NEXT_STRATA_PHRASE = "to next Strata";
export const TO_NEXT_STRATUM_PHRASE = "to next Stratum";
export const STRATA_PANEL_TOOLTIP =
  "Strata represent the age of your pond and determine how many fossils you begin your next pond cycle with.";
export const CYCLE_LABEL = "Cycle";
export const FOSSIL_SHOP_LABEL = "Fossil Shop";
export const FOSSILS_LABEL = "Fossils";
export const FOSSILIZED_STRATA_LABEL = "Fossilized strata";
export const UNFOSSILIZED_STRATA_LABEL = "Unfossilized strata";
export const CYCLE_POND_BUTTON = "Cycle Pond";
export const CYCLE_POND_CONFIRM_TITLE = "Cycle your pond?";
export const CYCLE_POND_CONFIRM_BODY =
  "Cycling your pond starts a new era. You fossilize your current unfossilized strata, earn one fossil per stratum fossilized, and restart your pond while keeping your lifetime progress.";
export const CYCLE_POND_CONFIRM_RESET = "You reset";
export const CYCLE_POND_CONFIRM_GAIN = "You gain";
export const CYCLE_POND_CONFIRM_KEEP = "You keep";
export function CYCLE_POND_CONFIRM_FOSSILIZE(count: number): string {
  const n = Math.max(0, Math.floor(count));
  if (n === 1) return "Cycling the pond now will fossilize 1 Stratum.";
  return `Cycling the pond now will fossilize ${n.toLocaleString()} Strata.`;
}
export const CYCLE_POND_CYCLE_BUTTON = "Cycle";
export const CYCLE_POND_NOT_YET_BUTTON = "Not yet";

export const RESET_POND_BUTTON = "Erase pond";
export const RESET_POND_CONFIRM_BUTTON = "Confirm erase pond";
export const RESET_POND_SECTION_TITLE = "Erase this pond?";
export const RESET_POND_WARNING =
  "This permanently deletes your entire PondClicker Redux save. ALL LIFETIME PROGRESS IS ERASED. You will start a brand-new pond on this account.";
export const RESET_POND_CANNOT_UNDO = "This cannot be undone.";

/** Main stratum UI heading — "1 Stratum" or "N Strata". */
export function stratumCountHeading(level: number): string {
  const n = Math.max(0, Math.floor(level));
  if (n === 1) return `1 ${STRATUM_LABEL}`;
  return `${n.toLocaleString()} ${STRATA_LABEL}`;
}
