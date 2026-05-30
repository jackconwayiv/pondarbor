import { Box, SimpleGrid, Text, VStack } from "@chakra-ui/react";

import { SquallsHeading } from "./SquallsHeading";

import { getDungeonKindEmoji, isDungeonDiscoveryEvent } from "./dungeonExplore";
import SquallsActionCard from "./SquallsActionCard";
import type { ExploreTestContext, ExploreTestOption } from "./exploreTestPicker";
import { exploreTestContextTitle } from "./exploreTestPicker";

type Props = {
  context: ExploreTestContext;
  options: ExploreTestOption[];
  onSelect: (optionId: string) => void;
  onCancel: () => void;
};

function optionEmoji(option: ExploreTestOption): string {
  if (option.forceCombat) return "⚔️";
  const event = option.event;
  if (!event) return "🎯";
  if (isDungeonDiscoveryEvent(event) && event.dungeonKind) {
    return getDungeonKindEmoji(event.dungeonKind);
  }
  switch (event.type) {
    case "combat":
      return "⚔️";
    case "discovery":
      return "🏝️";
    case "port":
      return "⚓";
    case "merchant":
      return "🛶";
    case "shipwreck":
      return "⛵";
    case "weather":
      return "⛈️";
    case "treasure":
      return "💰";
    case "cookstove":
      return "🍳";
    default:
      return "🎯";
  }
}

function optionSubtext(option: ExploreTestOption): string {
  return `${option.detail} · ${option.probabilityLabel}`;
}

export default function ExploreTestPickerView({
  context,
  options,
  onSelect,
  onCancel,
}: Props) {
  return (
    <VStack align="stretch" gap={4} w="100%">
      <Box>
        <SquallsHeading size="md" color="gray.900">
          {exploreTestContextTitle(context)}
        </SquallsHeading>
        <Text fontSize="sm" color="gray.900" mt={1}>
          Placeholder test menu — pick an outcome to trigger it directly.
        </Text>
      </Box>

      <SimpleGrid columns={2} gap={2} w="100%">
        {options.map((option) => (
          <SquallsActionCard
            key={option.id}
            emoji={optionEmoji(option)}
            label={option.label}
            subtext={optionSubtext(option)}
            accent="teal"
            compact
            onClick={() => onSelect(option.id)}
          />
        ))}
        <Box gridColumn="1 / -1" maxW="10rem">
          <SquallsActionCard
            emoji="↩️"
            label="Cancel"
            accent="gray"
            compact
            onClick={onCancel}
          />
        </Box>
      </SimpleGrid>
    </VStack>
  );
}
