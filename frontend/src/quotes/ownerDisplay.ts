import type { QuoteOwner } from "./types";

/** Prefer username when present; otherwise email (shown in quote card header / links). */
export function quoteOwnerDisplayLabel(owner: QuoteOwner): string {
  const u = (owner.username || "").trim();
  return u.length > 0 ? u : owner.email;
}
