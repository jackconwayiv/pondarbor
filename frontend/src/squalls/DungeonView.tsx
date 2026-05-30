import {
  SquallsActionOption,
  SquallsActionSection,
  SquallsActionSheet,
} from "./SquallsActionSheet";

type Props = {
  delvePoints: number;
  onDelve: () => void;
  onReturn: () => void;
  returnLabel: string;
  returnEmoji?: string;
};

export default function DungeonView({
  delvePoints,
  onDelve,
  onReturn,
  returnLabel,
  returnEmoji = "🏝️",
}: Props) {
  const canDelve = delvePoints > 0;

  return (
    <SquallsActionSheet>
      <SquallsActionSection label="Explore And Advance">
        <SquallsActionOption
          emoji="⛏️"
          title={`Delve deeper (${delvePoints})`}
          detail="Press onward through shadows in search of hidden spoils."
          tone="risk"
          disabled={!canDelve}
          onClick={onDelve}
        />
      </SquallsActionSection>
      <SquallsActionSection label="Retreat And Return">
        <SquallsActionOption
          emoji={returnEmoji}
          title={returnLabel}
          detail="Withdraw from the depths while ye still can."
          tone="retreat"
          onClick={onReturn}
        />
      </SquallsActionSection>
    </SquallsActionSheet>
  );
}
