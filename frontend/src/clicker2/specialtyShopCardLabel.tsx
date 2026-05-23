import { Text } from "@chakra-ui/react";

/**
 * Evolution shop captions inside the card, below the emoji. Set to false (or delete
 * this file and remove imports from SpecialtyShopGrid) to revert to emoji-only cards.
 */
export const SHOW_SPECIALTY_SHOP_CARD_LABELS = true;

export function SpecialtyShopCardLabel({
  name,
  muted,
}: {
  name: string;
  muted?: boolean;
}) {
  return (
    <Text
      fontSize="2xs"
      lineHeight="1.15"
      textAlign="center"
      w="full"
      px="0.5"
      pb="0.5"
      flexShrink={0}
      color={muted ? "gray.500" : "gray.800"}
      lineClamp={2}
      aria-hidden
    >
      {name}
    </Text>
  );
}
