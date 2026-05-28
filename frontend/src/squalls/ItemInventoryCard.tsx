import { Button, Text, chakra } from "@chakra-ui/react";

import { ITEM_DEFINITIONS } from "./shantiesItems";
import type { ItemId } from "./shantiesTypes";

const CardRoot = chakra("div");

type Props = {
  itemId: ItemId;
  count: number;
  /** How to show count under the name (default ×N). */
  countFormat?: "times" | "owned";
  showUse?: boolean;
  /** Button label when showUse (default "Use"). */
  useLabel?: string;
  /** Shown on the Use button during combat (e.g. energy cost). */
  useEnergyCost?: number | null;
  useDisabled?: boolean;
  onUse?: () => void;
};

export default function ItemInventoryCard({
  itemId,
  count,
  countFormat = "times",
  showUse = false,
  useLabel = "Use",
  useEnergyCost = null,
  useDisabled = false,
  onUse,
}: Props) {
  const def = ITEM_DEFINITIONS[itemId];

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
      borderColor="teal.500"
      bg="white"
      color="gray.900"
      boxShadow="sm"
    >
      <Text fontSize="xl" lineHeight={1} aria-hidden>
        {def.emoji}
      </Text>
      <Text fontSize="xs" fontWeight="bold" textAlign="center" lineHeight="short" px={1}>
        {def.name}
      </Text>
      <Text fontSize="xs" color="gray.600">
        {countFormat === "owned" ? `owned: ${count}` : `×${count}`}
      </Text>
      {showUse && onUse ? (
        <Button
          size="2xs"
          colorPalette="teal"
          mt={0.5}
          disabled={useDisabled}
          onClick={onUse}
        >
          {useEnergyCost != null ? `Use (${useEnergyCost}⚡)` : useLabel}
        </Button>
      ) : null}
    </CardRoot>
  );
}
