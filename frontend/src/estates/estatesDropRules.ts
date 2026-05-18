export const ZONE_NAMES = ["farm", "gate", "road", "throne", "tower"] as const;
export type ZoneName = (typeof ZONE_NAMES)[number];

export const ZONE_ALLOWED_SUITS: Record<ZoneName, ReadonlySet<string>> = {
  gate: new Set(["peasant", "noble", "royal"]),
  farm: new Set(["peasant"]),
  road: new Set(["peasant", "noble"]),
  tower: new Set(["noble", "royal"]),
  throne: new Set(["royal"]),
};

export type CanonicalSuit = "peasant" | "noble" | "royal";

/** Map suit/color alias strings to canonical peasant, noble, or royal. */
export function normalizeSuitValue(suitOrColor: string): string {
  const value = suitOrColor.trim().toLowerCase();
  if (value === "peasant" || value === "green") return "peasant";
  if (value === "noble" || value === "blue") return "noble";
  if (value === "royal" || value === "orange") return "royal";
  return value;
}

/** Resolve suit from card payload (canonical: peasant, noble, royal). */
export function resolveCardSuit(card: Record<string, unknown>): CanonicalSuit | "" {
  const suit = String(card.suit || "").trim().toLowerCase();
  const color = String(card.color || "").trim().toLowerCase();
  for (const value of [suit, color]) {
    if (!value) continue;
    const normalized = normalizeSuitValue(value);
    if (normalized === "peasant" || normalized === "noble" || normalized === "royal") {
      return normalized;
    }
  }
  return "";
}

export function isSuitAllowedInZone(zone: ZoneName, suit: string): boolean {
  const normalized = normalizeSuitValue(suit);
  return ZONE_ALLOWED_SUITS[zone].has(normalized);
}

export function placedCardEntry(
  value: unknown,
): { card: Record<string, unknown>; confirmed: boolean } | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { card?: unknown; confirmed?: unknown };
  if (!row.card || typeof row.card !== "object") return null;
  return { card: row.card as Record<string, unknown>, confirmed: Boolean(row.confirmed) };
}

export type ZoneDropBlockReason = "suit" | "already_placed";

export function zoneAllowedSuitsHint(zone: ZoneName): string {
  const labels: Record<ZoneName, string> = {
    farm: "Peasant only",
    gate: "Any suit",
    road: "Peasant or noble only",
    tower: "Noble or royal only",
    throne: "Royal only",
  };
  return labels[zone];
}

export function isZoneDropAllowed(params: {
  zone: ZoneName;
  card: Record<string, unknown> | null | undefined;
  placementsByZone: Record<string, Record<string, unknown>>;
  mySeat: number;
  isMyTurn: boolean;
}): boolean {
  const { zone, card, placementsByZone, mySeat, isMyTurn } = params;
  if (!isMyTurn || !card) return false;
  const suit = resolveCardSuit(card);
  if (!suit || !isSuitAllowedInZone(zone, suit)) return false;
  const zonePayload = placementsByZone[zone] ?? {};
  const myPlaced = placedCardEntry(zonePayload[String(mySeat)]);
  if (myPlaced?.confirmed) return false;
  return true;
}

export function getZoneDropBlockReason(params: {
  zone: ZoneName;
  card: Record<string, unknown> | null | undefined;
  placementsByZone: Record<string, Record<string, unknown>>;
  mySeat: number;
  isMyTurn: boolean;
}): ZoneDropBlockReason | null {
  const { zone, card, placementsByZone, mySeat, isMyTurn } = params;
  if (!isMyTurn || !card) return null;
  const zonePayload = placementsByZone[zone] ?? {};
  const myPlaced = placedCardEntry(zonePayload[String(mySeat)]);
  if (myPlaced?.confirmed) return "already_placed";
  const suit = resolveCardSuit(card);
  if (!suit || !isSuitAllowedInZone(zone, suit)) return "suit";
  return null;
}
