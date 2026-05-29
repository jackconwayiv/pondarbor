import { Box, SimpleGrid, Text, VStack } from "@chakra-ui/react";

import {
  BUFF_ON_TOP_START_CHANCE,
  createEnemyActionDeckForMonster,
  deckHasBuffAction,
  formatEnemyActionDeckSummary,
  formatEnemyBroadcastLabel,
} from "../../enemyActions";
import { MONSTER_DROP_BY_NAME } from "../../monsterDrops";
import { MONSTER_TEMPLATES } from "../../monsters";
import { ITEM_DEFINITIONS } from "../../shantiesItems";
import {
  ENCOUNTER_GROUP_SIZES,
  ENCOUNTER_POOL_LABELS,
  ENCOUNTER_POOLS,
  ENEMY_ACTION_DESCRIPTIONS,
} from "../squallsDmCatalog";
import { DmPanelIntro, DmSectionHeading, DmStatRow } from "./DmStatRow";

function actionDeckSummary(): string {
  return formatEnemyActionDeckSummary(createEnemyActionDeckForMonster("Harpy"));
}

export default function DmMonstersPanel() {
  const monsters = Object.entries(MONSTER_TEMPLATES);

  return (
    <VStack align="stretch" gap={5}>
      <DmPanelIntro>
        Monster templates, encounter placement, drops, and the shared enemy action deck.
      </DmPanelIntro>

      <Box>
        <DmSectionHeading>Encounter pools</DmSectionHeading>
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap={3} mt={2}>
          {(Object.keys(ENCOUNTER_POOLS) as Array<keyof typeof ENCOUNTER_POOLS>).map(
            (key) => (
              <Box
                key={key}
                p={3}
                borderWidth="1px"
                borderColor="blackAlpha.200"
                borderRadius="md"
                bg="blackAlpha.50"
              >
                <Text fontSize="sm" fontWeight="bold" color="gray.900">
                  {ENCOUNTER_POOL_LABELS[key]}
                </Text>
                <Text fontSize="sm" color="gray.900" mt={1}>
                  {ENCOUNTER_POOLS[key].join(", ")}
                </Text>
                <Text fontSize="xs" color="gray.900" mt={1}>
                  1–2 types per fight; per type:{" "}
                  {ENCOUNTER_POOLS[key]
                    .map((name) => `${name} × ${ENCOUNTER_GROUP_SIZES[name] ?? "?"}`)
                    .join("; ")}
                </Text>
              </Box>
            ),
          )}
        </SimpleGrid>
      </Box>

      <Box>
        <DmSectionHeading>Default action deck (Harpy / Siren)</DmSectionHeading>
        <Text fontSize="sm" color="gray.900" mt={1}>
          Composition: {actionDeckSummary()}. Shuffled per enemy at combat start; one action
          per turn with telegraphed broadcast. Enemies with a buff card have a{" "}
          {Math.round(BUFF_ON_TOP_START_CHANCE * 100)}% chance to start with buff on top.
        </Text>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={2} mt={2}>
          {ENEMY_ACTION_DESCRIPTIONS.map((row) => (
            <Box
              key={row.action}
              p={2}
              borderWidth="1px"
              borderColor="blackAlpha.200"
              borderRadius="md"
            >
              <Text fontSize="sm" fontWeight="semibold" color="gray.900">
                {row.action} → {row.broadcast}
              </Text>
              <Text fontSize="xs" color="gray.900">
                {row.effect}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
      </Box>

      <Box>
        <DmSectionHeading>Monster stats</DmSectionHeading>
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={3} mt={2}>
          {monsters.map(([name, template]) => {
            const drop = MONSTER_DROP_BY_NAME[name];
            const deck = createEnemyActionDeckForMonster(name);
            return (
              <Box
                key={name}
                p={3}
                borderWidth="1px"
                borderColor="blackAlpha.200"
                borderRadius="md"
                bg="white"
              >
                <Text fontSize="md" fontWeight="bold" color="gray.900">
                  {name}
                </Text>
                <SimpleGrid columns={2} gap={2} mt={2}>
                  <DmStatRow label="Level" value={String(template.level)} />
                  <DmStatRow label="HP" value={String(template.hp)} />
                  <DmStatRow
                    label="Start armor"
                    value={String(template.armor ?? 0)}
                  />
                  <DmStatRow label="Gold" value="Ld4 (level) per kill" />
                  <DmStatRow label="XP" value={`${template.level} per kill`} />
                  <DmStatRow
                    label="Group size"
                    value={ENCOUNTER_GROUP_SIZES[name] ?? "—"}
                  />
                </SimpleGrid>
                {template.traits && template.traits.length > 0 ? (
                  <Text fontSize="xs" color="gray.900" mt={2}>
                    Traits: {template.traits.join(", ")}
                    {name !== "Electric Eel" ? " (stacks with Evade)" : ""}
                  </Text>
                ) : name === "Electric Eel" ? (
                  <Text fontSize="xs" color="gray.900" mt={2}>
                    Traits: Shocking via Electrify action
                  </Text>
                ) : (
                  <Text fontSize="xs" color="gray.900" mt={2}>
                    Traits: none
                  </Text>
                )}
                {name === "Electric Eel" ? (
                  <Text fontSize="xs" color="gray.900" mt={1}>
                    Action deck: {formatEnemyActionDeckSummary(deck)} (Electrify replaces Evade)
                  </Text>
                ) : (
                  <Text fontSize="xs" color="gray.900" mt={1}>
                    Action deck: {formatEnemyActionDeckSummary(deck)}
                    {deckHasBuffAction(deck)
                      ? `; ${Math.round(BUFF_ON_TOP_START_CHANCE * 100)}% buff on top at start`
                      : ""}
                  </Text>
                )}
                {drop ? (
                  <Text fontSize="xs" color="gray.900" mt={1}>
                    Drop: {ITEM_DEFINITIONS[drop.itemId].emoji}{" "}
                    {ITEM_DEFINITIONS[drop.itemId].name} ({Math.round(drop.dropRate * 100)}%)
                  </Text>
                ) : (
                  <Text fontSize="xs" color="gray.900" mt={1}>
                    Drop: none
                  </Text>
                )}
              </Box>
            );
          })}
        </SimpleGrid>
      </Box>

      <Box>
        <DmSectionHeading>Broadcast labels</DmSectionHeading>
        <Text fontSize="sm" color="gray.900" mt={1}>
          Attack, Defend, {formatEnemyBroadcastLabel("buff")},{" "}
          {formatEnemyBroadcastLabel("debuff")} shown during the player turn.
        </Text>
      </Box>
    </VStack>
  );
}
