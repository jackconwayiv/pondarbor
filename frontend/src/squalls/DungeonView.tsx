import HomeActionGrid from "./HomeActionGrid";
import SquallsActionCard from "./SquallsActionCard";

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
    <HomeActionGrid>
      {canDelve ? (
        <SquallsActionCard
          emoji="⛏️"
          label={`Delve (${delvePoints})`}
          accent="teal"
          onClick={onDelve}
        />
      ) : null}
      <SquallsActionCard
        emoji={returnEmoji}
        label={returnLabel}
        accent="blue"
        onClick={onReturn}
      />
    </HomeActionGrid>
  );
}
