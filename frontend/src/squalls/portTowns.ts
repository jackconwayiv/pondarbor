export const PORT_TOWN_SIZES = [
  "Fishing Village",
  "Port Town",
  "Capital City",
] as const;

export const PORT_TOWN_VIBES = [
  "Freedom",
  "Order",
  "Wilds",
  "Industry",
  "Philosophy",
  "Worship",
  "Scholarship",
  "Conquest",
] as const;

export type PortTownSize = (typeof PORT_TOWN_SIZES)[number];
export type PortTownVibe = (typeof PORT_TOWN_VIBES)[number];

export type PortTownType = {
  size: PortTownSize;
  vibe: PortTownVibe;
};

export function generatePortTown(): PortTownType {
  const size =
    PORT_TOWN_SIZES[Math.floor(Math.random() * PORT_TOWN_SIZES.length)]!;
  const vibe =
    PORT_TOWN_VIBES[Math.floor(Math.random() * PORT_TOWN_VIBES.length)]!;
  return { size, vibe };
}

export function renderPortTownName(port: PortTownType): string {
  return `${port.size} of ${port.vibe}`;
}

export function normalizePortTown(raw: unknown): PortTownType | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (
    typeof record.size !== "string" ||
    !(PORT_TOWN_SIZES as readonly string[]).includes(record.size)
  ) {
    return null;
  }
  if (
    typeof record.vibe !== "string" ||
    !(PORT_TOWN_VIBES as readonly string[]).includes(record.vibe)
  ) {
    return null;
  }
  return {
    size: record.size as PortTownSize,
    vibe: record.vibe as PortTownVibe,
  };
}
