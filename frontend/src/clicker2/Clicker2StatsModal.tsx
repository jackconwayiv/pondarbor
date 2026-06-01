import {
  Box,
  Flex,
  Grid,
  Stack,
  Tabs,
  Text,
  useMediaQuery,
} from "@chakra-ui/react";
import { useState, type ReactNode } from "react";

import { useIsMobile } from "../responsive";

import { AppModal } from "../components/AppModal";
import {
  APP_SHELL_TAB_LIST_NESTED_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import { HIDE_SCROLLBAR_CSS } from "../theme/typography";
import { DESIGN } from "../theme/tokens";

import { EvolutionShopCard, EvolutionShopCardGrid } from "./EvolutionShopCard";
import {
  CYCLE_LABEL,
  EVOLUTIONS_LABEL,
  FOSSILIZED_STRATA_LABEL,
  FOSSILS_LABEL,
  FOSSIL_SHOP_LABEL,
  MILESTONES_LABEL,
  MUTAGENS_LABEL,
  STRATA_LABEL,
  TO_NEXT_STRATA_PHRASE,
  UNFOSSILIZED_STRATA_LABEL,
} from "./clicker2Copy";
import { formatFossilCost } from "./FossilShopSection";
import { FOSSIL_EMOJI } from "./fossilShop";
import { ENERGY_EMOJI, formatEnergyAmount, formatEnergyRate } from "./formatEnergy";
import { formatLastSaved, formatPondAgeAgo } from "./formatPondAge";
import {
  compareMilestoneReachedTimes,
  getMilestoneDef,
  milestoneDisplayEmoji,
} from "./milestones";
import ResetPondSaveSection from "./ResetPondSaveSection";
import type { SpecialtyDef } from "./specialties";
import {
  FOSSIL_SHOP_CARD_BORDER_WIDTH,
  FOSSIL_SHOP_CARD_GRADIENT,
} from "./specialtyTierColors";

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
  /** 1-based pond cycle (internal `pond_era`). */
  pondEra: number;
  eraEnergyEarned: number;
  allTimeEnergyEarned: number;
  /** 0 before 1T lifetime energy; derived from all-time total. */
  stratumLevel: number;
  energyToNextStratum: number;
  fossilizedStrata: number;
  unfossilizedStrata: number;
  fossils: number;
  totalFossilsEarned: number;
  pondStartedAtMs: number;
  /** Wall-clock epoch ms of the most recent successful save (0 if unknown). */
  lastSavedAtMs: number;
  denizensOwned: number;
  evolutionsOwned: number;
  ownedEvolutionDefs: readonly SpecialtyDef[];
  fossilShopOwned: number;
  ownedFossilShopDefs: readonly SpecialtyDef[];
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

const STATS_EVOLUTION_GRID_COLUMNS_DESKTOP = 4;
const STATS_EVOLUTION_GRID_COLUMNS_MOBILE = 3;

function EvolutionsOwnedPanel({
  ownedEvolutionDefs,
}: {
  ownedEvolutionDefs: readonly SpecialtyDef[];
}) {
  const isMobile = useIsMobile();
  const [canHoverFinePointer] = useMediaQuery(
    ["(hover: hover) and (pointer: fine)"],
    { ssr: false, fallback: [false] },
  );
  const columns = isMobile
    ? STATS_EVOLUTION_GRID_COLUMNS_MOBILE
    : STATS_EVOLUTION_GRID_COLUMNS_DESKTOP;

  return (
    <Box
      maxH="14rem"
      overflowY="auto"
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
      bg="bg.subtle"
      px="2"
      py="1.5"
      css={{ ...HIDE_SCROLLBAR_CSS, WebkitOverflowScrolling: "touch" }}
    >
      <EvolutionShopCardGrid gap="0.5" columns={columns}>
        {ownedEvolutionDefs.map((def) => (
          <EvolutionShopCard
            key={def.id}
            def={def}
            canHoverFinePointer={canHoverFinePointer}
            owned
          />
        ))}
      </EvolutionShopCardGrid>
    </Box>
  );
}

function FossilShopOwnedPanel({
  ownedFossilShopDefs,
}: {
  ownedFossilShopDefs: readonly SpecialtyDef[];
}) {
  const isMobile = useIsMobile();
  const [canHoverFinePointer] = useMediaQuery(
    ["(hover: hover) and (pointer: fine)"],
    { ssr: false, fallback: [false] },
  );
  const columns = isMobile
    ? STATS_EVOLUTION_GRID_COLUMNS_MOBILE
    : STATS_EVOLUTION_GRID_COLUMNS_DESKTOP;

  return (
    <Box
      maxH="14rem"
      overflowY="auto"
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
      bg="bg.subtle"
      px="2"
      py="1.5"
      css={{ ...HIDE_SCROLLBAR_CSS, WebkitOverflowScrolling: "touch" }}
    >
      <EvolutionShopCardGrid gap="0.5" columns={columns}>
        {ownedFossilShopDefs.map((def) => (
          <EvolutionShopCard
            key={def.id}
            def={def}
            canHoverFinePointer={canHoverFinePointer}
            owned
            backgroundGradient={FOSSIL_SHOP_CARD_GRADIENT}
            borderWidth={FOSSIL_SHOP_CARD_BORDER_WIDTH}
            costLabel={
              def.priceFossils != null
                ? formatFossilCost(def.priceFossils)
                : undefined
            }
          />
        ))}
      </EvolutionShopCardGrid>
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
    <Box
      maxH="14rem"
      overflowY="auto"
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
      bg="bg.subtle"
      px="2"
      py="1.5"
      css={{ ...HIDE_SCROLLBAR_CSS, WebkitOverflowScrolling: "touch" }}
    >
      <Grid templateColumns="repeat(2, minmax(0, 1fr))" gap="1.5">
        {earned.map((m) => (
          <MilestoneStatusRow key={m.id} {...m} />
        ))}
      </Grid>
    </Box>
  );
}

function statsCatalogTabLabel(base: string, count: number): string {
  return `${base} (${count.toLocaleString()})`;
}

type StatsCatalogTabId = "evolutions" | "milestones" | "fossilShop";

function StatsCatalogTabs({
  evolutionsOwned,
  milestonesReached,
  fossilShopOwned,
  ownedEvolutionDefs,
  ownedFossilShopDefs,
  milestoneStatuses,
}: {
  evolutionsOwned: number;
  milestonesReached: number;
  fossilShopOwned: number;
  ownedEvolutionDefs: readonly SpecialtyDef[];
  ownedFossilShopDefs: readonly SpecialtyDef[];
  milestoneStatuses: Clicker2StatsSnapshot["milestoneStatuses"];
}) {
  const showEvolutions = evolutionsOwned > 0;
  const showMilestones = milestonesReached > 0;
  const showFossilShop = fossilShopOwned > 0;
  const [tab, setTab] = useState<StatsCatalogTabId>("evolutions");

  if (!showEvolutions && !showMilestones && !showFossilShop) return null;

  const evolutionsTabLabel = statsCatalogTabLabel(EVOLUTIONS_LABEL, evolutionsOwned);
  const milestonesTabLabel = statsCatalogTabLabel(
    MILESTONES_LABEL,
    milestonesReached,
  );
  const fossilShopTabLabel = statsCatalogTabLabel(
    FOSSIL_SHOP_LABEL,
    fossilShopOwned,
  );

  const tabCount =
    (showEvolutions ? 1 : 0) + (showMilestones ? 1 : 0) + (showFossilShop ? 1 : 0);

  const defaultTab: StatsCatalogTabId = showEvolutions
    ? "evolutions"
    : showMilestones
      ? "milestones"
      : "fossilShop";

  const activeTab: StatsCatalogTabId =
    tabCount > 1
      ? tab === "evolutions" && showEvolutions
        ? "evolutions"
        : tab === "milestones" && showMilestones
          ? "milestones"
          : tab === "fossilShop" && showFossilShop
            ? "fossilShop"
            : defaultTab
      : defaultTab;

  const panel =
    activeTab === "evolutions" ? (
      <EvolutionsOwnedPanel ownedEvolutionDefs={ownedEvolutionDefs} />
    ) : activeTab === "milestones" ? (
      <MilestonesStatusPanel milestoneStatuses={milestoneStatuses} />
    ) : (
      <FossilShopOwnedPanel ownedFossilShopDefs={ownedFossilShopDefs} />
    );

  const activeTabLabel =
    activeTab === "evolutions"
      ? evolutionsTabLabel
      : activeTab === "milestones"
        ? milestonesTabLabel
        : fossilShopTabLabel;

  return (
    <Stack
      gap="2"
      pt="2"
      mt="0.5"
      borderTopWidth="1px"
      borderColor="border"
    >
      {tabCount > 1 ? (
        <Tabs.Root
          value={activeTab}
          variant="plain"
          w="100%"
          onValueChange={(details) =>
            setTab(details.value as StatsCatalogTabId)
          }
        >
          <Tabs.List {...APP_SHELL_TAB_LIST_NESTED_PROPS}>
            {showEvolutions ? (
              <Tabs.Trigger
                value="evolutions"
                {...APP_SHELL_TAB_TRIGGER_PROPS}
                fontSize="xs"
              >
                {evolutionsTabLabel}
              </Tabs.Trigger>
            ) : null}
            {showMilestones ? (
              <Tabs.Trigger
                value="milestones"
                {...APP_SHELL_TAB_TRIGGER_PROPS}
                fontSize="xs"
              >
                {milestonesTabLabel}
              </Tabs.Trigger>
            ) : null}
            {showFossilShop ? (
              <Tabs.Trigger
                value="fossilShop"
                {...APP_SHELL_TAB_TRIGGER_PROPS}
                fontSize="xs"
              >
                {fossilShopTabLabel}
              </Tabs.Trigger>
            ) : null}
          </Tabs.List>
          <Tabs.Content value={activeTab} pt="2">
            {panel}
          </Tabs.Content>
        </Tabs.Root>
      ) : (
        <Stack gap="2">
          <Text fontSize="xs" fontWeight="semibold" color="gray.600">
            {activeTabLabel}
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
  resetPondBusy,
  resetPondError,
  onResetPondSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: Clicker2StatsSnapshot | null;
  resetPondBusy: boolean;
  resetPondError: string | null;
  onResetPondSave: () => void | Promise<void>;
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
        <StatsRow
          label="Pond started"
          value={formatPondAgeAgo(snapshot.pondStartedAtMs, snapshot.capturedAtWallMs)}
        />
        <StatsRow
          label="Last saved"
          value={formatLastSaved(snapshot.lastSavedAtMs, snapshot.capturedAtWallMs)}
        />
        <StatsRow label="Energy in pond" value={energyAmount(snapshot.energyInPond)} />
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
        <StatsRow label="Number of clicks" value={snapshot.totalClicks.toLocaleString()} />
        <StatsRow
          label="Energy from clicking"
          value={energyAmount(snapshot.energyFromClicking)}
        />
        {snapshot.stratumLevel < 1 ? (
          <StatsRow
            label="Total energy earned"
            value={energyAmount(snapshot.allTimeEnergyEarned)}
          />
        ) : null}
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
        {snapshot.fossilShopOwned > 0 ? (
          <StatsRow
            label={FOSSIL_SHOP_LABEL}
            value={snapshot.fossilShopOwned.toLocaleString()}
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
        {snapshot.stratumLevel >= 1 ? (
          <>
            <StatsRow
              label="Total energy earned (this cycle)"
              value={energyAmount(snapshot.eraEnergyEarned)}
            />
            <StatsRow
              label="Total energy earned (lifetime)"
              value={energyAmount(snapshot.allTimeEnergyEarned)}
            />
            {snapshot.pondEra > 1 ? (
              <StatsRow
                label={CYCLE_LABEL}
                value={snapshot.pondEra.toLocaleString()}
              />
            ) : null}
            <StatsRow
              label={STRATA_LABEL}
              value={snapshot.stratumLevel.toLocaleString()}
            />
            {snapshot.pondEra > 1 ? (
              <>
                <StatsRow
                  label={FOSSILIZED_STRATA_LABEL}
                  value={snapshot.fossilizedStrata.toLocaleString()}
                />
                <StatsRow
                  label={UNFOSSILIZED_STRATA_LABEL}
                  value={snapshot.unfossilizedStrata.toLocaleString()}
                />
              </>
            ) : null}
            {snapshot.totalFossilsEarned > 0 ? (
              <>
                <StatsRow
                  label={FOSSILS_LABEL}
                  value={`${snapshot.fossils.toLocaleString()} ${FOSSIL_EMOJI}`}
                />
                <StatsRow
                  label={`${FOSSILS_LABEL} earned (lifetime)`}
                  value={`${snapshot.totalFossilsEarned.toLocaleString()} ${FOSSIL_EMOJI}`}
                />
              </>
            ) : null}
            <Text
              fontSize="xs"
              color="gray.600"
              fontVariantNumeric="tabular-nums"
              textAlign="left"
              lineHeight="1.4"
            >
              {formatEnergyAmount(snapshot.energyToNextStratum)} {ENERGY_EMOJI}{" "}
              {TO_NEXT_STRATA_PHRASE}
            </Text>
          </>
        ) : null}
        <StatsCatalogTabs
          evolutionsOwned={snapshot.evolutionsOwned}
          milestonesReached={snapshot.milestonesReached}
          fossilShopOwned={snapshot.fossilShopOwned}
          ownedEvolutionDefs={snapshot.ownedEvolutionDefs}
          ownedFossilShopDefs={snapshot.ownedFossilShopDefs}
          milestoneStatuses={snapshot.milestoneStatuses}
        />
        <ResetPondSaveSection
          key={open ? "open" : "closed"}
          busy={resetPondBusy}
          error={resetPondError}
          onReset={onResetPondSave}
        />
      </Stack>
    </AppModal>
  );
}
