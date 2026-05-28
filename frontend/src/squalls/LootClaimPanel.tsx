import { Box, Button, Heading, HStack, Text, VStack } from "@chakra-ui/react";

import CombatLootCard from "./CombatLootCard";
import type { CombatLootItem } from "./shantiesTypes";

type Props = {
  title: string;
  loot: CombatLootItem[];
  allClaimed: boolean;
  returnLabel: string;
  onClaim: (lootId: string) => void;
  onComplete: () => void;
  subtitle?: string;
  fillHeight?: boolean;
  /** Return button on the same row as the title (title left, button right). */
  inlineReturnInHeader?: boolean;
};

export default function LootClaimPanel({
  title,
  loot,
  allClaimed,
  returnLabel,
  onClaim,
  onComplete,
  subtitle = "Claim yer spoils",
  fillHeight = false,
  inlineReturnInHeader = false,
}: Props) {
  const align = inlineReturnInHeader ? "stretch" : "center";
  const textAlign = inlineReturnInHeader ? "left" : "center";

  return (
    <VStack
      flex={fillHeight ? "1" : undefined}
      minH={fillHeight ? 0 : undefined}
      w="100%"
      justify="flex-start"
      align={align}
      gap={3}
      overflow={fillHeight ? "hidden" : undefined}
      py={fillHeight ? 0 : 2}
    >
      {inlineReturnInHeader ? (
        <HStack
          w="100%"
          justify="space-between"
          align="center"
          gap={2}
          flexShrink={0}
        >
          <Heading size="md" textAlign="left" flex={1} minW={0}>
            {title}
          </Heading>
          {allClaimed ? (
            <Button
              colorPalette="orange"
              flexShrink={0}
              size="sm"
              onClick={onComplete}
            >
              {returnLabel}
            </Button>
          ) : null}
        </HStack>
      ) : (
        <Heading size="md" textAlign={textAlign} flexShrink={0}>
          {title}
        </Heading>
      )}
      {loot.length > 0 ? (
        <Text
          fontSize="xs"
          color="fg.muted"
          textAlign={textAlign}
          flexShrink={0}
          w="100%"
        >
          {subtitle}
        </Text>
      ) : null}
      <Box
        flex={fillHeight ? "1" : undefined}
        minH={fillHeight ? 0 : undefined}
        w="100%"
        maxW="28rem"
        overflowY="auto"
        display="grid"
        gridTemplateColumns="repeat(3, minmax(0, 1fr))"
        gridAutoRows="minmax(5.5rem, auto)"
        gap={1.5}
        alignContent="start"
        px={1}
      >
        {loot.map((item) => (
          <Box key={item.id} minH="5.5rem" h="100%">
            <CombatLootCard item={item} onClaim={() => onClaim(item.id)} />
          </Box>
        ))}
      </Box>
      {allClaimed && !inlineReturnInHeader ? (
        <Button
          colorPalette="orange"
          flexShrink={0}
          w="100%"
          maxW="20rem"
          onClick={onComplete}
        >
          {returnLabel}
        </Button>
      ) : null}
    </VStack>
  );
}
