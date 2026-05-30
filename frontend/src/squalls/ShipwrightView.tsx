import { HStack, Text, VStack } from "@chakra-ui/react";

import { SquallsHeading } from "./SquallsHeading";
import { SquallsPanelBackButton } from "./SquallsActionSheet";
import { SQUALLS_TEXT_ZONE, SQUALLS_WORLD_PANEL } from "./squallsTheme";

type Props = {
  onBack: () => void;
};

export default function ShipwrightView({ onBack }: Props) {
  return (
    <VStack align="stretch" gap={4} w="100%" {...SQUALLS_WORLD_PANEL} p={{ base: 3, md: 4 }}>
      <HStack w="100%" justify="space-between" align="flex-start" gap={3}>
        <VStack align="start" flex={1} minW={0} gap={1}>
          <SquallsHeading w="100%">Shipwright</SquallsHeading>
          <Text fontSize="sm" color={SQUALLS_TEXT_ZONE.muted}>
            Ship upgrades and hull fittings are coming soon.
          </Text>
        </VStack>
        <SquallsPanelBackButton label="Back to port" onClick={onBack} />
      </HStack>
    </VStack>
  );
}
