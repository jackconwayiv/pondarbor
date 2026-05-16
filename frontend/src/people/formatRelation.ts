import { labelForRelationCore } from "./relationVocab";
import type { PeoplePerson } from "./types";

function normalizeRelationText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function relationSuffixParts(p: PeoplePerson): string[] {
  return (p.relation_suffix_tokens || [])
    .filter((t) => t === "in_law" || (t === "best" && p.relation_core === "friend"))
    .map((t) => (t === "in_law" ? "in-law" : "best "));
}

/** Default relation label from core + prefix/suffix tokens (no alias). */
export function formatDefaultRelationLine(p: PeoplePerson): string {
  const pre = (p.relation_prefix_tokens || []).map((t) => `${t}-`).join("");
  const suf = relationSuffixParts(p);
  const core = labelForRelationCore(p.relation_core).toLowerCase();
  return [`${pre}${core}`, ...suf].join(" ").trim();
}

/** True when alias is only the core label but prefixes/suffixes change the default line. */
function aliasMasksDefaultRelation(p: PeoplePerson, alias: string, defaultLine: string): boolean {
  const coreLabel = labelForRelationCore(p.relation_core).toLowerCase();
  if (normalizeRelationText(alias) !== normalizeRelationText(coreLabel)) {
    return false;
  }
  return normalizeRelationText(defaultLine) !== normalizeRelationText(coreLabel);
}

/** Alias when it differs from the default; otherwise the default relation line. */
export function formatRelationLine(p: PeoplePerson): string {
  const defaultLine = formatDefaultRelationLine(p);
  const alias = (p.relation_alias || "").trim();
  if (!alias) return defaultLine;
  if (normalizeRelationText(alias) === normalizeRelationText(defaultLine)) {
    return defaultLine;
  }
  if (aliasMasksDefaultRelation(p, alias, defaultLine)) {
    return defaultLine;
  }
  return alias;
}

export function formatLifeDates(p: PeoplePerson): string {
  if (p.death_date) {
    const b = p.birthday || "—";
    return `${b} – ${p.death_date}`;
  }
  if (p.birthday) return `DOB: ${p.birthday}`;
  return "—";
}
