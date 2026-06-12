import { achievementCategoryMeta } from "./achievementCategoryLabels";
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

/** Unearned catalog rows grouped by app category (catalog order within each). */
export function groupHallOfFameLockedByCategory(
  rows: HallOfFameRow[],
): HallOfFameCategoryGroup[] {
  const locked = rows.filter((r) => !r.is_earned);

  const byCategory = new Map<string, HallOfFameRow[]>();
  for (const row of locked) {
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
      earnedRows: [],
      lockedRows: sortLockedRows(catRows),
    });
  }

  groups.sort(
    (a, b) => categorySortKey(a.lockedRows) - categorySortKey(b.lockedRows),
  );

  return groups;
}
