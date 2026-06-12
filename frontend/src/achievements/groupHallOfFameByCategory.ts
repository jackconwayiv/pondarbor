import { achievementCategoryMeta } from "./achievementCategoryLabels";
import { sortHallOfFameRows } from "./sortTrophyCase";
import type { HallOfFameCategoryGroup, HallOfFameRow } from "./types";

function categorySortKey(rows: HallOfFameRow[]): number {
  if (rows.length === 0) return Number.MAX_SAFE_INTEGER;
  return Math.min(...rows.map((r) => r.catalog_order));
}

function sortLockedRows(rows: HallOfFameRow[]): HallOfFameRow[] {
  return [...rows].sort(
    (a, b) =>
      a.catalog_order - b.catalog_order || a.slug.localeCompare(b.slug),
  );
}

function buildCategoryGroups(
  rows: HallOfFameRow[],
  viewerId: number,
  mode: "earned" | "locked",
): HallOfFameCategoryGroup[] {
  const filtered =
    mode === "earned"
      ? rows.filter((r) => r.is_earned)
      : rows.filter((r) => !r.is_earned);

  const byCategory = new Map<string, HallOfFameRow[]>();
  for (const row of filtered) {
    const cat = row.category.trim() || "_general";
    const list = byCategory.get(cat) ?? [];
    list.push(row);
    byCategory.set(cat, list);
  }

  const groups: HallOfFameCategoryGroup[] = [];
  for (const [category, catRows] of byCategory) {
    const meta = achievementCategoryMeta(category === "_general" ? "" : category);
    groups.push({
      category,
      label: meta.label,
      emoji: meta.emoji,
      earnedRows:
        mode === "earned" ? sortHallOfFameRows(catRows, viewerId) : [],
      lockedRows: mode === "locked" ? sortLockedRows(catRows) : [],
    });
  }

  groups.sort((a, b) => {
    const aRows = mode === "earned" ? a.earnedRows : a.lockedRows;
    const bRows = mode === "earned" ? b.earnedRows : b.lockedRows;
    return categorySortKey(aRows) - categorySortKey(bRows);
  });

  return groups;
}

/** Earned badges grouped by category (rarity order within each). */
export function groupHallOfFameEarnedByCategory(
  rows: HallOfFameRow[],
  viewerId: number,
): HallOfFameCategoryGroup[] {
  return buildCategoryGroups(rows, viewerId, "earned");
}

/** Unearned catalog rows grouped by category (catalog order within each). */
export function groupHallOfFameLockedByCategory(
  rows: HallOfFameRow[],
  viewerId: number,
): HallOfFameCategoryGroup[] {
  return buildCategoryGroups(rows, viewerId, "locked");
}
