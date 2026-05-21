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

const ZONE_SCORE_ORDER_HINTS: Record<ZoneName, string> = {
  gate: "Scored 1st",
  throne: "Scored 2nd",
  farm: "Scored 3rd",
  road: "Scored 4th",
  tower: "Scored 5th",
};

const ZONE_SUIT_HINTS: Record<ZoneName, string> = {
  gate: "Any suit",
  farm: "Peasants only",
  road: "Peasants or nobles only",
  tower: "Nobles or royals only",
  throne: "Royals only",
};

const ZONE_EFFECT_HINTS: Record<ZoneName, string> = {
  gate: "Give a card −1 this round",
  farm: "Permanent +1 to a card in hand",
  road: "Draw +1 card next turn",
  tower: "Go second next round; discard a hand card",
  throne: "Gain 1 point",
};

const ZONE_INVALID_HINTS: Record<ZoneName, string> = {
  farm: "Peasants only",
  gate: "Any suit",
  road: "Peasants or nobles only",
  tower: "Nobles or royals only",
  throne: "Royals only",
};

function ZoneHintPanel({ zone }: { zone: ZoneName }) {
  return (
    <div className="estates-zone-hint estates-zone-hint--effect">
      <p className="estates-zone-hint__row estates-zone-hint__row--order">
        {ZONE_SCORE_ORDER_HINTS[zone]}
      </p>
      <p className="estates-zone-hint__row estates-zone-hint__row--suits">{ZONE_SUIT_HINTS[zone]}</p>
      <p className="estates-zone-hint__row estates-zone-hint__row--effect">
        {ZONE_EFFECT_HINTS[zone]}
      </p>
    </div>
  );
}

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
            <ZoneHintPanel zone={zone} />
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
