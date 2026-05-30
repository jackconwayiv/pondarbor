import SquallsActionCard, { type SquallsActionAccent } from "./SquallsActionCard";
import { EQUIPMENT_DEFINITIONS } from "./shantiesEquipment";
import { ITEM_DEFINITIONS } from "./shantiesItems";
import type { CombatLootItem } from "./shantiesTypes";

type Props = {
  item: CombatLootItem;
  onClaim: () => void;
};

function lootAccent(item: CombatLootItem): SquallsActionAccent {
  if (item.kind === "gold") return "yellow";
  if (item.kind === "item") return "teal";
  if (item.kind === "equipment") return "purple";
  return "purple";
}

function lootEmoji(item: CombatLootItem): string {
  if (item.kind === "gold") return "🪙";
  if (item.kind === "xp") return "🥇";
  if (item.kind === "equipment" && item.equipmentId) {
    return EQUIPMENT_DEFINITIONS[item.equipmentId].emoji;
  }
  if (item.kind === "item" && item.itemId) {
    return ITEM_DEFINITIONS[item.itemId].emoji;
  }
  return "✨";
}

function lootLabel(item: CombatLootItem): string {
  if (item.kind === "gold") return `+${item.amount} Gold`;
  if (item.kind === "xp") return `+${item.amount} XP`;
  if (item.kind === "equipment" && item.equipmentId) {
    return EQUIPMENT_DEFINITIONS[item.equipmentId].name;
  }
  if (item.kind === "item" && item.itemId) {
    const name = ITEM_DEFINITIONS[item.itemId].name;
    return item.amount > 1 ? `${name} ×${item.amount}` : name;
  }
  return "Spoils";
}

export default function CombatLootCard({ item, onClaim }: Props) {
  return (
    <SquallsActionCard
      emoji={lootEmoji(item)}
      label={lootLabel(item)}
      subtext={item.claimed ? "Claimed" : "Tap to claim"}
      accent={lootAccent(item)}
      disabled={item.claimed}
      onClick={onClaim}
      compact
      centerContent
    />
  );
}
