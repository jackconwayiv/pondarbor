import {
  wedgeLabelBaseFontSize,
  wedgeLabelMaxWidth,
} from "./whatifTvSeatRingGeometry";

const MIN_FONT_RATIO = 0.48;
const CHAR_WIDTH_RATIO = 0.52;

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * CHAR_WIDTH_RATIO;
}

function truncateToWidth(text: string, fontSize: number, maxWidth: number): string {
  if (estimateTextWidth(text, fontSize) <= maxWidth) return text;
  const ellipsis = "…";
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = `${text.slice(0, mid).trimEnd()}${ellipsis}`;
    if (estimateTextWidth(candidate, fontSize) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  const trimmed = text.slice(0, lo).trimEnd();
  return trimmed.length > 0 ? `${trimmed}${ellipsis}` : ellipsis;
}

export type SeatRingLabelFit = {
  fontSize: number;
  displayText: string;
  truncated: boolean;
};

/** Shrink font to show full text; ellipsis only at minimum font floor. */
export function fitSeatRingLabel(
  text: string,
  seatCount: number,
  labelRadius?: number,
): SeatRingLabelFit {
  const maxWidth = wedgeLabelMaxWidth(seatCount, labelRadius);
  const baseFont = wedgeLabelBaseFontSize(seatCount);
  const minFont = baseFont * MIN_FONT_RATIO;

  if (estimateTextWidth(text, baseFont) <= maxWidth) {
    return { fontSize: baseFont, displayText: text, truncated: false };
  }

  const scale = maxWidth / estimateTextWidth(text, baseFont);
  let fontSize = Math.max(minFont, baseFont * scale);

  if (estimateTextWidth(text, fontSize) <= maxWidth) {
    return { fontSize, displayText: text, truncated: false };
  }

  fontSize = minFont;
  const displayText = truncateToWidth(text, fontSize, maxWidth);
  return {
    fontSize,
    displayText,
    truncated: displayText !== text,
  };
}

/** Human join-order seat number (1..P), not physical wedge index. */
export function formatPlayerSeatLabel(humanNumber: number, displayName: string): string {
  return `${humanNumber} ${displayName}`;
}
