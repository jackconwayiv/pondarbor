import type { ZoneName } from "./estatesDropRules";

export type EstatesLastPlacement = {
  seat: number;
  zone: ZoneName;
  rank: number;
  suit: string;
};

const SUIT_LABELS: Record<string, string> = {
  peasant: "Peasant",
  noble: "Noble",
  royal: "Royal",
};

const ZONE_LABELS: Record<ZoneName, string> = {
  gate: "Gate",
  farm: "Farm",
  road: "Road",
  tower: "Tower",
  throne: "Throne",
};

function isZoneName(value: string): value is ZoneName {
  return value === "gate" || value === "farm" || value === "road" || value === "tower" || value === "throne";
}

function parseLastPlacement(raw: unknown): EstatesLastPlacement | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const seat = Number(row.seat);
  const zone = String(row.zone || "");
  const rank = Number(row.rank);
  const suit = String(row.suit || "");
  if (!Number.isFinite(seat) || seat !== 1 && seat !== 2) return null;
  if (!isZoneName(zone)) return null;
  if (!Number.isFinite(rank)) return null;
  if (!suit) return null;
  return { seat, zone, rank, suit };
}

export function formatOpponentLastPlacement({
  lastPlacement,
  mySeat,
  opponentDisplayName,
}: {
  lastPlacement: unknown;
  mySeat: number | null | undefined;
  opponentDisplayName: string;
}): string | null {
  const parsed = parseLastPlacement(lastPlacement);
  if (!parsed || mySeat == null || parsed.seat === mySeat) return null;

  const opponentName = opponentDisplayName.trim() || "Opponent";
  const suitLabel = SUIT_LABELS[parsed.suit] ?? parsed.suit;
  const zoneLabel = ZONE_LABELS[parsed.zone];
  return `${opponentName} plays ${parsed.rank} ${suitLabel} at the ${zoneLabel}.`;
}

/**
 * Rewrites server status lines that use the winner's display name so the
 * current player sees "You" / "you" instead of their own username.
 */
export function personalizeEstatesStatusMessage(
  message: string,
  myDisplayName: string | undefined,
): string {
  const name = myDisplayName?.trim();
  if (!message || !name) return message;

  if (message.startsWith(`Waiting for ${name} `)) {
    return `Waiting for you${message.slice(`Waiting for ${name}`.length)}`;
  }

  if (!message.startsWith(`${name} `)) return message;
  const rest = message.slice(name.length + 1);

  if (rest.startsWith("wins the Throne and wins the game!")) {
    return "You won the Throne and won the game!";
  }
  if (rest.startsWith("wins the Throne and gains 1 point.")) {
    return "You won the Throne and gained 1 point.";
  }
  if (rest.startsWith("wins the Road and will draw 2 extra cards next round.")) {
    return "You won the Road and will draw 2 extra cards next round.";
  }
  if (rest.startsWith("wins ")) {
    return `You won ${rest.slice(5)}`;
  }
  if (rest.startsWith("applies ")) {
    return `You applied ${rest.slice(8)}`;
  }
  if (rest.startsWith("permanently upgrades ")) {
    return `You permanently upgraded ${rest.slice(21)}`;
  }
  if (rest.startsWith("keeps their hand (Tower)")) {
    return "You keep your hand (Tower) and will go second next round.";
  }
  if (rest.startsWith("discards ")) {
    return `You discard ${rest.slice(9)}`;
  }
  if (rest.startsWith("will go ")) {
    return `You ${rest}`;
  }

  return `You ${rest}`;
}
