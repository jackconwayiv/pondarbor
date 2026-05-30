import HomeActionGrid from "./HomeActionGrid";
import SquallsActionCard from "./SquallsActionCard";

type Props = {
  onShop: () => void;
  onShipwright: () => void;
  onTavern: () => void;
  onReturnToIsland: () => void;
};

export default function PortView({
  onShop,
  onShipwright,
  onTavern,
  onReturnToIsland,
}: Props) {
  return (
    <HomeActionGrid>
      <SquallsActionCard
        emoji="💰"
        label="Marketplace"
        accent="yellow"
        onClick={onShop}
      />
      <SquallsActionCard
        emoji="🚢"
        label="Shipwright"
        accent="purple"
        onClick={onShipwright}
      />
      <SquallsActionCard
        emoji="🃏"
        label="Tavern"
        accent="teal"
        onClick={onTavern}
      />
      <SquallsActionCard
        emoji="⛵"
        label="Return to Ship"
        accent="blue"
        onClick={onReturnToIsland}
      />
    </HomeActionGrid>
  );
}
