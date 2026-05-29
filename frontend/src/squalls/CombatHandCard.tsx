import { Badge, Box, HStack, chakra, Text } from "@chakra-ui/react";

import { getCardBackground, getCardTags } from "./combatCardStyle";
import { getCardEffectText } from "./combatRules";
import type { CombatCard, EquippedGear } from "./shantiesTypes";

const CardButton = chakra("button");

type Props = {
  card: CombatCard;
  cost: number;
  equipped?: EquippedGear;
  layout?: "default" | "hand";
  selected?: boolean;
  disabled?: boolean;
  viewOnly?: boolean;
  /** Fill a fixed-aspect grid slot (size comes from the parent cell). */
  fillSlot?: boolean;
  /** Let a parent drag handle receive touches (attack cards). */
  dragPassthrough?: boolean;
  onClick: () => void;
};

export default function CombatHandCard({
  card,
  cost,
  equipped,
  layout = "default",
  selected = false,
  disabled = false,
  viewOnly = false,
  fillSlot = false,
  dragPassthrough = false,
  onClick,
}: Props) {
  const effectText = getCardEffectText(card, equipped);
  const isHandLayout = layout === "hand";
  const tags = getCardTags(card, equipped);
  const cardBg = getCardBackground(card);

  return (
    <CardButton
      type="button"
      disabled={!viewOnly && disabled}
      onClick={viewOnly ? undefined : onClick}
      aria-disabled={viewOnly || disabled}
      position={fillSlot ? "absolute" : "relative"}
      inset={fillSlot ? 0 : undefined}
      w="100%"
      maxW="100%"
      h={fillSlot ? "100%" : undefined}
      aspectRatio={fillSlot ? undefined : "2.5/3.5"}
      justifySelf="stretch"
      flexShrink={1}
      minW={0}
      borderRadius="md"
      borderWidth="2px"
      borderColor={selected ? "orange.500" : "gray.800"}
      bg={cardBg}
      color="gray.900"
      boxShadow={selected ? "0 0 0 2px var(--chakra-colors-orange-300)" : "sm"}
      opacity={!viewOnly && disabled ? 0.45 : 1}
      cursor={viewOnly ? "default" : disabled ? "not-allowed" : "pointer"}
      transition="transform 0.12s ease, box-shadow 0.12s ease"
      _hover={
        viewOnly || disabled
          ? undefined
          : {
              transform: "translateY(-3px)",
              boxShadow: "md",
            }
      }
      _disabled={{ pointerEvents: "none" }}
      pointerEvents={dragPassthrough ? "none" : undefined}
      tabIndex={dragPassthrough ? -1 : undefined}
      display="flex"
      flexDirection="column"
      overflow="hidden"
    >
      <Text
        position="absolute"
        top={isHandLayout ? "0.5" : "1"}
        right={isHandLayout ? "0.5" : "1"}
        fontSize={isHandLayout ? "2xs" : "xs"}
        fontWeight="bold"
        lineHeight="1"
        minW={isHandLayout ? "1rem" : "1.25rem"}
        textAlign="center"
        px={isHandLayout ? "0.5" : "1"}
        py={isHandLayout ? "0.5" : "0.5"}
        borderRadius="sm"
        bg="gray.900"
        color="white"
        zIndex={1}
      >
        {cost}
      </Text>

      <Box
        flex="1"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        px={isHandLayout ? "1" : "1.5"}
        pt={isHandLayout ? "4" : "6"}
        pb={isHandLayout ? "0.5" : "1"}
        minH={0}
        gap={0.5}
      >
        <Text
          fontSize={isHandLayout ? "2xs" : "xs"}
          fontWeight="bold"
          textTransform="uppercase"
          textAlign="center"
          lineClamp={isHandLayout ? 2 : 4}
          lineHeight="short"
        >
          {card.name}
        </Text>
        <Text
          w="100%"
          fontSize="2xs"
          fontWeight="normal"
          textAlign="center"
          lineClamp={isHandLayout ? 2 : 2}
          lineHeight="short"
          color="gray.900"
        >
          {effectText}
        </Text>
      </Box>

      <HStack
        gap={0.5}
        justify="center"
        flexWrap="wrap"
        px={1}
        pb={isHandLayout ? 1 : 1.5}
        pt={0}
        flexShrink={0}
      >
        {tags.map((tag) => (
          <Badge
            key={tag}
            size="sm"
            variant="subtle"
            colorPalette="gray"
            fontSize="2xs"
            textTransform="capitalize"
            px={1}
          >
            {tag}
          </Badge>
        ))}
      </HStack>
    </CardButton>
  );
}
