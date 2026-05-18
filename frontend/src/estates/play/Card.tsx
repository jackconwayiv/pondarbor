import { useDraggable } from "@dnd-kit/core";
import type { DraggableSyntheticListeners } from "@dnd-kit/core";
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode, Ref } from "react";

import { resolveCardSuit } from "../estatesDropRules";

import { PermanentBonusStar, SuitGlyph } from "./glyphs";

export type CardScoringTarget = {
  modifierLabel: string;
  onApply: () => void;
  applying?: boolean;
};

export type CardSize = "default" | "small";

export type CardProps = {
  card: Record<string, unknown>;
  size?: CardSize;
  isWinner?: boolean;
  winnerAnchor?: "top" | "bottom";
  isDragging?: boolean;
  scoringTarget?: CardScoringTarget;
  /** Dim this card while another card is being chosen in the same pool. */
  dimmed?: boolean;
  draggable?: boolean;
  dragHandleRef?: Ref<HTMLDivElement>;
  dragListeners?: DraggableSyntheticListeners;
  dragAttributes?: Record<string, unknown> | object;
  ariaLabel?: string;
  style?: CSSProperties;
};

function cardTemporaryModifier(card: Record<string, unknown>): number {
  return Number(card.temporary_value_modifier ?? 0);
}

function cardPermanentBonus(card: Record<string, unknown>): number {
  return Number(card.permanent_value_bonus ?? 0);
}

function cardEffectiveValue(card: Record<string, unknown>): number {
  const rank = Number(card.rank ?? 0);
  return rank + cardPermanentBonus(card) + cardTemporaryModifier(card);
}

function formatTempLabel(modifier: number): string | null {
  if (modifier === 0) return null;
  return modifier > 0 ? `+${modifier}` : String(modifier);
}

function suitClass(suit: string): string {
  if (suit === "royal") return "estates-card--royal";
  if (suit === "noble") return "estates-card--noble";
  return "estates-card--peasant";
}

function suitGlyphPrimary(suit: string): string {
  if (suit === "royal") return "var(--vermilion)";
  if (suit === "noble") return "var(--lapis)";
  return "var(--verdigris)";
}

export function Card(props: CardProps) {
  const {
    card,
    size = "default",
    isWinner,
    winnerAnchor,
    isDragging,
    scoringTarget,
    dimmed,
    draggable,
    dragHandleRef,
    dragListeners,
    dragAttributes,
    ariaLabel,
    style,
  } = props;

  const suit = resolveCardSuit(card);
  const value = cardEffectiveValue(card);
  const tempMod = cardTemporaryModifier(card);
  const tempLabel = formatTempLabel(tempMod);
  const permBonus = cardPermanentBonus(card);

  const classes = [
    "estates-card",
    suitClass(suit || "peasant"),
    size === "small" ? "estates-card--small" : null,
    draggable ? "estates-card--draggable" : null,
    isDragging ? "estates-card--dragging" : null,
    isWinner ? "estates-card--winner" : null,
    dimmed ? "estates-card--dimmed" : null,
  ]
    .filter(Boolean)
    .join(" ");

  const glyphColor = suitGlyphPrimary(suit);

  return (
    <div
      ref={dragHandleRef}
      className={classes}
      style={style}
      aria-label={ariaLabel ?? `${suit || "card"} rank ${value}`}
      {...(dragListeners ?? {})}
      {...(dragAttributes ?? {})}
    >
      {isWinner && winnerAnchor === "top" ? (
        <span className="estates-card__winner-triangle estates-card__winner-triangle--top" aria-hidden />
      ) : null}
      {isWinner && winnerAnchor === "bottom" ? (
        <span className="estates-card__winner-triangle estates-card__winner-triangle--bottom" aria-hidden />
      ) : null}

      <div className="estates-card__corner">
        <SuitGlyph suit={suit} color={glyphColor} />
        <span>{value}</span>
      </div>

      <div className="estates-card__center" aria-hidden>
        <SuitGlyph suit={suit} color={glyphColor} />
      </div>

      <span className="estates-card__rank" aria-hidden>
        {value}
      </span>

      <div className="estates-card__corner estates-card__corner--bottom" aria-hidden>
        <SuitGlyph suit={suit} color={glyphColor} />
        <span>{value}</span>
      </div>

      {tempLabel ? (
        <span
          className={`estates-card__temp-banner${
            tempMod < 0 ? " estates-card__temp-banner--negative" : ""
          }`}
          aria-label={`Temporary modifier ${tempLabel}`}
        >
          {tempLabel}
        </span>
      ) : null}

      {permBonus > 0 ? (
        <span className="estates-card__perm-star" aria-label={`Permanent bonus +${permBonus}`}>
          <PermanentBonusStar size={size === "small" ? 12 : 18} />
        </span>
      ) : null}

      {scoringTarget ? <ScoringTargetButton target={scoringTarget} /> : null}
    </div>
  );
}

function ScoringTargetButton({ target }: { target: CardScoringTarget }) {
  const negative = target.modifierLabel.startsWith("-");
  const className = `estates-scoring-target${negative ? " estates-scoring-target--negative" : ""}`;
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (target.applying) return;
    target.onApply();
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      if (target.applying) return;
      target.onApply();
    }
  };
  return (
    <button
      type="button"
      className={className}
      data-applying={target.applying ? "true" : "false"}
      onClick={onClick}
      onKeyDown={onKey}
      aria-label={`Apply ${target.modifierLabel}`}
      disabled={Boolean(target.applying)}
    >
      <span className="estates-scoring-target__badge">{target.modifierLabel}</span>
    </button>
  );
}

export type DraggableHandCardProps = {
  card: Record<string, unknown>;
  dragId: string;
  disabled?: boolean;
  scoringTarget?: CardScoringTarget;
};

export function DraggableHandCard({ card, dragId, disabled, scoringTarget }: DraggableHandCardProps) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: dragId,
    disabled,
  });
  return (
    <Card
      card={card}
      draggable={!disabled}
      isDragging={isDragging}
      dragHandleRef={setNodeRef}
      dragListeners={listeners}
      dragAttributes={attributes}
      scoringTarget={scoringTarget}
    />
  );
}

export type DragPreviewCardProps = {
  card: Record<string, unknown>;
};

export function DragPreviewCard({ card }: DragPreviewCardProps): ReactNode {
  return (
    <div className="estates-drag-preview">
      <Card card={card} />
    </div>
  );
}
