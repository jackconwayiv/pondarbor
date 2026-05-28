import HomeActionGrid from "./HomeActionGrid";
import SquallsActionCard from "./SquallsActionCard";
type Props = {
  delvePoints: number;
  onDelve: () => void;
  onReturnToIsland: () => void;
};

export default function DungeonView({
  delvePoints,
  onDelve,
  onReturnToIsland,
}: Props) {
  const remaining = Math.max(0, delvePoints);

  return (
    <HomeActionGrid>
      <SquallsActionCard
        emoji="⛏️"
        label={`Delve (${remaining})`}
        accent="teal"
        disabled={remaining <= 0}
        onClick={onDelve}
      />
      <SquallsActionCard
        emoji="🏝️"
        label="Return to Island"
        accent="blue"
        onClick={onReturnToIsland}
      />
    </HomeActionGrid>
  );
}
