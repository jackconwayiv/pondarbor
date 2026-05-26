import {
  Box,
  Flex,
  Grid,
  Stack,
  Tabs,
  Text,
  TooltipContent,
  TooltipPositioner,
  TooltipRoot,
  TooltipTrigger,
} from "@chakra-ui/react";
import { useState, type ReactNode } from "react";

import {
  ecologyTooltipRootBaseProps,
  ecologyTooltipSurfaceProps,
} from "../clicker/ecologyUi.constants";
import { AppModal } from "../components/AppModal";
import {
  APP_SHELL_TAB_LIST_NESTED_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import { HIDE_SCROLLBAR_CSS } from "../theme/typography";
import { DESIGN } from "../theme/tokens";

import { evolutionDisplayEmoji } from "./clicker2OwnedEvolutions";
import { EVOLUTIONS_LABEL, MILESTONES_LABEL, MUTAGENS_LABEL } from "./clicker2Copy";
import { EvolutionTooltipContent } from "./EvolutionTooltipContent";
import { ENERGY_EMOJI, formatEnergyAmount, formatEnergyRate } from "./formatEnergy";
import { formatPondAgeAgo } from "./formatPondAge";
import {
  compareMilestoneReachedTimes,
  getMilestoneDef,
  milestoneDisplayEmoji,
} from "./milestones";
import type { SpecialtyDef } from "./specialties";

function StatsRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Flex justify="space-between" align="flex-start" gap="4" fontSize="sm" lineHeight="1.4">
      <Text color="gray.600" flexShrink={0}>
        {label}
      </Text>
      <Text
        fontWeight="medium"
        fontVariantNumeric="tabular-nums"
        textAlign="right"
        flex="1"
        minW="0"
      >
        {value}
      </Text>
    </Flex>
  );
}

export type Clicker2StatsSnapshot = {
  energyInPond: number;
  /** 1-based; era 2+ shows per-era and all-time energy totals. */
  pondEra: number;
  eraEnergyEarned: number;
  allTimeEnergyEarned: number;
  pondStartedAtMs: number;
  denizensOwned: number;
  evolutionsOwned: number;
  ownedEvolutionDefs: readonly SpecialtyDef[];
  milestonesReached: number;
  blossoms: number;
  milestoneStatuses: Array<{
    id: string;
    title: string;
    description: string;
    criteriaText: string;
    reachedAtMs: number | null;
  }>;
  energyPerSecond: number;
  energyPerClick: number;
  /** Ripples passive EpS only (`denizenEps.ripples`); does not match total pond EpS or click-linked term. */
  ripplesPassiveEps: number;
  /** Matches `simulateGame`; rain multiplies HUD click but not passive EpS. */
  energyPerClickSurfaceRingsBaseline: number;
  energyPerClickFromReflections: number;
  totalClicks: number;
  energyFromClicking: number;
  weatherEventsClicked: number;
  totalMutagensAcquired: number;
  /** Wall-clock epoch ms when the snapshot was taken (for pond age). */
  capturedAtWallMs: number;
};

function energyAmount(value: number): ReactNode {
  return `${formatEnergyAmount(value)} ${ENERGY_EMOJI}`;
}

function EvolutionOwnedRow({ def }: { def: SpecialtyDef }) {
  const emoji = evolutionDisplayEmoji(def);

  return (
    <TooltipRoot {...ecologyTooltipRootBaseProps} openDelay={300}>
      <TooltipTrigger asChild>
        <Flex
          gap="1.5"
          align="center"
          fontSize="sm"
          lineHeight="1.35"
          minW="0"
          w="full"
          cursor="default"
        >
          <Text lineHeight="1.2" aria-hidden flexShrink={0}>
            {emoji}
          </Text>
          <Text fontWeight="medium" lineHeight="1.3" truncate>
            {def.name}
          </Text>
        </Flex>
      </TooltipTrigger>
      <TooltipPositioner>
        <TooltipContent {...ecologyTooltipSurfaceProps} maxW="300px">
          <EvolutionTooltipContent def={def} owned />
        </TooltipContent>
      </TooltipPositioner>
    </TooltipRoot>
  );
}

function MilestoneStatusRow({
  id,
  title,
  description,
  criteriaText,
  reachedAtMs,
}: {
  id: string;
  title: string;
  description: string;
  criteriaText: string;
  reachedAtMs: number | null;
}) {
  const reached = reachedAtMs != null;
  const def = getMilestoneDef(id);
  const emoji = def ? milestoneDisplayEmoji(def) : undefined;

  return (
    <Box
      borderWidth="1px"
      borderColor={reached ? DESIGN.nautical : "border"}
      borderRadius="md"
      bg={reached ? "orange.50" : "bg.subtle"}
      px="2"
      py="1.5"
    >
      <Flex justify="space-between" align="flex-start" gap="2">
        <Stack gap="0.5" flex="1" minW="0">
          <Flex gap="1.5" align="center" minW="0">
            {emoji ? (
              <Text fontSize="sm" lineHeight="1" aria-hidden flexShrink={0}>
                {emoji}
              </Text>
            ) : null}
            <Text fontSize="sm" fontWeight="semibold" lineHeight="1.3" minW="0">
              {reached ? "✓ " : ""}
              {title}
            </Text>
          </Flex>
          <Text fontSize="xs" color="gray.600" lineHeight="1.35">
            {reached ? description : criteriaText}
          </Text>
        </Stack>
      </Flex>
    </Box>
  );
}

function EvolutionsOwnedPanel({
  ownedEvolutionDefs,
}: {
  ownedEvolutionDefs: readonly SpecialtyDef[];
}) {
  return (
    <Box
      maxH="10rem"
      overflowY="auto"
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
      bg="bg.subtle"
      px="2"
      py="1.5"
    >
      <Grid templateColumns="repeat(2, minmax(0, 1fr))" gap="1.5">
        {ownedEvolutionDefs.map((def) => (
          <EvolutionOwnedRow key={def.id} def={def} />
        ))}
      </Grid>
    </Box>
  );
}

function MilestonesStatusPanel({
  milestoneStatuses,
}: {
  milestoneStatuses: Clicker2StatsSnapshot["milestoneStatuses"];
}) {
  const earned = milestoneStatuses
    .filter((m): m is typeof m & { reachedAtMs: number } => m.reachedAtMs != null)
    .sort(compareMilestoneReachedTimes);

  return (
    <Stack
      gap="1.5"
      maxH="14rem"
      overflowY="auto"
      css={{ ...HIDE_SCROLLBAR_CSS, WebkitOverflowScrolling: "touch" }}
    >
      {earned.map((m) => (
        <MilestoneStatusRow key={m.id} {...m} />
      ))}
    </Stack>
  );
}

function statsCatalogTabLabel(base: string, count: number): string {
  return `${base} (${count.toLocaleString()})`;
}

function StatsCatalogTabs({
  evolutionsOwned,
  milestonesReached,
  ownedEvolutionDefs,
  milestoneStatuses,
}: {
  evolutionsOwned: number;
  milestonesReached: number;
  ownedEvolutionDefs: readonly SpecialtyDef[];
  milestoneStatuses: Clicker2StatsSnapshot["milestoneStatuses"];
}) {
  const showEvolutions = evolutionsOwned > 0;
  const showMilestones = milestonesReached > 0;
  const [tab, setTab] = useState("evolutions");

  if (!showEvolutions && !showMilestones) return null;

  const evolutionsTabLabel = statsCatalogTabLabel(
    `${EVOLUTIONS_LABEL} acquired`,
    evolutionsOwned,
  );
  const milestonesTabLabel = statsCatalogTabLabel(
    `${MILESTONES_LABEL} reached`,
    milestonesReached,
  );

  const activeTab =
    showEvolutions && showMilestones
      ? tab
      : showEvolutions
        ? "evolutions"
        : "milestones";

  const panel =
    activeTab === "evolutions" ? (
      <EvolutionsOwnedPanel ownedEvolutionDefs={ownedEvolutionDefs} />
    ) : (
      <MilestonesStatusPanel milestoneStatuses={milestoneStatuses} />
    );

  return (
    <Stack
      gap="2"
      pt="2"
      mt="0.5"
      borderTopWidth="1px"
      borderColor="border"
    >
      {showEvolutions && showMilestones ? (
        <Tabs.Root
          value={activeTab}
          variant="plain"
          w="100%"
          onValueChange={(details) => setTab(details.value)}
        >
          <Tabs.List {...APP_SHELL_TAB_LIST_NESTED_PROPS}>
            <Tabs.Trigger value="evolutions" {...APP_SHELL_TAB_TRIGGER_PROPS} fontSize="xs">
              {evolutionsTabLabel}
            </Tabs.Trigger>
            <Tabs.Trigger value="milestones" {...APP_SHELL_TAB_TRIGGER_PROPS} fontSize="xs">
              {milestonesTabLabel}
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value={activeTab} pt="2">
            {panel}
          </Tabs.Content>
        </Tabs.Root>
      ) : (
        <Stack gap="2">
          <Text fontSize="xs" fontWeight="semibold" color="gray.600">
            {activeTab === "evolutions" ? evolutionsTabLabel : milestonesTabLabel}
          </Text>
          {panel}
        </Stack>
      )}
    </Stack>
  );
}

export default function Clicker2StatsModal({
  open,
  onOpenChange,
  snapshot,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: Clicker2StatsSnapshot | null;
}) {
  if (!snapshot) return null;

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title="Pond statistics"
      size="md"
    >
      <Stack gap="2.5">
        <StatsRow label="Energy in pond" value={energyAmount(snapshot.energyInPond)} />
        {snapshot.pondEra >= 2 ? (
          <>
            <StatsRow
              label="Total energy produced (this era)"
              value={energyAmount(snapshot.eraEnergyEarned)}
            />
            <StatsRow
              label="Total energy produced (all time)"
              value={energyAmount(snapshot.allTimeEnergyEarned)}
            />
          </>
        ) : (
          <StatsRow
            label="Total energy produced"
            value={energyAmount(snapshot.eraEnergyEarned)}
          />
        )}
        <StatsRow
          label="Pond started"
          value={formatPondAgeAgo(snapshot.pondStartedAtMs, snapshot.capturedAtWallMs)}
        />
        <StatsRow
          label="Denizens welcomed"
          value={snapshot.denizensOwned.toLocaleString()}
        />
        {snapshot.evolutionsOwned > 0 ? (
          <StatsRow
            label={`${EVOLUTIONS_LABEL} acquired`}
            value={snapshot.evolutionsOwned.toLocaleString()}
          />
        ) : null}
        {snapshot.milestonesReached > 0 ? (
          <StatsRow
            label={`${MILESTONES_LABEL} reached`}
            value={snapshot.milestonesReached.toLocaleString()}
          />
        ) : null}
        {snapshot.blossoms > 0 ? (
          <StatsRow
            label="Blossoms grown"
            value={snapshot.blossoms.toLocaleString()}
          />
        ) : null}
        <StatsRow
          label="Energy per second"
          value={`${formatEnergyRate(snapshot.energyPerSecond)} ${ENERGY_EMOJI}`}
        />
        <StatsRow
          label="Energy per click"
          value={
            snapshot.energyPerClick > 0
              ? `${formatEnergyAmount(snapshot.energyPerClick)} ${ENERGY_EMOJI}`
              : "0"
          }
        />
        {snapshot.energyPerClick > 0 ? (
          <>
            <StatsRow
              label="  · surface & rings (baseline)"
              value={energyAmount(snapshot.energyPerClickSurfaceRingsBaseline)}
            />
            <StatsRow
              label="  · click reflections (+ % of pond EpS)"
              value={energyAmount(snapshot.energyPerClickFromReflections)}
            />
            <StatsRow
              label="Ripples passive EpS"
              value={`${formatEnergyRate(snapshot.ripplesPassiveEps)} ${ENERGY_EMOJI}`}
            />
          </>
        ) : null}
        <StatsRow label="Number of clicks" value={snapshot.totalClicks.toLocaleString()} />
        <StatsRow
          label="Energy from clicking"
          value={energyAmount(snapshot.energyFromClicking)}
        />
        {snapshot.weatherEventsClicked > 0 ? (
          <StatsRow
            label="Weather witnessed"
            value={snapshot.weatherEventsClicked.toLocaleString()}
          />
        ) : null}
        {snapshot.totalMutagensAcquired > 0 ? (
          <StatsRow
            label={`Total ${MUTAGENS_LABEL.toLowerCase()} acquired`}
            value={snapshot.totalMutagensAcquired.toLocaleString()}
          />
        ) : null}
        <StatsCatalogTabs
          evolutionsOwned={snapshot.evolutionsOwned}
          milestonesReached={snapshot.milestonesReached}
          ownedEvolutionDefs={snapshot.ownedEvolutionDefs}
          milestoneStatuses={snapshot.milestoneStatuses}
        />
      </Stack>
    </AppModal>
  );
}
