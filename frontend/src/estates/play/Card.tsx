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

export type CardTowerDiscardChoice = {
  mode: "keep" | "discard";
  onToggle: () => void;
  applying?: boolean;
};

export type CardSize = "default" | "small";

export type CardProps = {
  card: Record<string, unknown>;
  size?: CardSize;
  isWinner?: boolean;
  winnerAnchor?: "top" | "bottom";
  /** Darken the card face when this zone has a winner and this card lost. */
  zoneLoser?: boolean;
  isDragging?: boolean;
  scoringTarget?: CardScoringTarget;
  towerDiscardChoice?: CardTowerDiscardChoice;
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
  if (suit === "royal") return "var(--royal)";
  if (suit === "noble") return "var(--lapis)";
  return "var(--verdigris)";
}

export function Card(props: CardProps) {
  const {
    card,
    size = "default",
    isWinner,
    winnerAnchor,
    zoneLoser,
    isDragging,
    scoringTarget,
    towerDiscardChoice,
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
    zoneLoser ? "estates-card--zone-loser" : null,
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
        <span
          className={[
            "estates-card__perm-stars",
            permBonus > 2 ? "estates-card__perm-stars--dense" : null,
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={`Permanent bonus +${permBonus}`}
        >
          {Array.from({ length: permBonus }, (_, index) => (
            <span key={index} className="estates-card__perm-star" aria-hidden>
              <PermanentBonusStar
                size={
                  size === "small"
                    ? permBonus > 3
                      ? 9
                      : permBonus > 1
                        ? 10
                        : 12
                    : permBonus > 3
                      ? 13
                      : permBonus > 1
                        ? 15
                        : 18
                }
              />
            </span>
          ))}
        </span>
      ) : null}

      {scoringTarget ? <ScoringTargetButton target={scoringTarget} /> : null}
      {towerDiscardChoice ? (
        <TowerDiscardToggle choice={towerDiscardChoice} />
      ) : null}
    </div>
  );
}

function TowerDiscardToggle({ choice }: { choice: CardTowerDiscardChoice }) {
  const discard = choice.mode === "discard";
  const className = [
    "estates-scoring-target",
    "estates-scoring-target--tower-discard",
    discard ? "estates-scoring-target--discard" : "estates-scoring-target--keep",
  ]
    .filter(Boolean)
    .join(" ");
  const label = discard ? "DISCARD" : "KEEP";
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (choice.applying) return;
    choice.onToggle();
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      if (choice.applying) return;
      choice.onToggle();
    }
  };
  return (
    <button
      type="button"
      className={className}
      data-applying={choice.applying ? "true" : "false"}
      onClick={onClick}
      onKeyDown={onKey}
      aria-label={`${label}; tap to switch`}
      aria-pressed={discard}
      disabled={Boolean(choice.applying)}
    >
      <span className="estates-scoring-target__badge">{label}</span>
    </button>
  );
}

function ScoringTargetButton({ target }: { target: CardScoringTarget }) {
  const negative = target.modifierLabel.startsWith("-");
  const discard = target.modifierLabel === "Discard";
  const className = [
    "estates-scoring-target",
    negative ? "estates-scoring-target--negative" : null,
    discard ? "estates-scoring-target--discard" : null,
  ]
    .filter(Boolean)
    .join(" ");
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
  towerDiscardChoice?: CardTowerDiscardChoice;
};

export function DraggableHandCard({
  card,
  dragId,
  disabled,
  scoringTarget,
  towerDiscardChoice,
}: DraggableHandCardProps) {
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
      towerDiscardChoice={towerDiscardChoice}
    />
  );
}

export type DragPreviewCardProps = {
  card: Record<string, unknown>;
  /** Measured hand-card box (landscape responsive layout). */
  width?: number;
  height?: number;
  /** Portrait scaled canvas — apply --estates-canvas-scale on the preview wrapper. */
  portraitScale?: boolean;
};

export function DragPreviewCard({
  card,
  width,
  height,
  portraitScale = false,
}: DragPreviewCardProps): ReactNode {
  const sized = width != null && height != null && width > 0 && height > 0;
  const wrapperClass = [
    "estates-drag-preview",
    portraitScale ? "estates-drag-preview--portrait-scale" : null,
    sized ? "estates-drag-preview--sized" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={wrapperClass}
      style={sized ? { width, height } : undefined}
    >
      <Card card={card} />
    </div>
  );
}
