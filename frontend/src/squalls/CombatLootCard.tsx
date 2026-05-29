import { Text, chakra } from "@chakra-ui/react";

import { ITEM_DEFINITIONS } from "./shantiesItems";
import { EQUIPMENT_DEFINITIONS } from "./shantiesEquipment";
import type { CombatLootItem } from "./shantiesTypes";

const LootButton = chakra("button");

type Props = {
  item: CombatLootItem;
  onClaim: () => void;
};

export default function CombatLootCard({ item, onClaim }: Props) {
  const isGold = item.kind === "gold";
  const isItem = item.kind === "item";
  const isEquipment = item.kind === "equipment";
  const label = isGold ? "Gold" : isEquipment ? "Relic" : isItem ? "Item" : "XP";
  const emoji = isGold
    ? "🪙"
    : isEquipment && item.equipmentId
      ? EQUIPMENT_DEFINITIONS[item.equipmentId].emoji
      : isItem && item.itemId
        ? ITEM_DEFINITIONS[item.itemId].emoji
        : "✨";
  const borderColor = item.claimed
    ? "gray.400"
    : isGold
      ? "yellow.600"
      : isEquipment
        ? "purple.500"
        : isItem
          ? "teal.500"
          : "purple.500";
  const amountLabel = isEquipment
    ? item.equipmentId
      ? EQUIPMENT_DEFINITIONS[item.equipmentId].name
      : "Equipment"
    : isItem
      ? item.itemId
        ? ITEM_DEFINITIONS[item.itemId].name
        : "Item"
      : `+${item.amount}`;

  return (
    <LootButton
      type="button"
      disabled={item.claimed}
      onClick={onClaim}
      w="100%"
      h="100%"
      minH={0}
      p={2}
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={1}
      borderRadius="md"
      borderWidth="2px"
      borderColor={borderColor}
      bg={item.claimed ? "blackAlpha.100" : "white"}
      color="gray.900"
      opacity={item.claimed ? 0.45 : 1}
      cursor={item.claimed ? "default" : "pointer"}
      boxShadow={item.claimed ? "none" : "sm"}
      transition="transform 0.12s ease, box-shadow 0.12s ease"
      _hover={
        item.claimed
          ? undefined
          : {
              transform: "translateY(-2px)",
              boxShadow: "md",
            }
      }
      _disabled={{ pointerEvents: "none" }}
    >
      <Text fontSize="lg" lineHeight={1}>
        {emoji}
      </Text>
      <Text fontSize="xs" fontWeight="bold" textTransform="uppercase">
        {label}
      </Text>
      <Text fontSize="sm" fontWeight="bold" textAlign="center" lineClamp={2} px={1}>
        {amountLabel}
      </Text>
      {isItem && item.amount > 1 ? (
        <Text fontSize="sm" fontWeight="bold" color="gray.900">
          ×{item.amount}
        </Text>
      ) : null}
      {item.claimed ? (
        <Text fontSize="2xs" color="gray.900">
          Claimed
        </Text>
      ) : (
        <Text fontSize="2xs" color="gray.900">
          Tap to claim
        </Text>
      )}
    </LootButton>
  );
}
