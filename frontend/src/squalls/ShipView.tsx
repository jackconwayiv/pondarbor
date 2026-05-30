import {
  SquallsActionOption,
  SquallsActionSection,
  SquallsActionSheet,
} from "./SquallsActionSheet";

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
    <SquallsActionSheet>
      <SquallsActionSection label="Explore And Advance">
        <SquallsActionOption
          emoji="⛵"
          title="Set sail for open water"
          detail="Push onward and face whatever the sea reveals."
          tone="explore"
          onClick={onSail}
        />
        {onIsland ? (
          <SquallsActionOption
            emoji="🏝️"
            title={`Head ashore (${islandExplorePoints ?? 0} explores)`}
            detail="Scout the island for treasure, danger, or opportunities."
            tone="explore"
            onClick={onIsland}
          />
        ) : null}
        {onEnterWreck && (wreckDelvePoints ?? 0) > 0 ? (
          <SquallsActionOption
            emoji="⛵"
            title={`Enter the wreck (${wreckDelvePoints} delves)`}
            detail="Descend into the flooded hull in search of valuables."
            tone="risk"
            onClick={onEnterWreck}
          />
        ) : null}
      </SquallsActionSection>

      <SquallsActionSection label="Supplies And Services">
        <SquallsActionOption
          emoji="💰"
          title="Visit ship provisions"
          detail="Trade gold for supplies before the next encounter."
          tone="service"
          onClick={onShop}
        />
        <SquallsActionOption
          emoji="🍳"
          title="Work the cookstove"
          detail="Turn raw catch into food if ye have timber to burn."
          tone="service"
          onClick={onCookstove}
        />
        <SquallsActionOption
          emoji="🛏️"
          title="Take rest below deck"
          detail="Recover before ye tempt the tides again."
          tone="service"
          onClick={onRest}
        />
      </SquallsActionSection>

      {onReturnToPort ? (
        <SquallsActionSection label="Retreat And Return">
          <SquallsActionOption
            emoji="⚓"
            title="Return to port town"
            detail="Stand down from exploration and dock in safer waters."
            tone="retreat"
            onClick={onReturnToPort}
          />
        </SquallsActionSection>
      ) : null}
    </SquallsActionSheet>
  );
}
