import { useDroppable } from "@dnd-kit/core";
import type { CSSProperties, ReactNode } from "react";

import {
  ZONE_ALLOWED_SUITS,
  type CanonicalSuit,
  type ZoneDropBlockReason,
  type ZoneName,
} from "../estatesDropRules";

import { SuitGlyph } from "./glyphs";
import { ZoneIllumination } from "./illumination";

const ZONE_LABELS: Record<ZoneName, string> = {
  farm: "FARM",
  gate: "GATE",
  road: "ROAD",
  throne: "THRONE",
  tower: "TOWER",
};

const ZONE_EFFECT_HINTS: Record<ZoneName, string> = {
  farm: "2nd: give a card +2 this round",
  gate: "1st: give a card -1 this round",
  road: "3rd: permanent +1 to a card in hand",
  tower: "4th: draw +1 card next round",
  throne: "5th: gain 1 point",
};

const ZONE_INVALID_HINTS: Record<ZoneName, string> = {
  farm: "Peasant only",
  gate: "Any suit",
  road: "Peasant or noble only",
  tower: "Noble or royal only",
  throne: "Royal only",
};

function zoneSpacedName(zone: ZoneName): string {
  return ZONE_LABELS[zone].split("").join(" ");
}

function suitWashVar(suit: string): string {
  if (suit === "royal") return "rgba(184, 51, 42, 0.28)";
  if (suit === "noble") return "rgba(31, 61, 138, 0.25)";
  return "rgba(93, 127, 79, 0.28)";
}

export const ZONE_DROP_ID_PREFIX = "zone:";

export function zoneDropId(zone: ZoneName): string {
  return `${ZONE_DROP_ID_PREFIX}${zone}`;
}

export function parseZoneDropId(id: string | number): ZoneName | null {
  const raw = String(id);
  if (!raw.startsWith(ZONE_DROP_ID_PREFIX)) return null;
  const zone = raw.slice(ZONE_DROP_ID_PREFIX.length) as ZoneName;
  if (zone === "gate" || zone === "farm" || zone === "road" || zone === "tower" || zone === "throne") {
    return zone;
  }
  return null;
}

export type ZoneProps = {
  zone: ZoneName;
  isMyTurn: boolean;
  dropValid: boolean;
  dropInvalid: boolean;
  invalidReason?: ZoneDropBlockReason | null;
  dragSuit?: string;
  /** Card rendered in the slot above the zone (opponent's placement). */
  opponentSlot?: ReactNode;
  /** Card rendered in the slot below the zone (mine). */
  mineSlot?: ReactNode;
  /** When true, lift this zone above the brick wall (used when the player wins this zone). */
  stackAbove?: boolean;
};

export function Zone({
  zone,
  isMyTurn,
  dropValid,
  dropInvalid,
  invalidReason,
  dragSuit = "",
  opponentSlot,
  mineSlot,
  stackAbove,
}: ZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: zoneDropId(zone),
    disabled: !isMyTurn,
  });

  const hoverValid = isOver && dropValid;
  const hoverInvalid = isOver && dropInvalid;

  const boxClass = [
    "estates-zone-box",
    hoverValid ? "estates-zone-box--hover-valid" : null,
    hoverInvalid ? "estates-zone-box--hover-invalid" : null,
  ]
    .filter(Boolean)
    .join(" ");

  const boxStyle: CSSProperties = hoverValid
    ? ({ ["--zone-hover-wash" as string]: suitWashVar(dragSuit) } as CSSProperties)
    : {};

  const cellClass = ["estates-zone-cell", `estates-zone-cell--${zone}`].join(" ");
  const cellStyle: CSSProperties | undefined = stackAbove ? { zIndex: 5 } : undefined;

  const hint =
    hoverInvalid && invalidReason
      ? invalidReason === "already_placed"
        ? "Already placed here this round"
        : ZONE_INVALID_HINTS[zone]
      : ZONE_EFFECT_HINTS[zone];

  const allowed = [...ZONE_ALLOWED_SUITS[zone]] as Array<CanonicalSuit>;

  return (
    <div className={cellClass} style={cellStyle}>
      <div className="estates-zone-stack">
        <div ref={setNodeRef} className={boxClass} style={boxStyle}>
          <div className="estates-zone-art" aria-hidden>
            <ZoneIllumination zone={zone} />
          </div>

          <div className="estates-zone-banner">
            <span className="estates-zone-banner__name">{zoneSpacedName(zone)}</span>
            <span className="estates-zone-banner__glyphs">
              {allowed.map((s) => (
                <SuitGlyph key={s} suit={s} aria-label={s} />
              ))}
            </span>
          </div>

          <div
            className={
              hoverInvalid
                ? "estates-zone-hint estates-zone-hint--invalid"
                : "estates-zone-hint"
            }
          >
            {hint}
          </div>
        </div>

        {opponentSlot ? (
          <div className="estates-zone-slot estates-zone-slot--opponent">{opponentSlot}</div>
        ) : null}
        {mineSlot ? (
          <div className="estates-zone-slot estates-zone-slot--mine">{mineSlot}</div>
        ) : null}
      </div>
    </div>
  );
}
