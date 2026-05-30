import { Box, Heading, HStack, Text, VStack } from "@chakra-ui/react";

import SquallsActionCard from "./SquallsActionCard";

type Props = {
  onBack: () => void;
};

export default function ShipwrightView({ onBack }: Props) {
  return (
    <VStack align="stretch" gap={4} w="100%">
      <HStack w="100%" justify="space-between" align="flex-start" gap={2}>
        <VStack align="start" flex={1} minW={0} gap={1}>
          <Heading w="100%">🚢 Shipwright</Heading>
          <Text fontSize="sm" color="gray.900">
            Ship upgrades and hull fittings — coming soon.
          </Text>
        </VStack>
        <Box flexShrink={0} w="7rem">
          <SquallsActionCard
            emoji="⚓"
            label="Back to Port"
            accent="blue"
            compact
            onClick={onBack}
          />
        </Box>
      </HStack>
    </VStack>
  );
}
