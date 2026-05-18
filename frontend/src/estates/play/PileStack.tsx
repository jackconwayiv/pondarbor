import type { KeyboardEvent, MouseEvent } from "react";

export type PileStackProps = {
  label: string;
  count: number;
  faceUp?: boolean;
  onClick?: () => void;
  bonus?: number;
};

export function PileStack({ label, count, faceUp = false, onClick, bonus }: PileStackProps) {
  const interactive = Boolean(onClick);
  const baseClass = ["estates-pile", faceUp ? "estates-pile--face-up" : null, interactive ? "estates-pile--clickable" : null]
    .filter(Boolean)
    .join(" ");

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!onClick) return;
    e.stopPropagation();
    onClick();
  };

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <div
      className={baseClass}
      onClick={handleClick}
      onKeyDown={handleKey}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `View ${label.toLowerCase()} pile (${count} cards)` : `${label} pile (${count} cards)`}
    >
      {!faceUp ? <span className="estates-pile__pattern" aria-hidden /> : null}
      <span className="estates-pile__label">{label}</span>
      <span className="estates-pile__count">{count}</span>
      {bonus != null && bonus > 0 ? (
        <span className="estates-pile__bonus" aria-label={`Draw bonus +${bonus}`}>
          +{bonus}
        </span>
      ) : null}
    </div>
  );
}
