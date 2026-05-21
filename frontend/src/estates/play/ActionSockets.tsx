/** Three placement actions per player per round (matches backend cap). */
export const ESTATES_ACTIONS_PER_PLAYER = 3;

export type ActionSocketsProps = {
  actionsTaken: number;
  compact?: boolean;
};

export function ActionSockets({ actionsTaken, compact = false }: ActionSocketsProps) {
  const taken = Math.min(
    ESTATES_ACTIONS_PER_PLAYER,
    Math.max(0, Math.floor(actionsTaken)),
  );
  const remaining = ESTATES_ACTIONS_PER_PLAYER - taken;

  const classes = ["estates-action-sockets", compact ? "estates-action-sockets--compact" : null]
    .filter(Boolean)
    .join(" ");

  const sockets = Array.from({ length: ESTATES_ACTIONS_PER_PLAYER }, (_, index) => {
    const spent = index < taken;
    return (
      <span
        key={index}
        className={`estates-action-socket${
          spent ? " estates-action-socket--spent" : " estates-action-socket--available"
        }`}
        aria-hidden
      />
    );
  });

  const label =
    remaining === 0
      ? "No actions remaining"
      : remaining === 1
        ? "1 action remaining"
        : `${remaining} actions remaining`;
  const spentLabel = taken === 1 ? "1 action spent" : `${taken} actions spent`;

  return (
    <div
      className={classes}
      role="img"
      aria-label={`${label}, ${spentLabel}`}
      title={`${label} · ${spentLabel}`}
    >
      {sockets}
    </div>
  );
}
