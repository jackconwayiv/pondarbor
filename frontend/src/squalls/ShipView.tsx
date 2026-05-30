import HomeActionGrid from "./HomeActionGrid";
import SquallsActionCard from "./SquallsActionCard";

type Props = {
  onShop: () => void;
  onRest: () => void;
  onSail: () => void;
  onIsland?: () => void;
  islandExplorePoints?: number;
  onEnterWreck?: () => void;
  wreckDelvePoints?: number;
  onReturnToPort?: () => void;
  onCookstove: () => void;
};

export default function ShipView({
  onShop,
  onRest,
  onSail,
  onIsland,
  islandExplorePoints,
  onEnterWreck,
  wreckDelvePoints,
  onReturnToPort,
  onCookstove,
}: Props) {
  return (
    <HomeActionGrid>
      {onIsland ? (
        <SquallsActionCard
          emoji="🏝️"
          label={`Head Ashore (${islandExplorePoints ?? 0})`}
          accent="teal"
          onClick={onIsland}
        />
      ) : null}
      {onEnterWreck && (wreckDelvePoints ?? 0) > 0 ? (
        <SquallsActionCard
          emoji="⛵"
          label={`Enter Wreck (${wreckDelvePoints})`}
          accent="orange"
          onClick={onEnterWreck}
        />
      ) : null}
      {onReturnToPort ? (
        <SquallsActionCard
          emoji="⚓"
          label="Return to Town"
          accent="blue"
          onClick={onReturnToPort}
        />
      ) : null}
      <SquallsActionCard emoji="💰" label="Provisions" accent="yellow" onClick={onShop} />
      <SquallsActionCard emoji="🍳" label="Cookstove" accent="orange" onClick={onCookstove} />
      <SquallsActionCard emoji="🛏️" label="Rest Up" accent="purple" onClick={onRest} />
      <SquallsActionCard emoji="⛵" label="Set Sail" accent="blue" onClick={onSail} />
    </HomeActionGrid>
  );
}
