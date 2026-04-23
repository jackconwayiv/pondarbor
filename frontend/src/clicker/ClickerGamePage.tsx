import {
  Box,
  Flex,
  Grid,
  GridItem,
  Heading,
  IconButton,
  PopoverBody,
  PopoverContent,
  PopoverPositioner,
  PopoverRoot,
  PopoverTrigger,
  SimpleGrid,
  Stack,
  Text,
  TooltipContent,
  TooltipPositioner,
  TooltipRoot,
  TooltipTrigger,
  useMediaQuery,
} from "@chakra-ui/react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";
import {
  CATALOG_CONTENT_VERSION,
  createDefaultClickerState,
  fetchClickerState,
  normalizeClickerStateForSchema,
  saveClickerState,
  type ClickerGameStateV1,
} from "./api";
import {
  CATALOG_UPGRADES,
  FAMILY_PRESENTATION,
  POND_STAGE_ECOLOGY_NOTE,
  POND_STAT_LABELS,
  PRIMARY_RESOURCE_IDS,
  RESOURCE_PRESENTATION,
  effectiveOwnedStacks,
  nextPurchaseCost,
  type PrimaryResourceId,
  type UpgradeDef,
  type UpgradeEffect,
  type UpgradeFamily,
} from "./catalog";
import { ClickerPageShell } from "./ClickerShell";
import {
  ecologyPopoverContentProps,
  ecologyTooltipRootBaseProps,
  ecologyTooltipSurfaceProps,
} from "./ecologyUi.constants.ts";
import { EcologyBlurbText } from "./ecologyUi.tsx";
import PondStage from "./PondStage";
import { pondStageEmojiForUpgrade } from "./upgradeEmojis";
import {
  canAffordCosts,
  computeBiodiversity,
  computePondStats,
  finalTierPondComplete,
  getOwnedCount,
  isUpgradeUnlocked,
  isUpgradeVisible,
  revealEnergyThresholdForNextPurchase,
  scaledNumericGateMin,
  type ResourceBalances,
} from "./ruleEngine";
import {
  applyResourceDelta,
  marginalClickIfBuyNextTier,
  marginalRatesIfBuyNextTier,
  simulateOwnedUpgrades,
  upgradeContributionToEnergyAndClick,
} from "./simulation";
const SAVE_INTERVAL_MS = 2000;
const PASSIVE_TICK_MS = 1000;

function formatPassiveRate(n: number): string {
  const r = Math.round(n * 100) / 100;
  if (Number.isInteger(r)) return String(r);
  const s = r.toFixed(2);
  return s.endsWith("0") ? s.slice(0, -1) : s;
}

const HUD_NUMBER_LOCALE = "en-US" as const;

/** M / B / T with three digits after the decimal (e.g. `1.234 M`), grouped with commas. */
function formatHudAbbreviatedMbt(x: number): string | null {
  if (!Number.isFinite(x) || x < 1e6) return null;
  if (x >= 1e12)
    return `${(x / 1e12).toLocaleString(HUD_NUMBER_LOCALE, {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })} T`;
  if (x >= 1e9)
    return `${(x / 1e9).toLocaleString(HUD_NUMBER_LOCALE, {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })} B`;
  return `${(x / 1e6).toLocaleString(HUD_NUMBER_LOCALE, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} M`;
}

/** Rates and deltas: same M/B/T style as the energy meter; finer below 1e6. */
function formatHudRate(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const sign = n < 0 ? "-" : "";
  const ax = Math.abs(n);
  const abbreviated = formatHudAbbreviatedMbt(ax);
  if (abbreviated != null) return `${sign}${abbreviated}`;
  const r = Math.round(n * 10) / 10;
  return r.toLocaleString(HUD_NUMBER_LOCALE, {
    minimumFractionDigits: Number.isInteger(r) ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

function formatHudResourceAmount(n: number): string {
  const x = Math.max(0, n);
  if (!Number.isFinite(x)) return "0";
  const abbreviated = formatHudAbbreviatedMbt(x);
  if (abbreviated != null) return abbreviated;
  return Math.floor(x).toLocaleString(HUD_NUMBER_LOCALE);
}

function formatShopCostAmount(v: number): string {
  return Math.round(v).toLocaleString(HUD_NUMBER_LOCALE);
}

const initialGameState = (): ClickerGameStateV1 => createDefaultClickerState();

/** Roman labels for owned-upgrade tier filter tabs (1–7); tier 0 uses digit `0` (no Roman zero). */
const TIER_ROMAN: readonly string[] = ["", "I", "II", "III", "IV", "V", "VI", "VII"];

function tierFilterTabLabel(tier: number): string {
  if (tier === 0) return "0";
  if (tier >= 1 && tier <= 7) return TIER_ROMAN[tier] ?? String(tier);
  return String(tier);
}

type LoadStatus = "loading" | "ready" | "error";

const MECHANIC_DISPLAY_LABELS: Record<string, string> = {
  pond_unlocked: "Pond",
};

const POND_STAT_IMPORTANCE_COPY: Record<keyof typeof POND_STAT_LABELS, string> =
  {
    depth:
      "How much water your pond can hold and how deep it gets. Deeper water stays cooler on hot days and gives fish more room to live and hide.",
    fertility:
      "Food-building material in the water and mud. More of it helps tiny plants and animals grow, which feeds larger animals up the chain.",
    oxygen:
      "Dissolved oxygen animals breathe underwater. Healthy mixing and plants help keep it up so the pond does not go stale.",
    shelter:
      "Logs, plants, and nooks where small animals can hide. Cover spreads out hunting so one species does not wipe out another.",
  };

const BIODIVERSITY_HUD_COPY =
  "Biodiversity is how many kinds of organisms live in an area and how different their jobs are—who eats whom, who builds shelter, who cycles nutrients. Richer variety often makes an ecosystem more stable when one species hits hard times.";

/** Tier filter tab: one plain sentence each (Roman / 0 band). */
const OWNED_TIER_ECOLOGY_SENTENCE: Record<number, string> = {
  0: "A brand-new pond is mostly clear water over open mud. Sun reaches the bottom, a faint film of algae and bacteria forms, and bits of debris and insects collect at the rim before bigger plants take hold.",
  1: "Once light and a thin algae film are in place, warm shallows grow thicker green films and soft mats. Tiny grazers and very small fish show up and turn that microscopic growth into food for larger animals.",
  2: "Tier II adds plants and structure; small hunters trim the plankton bloom and minnows link algae to bigger fish food.",
  3: "Tier III widens the edges and seasons; nests, frogs, and birds start tying land litter and rain pulses to life in the water.",
  4: "Tier IV adds snags and slower water so ambush fish can hunt; storms and banks feed open-water microbes and visiting birds.",
  5: "Tier V is thick weeds and busy waterfowl paths; nutrients get stored in plants and surface films that shuffle who feeds where.",
  6: "Tier VI is a mature pond—big wood, calm evenings, and large mammals sharing deep, oxygen-rich water with slow bottom life and fast predators.",
  7: "Tier VII is prestige endgame: rare denizens and capstone edges that celebrate an apex pond builder without adding new mechanical bonuses.",
};

const FAMILY_ECOSYSTEM_ROLE: Record<UpgradeFamily, string> = {
  Geology:
    "Shapes the bowl of the pond—banks, bottom, and depth that set where water sits and where animals can hide.",
  Hydrology:
    "Moves and refreshes water—inflow, mixing, and exchange so chemicals cycle and oxygen stays available.",
  Nutrients:
    "Builds the food base—fertility and decay that feed tiny producers, then everything above them.",
  Structure:
    "Adds logs, rocks, and complexity so many species can live in the same pond without one group taking over.",
  Plants:
    "Living structure: shade, cover, and food from underwater and edge plants.",
  "Microbes, Algae, and Plankton":
    "Tiny cells and drifting life that turn nutrients into food for the smallest animals.",
  Invertebrates:
    "Bugs, snails, and larvae that graze plants and each other and pass energy up to fish and frogs.",
  Herptiles:
    "Frogs, toads, turtles, and snakes that hunt in shallow water and tie the pond to the land.",
  Fish:
    "Fish schools and predators that move a lot of energy and keep weaker prey from exploding out of control.",
  Birds:
    "Wading and swimming birds that feed in the pond and carry nutrients in and out.",
  Mammals:
    "Muskrats, otters, and other mammals that reshape banks and move food and mud along the shore.",
};

function mechanicUnlockLabel(mechanicId: string): string {
  return MECHANIC_DISPLAY_LABELS[mechanicId] ?? mechanicId;
}

function multiplierTargetLabel(target: "global" | "click" | "passive"): string {
  if (target === "click") return "click energy";
  if (target === "passive") return "passive energy";
  return "all outputs";
}

function resourceLabelForInline(meta: { label: string }): string {
  // Keep gameplay readouts consistent regardless of card text casing.
  return meta.label.toLowerCase();
}

function tierRomanHeading(tier: number): string {
  if (tier >= 1 && tier <= 7) return `Tier ${TIER_ROMAN[tier]}`;
  return `Tier ${tier}`;
}

/** Marginal +/s line only when this upgrade adds raw passive gen (not multiplier-only). */
function upgradeHasEnergyPassiveGeneration(def: UpgradeDef): boolean {
  return def.effects.some(
    (e) => e.type === "passive_generation" && e.resource === "energy",
  );
}

/** Marginal +/click line only when this upgrade adds raw click bonus (not multiplier-only). */
function upgradeHasClickBonus(def: UpgradeDef): boolean {
  return def.effects.some((e) => e.type === "click_bonus");
}

/**
 * Shop card: **only** the marginal gain from the **next** Buy (one purchase). Never cumulative
 * totals. Energy lines use simulation deltas; multipliers/thresholds use per-purchase increments.
 */
function shopCardFunctionLine(
  def: UpgradeDef,
  ownedUpgrades: Record<string, number>,
): string | null {
  const parts: string[] = [];
  const passiveDelta = marginalRatesIfBuyNextTier(def, ownedUpgrades).energy;
  const clickDelta = marginalClickIfBuyNextTier(def, ownedUpgrades);
  if (upgradeHasEnergyPassiveGeneration(def) && passiveDelta > 0) {
    const meta = RESOURCE_PRESENTATION.energy;
    parts.push(
      `+${formatHudRate(passiveDelta)} ${resourceLabelForInline(meta)}/second`,
    );
  }
  if (upgradeHasClickBonus(def) && clickDelta > 0) {
    parts.push(`+${formatHudRate(clickDelta)} energy/click`);
  }
  for (const e of def.effects) {
    if (e.type === "passive_generation" || e.type === "click_bonus") continue;
    if (e.type === "multiplier") {
      const pct = Math.round(e.value * 100);
      parts.push(
        `Multiplies ${multiplierTargetLabel(e.target)} (+${pct}%)`,
      );
    } else if (e.type === "unlock") {
      parts.push(`Unlocks ${mechanicUnlockLabel(e.mechanicId)}`);
    } else if (e.type === "threshold_delta") {
      parts.push(
        `+${formatPassiveRate(e.delta)} ${POND_STAT_LABELS[e.stat]}`,
      );
    }
  }
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

function scaleEffectForDisplay(
  effect: UpgradeEffect,
  level: number,
): UpgradeEffect {
  if (effect.type === "click_bonus")
    return { ...effect, amount: effect.amount * level };
  if (effect.type === "passive_generation")
    return { ...effect, amount: effect.amount * level };
  if (effect.type === "multiplier")
    return { ...effect, value: effect.value * level };
  if (effect.type === "threshold_delta")
    return { ...effect, delta: effect.delta * level };
  return effect;
}

/** Owned-card effect line; flat +/s and +/click only for direct passive/click effects. */
function ownedCardEffectLine(
  def: UpgradeDef,
  ownedUpgrades: Record<string, number>,
): string | null {
  const stacks = effectiveOwnedStacks(def, ownedUpgrades);
  if (stacks <= 0) return null;
  const lines: string[] = [];
  const contrib = upgradeContributionToEnergyAndClick(def, ownedUpgrades);
  if (upgradeHasClickBonus(def) && contrib.clickPerClick > 0) {
    lines.push(`+${formatHudRate(contrib.clickPerClick)} energy/click`);
  }
  if (upgradeHasEnergyPassiveGeneration(def) && contrib.passivePerSec > 0) {
    const meta = RESOURCE_PRESENTATION.energy;
    lines.push(
      `+${formatHudRate(contrib.passivePerSec)} ${resourceLabelForInline(meta)}/second`,
    );
  }
  for (const effect of def.effects) {
    if (effect.type === "passive_generation" || effect.type === "click_bonus")
      continue;
    const scaled = scaleEffectForDisplay(effect, stacks);
    if (scaled.type === "multiplier") {
      lines.push(`+${Math.round(scaled.value * 100)}% ${scaled.target}`);
    }
    if (scaled.type === "unlock") {
      lines.push(`Unlock: ${mechanicUnlockLabel(scaled.mechanicId)}`);
    }
    if (
      scaled.type === "threshold_delta" &&
      effect.type === "threshold_delta"
    ) {
      const perStack = effect.delta;
      lines.push(
        `+${formatPassiveRate(perStack)} ${POND_STAT_LABELS[scaled.stat]}/stack`,
      );
    }
  }
  return lines.length > 0 ? lines.join(" • ") : null;
}

function formatResourceCostParts(
  costs: Partial<Record<PrimaryResourceId, number>>,
): string[] {
  const parts: string[] = [];
  for (const resourceId of PRIMARY_RESOURCE_IDS) {
    const v = costs[resourceId];
    if (typeof v === "number" && v > 0) {
      parts.push(
        `${formatShopCostAmount(v)} ${RESOURCE_PRESENTATION[resourceId].symbol}`,
      );
    }
  }
  return parts;
}

type PondGateRow = {
  title: string;
  required: number;
  current: number;
  met: boolean;
};

function pondGateRowsForShopCard(
  def: UpgradeDef,
  ownedUpgrades: Record<string, number>,
  pondStats: ReturnType<typeof computePondStats>,
  biodiversity: number,
): PondGateRow[] {
  void biodiversity;
  const rows: PondGateRow[] = [];
  for (const r of def.requirements) {
    if (r.type === "stat_threshold") {
      const required = scaledNumericGateMin(r, def, ownedUpgrades, r.stat);
      const current = pondStats[r.stat];
      rows.push({
        title: POND_STAT_LABELS[r.stat],
        required,
        current,
        met: current >= required,
      });
    }
  }
  return rows;
}

/** Mobile / coarse pointer only: small black “?” opens the ecology popover. */
function EcologyHelpMobileButton({
  upgradeName,
  ecologyNote,
}: {
  upgradeName: string;
  ecologyNote: string;
}) {
  const trigger = (
    <IconButton
      variant="plain"
      borderRadius="full"
      bg="white"
      color="black"
      borderWidth="1px"
      borderStyle="solid"
      borderColor="black"
      minW="1.0625rem"
      w="1.0625rem"
      h="1.0625rem"
      minH="1.0625rem"
      fontSize="8px"
      fontWeight="extrabold"
      lineHeight="1"
      p="0"
      flexShrink={0}
      aria-label={`Ecology note: ${upgradeName}`}
      _hover={{ bg: "gray.100" }}
      _active={{ bg: "gray.200" }}
    >
      ?
    </IconButton>
  );

  return (
    <PopoverRoot positioning={{ placement: "bottom-end" }}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverPositioner>
        <PopoverContent
          {...ecologyPopoverContentProps}
          w={{ base: "calc(100vw - 2rem)", md: "auto" }}
        >
          <PopoverBody bg="white" color="black" p="3" border="none">
            <EcologyBlurbText>{ecologyNote}</EcologyBlurbText>
          </PopoverBody>
        </PopoverContent>
      </PopoverPositioner>
    </PopoverRoot>
  );
}

function ClickerResourceHud({
  resources,
  rates,
  clickPower,
  hasBasin,
  pondStats,
  biodiversityStackTotal,
  showResetPond,
  confirmResetPond,
  resetPondBusy,
  onResetPondClick,
}: {
  resources: ResourceBalances;
  rates: ResourceBalances;
  /** Energy gained per pond click. */
  clickPower: number;
  /** After Pond Basin, show per-click line in the HUD (hidden before that). */
  hasBasin: boolean;
  pondStats: ReturnType<typeof computePondStats>;
  /** Sum of effective stacks across all catalog upgrades (computeBiodiversity / 100). */
  biodiversityStackTotal: number;
  /** When all Tier VII prestige denizens are owned, show Reset pond on the right. */
  showResetPond: boolean;
  confirmResetPond: boolean;
  resetPondBusy: boolean;
  onResetPondClick: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  const [canHoverFinePointer] = useMediaQuery(
    ["(hover: hover) and (pointer: fine)"],
    {
      ssr: false,
      fallback: [false],
    },
  );

  return (
    <Flex
      align="flex-start"
      justify="space-between"
      gap={{ base: 2, md: 3 }}
      flexWrap="wrap"
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
      bg="bg"
      py="2"
      px={{ base: 2, md: 3 }}
      w="full"
      maxW="100%"
      minW="0"
      alignSelf={{ base: "stretch", md: "flex-start" }}
      overflow="hidden"
    >
      <Grid
        flex="1"
        minW="0"
        templateColumns="auto auto"
        alignItems="stretch"
        columnGap={{ base: 3, md: 4 }}
        w={{ base: "full", md: "auto" }}
        maxW="100%"
      >
        <GridItem
          minW="0"
          maxW="100%"
          boxSizing="border-box"
          display="flex"
          flexDirection="column"
        >
          {PRIMARY_RESOURCE_IDS.map((resourceId) => {
            const rate = rates[resourceId];
            const meta = RESOURCE_PRESENTATION[resourceId];
            const isEnergy = resourceId === "energy";
            return (
              <Flex
                key={resourceId}
                align={{ base: "stretch", md: "center" }}
                gap={{ base: 2, md: 3 }}
                flexWrap="wrap"
                flex="1"
                minH="0"
                w={{ base: "full", md: "max-content" }}
                maxW="100%"
                minW="0"
              >
                <Box
                  borderWidth="1px"
                  borderColor="border"
                  borderRadius="md"
                  bg="bg.subtle"
                  px="2"
                  py="1.5"
                  minW={isEnergy ? "12ch" : "0"}
                  maxW="100%"
                  alignSelf={{ base: "stretch", md: "auto" }}
                  h={{ base: "full", md: "auto" }}
                  display="flex"
                  flexDirection="column"
                  justifyContent="center"
                >
                  <Stack
                    gap="0.5"
                    align={isEnergy ? "center" : "stretch"}
                    w="full"
                  >
                    <Text
                      fontSize="2xs"
                      fontWeight="bold"
                      color="fg"
                      lineHeight="1.2"
                      textAlign={isEnergy ? "center" : "start"}
                      w="full"
                    >
                      {meta.label}
                    </Text>
                    <Text
                      fontSize="sm"
                      fontWeight="semibold"
                      fontVariantNumeric="tabular-nums"
                      lineHeight="1.2"
                      lineClamp={1}
                      textAlign={isEnergy ? "center" : "start"}
                      w="full"
                      minW={isEnergy ? "6ch" : undefined}
                    >
                      {formatHudResourceAmount(resources[resourceId])}
                    </Text>
                  </Stack>
                </Box>
                {resourceId === "energy" ? (
                  <Stack
                    gap="1"
                    justify="center"
                    minW="0"
                    py="0.5"
                    alignSelf="center"
                  >
                    <Text
                      fontSize="2xs"
                      color="gray.600"
                      lineHeight="1.2"
                      fontVariantNumeric="tabular-nums"
                      whiteSpace="nowrap"
                      visibility={rate !== 0 ? "visible" : "hidden"}
                      aria-hidden={rate === 0}
                    >
                      {rate > 0 ? "+" : ""}
                      {formatHudRate(rate)}
                      {meta.symbol}/second
                    </Text>
                    {hasBasin ? (
                      <Text
                        fontSize="2xs"
                        color="gray.600"
                        lineHeight="1.2"
                        fontVariantNumeric="tabular-nums"
                        whiteSpace="nowrap"
                      >
                        {clickPower > 0 ? "+" : ""}
                        {formatHudRate(clickPower)}
                        {meta.symbol}/click
                      </Text>
                    ) : null}
                  </Stack>
                ) : null}
              </Flex>
            );
          })}
        </GridItem>
        <GridItem minW="0" display="flex" flexDirection="column">
          <SimpleGrid
            columns={{ base: 2, sm: 3, md: 5 }}
            gap="2"
            w="full"
            minW="0"
            flex="1"
            justifyItems="stretch"
          >
            {(
              Object.keys(POND_STAT_LABELS) as Array<
                keyof typeof POND_STAT_LABELS
              >
            ).map((k) => {
              const label = POND_STAT_LABELS[k];
              const blurb = POND_STAT_IMPORTANCE_COPY[k];
              const tile = (
                <Box
                  key={k}
                  borderWidth="1px"
                  borderColor="border"
                  borderRadius="md"
                  bg="bg.subtle"
                  px="2"
                  py="1.5"
                  minW="0"
                  title={!canHoverFinePointer ? blurb : undefined}
                >
                  <Stack gap="0.5" align="center">
                    <Text
                      fontSize="2xs"
                      fontWeight="bold"
                      color="fg"
                      lineHeight="1.2"
                      textAlign="center"
                      w="full"
                    >
                      {label}
                    </Text>
                    <Text
                      fontSize="sm"
                      fontWeight="semibold"
                      fontVariantNumeric="tabular-nums"
                      lineHeight="1.2"
                      textAlign="center"
                      w="full"
                    >
                      {Math.round(pondStats[k])}
                    </Text>
                  </Stack>
                </Box>
              );

              if (!canHoverFinePointer) return tile;

              return (
                <TooltipRoot
                  key={k}
                  {...ecologyTooltipRootBaseProps}
                  openDelay={650}
                  positioning={{ placement: "top" }}
                >
                  <TooltipTrigger asChild>{tile}</TooltipTrigger>
                  <TooltipPositioner>
                    <TooltipContent {...ecologyTooltipSurfaceProps}>
                      <EcologyBlurbText>{blurb}</EcologyBlurbText>
                    </TooltipContent>
                  </TooltipPositioner>
                </TooltipRoot>
              );
            })}
            {(() => {
              const bioTile = (
                <Box
                  key="biodiversity"
                  borderWidth="1px"
                  borderColor="border"
                  borderRadius="md"
                  bg="bg.subtle"
                  px="2"
                  py="1.5"
                  minW="0"
                  title={
                    !canHoverFinePointer ? BIODIVERSITY_HUD_COPY : undefined
                  }
                >
                  <Stack gap="0.5" align="center">
                    <Text
                      fontSize="2xs"
                      fontWeight="bold"
                      color="fg"
                      lineHeight="1.2"
                      textAlign="center"
                      w="full"
                    >
                      Biodiversity
                    </Text>
                    <Text
                      fontSize="sm"
                      fontWeight="semibold"
                      fontVariantNumeric="tabular-nums"
                      lineHeight="1.2"
                      textAlign="center"
                      w="full"
                    >
                      {biodiversityStackTotal}
                    </Text>
                  </Stack>
                </Box>
              );
              if (!canHoverFinePointer) return bioTile;
              return (
                <TooltipRoot
                  key="biodiversity-tip"
                  {...ecologyTooltipRootBaseProps}
                  openDelay={650}
                  positioning={{ placement: "top" }}
                >
                  <TooltipTrigger asChild>{bioTile}</TooltipTrigger>
                  <TooltipPositioner>
                    <TooltipContent {...ecologyTooltipSurfaceProps}>
                      <EcologyBlurbText>{BIODIVERSITY_HUD_COPY}</EcologyBlurbText>
                    </TooltipContent>
                  </TooltipPositioner>
                </TooltipRoot>
              );
            })()}
          </SimpleGrid>
        </GridItem>
      </Grid>
      {showResetPond ? (
        <PondButton
          type="button"
          size="sm"
          colorPalette="orange"
          flexShrink={0}
          alignSelf={{ base: "center", md: "flex-start" }}
          loading={resetPondBusy}
          disabled={resetPondBusy}
          onClick={onResetPondClick}
        >
          {confirmResetPond ? "Confirm reset pond" : "Reset pond"}
        </PondButton>
      ) : null}
    </Flex>
  );
}

/** Filled ★ / empty ☆ for each ownable stack (shop card, centered row). */
function ShopCardStackStars({
  maxOwned,
  filledStacks,
}: {
  maxOwned: number;
  filledStacks: number;
}) {
  const filled = Math.max(0, Math.min(filledStacks, maxOwned));
  const starSize = maxOwned > 5 ? "2xs" : "xs";
  return (
    <Flex
      role="img"
      aria-label={`${filled} of ${maxOwned} owned`}
      align="center"
      justify="center"
      gap="0.125rem"
      flexShrink={0}
    >
      {Array.from({ length: maxOwned }, (_, i) => (
        <Text
          as="span"
          key={i}
          fontSize={starSize}
          lineHeight="1"
          color={i < filled ? "yellow.400" : "gray.400"}
        >
          {i < filled ? "★" : "☆"}
        </Text>
      ))}
    </Flex>
  );
}

function UpgradeCard({
  def,
  resources,
  ownedUpgrades,
  pondStats,
  biodiversity,
  onBuy,
  shopListRevision,
}: {
  def: UpgradeDef;
  resources: ResourceBalances;
  ownedUpgrades: Record<string, number>;
  pondStats: ReturnType<typeof computePondStats>;
  biodiversity: number;
  onBuy: (def: UpgradeDef) => void;
  /** Bumps Tooltip `key` when shop order or ownership changes so no tooltip instance survives stale. */
  shopListRevision: string;
}) {
  const [canHoverFinePointer] = useMediaQuery(
    ["(hover: hover) and (pointer: fine)"],
    {
      ssr: false,
      fallback: [false],
    },
  );

  const ownedCount = getOwnedCount(ownedUpgrades, def.id);

  const maxed = nextPurchaseCost(def, ownedCount) === null;
  const nextCost = nextPurchaseCost(def, ownedCount);
  const unlocked = isUpgradeUnlocked(
    def,
    ownedUpgrades,
    resources,
    pondStats,
    biodiversity,
  );
  const canPay = nextCost !== null && canAffordCosts(nextCost, resources);

  const lockedByRequirements = !maxed && !unlocked;
  const lockedByCost = !maxed && unlocked && !canPay;
  const affordable = !maxed && nextCost !== null && unlocked && canPay;
  // const disabledCard = !maxed && !affordable;
  // const cantAfford =
  //   unlocked &&
  //   nextCost !== null &&
  //   !maxed &&
  //   !canAffordCosts(nextCost, resources);
  const costLine = nextCost ? formatResourceCostParts(nextCost).join(" ") : "";
  const familyMeta = FAMILY_PRESENTATION[def.family];
  const functionLine =
    shopCardFunctionLine(def, ownedUpgrades) ?? def.effectText ?? null;
  const pondGateRows = pondGateRowsForShopCard(
    def,
    ownedUpgrades,
    pondStats,
    biodiversity,
  );
  const pondCardEmoji = pondStageEmojiForUpgrade(def);
  const upgradeTitleDisplay = pondCardEmoji
    ? `${pondCardEmoji} ${def.name}`
    : def.name;

  const cardBody = (
    <Box
      position="relative"
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
      py={{ base: "1", md: "1.5" }}
      px={{ base: "1.5", md: "2" }}
      pr={{ base: "1.625rem", md: "2" }}
      bg={lockedByRequirements || lockedByCost ? "gray.200" : "bg"}
      h="full"
      minH="0"
      w="full"
      display="flex"
      flexDirection="column"
    >
      {!canHoverFinePointer ? (
        <Box position="absolute" top="0.375rem" right="0.375rem" zIndex={1}>
          <EcologyHelpMobileButton
            upgradeName={upgradeTitleDisplay}
            ecologyNote={def.ecologyNote}
          />
        </Box>
      ) : null}
      <Flex justify="space-between" align="flex-start" gap="2" w="full">
        <Text
          fontWeight="semibold"
          fontSize={{ base: "xs", md: "sm" }}
          lineHeight="1.2"
          textAlign="left"
          flex="1"
          minW="0"
        >
          {upgradeTitleDisplay}
        </Text>
        <Text
          fontSize="xs"
          fontWeight="medium"
          color={familyMeta.accent}
          whiteSpace="nowrap"
          lineHeight="1.2"
          flexShrink={0}
          textAlign="right"
        >
          {familyMeta.symbol} {familyMeta.label}
        </Text>
      </Flex>
      <Flex
        justify="space-between"
        align="baseline"
        gap="2"
        mt="1"
        w="full"
        minW="0"
      >
        {functionLine ? (
          <Text
            fontSize="xs"
            color="gray.700"
            lineHeight="1.3"
            flex="1"
            minW="0"
          >
            {functionLine}
          </Text>
        ) : (
          <Box flex="1" minW="0" />
        )}
        <Text
          fontSize="2xs"
          fontWeight="medium"
          color="gray.500"
          opacity={0.88}
          lineHeight="1.3"
          flexShrink={0}
          letterSpacing="0.02em"
        >
          {tierRomanHeading(def.tier)}
        </Text>
      </Flex>
      {pondGateRows.length > 0 ? (
        <Stack gap="0.5" mt="1" align="stretch">
          {pondGateRows.map((row) => (
            <Text
              key={row.title}
              fontSize="2xs"
              color={row.met ? "teal.solid" : "nautical.solid"}
              lineHeight="1.3"
              fontVariantNumeric="tabular-nums"
            >
              {row.title} ≥ {row.required}
              <Box
                as="span"
                color={row.met ? "teal.solid" : "nautical.solid"}
                fontWeight="normal"
              >
                {" "}
                ({Math.round(row.current)}/{row.required})
              </Box>
            </Text>
          ))}
        </Stack>
      ) : null}
      {def.maxOwned != null && def.maxOwned > 0 ? (
        <Flex
          align="center"
          justify="space-between"
          gap="1.5"
          mt="1.5"
          w="full"
          minW="0"
        >
          <Box flex="1" minW="0" pr="1" display="flex" alignItems="center">
            {!maxed && nextCost ? (
              <Text fontSize="xs" color="gray.700" lineClamp={1}>
                <strong>{costLine}</strong>
              </Text>
            ) : maxed ? (
              <Text fontSize="xs" color="gray.500">
                Max
              </Text>
            ) : (
              <Text fontSize="xs" color="gray.500">
                —
              </Text>
            )}
          </Box>
          <Flex
            align="center"
            justify="flex-end"
            gap="1"
            flexShrink={0}
            minW="0"
          >
            <ShopCardStackStars
              maxOwned={def.maxOwned}
              filledStacks={effectiveOwnedStacks(def, ownedUpgrades)}
            />
            {!maxed && nextCost ? (
              <PondButton
                type="button"
                size="xs"
                colorPalette="nautical"
                disabled={!affordable}
                flexShrink={0}
                onClick={() => onBuy(def)}
              >
                Buy
              </PondButton>
            ) : null}
          </Flex>
        </Flex>
      ) : !maxed && nextCost ? (
        <Flex
          align="center"
          justify="space-between"
          gap="1.5"
          mt="1.5"
          w="full"
          minW="0"
        >
          <Text fontSize="xs" color="gray.700" flexShrink={0}>
            <strong>{costLine}</strong>
          </Text>
          <PondButton
            type="button"
            size="xs"
            colorPalette="nautical"
            disabled={!affordable}
            flexShrink={0}
            onClick={() => onBuy(def)}
          >
            Buy
          </PondButton>
        </Flex>
      ) : null}
    </Box>
  );

  if (canHoverFinePointer) {
    return (
      <TooltipRoot
        key={`shop-eco-${def.id}-${shopListRevision}-${ownedCount}`}
        {...ecologyTooltipRootBaseProps}
        openDelay={1000}
        positioning={{ placement: "top-start" }}
      >
        <TooltipTrigger asChild>
          <Box w="full" minW="0" display="block" cursor="default">
            {cardBody}
          </Box>
        </TooltipTrigger>
        <TooltipPositioner>
          <TooltipContent {...ecologyTooltipSurfaceProps}>
            <EcologyBlurbText>{def.ecologyNote}</EcologyBlurbText>
          </TooltipContent>
        </TooltipPositioner>
      </TooltipRoot>
    );
  }

  return cardBody;
}

function isClickerAuthFailureMessage(msg: string): boolean {
  return msg.includes("(401)") || msg.includes("(403)");
}

function OwnedChip({
  def,
  ownedUpgrades,
}: {
  def: UpgradeDef;
  ownedUpgrades: Record<string, number>;
}) {
  const [canHoverFinePointer] = useMediaQuery(
    ["(hover: hover) and (pointer: fine)"],
    {
      ssr: false,
      fallback: [false],
    },
  );
  const stacks = effectiveOwnedStacks(def, ownedUpgrades);
  const fx = ownedCardEffectLine(def, ownedUpgrades);
  const familyMeta = FAMILY_PRESENTATION[def.family];

  const hasCap = typeof def.maxOwned === "number" && def.maxOwned > 0;
  const MAX_STARS = 5;
  const starCap = hasCap ? Math.min(def.maxOwned!, MAX_STARS) : MAX_STARS;
  const filledStars = Math.max(0, Math.min(stacks, starCap));
  const emptyStars = Math.max(0, starCap - filledStars);
  const pondCardEmoji = pondStageEmojiForUpgrade(def);
  const upgradeTitleDisplay = pondCardEmoji
    ? `${pondCardEmoji} ${def.name}`
    : def.name;

  const chipBody = (
    <Box
      position="relative"
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
      px="3"
      py="1.5"
      pr={{ base: "1.625rem", md: "3" }}
      bg="bg"
      flexShrink={0}
      display="flex"
      flexDirection="column"
      gap="1"
      minW="0"
    >
      {!canHoverFinePointer ? (
        <Box position="absolute" top="0.375rem" right="0.5rem" zIndex={1}>
          <EcologyHelpMobileButton
            upgradeName={upgradeTitleDisplay}
            ecologyNote={def.ecologyNote}
          />
        </Box>
      ) : null}
      <Text
        fontSize="sm"
        fontWeight="bold"
        lineHeight="1.3"
        minW="0"
        lineClamp={2}
      >
        {upgradeTitleDisplay}
      </Text>
      <Flex
        justify="space-between"
        align="baseline"
        gap="2"
        w="full"
        minW="0"
      >
        {fx ? (
          <Text
            fontSize={APP_TEXT_SIZES.meta}
            color="gray.600"
            lineHeight="1.35"
            flex="1"
            minW="0"
          >
            {fx}
          </Text>
        ) : (
          <Box flex="1" minW="0" />
        )}
        <Text
          fontSize="2xs"
          fontWeight="medium"
          color="gray.500"
          opacity={0.88}
          lineHeight="1.35"
          flexShrink={0}
          letterSpacing="0.02em"
        >
          {tierRomanHeading(def.tier)}
        </Text>
      </Flex>
      <Flex justify="space-between" align="center" gap="2" w="full" minW="0">
        <Text
          fontSize="xs"
          fontWeight="medium"
          color={familyMeta.accent}
          lineClamp={2}
          flex="1"
          minW="0"
        >
          {familyMeta.symbol} {familyMeta.label}
        </Text>
        <Flex
          align="center"
          gap="0.5"
          flexShrink={0}
          title={
            hasCap
              ? `${stacks} of ${def.maxOwned} stacks owned`
              : `${stacks} stack${stacks === 1 ? "" : "s"} owned`
          }
        >
          <Flex gap="0.25">
            {Array.from({ length: filledStars }).map((_, i) => (
              <Text key={`f-${i}`} fontSize="xs" color="yellow.400">
                ★
              </Text>
            ))}
            {Array.from({ length: emptyStars }).map((_, i) => (
              <Text key={`e-${i}`} fontSize="xs" color="gray.400">
                ☆
              </Text>
            ))}
          </Flex>
          {!hasCap && (
            <Text
              fontSize="xs"
              fontWeight="medium"
              color="gray.600"
              fontVariantNumeric="tabular-nums"
            >
              {stacks}
            </Text>
          )}
          {hasCap && def.maxOwned! > MAX_STARS && (
            <Text
              fontSize="xs"
              fontWeight="medium"
              color="gray.600"
              fontVariantNumeric="tabular-nums"
            >
              {stacks}/{def.maxOwned}
            </Text>
          )}
        </Flex>
      </Flex>
    </Box>
  );

  if (canHoverFinePointer) {
    return (
      <TooltipRoot
        key={`owned-eco-${def.id}-${stacks}`}
        {...ecologyTooltipRootBaseProps}
        openDelay={1000}
        positioning={{ placement: "top-start" }}
      >
        <TooltipTrigger asChild>
          <Box display="block" cursor="default" flexShrink={0}>
            {chipBody}
          </Box>
        </TooltipTrigger>
        <TooltipPositioner>
          <TooltipContent {...ecologyTooltipSurfaceProps}>
            <EcologyBlurbText>{def.ecologyNote}</EcologyBlurbText>
          </TooltipContent>
        </TooltipPositioner>
      </TooltipRoot>
    );
  }

  return chipBody;
}

function applyNormalizedState(
  normalized: ClickerGameStateV1,
  setters: {
    setResources: (r: ResourceBalances) => void;
    setOwnedUpgrades: (o: Record<string, number>) => void;
    setOwnedUpgradeOrder: (o: string[]) => void;
    setRevealedUpgrades: (r: Record<string, boolean>) => void;
    setUnlockedMechanics: (u: string[]) => void;
    setCatalogVersion: (n: number) => void;
    setActiveBuffs: (b: Array<{ id: string; expires_at_ms: number }>) => void;
    setStatistics: (s: ClickerGameStateV1["statistics"]) => void;
  },
) {
  const {
    setResources,
    setOwnedUpgrades,
    setOwnedUpgradeOrder,
    setRevealedUpgrades,
    setUnlockedMechanics,
    setCatalogVersion,
    setActiveBuffs,
    setStatistics,
  } = setters;
  setResources({ energy: normalized.energy });
  setOwnedUpgrades(normalized.owned_upgrades);
  setOwnedUpgradeOrder(normalized.owned_upgrade_order);
  setRevealedUpgrades(normalized.revealed_upgrades);
  setUnlockedMechanics(normalized.unlocked_mechanics);
  setCatalogVersion(normalized.catalog_version);
  setActiveBuffs(normalized.active_buffs);
  setStatistics(normalized.statistics);
}

export default function ClickerGamePage() {
  const navigate = useNavigate();
  const {
    isAuthenticated,
    sessionUser,
    isLoading: sessionLoading,
    error: sessionError,
    getApiAccessToken,
    refreshSession,
  } = useAppSession();

  const [resources, setResources] = useState<ResourceBalances>({ energy: 0 });
  const [ownedUpgrades, setOwnedUpgrades] = useState<Record<string, number>>(
    {},
  );
  const [ownedUpgradeOrder, setOwnedUpgradeOrder] = useState<string[]>(
    () => initialGameState().owned_upgrade_order,
  );
  const [revealedUpgrades, setRevealedUpgrades] = useState<
    Record<string, boolean>
  >({});
  const [unlockedMechanics, setUnlockedMechanics] = useState<string[]>([]);
  const [catalogVersion, setCatalogVersion] = useState(CATALOG_CONTENT_VERSION);
  const [activeBuffs, setActiveBuffs] = useState<
    Array<{ id: string; expires_at_ms: number }>
  >([]);
  const [statistics, setStatistics] = useState(
    () => createDefaultClickerState().statistics,
  );
  const [ownedFamilyFilter, setOwnedFamilyFilter] =
    useState<UpgradeFamily | null>(null);
  const [ownedTierFilter, setOwnedTierFilter] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveAuthBlocked, setSaveAuthBlocked] = useState(false);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [canHoverEcologyTooltips] = useMediaQuery(
    ["(hover: hover) and (pointer: fine)"],
    { ssr: false, fallback: [false] },
  );
  const [confirmServerReset, setConfirmServerReset] = useState(false);
  const [serverResetBusy, setServerResetBusy] = useState(false);
  const [serverResetError, setServerResetError] = useState<string | null>(null);
  const [confirmFinalReset, setConfirmFinalReset] = useState(false);
  const [finalResetBusy, setFinalResetBusy] = useState(false);
  const finalCompleteBeforeSaveRef = useRef(false);
  /** Stable purchasable-first shop order; new purchasable ids append (catalog order for same-frame adds). */
  const shopPurchasableOrderRef = useRef<string[]>([]);

  /** Any local change since last successful save. */
  const saveDirtyRef = useRef(false);
  /** Last high-frequency user action (clicking/buying) — used to avoid saving mid-spam. */
  const lastInteractionAtMsRef = useRef(0);
  const saveInFlightRef = useRef(false);
  const saveIdleHandleRef = useRef<number | null>(null);

  const ownedRef = useRef<Record<string, number>>({});
  ownedRef.current = ownedUpgrades;

  const gameRef = useRef(resources);
  gameRef.current = resources;

  const pondStats = useMemo(
    () => computePondStats(ownedUpgrades),
    [ownedUpgrades],
  );
  const biodiversity = useMemo(
    () => computeBiodiversity(ownedUpgrades),
    [ownedUpgrades],
  );
  const biodiversityStackTotal = useMemo(
    () => Math.round(biodiversity / 100),
    [biodiversity],
  );

  /** All Tier VII prestige denizens owned (shows Reset pond in HUD). */
  const finalTierComplete = finalTierPondComplete(ownedUpgrades);

  const stateRef = useRef<ClickerGameStateV1>(initialGameState());
  stateRef.current = {
    energy: resources.energy,
    owned_upgrades: ownedUpgrades,
    owned_upgrade_order: ownedUpgradeOrder,
    revealed_upgrades: revealedUpgrades,
    unlocked_mechanics: unlockedMechanics,
    catalog_version: catalogVersion,
    active_buffs: activeBuffs,
    statistics,
  };

  const performServerResetAndReload = useCallback(async () => {
    setServerResetBusy(true);
    setServerResetError(null);
    try {
      const token = await getApiAccessToken();
      await saveClickerState(token, createDefaultClickerState());
      setConfirmServerReset(false);
      setLoadError(null);
      setConfirmFinalReset(false);
      finalCompleteBeforeSaveRef.current = false;
      setLoadAttempt((n) => n + 1);
    } catch (e) {
      setServerResetError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setServerResetBusy(false);
    }
  }, [getApiAccessToken]);

  const performTier1Reset = useCallback(async () => {
    setFinalResetBusy(true);
    try {
      const token = await getApiAccessToken();
      const fresh = createDefaultClickerState();
      await saveClickerState(token, fresh);
      applyNormalizedState(fresh, {
        setResources,
        setOwnedUpgrades,
        setOwnedUpgradeOrder,
        setRevealedUpgrades,
        setUnlockedMechanics,
        setCatalogVersion,
        setActiveBuffs,
        setStatistics,
      });
      ownedRef.current = fresh.owned_upgrades;
      stateRef.current = fresh;
      setConfirmFinalReset(false);
      finalCompleteBeforeSaveRef.current = false;
      void refreshSession();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setFinalResetBusy(false);
    }
  }, [getApiAccessToken, refreshSession]);

  useEffect(() => {
    if (!finalTierComplete) {
      setConfirmFinalReset(false);
    }
  }, [finalTierComplete]);

  useEffect(() => {
    if (!isAuthenticated || !sessionUser) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadStatus("loading");
      setLoadError(null);
      try {
        const token = await getApiAccessToken();
        const res = await fetchClickerState(token);
        if (cancelled) return;
        const normalized = normalizeClickerStateForSchema(
          res.state,
          res.schema_version,
        );
        setResources({ energy: normalized.energy });
        setOwnedUpgrades(normalized.owned_upgrades);
        setOwnedUpgradeOrder(normalized.owned_upgrade_order);
        setRevealedUpgrades(normalized.revealed_upgrades);
        setUnlockedMechanics(normalized.unlocked_mechanics);
        setCatalogVersion(normalized.catalog_version);
        setActiveBuffs(normalized.active_buffs);
        setStatistics(normalized.statistics);
        ownedRef.current = normalized.owned_upgrades;
        stateRef.current = normalized;
        saveDirtyRef.current = false;
        setLoadStatus("ready");
        setSaveAuthBlocked(false);
        setSaveError(null);
        finalCompleteBeforeSaveRef.current = finalTierPondComplete(
          normalized.owned_upgrades,
        );
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load");
          setLoadStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, sessionUser, loadAttempt, getApiAccessToken]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !sessionUser ||
      loadStatus !== "ready" ||
      saveAuthBlocked
    )
      return;
    const scheduleIdleSave = () => {
      if (!saveDirtyRef.current) return;
      if (saveInFlightRef.current) return;
      // If the user is actively clicking/buying, don't interrupt input handling.
      if (Date.now() - lastInteractionAtMsRef.current < 650) return;
      if (saveIdleHandleRef.current !== null) return;

      const run = () => {
        saveIdleHandleRef.current = null;
        if (!saveDirtyRef.current) return;
        if (saveInFlightRef.current) return;
        if (Date.now() - lastInteractionAtMsRef.current < 650) return;
        saveInFlightRef.current = true;
        void (async () => {
          try {
            // Avoid a re-render every autosave when there's no visible error.
            setSaveError((prev) => (prev ? null : prev));
            const token = await getApiAccessToken();
            // JSON.stringify can be chunky — do it only when idle.
            const saveRes = await saveClickerState(token, stateRef.current);
            saveDirtyRef.current = false;
            setSaveAuthBlocked(false);
            const nowFinalComplete = finalTierPondComplete(
              stateRef.current.owned_upgrades,
            );
            if (saveRes.pondclicker_badges_unlocked) {
              void refreshSession();
            }
            if (nowFinalComplete && !finalCompleteBeforeSaveRef.current) {
              finalCompleteBeforeSaveRef.current = true;
              if (!saveRes.pondclicker_badges_unlocked) {
                void refreshSession();
              }
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Save failed";
            setSaveError(msg);
            if (isClickerAuthFailureMessage(msg)) {
              setSaveAuthBlocked(true);
            }
          } finally {
            saveInFlightRef.current = false;
          }
        })();
      };

      type RicFn = (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number;
      const ric = (window as unknown as { requestIdleCallback?: RicFn })
        .requestIdleCallback;
      if (typeof ric === "function") {
        saveIdleHandleRef.current = ric(run, { timeout: 1200 }) as number;
      } else {
        saveIdleHandleRef.current = window.setTimeout(run, 0);
      }
    };

    const id = window.setInterval(scheduleIdleSave, SAVE_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
      if (saveIdleHandleRef.current !== null) {
        type CancelRicFn = (id: number) => void;
        const cancelRic = (window as unknown as { cancelIdleCallback?: CancelRicFn })
          .cancelIdleCallback;
        if (typeof cancelRic === "function") {
          cancelRic(saveIdleHandleRef.current);
        } else {
          window.clearTimeout(saveIdleHandleRef.current);
        }
        saveIdleHandleRef.current = null;
      }
    };
  }, [
    isAuthenticated,
    sessionUser,
    loadStatus,
    getApiAccessToken,
    saveAuthBlocked,
    refreshSession,
  ]);

  useEffect(() => {
    if (!isAuthenticated || loadStatus !== "ready") return;
    const id = window.setInterval(() => {
      const sim = simulateOwnedUpgrades(ownedRef.current);
      const dt = PASSIVE_TICK_MS / 1000;
      const energyGain = Math.max(0, sim.resourceRates.energy * dt);
      setResources((curr) => applyResourceDelta(curr, sim.resourceRates, dt));
      setUnlockedMechanics(sim.unlockedMechanics);
      if (energyGain > 0) {
        saveDirtyRef.current = true;
        setStatistics((s) => ({
          ...s,
          total_energy_earned: s.total_energy_earned + energyGain,
        }));
      }
    }, PASSIVE_TICK_MS);
    return () => window.clearInterval(id);
  }, [isAuthenticated, loadStatus]);

  useEffect(() => {
    if (loadStatus !== "ready") return;
    setRevealedUpgrades((prev) => {
      let next: Record<string, boolean> | null = null;
      for (const def of CATALOG_UPGRADES) {
        // Sticky behavior: once a card has ever been visible in the shop,
        // keep it revealed regardless of later energy drops or stat scaling.
        if (
          !getOwnedCount(ownedUpgrades, def.id) &&
          !((next ?? prev)[def.id] ?? false) &&
          isUpgradeVisible(def, ownedUpgrades, resources, prev)
        ) {
          if (!next) next = { ...prev };
          next[def.id] = true;
          continue;
        }

        if (getOwnedCount(ownedUpgrades, def.id) > 0) continue;
        if ((next ?? prev)[def.id]) continue;
        if (
          !isUpgradeUnlocked(
            def,
            ownedUpgrades,
            resources,
            pondStats,
            biodiversity,
          )
        )
          continue;
        const tier1Cost = nextPurchaseCost(def, 0);
        if (!tier1Cost) continue;
        const thr = Math.ceil((tier1Cost.energy ?? 0) / 2);
        if (resources.energy >= thr) {
          if (!next) next = { ...prev };
          next[def.id] = true;
        }
      }
      return next ?? prev;
    });
  }, [
    resources.energy,
    ownedUpgrades,
    loadStatus,
    resources,
    pondStats,
    biodiversity,
  ]);

  const buyUpgrade = useCallback((def: UpgradeDef) => {
    const owned = ownedRef.current;
    const resBefore = gameRef.current;
    const statsBefore = computePondStats(owned);
    const bioBefore = computeBiodiversity(owned);
    const ownedCount = getOwnedCount(owned, def.id);
    if (nextPurchaseCost(def, ownedCount) === null) return;
    const nextCost = nextPurchaseCost(def, ownedCount);
    if (!nextCost) return;
    if (!isUpgradeUnlocked(def, owned, resBefore, statsBefore, bioBefore))
      return;
    if (!canAffordCosts(nextCost, resBefore)) return;

    const resAfter: ResourceBalances = {
      energy: Math.max(0, resBefore.energy - nextCost.energy),
    };
    const ownedAfterPurchase = ownedCount + 1;

    setRevealedUpgrades((prev) => {
      const next = { ...prev };

      for (const u of CATALOG_UPGRADES) {
        if (u.id === def.id) continue;
        const oc = getOwnedCount(owned, u.id);
        if (!isUpgradeUnlocked(u, owned, resBefore, statsBefore, bioBefore))
          continue;
        const t = revealEnergyThresholdForNextPurchase(u, oc);
        if (resBefore.energy >= t) {
          next[u.id] = true;
        }
      }

      if (nextPurchaseCost(def, ownedAfterPurchase) !== null) {
        next[def.id] = true;
      }

      return next;
    });

    lastInteractionAtMsRef.current = Date.now();
    saveDirtyRef.current = true;
    setResources(() => resAfter);
    setOwnedUpgradeOrder((ord) => [def.id, ...ord.filter((k) => k !== def.id)]);
    setOwnedUpgrades((o) => {
      const next = { ...o, [def.id]: ownedCount + 1 };
      ownedRef.current = next;
      return next;
    });
  }, []);

  const simulation = useMemo(
    () => simulateOwnedUpgrades(ownedUpgrades),
    [ownedUpgrades],
  );
  const rates = simulation.resourceRates;

  const ownedListOrdered = useMemo(() => {
    const byKey = new Map(CATALOG_UPGRADES.map((u) => [u.id, u] as const));
    const seen = new Set<string>();
    const list: UpgradeDef[] = [];
    for (const k of ownedUpgradeOrder) {
      const d = byKey.get(k);
      if (!d || getOwnedCount(ownedUpgrades, d.id) <= 0) continue;
      list.push(d);
      seen.add(k);
    }
    for (const def of CATALOG_UPGRADES) {
      if (getOwnedCount(ownedUpgrades, def.id) > 0 && !seen.has(def.id)) {
        list.push(def);
        seen.add(def.id);
      }
    }
    return list;
  }, [ownedUpgradeOrder, ownedUpgrades]);

  const ownedCountsByFamily = useMemo(() => {
    const counts = {} as Record<UpgradeFamily, number>;
    for (const family of Object.keys(FAMILY_PRESENTATION) as UpgradeFamily[]) {
      counts[family] = 0;
    }
    for (const def of CATALOG_UPGRADES) {
      counts[def.family] += effectiveOwnedStacks(def, ownedUpgrades);
    }
    return counts;
  }, [ownedUpgrades]);

  const ownedCountsByTier = useMemo(() => {
    const counts: Record<number, number> = {
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
      7: 0,
    };
    for (const def of CATALOG_UPGRADES) {
      const t = def.tier;
      if (t >= 0 && t <= 7) counts[t] += effectiveOwnedStacks(def, ownedUpgrades);
    }
    return counts;
  }, [ownedUpgrades]);

  const hasTierOnePlusOwned = useMemo(() => {
    let s = 0;
    for (let t = 1; t <= 7; t++) s += ownedCountsByTier[t] ?? 0;
    return s > 0;
  }, [ownedCountsByTier]);

  useEffect(() => {
    if (!hasTierOnePlusOwned) setOwnedTierFilter(null);
  }, [hasTierOnePlusOwned]);

  const ownedListFiltered = useMemo(() => {
    let list = ownedListOrdered;
    if (ownedFamilyFilter) {
      list = list.filter((def) => def.family === ownedFamilyFilter);
    }
    if (ownedTierFilter !== null) {
      list = list.filter((def) => def.tier === ownedTierFilter);
    }
    return list;
  }, [ownedListOrdered, ownedFamilyFilter, ownedTierFilter]);

  const shopVisible = useMemo(
    () =>
      CATALOG_UPGRADES.filter((def) =>
        isUpgradeVisible(def, ownedUpgrades, resources, revealedUpgrades),
      ),
    [ownedUpgrades, resources, revealedUpgrades],
  );

  const shopOrdered = useMemo(() => {
    const isPurchasable = (def: UpgradeDef) => {
      const c = nextPurchaseCost(def, getOwnedCount(ownedUpgrades, def.id));
      return (
        c !== null &&
        isUpgradeUnlocked(
          def,
          ownedUpgrades,
          resources,
          pondStats,
          biodiversity,
        ) &&
        canAffordCosts(c, resources)
      );
    };

    const purchasableDefs = shopVisible.filter(isPurchasable);
    const purchIds = new Set(purchasableDefs.map((d) => d.id));

    const order = shopPurchasableOrderRef.current.filter((id) =>
      purchIds.has(id),
    );
    for (const def of CATALOG_UPGRADES) {
      if (!purchIds.has(def.id)) continue;
      if (!order.includes(def.id)) order.push(def.id);
    }
    shopPurchasableOrderRef.current = order;

    const idToDef = new Map(CATALOG_UPGRADES.map((d) => [d.id, d] as const));
    const purchOrdered = order
      .map((id) => idToDef.get(id))
      .filter(
        (d): d is UpgradeDef =>
          d !== undefined &&
          shopVisible.some((v) => v.id === d.id) &&
          isPurchasable(d),
      );

    const unpurch = shopVisible
      .filter((d) => !isPurchasable(d))
      .sort((a, b) => {
        const ca = nextPurchaseCost(a, getOwnedCount(ownedUpgrades, a.id));
        const cb = nextPurchaseCost(b, getOwnedCount(ownedUpgrades, b.id));
        const ea = ca?.energy ?? Number.POSITIVE_INFINITY;
        const eb = cb?.energy ?? Number.POSITIVE_INFINITY;
        return ea - eb;
      });

    return [...purchOrdered, ...unpurch];
  }, [
    shopVisible,
    ownedUpgrades,
    resources,
    pondStats,
    biodiversity,
  ]);

  const shopListRevision = useMemo(
    () => shopOrdered.map((d) => d.id).join("|"),
    [shopOrdered],
  );

  if (!isAuthenticated) {
    return (
      <ClickerPageShell>
        <Box maxW="7xl" mx="auto">
          <Text textStyle={{ base: "sm", md: "md" }}>Sign in to play.</Text>
        </Box>
      </ClickerPageShell>
    );
  }

  if (isAuthenticated && !sessionUser && !sessionLoading) {
    return (
      <ClickerPageShell>
        <Box maxW="7xl" mx="auto">
          <Text fontSize={{ base: "sm", md: "md" }} color="fg">
            {sessionError ??
              "Could not load your account session. Try signing in again."}
          </Text>
        </Box>
      </ClickerPageShell>
    );
  }

  if (sessionLoading || !sessionUser || loadStatus === "loading") {
    return (
      <ClickerPageShell>
        <Text fontSize={{ base: "sm", md: "md" }}>Loading…</Text>
      </ClickerPageShell>
    );
  }

  if (loadStatus === "error") {
    const is403 = (loadError ?? "").includes("403");
    return (
      <ClickerPageShell>
        <Box maxW="7xl" mx="auto">
          <Stack gap="3">
            <Box>
              <Text fontWeight="semibold" color="fg">
                Could not load your game state.
              </Text>
              <Text mt="1" fontSize={APP_TEXT_SIZES.helper} color="fg">
                {loadError ?? "Failed to load game state."}
              </Text>
              {is403 ? (
                <Text mt="2" fontSize={APP_TEXT_SIZES.helper} color="gray.600">
                  This is usually a sign-in or session issue. Try signing out
                  and back in.
                </Text>
              ) : null}
            </Box>
            {serverResetError ? (
              <Text
                role="alert"
                fontSize={APP_TEXT_SIZES.helper}
                color="nautical.solid"
                fontWeight="medium"
              >
                {serverResetError}
              </Text>
            ) : null}
            <Flex flexWrap="wrap" gap="2" align="center">
              <PondButton
                type="button"
                size="md"
                colorPalette="nautical"
                onClick={() => navigate("/clicker")}
              >
                Back to lobby
              </PondButton>
              <PondButton
                type="button"
                size="md"
                colorPalette="nautical"
                variant="outline"
                onClick={() => setLoadAttempt((n) => n + 1)}
              >
                Try again
              </PondButton>
              <PondButton
                type="button"
                size="md"
                colorPalette="nautical"
                variant="outline"
                loading={serverResetBusy}
                disabled={serverResetBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!confirmServerReset) {
                    setConfirmServerReset(true);
                    setServerResetError(null);
                    return;
                  }
                  void performServerResetAndReload();
                }}
              >
                {confirmServerReset ? "Confirm reset" : "Reset saved game"}
              </PondButton>
            </Flex>
          </Stack>
        </Box>
      </ClickerPageShell>
    );
  }

  return (
    <ClickerPageShell>
      <Stack gap={{ base: "1.5", md: "2" }} w="full">
        <ClickerResourceHud
          resources={resources}
          rates={rates}
          clickPower={simulation.clickValue}
          hasBasin={getOwnedCount(ownedUpgrades, "pond_basin") >= 1}
          pondStats={pondStats}
          biodiversityStackTotal={biodiversityStackTotal}
          showResetPond={finalTierComplete}
          confirmResetPond={confirmFinalReset}
          resetPondBusy={finalResetBusy}
          onResetPondClick={(e) => {
            e.stopPropagation();
            if (!confirmFinalReset) {
              setConfirmFinalReset(true);
              return;
            }
            void performTier1Reset();
          }}
        />
        {saveError ? (
          <Stack gap="1">
            <Text fontSize={APP_TEXT_SIZES.helper} color="nautical.solid">
              {saveError}
            </Text>
            {saveAuthBlocked ? (
              <Text fontSize={APP_TEXT_SIZES.meta} color="gray.700">
                Your session may have expired. Try logging out and logging back
                in.
              </Text>
            ) : null}
          </Stack>
        ) : null}

        <Grid
          templateColumns={{
            base: "1fr",
            md: "minmax(260px, 1.1fr) minmax(240px, 1fr)",
          }}
          gap={{ base: 2, md: 3 }}
          alignItems="start"
        >
          <Stack
            gap="2"
            order={{ base: 1, md: 1 }}
            w="full"
            minW="0"
            opacity={1}
            transition="opacity 0.2s ease"
          >
            <PondStage
              hasBasin={getOwnedCount(ownedUpgrades, "pond_basin") >= 1}
              ownedUpgrades={ownedUpgrades}
              ecologyHoverNote={
                getOwnedCount(ownedUpgrades, "pond_basin") >= 1
                  ? POND_STAGE_ECOLOGY_NOTE
                  : undefined
              }
              clickDisabled={getOwnedCount(ownedUpgrades, "pond_basin") < 1}
              onClickPond={() => {
                if (getOwnedCount(ownedUpgrades, "pond_basin") < 1) return;
                const gain = simulation.clickValue;
                lastInteractionAtMsRef.current = Date.now();
                saveDirtyRef.current = true;
                setResources((curr) => ({
                  ...curr,
                  energy: curr.energy + gain,
                }));
                setStatistics((s) => ({
                  ...s,
                  total_clicks: s.total_clicks + 1,
                  total_energy_earned: s.total_energy_earned + gain,
                }));
              }}
            />
            {ownedListOrdered.length > 0 ? (
              <Stack gap="1" w="full">
                {hasTierOnePlusOwned ? (
                  <Flex align="center" gap="2" flexWrap="wrap">
                    <Heading as="h2" size="xs">
                      Tier:
                    </Heading>
                    <Flex gap="1" flexWrap="wrap" align="center">
                      {([0, 1, 2, 3, 4, 5, 6, 7] as const).map((tier) => {
                        const n = ownedCountsByTier[tier] ?? 0;
                        if (n <= 0) return null;
                        const label = tierFilterTabLabel(tier);
                        const isSelected = ownedTierFilter === tier;
                        const isDimmed =
                          ownedTierFilter !== null && !isSelected;
                        const tooltip =
                          OWNED_TIER_ECOLOGY_SENTENCE[tier] ??
                          `Tier ${label}: upgrades in this band change how full and busy the pond feels.`;
                        const pill = (
                          <Flex
                            role="button"
                            tabIndex={0}
                            aria-pressed={isSelected}
                            align="center"
                            gap="1"
                            px="2"
                            py="1"
                            borderWidth="1px"
                            borderColor={isSelected ? "black" : "border"}
                            borderRadius="md"
                            bg={isSelected ? "gray.100" : "bg.subtle"}
                            cursor="pointer"
                            userSelect="none"
                            opacity={isDimmed ? 0.35 : 1}
                            filter={isDimmed ? "grayscale(1)" : "none"}
                            onClick={() =>
                              setOwnedTierFilter((curr) =>
                                curr === tier ? null : tier,
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setOwnedTierFilter((curr) =>
                                  curr === tier ? null : tier,
                                );
                              }
                            }}
                            title={
                              !canHoverEcologyTooltips ? tooltip : undefined
                            }
                          >
                            <Text
                              fontSize="xs"
                              fontWeight="semibold"
                              color="gray.700"
                              lineHeight="1"
                            >
                              {label}
                            </Text>
                            <Text
                              as="span"
                              fontSize="xs"
                              fontWeight="semibold"
                              color="gray.500"
                              lineHeight="1"
                              aria-hidden
                            >
                              ·
                            </Text>
                            <Text
                              fontSize="xs"
                              fontWeight="semibold"
                              fontVariantNumeric="tabular-nums"
                              color="gray.700"
                              lineHeight="1"
                            >
                              {n}
                            </Text>
                          </Flex>
                        );
                        return (
                          <Fragment key={`tier-${tier}`}>
                            {canHoverEcologyTooltips ? (
                              <TooltipRoot
                                {...ecologyTooltipRootBaseProps}
                                openDelay={700}
                                positioning={{ placement: "top" }}
                              >
                                <TooltipTrigger asChild>{pill}</TooltipTrigger>
                                <TooltipPositioner>
                                  <TooltipContent
                                    {...ecologyTooltipSurfaceProps}
                                  >
                                    <EcologyBlurbText>{tooltip}</EcologyBlurbText>
                                  </TooltipContent>
                                </TooltipPositioner>
                              </TooltipRoot>
                            ) : (
                              pill
                            )}
                          </Fragment>
                        );
                      })}
                    </Flex>
                  </Flex>
                ) : null}
                <Flex align="center" gap="2" flexWrap="wrap">
                  <Heading as="h2" size="xs">
                    Biodiversity:
                  </Heading>
                  <Flex gap="1" flexWrap="wrap" align="center">
                    {(
                      Object.keys(FAMILY_PRESENTATION) as UpgradeFamily[]
                    ).map((family) => {
                      const n = ownedCountsByFamily[family] ?? 0;
                      if (n <= 0) return null;
                      const meta = FAMILY_PRESENTATION[family];
                      const isSelected = ownedFamilyFilter === family;
                      const isDimmed =
                        ownedFamilyFilter !== null && !isSelected;
                      const tooltip = `${meta.label} — ${FAMILY_ECOSYSTEM_ROLE[family]}`;
                      const pill = (
                        <Flex
                          role="button"
                          tabIndex={0}
                          aria-pressed={isSelected}
                          align="center"
                          gap="1"
                          px="2"
                          py="1"
                          borderWidth="1px"
                          borderColor={isSelected ? "black" : "border"}
                          borderRadius="md"
                          bg={isSelected ? "gray.100" : "bg.subtle"}
                          cursor="pointer"
                          userSelect="none"
                          opacity={isDimmed ? 0.35 : 1}
                          filter={isDimmed ? "grayscale(1)" : "none"}
                          onClick={() =>
                            setOwnedFamilyFilter((curr) =>
                              curr === family ? null : family,
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setOwnedFamilyFilter((curr) =>
                                curr === family ? null : family,
                              );
                            }
                          }}
                          title={
                            !canHoverEcologyTooltips ? tooltip : undefined
                          }
                        >
                          <Text
                            fontSize="sm"
                            lineHeight="1"
                            color={isSelected ? meta.accent : "gray.700"}
                          >
                            {meta.symbol}
                          </Text>
                          <Text
                            fontSize="xs"
                            fontWeight="semibold"
                            fontVariantNumeric="tabular-nums"
                            color="gray.700"
                            lineHeight="1"
                          >
                            {n}
                          </Text>
                        </Flex>
                      );

                      return (
                        <Fragment key={family}>
                          {canHoverEcologyTooltips ? (
                            <TooltipRoot
                              {...ecologyTooltipRootBaseProps}
                              openDelay={700}
                              positioning={{ placement: "top" }}
                            >
                              <TooltipTrigger asChild>{pill}</TooltipTrigger>
                              <TooltipPositioner>
                                <TooltipContent
                                  {...ecologyTooltipSurfaceProps}
                                >
                                  <EcologyBlurbText>{tooltip}</EcologyBlurbText>
                                </TooltipContent>
                              </TooltipPositioner>
                            </TooltipRoot>
                          ) : (
                            pill
                          )}
                        </Fragment>
                      );
                    })}
                  </Flex>
                </Flex>
                <Flex
                  gap="1.5"
                  w="full"
                  overflowX={{ base: "auto", md: "visible" }}
                  flexWrap={{ base: "nowrap", md: "wrap" }}
                  pb={{ base: "0.5", md: "0" }}
                  style={{ scrollSnapType: "x mandatory" }}
                >
                  {ownedListFiltered.map((def) => (
                    <Box
                      key={def.id}
                      flexShrink={0}
                      style={{ scrollSnapAlign: "start" }}
                    >
                      <OwnedChip
                        def={def}
                        ownedUpgrades={ownedUpgrades}
                      />
                    </Box>
                  ))}
                </Flex>
              </Stack>
            ) : null}
          </Stack>

          <Stack
            gap="1.5"
            order={{ base: 2, md: 2 }}
            w="full"
            minW="0"
            minH="0"
            opacity={1}
            pointerEvents="auto"
          >
            {shopOrdered.length > 0 ? (
              <>
                <Heading as="h2" size="xs">
                  Shop
                </Heading>
                <Grid
                  templateColumns="repeat(2, minmax(0, 1fr))"
                  gap="1.5"
                  w="full"
                  alignItems="stretch"
                >
                  {shopOrdered.map((def) => (
                    <GridItem key={def.id} minW="0" h="full">
                      <UpgradeCard
                        def={def}
                        resources={resources}
                        ownedUpgrades={ownedUpgrades}
                        pondStats={pondStats}
                        biodiversity={biodiversity}
                        onBuy={buyUpgrade}
                        shopListRevision={shopListRevision}
                      />
                    </GridItem>
                  ))}
                </Grid>
              </>
            ) : null}
          </Stack>
        </Grid>
      </Stack>
    </ClickerPageShell>
  );
}
