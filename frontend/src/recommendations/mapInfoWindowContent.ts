import { formatEntrySecondaryLine, formatRatingSigFigs } from "./utils";
import type { RecommendationEntry } from "./types";

export function buildMapInfoWindowElement(
  entry: RecommendationEntry,
  onViewDetails: (entryId: number) => void,
): HTMLElement {
  const root = document.createElement("div");
  root.style.cssText = "max-width:260px;font-family:system-ui,sans-serif;line-height:1.4;";

  const titleRow = document.createElement("div");
  titleRow.style.cssText = "display:flex;gap:6px;align-items:flex-start;margin-bottom:4px;";

  const emoji = document.createElement("span");
  emoji.textContent = entry.category.emoji;
  emoji.setAttribute("aria-hidden", "true");

  const title = document.createElement("strong");
  title.textContent = entry.title;
  title.style.fontSize = "15px";

  titleRow.append(emoji, title);
  root.append(titleRow);

  const secondary = formatEntrySecondaryLine(entry);
  if (secondary) {
    const line = document.createElement("div");
    line.textContent = secondary;
    line.style.cssText = "font-size:13px;color:#5f6368;margin-bottom:6px;";
    root.append(line);
  }

  if (entry.review_count > 0 && entry.average_rating != null) {
    const rating = document.createElement("div");
    rating.textContent = `${formatRatingSigFigs(entry.average_rating)} ★ · ${entry.review_count} review${entry.review_count === 1 ? "" : "s"}`;
    rating.style.cssText = "font-size:13px;color:#5f6368;margin-bottom:8px;";
    root.append(rating);
  }

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "View details";
  button.style.cssText =
    "font-size:13px;font-weight:600;color:#1a73e8;background:none;border:none;padding:0;cursor:pointer;";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    onViewDetails(entry.id);
  });
  root.append(button);

  return root;
}
