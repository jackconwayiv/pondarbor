import { Badge, Box, HStack, SimpleGrid, Text, VStack } from "@chakra-ui/react";

import {
  EQUIPMENT_DEFINITIONS,
  EQUIPMENT_SLOTS,
  EQUIPMENT_SLOT_LABELS,
} from "../../shantiesEquipment";
import type { EquipmentId } from "../../shantiesTypes";
import { SQUALLS_HUD_COLORS } from "../../squallsTheme";
import { DM_PANEL_CARD_PROPS, DmPanelIntro, DmSectionHeading } from "./DmStatRow";

function EquipmentReferenceCard({ equipmentId }: { equipmentId: EquipmentId }) {
  const def = EQUIPMENT_DEFINITIONS[equipmentId];
  return (
    <Box
      {...DM_PANEL_CARD_PROPS}
      borderRadius="lg"
      borderWidth="2px"
      borderColor="rgba(109, 79, 142, 0.8)"
      color={SQUALLS_HUD_COLORS.panelText}
      minH="8rem"
    >
      <Text fontSize="2xl" textAlign="center">
        {def.emoji}
      </Text>
      <Text fontSize="sm" fontWeight="bold" textAlign="center" mt={1}>
        {def.name}
      </Text>
      <Text fontSize="xs" color={SQUALLS_HUD_COLORS.panelMuted} textAlign="center" mt={1}>
        {EQUIPMENT_SLOT_LABELS[def.slot]}
      </Text>
      {def.combat ? (
        <Text fontSize="xs" color={SQUALLS_HUD_COLORS.panelMuted} textAlign="center" mt={1}>
          {def.combat.min}–{def.combat.max}
          {def.slot === "armor" ? " armor" : " damage"}
        </Text>
      ) : null}
      <HStack gap={1} flexWrap="wrap" justify="center" mt={2}>
        {(def.tags ?? []).map((tag) => (
          <Badge
            key={tag}
            size="sm"
            variant="solid"
            bg="rgba(58, 39, 21, 0.66)"
            color="gray.50"
            fontSize="2xs"
          >
            {tag}
          </Badge>
        ))}
      </HStack>
      <Text fontSize="2xs" color={SQUALLS_HUD_COLORS.panelMuted} mt={2} lineClamp={3}>
        {def.description}
      </Text>
      {def.shopPrice !== undefined ? (
        <Text fontSize="2xs" color={SQUALLS_HUD_COLORS.panelSubtle} mt={1}>
          Shop ref: {def.shopPrice}g
        </Text>
      ) : null}
    </Box>
  );
}

export default function DmEquipmentPanel() {
  return (
    <VStack align="stretch" gap={5}>
      <DmPanelIntro>
        Gear definitions drive combat card damage and armor ranges when equipped.
      </DmPanelIntro>

      {EQUIPMENT_SLOTS.map((slot) => {
        const items = (Object.keys(EQUIPMENT_DEFINITIONS) as EquipmentId[]).filter(
          (id) => EQUIPMENT_DEFINITIONS[id].slot === slot,
        );
        return (
          <Box key={slot}>
            <DmSectionHeading>{EQUIPMENT_SLOT_LABELS[slot]}</DmSectionHeading>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={3} mt={2}>
              {items.map((id) => (
                <EquipmentReferenceCard key={id} equipmentId={id} />
              ))}
            </SimpleGrid>
          </Box>
        );
      })}
    </VStack>
  );
}
