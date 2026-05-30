import { Box, SimpleGrid, Text, VStack } from "@chakra-ui/react";

import {
  ISLAND_TREASURE_LOCKED_CHANCE,
  SEA_TREASURE_LOCKED_CHANCE,
} from "../../dungeonTreasure";
import { getDungeonKindEmoji } from "../../dungeonExplore";
import { seaWeatherEffectLabel } from "../../seaWeather";
import {
  DUNGEON_DISCOVERY_NAMES,
  FLOATING_SUPPLY_POOL,
  ISLAND_DECK_RULES,
  ISLAND_DUNGEON_KINDS,
  ISLAND_EVENT_POOL_DISPLAY,
  ISLAND_TREASURE_POOL_DISPLAY,
  SEA_DECK_RULES,
  SEA_EVENT_POOL_DISPLAY,
  SEA_FIXED_EVENTS,
  SEA_PORT_RULES,
} from "../squallsDmCatalog";
import { DmPanelIntro, DmSectionHeading } from "./DmStatRow";

function EventList({
  events,
}: {
  events: readonly { name: string; type: string }[];
}) {
  return (
    <VStack align="stretch" gap={1} mt={2}>
      {events.map((event) => (
        <Text key={`${event.type}-${event.name}`} fontSize="sm" color="gray.900">
          {event.name}{" "}
          <Text as="span" fontSize="xs" color="gray.700">
            ({event.type})
          </Text>
        </Text>
      ))}
    </VStack>
  );
}

export default function DmEventsPanel() {
  return (
    <VStack align="stretch" gap={5}>
      <DmPanelIntro>
        Event template pools and deck-building rules. Decks are procedural — this shows
        templates and composition, not a live draw.
      </DmPanelIntro>

      <Box>
        <DmSectionHeading>Sea sailing</DmSectionHeading>
        <Text fontSize="sm" color="gray.900" mt={1}>
          {SEA_DECK_RULES}
        </Text>
        <Text fontSize="xs" fontWeight="semibold" color="gray.900" mt={2}>
          Fixed slots
        </Text>
        <EventList events={SEA_FIXED_EVENTS} />
        <Text fontSize="xs" fontWeight="semibold" color="gray.900" mt={2}>
          Random pool
        </Text>
        <EventList events={SEA_EVENT_POOL_DISPLAY} />
        <Text fontSize="xs" color="gray.900" mt={2}>
          Sea weather: Fog Bank {seaWeatherEffectLabel("Fog Bank")}; Storm!{" "}
          {seaWeatherEffectLabel("Storm!")}
        </Text>
        <Text fontSize="xs" color="gray.900" mt={1}>
          Sea treasure: {Math.round(SEA_TREASURE_LOCKED_CHANCE * 100)}% Floating Chest
          (locked), remainder Floating Supplies (unlocked)
        </Text>
        <Text fontSize="xs" color="gray.900" mt={1}>
          Port Town: {SEA_PORT_RULES}. Visiting port sets location to port (shop,
          shipwright, tavern).
        </Text>
      </Box>

      <Box>
        <DmSectionHeading>Island explore</DmSectionHeading>
        <SimpleGrid columns={{ base: 1, md: 3 }} gap={2} mt={2}>
          {(Object.keys(ISLAND_DECK_RULES) as Array<keyof typeof ISLAND_DECK_RULES>).map(
            (size) => (
              <Box
                key={size}
                p={2}
                borderWidth="1px"
                borderColor="blackAlpha.200"
                borderRadius="md"
              >
                <Text fontSize="sm" fontWeight="bold" color="gray.900">
                  {size}
                </Text>
                <Text fontSize="xs" color="gray.900">
                  {ISLAND_DECK_RULES[size]}
                </Text>
              </Box>
            ),
          )}
        </SimpleGrid>
        <Text fontSize="xs" fontWeight="semibold" color="gray.900" mt={2}>
          Event pool
        </Text>
        <EventList events={ISLAND_EVENT_POOL_DISPLAY} />
        <Text fontSize="xs" color="gray.900" mt={2}>
          Island treasure: {Math.round(ISLAND_TREASURE_LOCKED_CHANCE * 100)}% Buried Chest
          (locked), remainder Supply Cache (unlocked)
        </Text>
        <Text fontSize="xs" color="gray.900" mt={1}>
          Island treasure loot pool: {ISLAND_TREASURE_POOL_DISPLAY.join(", ")} (plus Ld4
          gold)
        </Text>
      </Box>

      <Box>
        <DmSectionHeading>Dungeon discovery (island)</DmSectionHeading>
        <VStack align="stretch" gap={1} mt={2}>
          {ISLAND_DUNGEON_KINDS.map((kind) => (
            <Text key={kind} fontSize="sm" color="gray.900">
              {getDungeonKindEmoji(kind)} {DUNGEON_DISCOVERY_NAMES[kind]} ({kind})
            </Text>
          ))}
        </VStack>
        <Text fontSize="xs" color="gray.900" mt={2}>
          Dungeon chests are always locked. Wreck dungeons use siren gills or dive helmet
          to enter from sea.
        </Text>
      </Box>

      <Box>
        <DmSectionHeading>Floating supplies loot pool</DmSectionHeading>
        <Text fontSize="sm" color="gray.900" mt={1}>
          {FLOATING_SUPPLY_POOL.join(", ")} — rolled 1d4 times per unlocked sea treasure;
          duplicate rolls for the same item are ignored
        </Text>
      </Box>
    </VStack>
  );
}
