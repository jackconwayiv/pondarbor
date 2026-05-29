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
};

export default function ShipView({
  onShop,
  onRest,
  onSail,
  onIsland,
  islandExplorePoints,
  onEnterWreck,
  wreckDelvePoints,
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
      <SquallsActionCard emoji="💰" label="Barter" accent="yellow" onClick={onShop} />
      <SquallsActionCard emoji="🛏️" label="Rest Up" accent="purple" onClick={onRest} />
      <SquallsActionCard emoji="⛵" label="Set Sail" accent="blue" onClick={onSail} />
    </HomeActionGrid>
  );
}
