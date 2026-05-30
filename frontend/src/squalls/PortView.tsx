import {
  SquallsActionOption,
  SquallsActionSection,
  SquallsActionSheet,
} from "./SquallsActionSheet";

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
    <SquallsActionSheet>
      <SquallsActionSection label="Supplies And Services">
        <SquallsActionOption
          emoji="💰"
          title="Browse the marketplace"
          detail="Resupply and prepare for the next leg of the voyage."
          tone="service"
          onClick={onShop}
        />
        <SquallsActionOption
          emoji="🚢"
          title="Consult the shipwright"
          detail="Inspect hull work, fittings, and future upgrades."
          tone="service"
          onClick={onShipwright}
        />
        <SquallsActionOption
          emoji="🃏"
          title="Enter the tavern"
          detail="Hire new tricks for the deck or refine yer tactics."
          tone="service"
          onClick={onTavern}
        />
      </SquallsActionSection>

      <SquallsActionSection label="Retreat And Return">
        <SquallsActionOption
          emoji="⛵"
          title="Return to ship"
          detail="Leave the stone harbor and rejoin the open sea."
          tone="retreat"
          onClick={onReturnToIsland}
        />
      </SquallsActionSection>
    </SquallsActionSheet>
  );
}
