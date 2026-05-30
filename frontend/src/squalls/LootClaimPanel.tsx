import { Box, HStack, SimpleGrid, Text, VStack } from "@chakra-ui/react";

import { SquallsHeading } from "./SquallsHeading";
import {
  SquallsActionSheet,
  SquallsPanelBackButton,
  SquallsTextZone,
} from "./SquallsActionSheet";
import { SQUALLS_TEXT_ZONE } from "./squallsTheme";
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
  intro?: string;
  fillHeight?: boolean;
  /** Return button on the same row as the title (title left, button right). */
  inlineReturnInHeader?: boolean;
  titleSize?: "md" | "lg" | "xl" | "2xl";
};

export default function LootClaimPanel({
  title,
  loot,
  allClaimed,
  returnLabel,
  onClaim,
  onComplete,
  subtitle = "Claim yer spoils",
  intro,
  fillHeight = false,
  inlineReturnInHeader = false,
  titleSize = "md",
}: Props) {
  return (
    <VStack
      flex={fillHeight ? "1" : undefined}
      minH={fillHeight ? 0 : undefined}
      w="100%"
      align="stretch"
      gap={3}
      overflow={fillHeight ? "hidden" : undefined}
      py={fillHeight ? 0 : 2}
    >
      <HStack
        w="100%"
        justify="space-between"
        align="center"
        gap={2}
        flexShrink={0}
      >
        <SquallsHeading size={titleSize} textAlign="left" flex={1} minW={0}>
          {title}
        </SquallsHeading>
        {allClaimed && inlineReturnInHeader ? (
          <SquallsPanelBackButton
            label={returnLabel}
            onClick={onComplete}
            tone="explore"
          />
        ) : null}
      </HStack>

      {intro ? (
        <SquallsTextZone flexShrink={0}>
          <Text fontSize="sm" lineHeight="snug">
            {intro}
          </Text>
        </SquallsTextZone>
      ) : null}

      {loot.length > 0 ? (
        <Box
          flex={fillHeight ? "1" : undefined}
          minH={fillHeight ? 0 : undefined}
          w="100%"
          overflowY={fillHeight ? "auto" : undefined}
        >
          <SquallsActionSheet title={subtitle} variant="white">
            <SimpleGrid columns={3} gap={1.5} w="100%">
              {loot.map((item) => (
                <CombatLootCard
                  key={item.id}
                  item={item}
                  onClaim={() => onClaim(item.id)}
                />
              ))}
            </SimpleGrid>
          </SquallsActionSheet>
        </Box>
      ) : (
        <SquallsTextZone flexShrink={0}>
          <Text fontSize="sm" color={SQUALLS_TEXT_ZONE.muted}>
            No spoils to claim.
          </Text>
        </SquallsTextZone>
      )}

      {allClaimed && !inlineReturnInHeader ? (
        <SquallsPanelBackButton
          label={returnLabel}
          onClick={onComplete}
          tone="explore"
        />
      ) : null}
    </VStack>
  );
}
