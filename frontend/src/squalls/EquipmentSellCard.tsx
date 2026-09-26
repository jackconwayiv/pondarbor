import { Button, Text, chakra } from "@chakra-ui/react";

import {
  EQUIPMENT_DEFINITIONS,
  LOOT_RARITY_BORDER,
  LOOT_RARITY_GLYPH,
} from "./shantiesEquipment";
import type { EquipmentId } from "./shantiesTypes";

const CardRoot = chakra("div");

type Props = {
  equipmentId: EquipmentId;
  sellLabel: string;
  onSell: () => void;
};

export default function EquipmentSellCard({
  equipmentId,
  sellLabel,
  onSell,
}: Props) {
  const def = EQUIPMENT_DEFINITIONS[equipmentId];

  return (
    <CardRoot
      w="100%"
      aspectRatio="1"
      minH="5.5rem"
      p={2}
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={1}
      borderRadius="lg"
      borderWidth="2px"
      borderColor={LOOT_RARITY_BORDER[def.rarity]}
      bg="white"
      color="gray.900"
      boxShadow="sm"
    >
      <Text fontSize="xl" lineHeight={1} aria-hidden>
        {def.emoji}
      </Text>
      <Text fontSize="xs" fontWeight="bold" textAlign="center" lineHeight="short" px={1}>
        {LOOT_RARITY_GLYPH[def.rarity]} {def.name}
      </Text>
      <Button size="2xs" colorPalette="orange" mt={0.5} onClick={onSell}>
        {sellLabel}
      </Button>
    </CardRoot>
  );
}
