import { useDroppable } from "@dnd-kit/core";
import { useState, type CSSProperties, type ReactNode } from "react";

import { useIsMobile } from "../../responsive";
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
  gate: "1st: give a card -1 this round",
  farm: "2nd: permanent +1 to a card in hand",
  road: "3rd: draw +1 card next turn",
  tower: "4th: choose who plays first next round",
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
  if (suit === "royal") return "rgba(201, 164, 26, 0.32)";
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
  const isMobile = useIsMobile();
  const [effectHintOpen, setEffectHintOpen] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: zoneDropId(zone),
    disabled: !isMyTurn,
  });

  const hoverValid = isOver && dropValid;
  const hoverInvalid = isOver && dropInvalid;
  const showInvalidHint = hoverInvalid && Boolean(invalidReason);
  const invalidHintText =
    invalidReason === "already_placed"
      ? "Already placed here this round"
      : ZONE_INVALID_HINTS[zone];

  const boxClass = [
    "estates-zone-box",
    hoverValid ? "estates-zone-box--hover-valid" : null,
    hoverInvalid ? "estates-zone-box--hover-invalid" : null,
    isMobile && effectHintOpen && !showInvalidHint ? "estates-zone-box--hint-open" : null,
  ]
    .filter(Boolean)
    .join(" ");

  const boxStyle: CSSProperties = hoverValid
    ? ({ ["--zone-hover-wash" as string]: suitWashVar(dragSuit) } as CSSProperties)
    : {};

  const cellClass = ["estates-zone-cell", `estates-zone-cell--${zone}`].join(" ");
  const cellStyle: CSSProperties | undefined = stackAbove ? { zIndex: 5 } : undefined;

  const allowed = [...ZONE_ALLOWED_SUITS[zone]] as Array<CanonicalSuit>;

  const onZoneBoxClick = () => {
    if (!isMobile || showInvalidHint) return;
    setEffectHintOpen((open) => !open);
  };

  return (
    <div className={cellClass} style={cellStyle}>
      <div className="estates-zone-stack">
        <div
          ref={setNodeRef}
          className={boxClass}
          style={boxStyle}
          onClick={onZoneBoxClick}
          onKeyDown={(event) => {
            if (!isMobile || showInvalidHint) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setEffectHintOpen((open) => !open);
            }
          }}
          role={isMobile ? "button" : undefined}
          tabIndex={isMobile ? 0 : undefined}
          aria-expanded={isMobile ? effectHintOpen : undefined}
          aria-label={isMobile ? `${ZONE_LABELS[zone]} zone, toggle effect hint` : undefined}
        >
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

          {showInvalidHint ? (
            <div className="estates-zone-hint estates-zone-hint--invalid">{invalidHintText}</div>
          ) : (
            <div className="estates-zone-hint estates-zone-hint--effect">
              {ZONE_EFFECT_HINTS[zone]}
            </div>
          )}
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
