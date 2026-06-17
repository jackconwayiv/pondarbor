import { formatEntrySecondaryLine, formatRatingSigFigs } from "./utils";
import type { RecommendationEntry } from "./types";

export function buildMapInfoWindowElement(
  entry: RecommendationEntry,
  onSelect: (entryId: number) => void,
): HTMLElement {
  const root = document.createElement("button");
  root.type = "button";
  root.setAttribute("aria-label", `Open ${entry.title}`);
  root.style.cssText = [
    "display:block",
    "max-width:260px",
    "font-family:system-ui,sans-serif",
    "line-height:1.4",
    "text-align:left",
    "cursor:pointer",
    "background:none",
    "border:none",
    "padding:0",
    "margin:0",
    "color:inherit",
  ].join(";");

  const openEntry = () => onSelect(entry.id);
  root.addEventListener("click", (event) => {
    event.preventDefault();
    openEntry();
  });

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
    line.style.cssText = "font-size:13px;color:#5f6368;margin-bottom:4px;";
    root.append(line);
  }

  if (entry.review_count > 0 && entry.average_rating != null) {
    const rating = document.createElement("div");
    rating.textContent = `${formatRatingSigFigs(entry.average_rating)} ★ · ${entry.review_count} review${entry.review_count === 1 ? "" : "s"}`;
    rating.style.cssText = "font-size:13px;color:#5f6368;";
    root.append(rating);
  }

  return root;
}
