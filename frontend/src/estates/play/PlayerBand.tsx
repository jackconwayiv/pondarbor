import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";

import { PileStack } from "./PileStack";

export const HAND_RETURN_DROP_ID = "hand-return";

export type PlayerBandProps = {
  opponent?: boolean;
  active?: boolean;
  displayName: string;
  avatarUrl?: string;
  deckCount: number;
  deckDrawBonus?: number;
  discardCount: number;
  onDiscardClick: () => void;
  center?: ReactNode;
  enableHandReturn?: boolean;
  dragActive?: boolean;
  scrollableHand?: boolean;
  /** Two rows of three (mobile opening hand before first placement). */
  handSixGrid?: boolean;
};

function avatarInitial(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "?";
  return trimmed[0]!.toUpperCase();
}

export function PlayerBand({
  opponent = false,
  active = false,
  displayName,
  avatarUrl,
  deckCount,
  deckDrawBonus = 0,
  discardCount,
  onDiscardClick,
  center,
  enableHandReturn = false,
  dragActive = false,
  scrollableHand = false,
  handSixGrid = false,
}: PlayerBandProps) {
  const { setNodeRef: setReturnRef, isOver: isOverReturn } = useDroppable({
    id: HAND_RETURN_DROP_ID,
    disabled: !enableHandReturn,
  });

  const returnHover = enableHandReturn && dragActive && isOverReturn;

  const classes = [
    "estates-band",
    opponent ? "estates-band--opponent" : "estates-band--mine",
    active ? "estates-band--active" : null,
    returnHover ? "estates-band--return-hover" : null,
    handSixGrid ? "estates-band--hand-six-grid" : null,
  ]
    .filter(Boolean)
    .join(" ");

  const handClass = [
    "estates-band__hand",
    handSixGrid ? "estates-band__hand--six-grid" : null,
    scrollableHand && !handSixGrid ? "estates-band__hand--scrollable" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      {enableHandReturn ? (
        <div
          ref={setReturnRef}
          className={`estates-band__return-overlay${
            dragActive ? " estates-band__return-overlay--active" : ""
          }`}
          aria-label={dragActive ? "Return card to hand" : undefined}
          aria-hidden={!dragActive}
        />
      ) : null}
      <div className="estates-band__deck">
        <PileStack label="Deck" count={deckCount} bonus={deckDrawBonus} />
      </div>
      <div
        className={`estates-band__center${opponent ? " estates-band__center--opponent" : ""}`}
      >
        {opponent ? (
          <div className="estates-band__player">
            <span className="estates-band__avatar" aria-hidden>
              {avatarUrl ? <img src={avatarUrl} alt="" /> : avatarInitial(displayName)}
            </span>
            <div className="estates-band__identity">
              <span className="estates-band__name" title={displayName}>
                {displayName}
              </span>
              {center ? <div className="estates-band__meta">{center}</div> : null}
            </div>
          </div>
        ) : (
          <div className={handClass}>{center}</div>
        )}
      </div>
      <div className="estates-band__spent">
        <PileStack label="Spent" count={discardCount} faceUp onClick={onDiscardClick} />
      </div>
    </div>
  );
}
