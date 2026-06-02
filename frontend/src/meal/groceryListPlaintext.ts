import type { GroceryListItem } from "./types";

export function groceryToPlaintext(items: GroceryListItem[], hideChecked: boolean): string {
  const lines: string[] = [];
  for (const it of items) {
    if (hideChecked && it.is_checked) continue;
    const mark = it.is_checked ? "[x]" : "[ ]";
    lines.push(`${mark} ${it.display_text}`);
    const c = it.contributions ?? [];
    if (c.length > 1) {
      for (const row of c) {
        lines.push(`    — ${row.meal_title}: ${row.display}`);
      }
    }
  }
  return lines.join("\n");
}
