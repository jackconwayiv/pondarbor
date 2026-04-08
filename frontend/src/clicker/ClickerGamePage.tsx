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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";
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
} from "./catalog";
import { EcologyBlurbText, ecologyPopoverContentProps, ecologyTooltipSurfaceProps } from "./ecologyUi";
import {
  CATALOG_CONTENT_VERSION,
  createDefaultClickerState,
  fetchClickerState,
  normalizeClickerStateForSchema,
  saveClickerState,
  type ClickerGameStateV1,
} from "./api";
import PondStage from "./PondStage";
import { ClickerPageShell } from "./ClickerShell";
import {
  canAffordCosts,
  computeBiodiversity,
  computePondStats,
  getOwnedCount,
  isUpgradeUnlocked,
  isUpgradeVisible,
  revealEnergyThresholdForNextPurchase,
  scaledNumericGateMin,
  tier1PondComplete,
  type ResourceBalances,
} from "./ruleEngine";
import { applyResourceDelta, simulateOwnedUpgrades } from "./simulation";

const SAVE_INTERVAL_MS = 2000;
const PASSIVE_TICK_MS = 1000;

function formatPassiveRate(n: number): string {
  const r = Math.round(n * 100) / 100;
  if (Number.isInteger(r)) return String(r);
  const s = r.toFixed(2);
  return s.endsWith("0") ? s.slice(0, -1) : s;
}

function formatHudResourceAmount(n: number): string {
  const x = Math.max(0, n);
  if (!Number.isFinite(x)) return "0";
  const oneDec = (v: number): string => {
    const rounded = Math.round(v * 10) / 10;
    const s = rounded.toFixed(1);
    return s.endsWith(".0") ? s.slice(0, -2) : s;
  };
  if (x >= 1e12) return `${oneDec(x / 1e12)} T`;
  if (x >= 1e9) return `${oneDec(x / 1e9)} B`;
  if (x >= 1e6) return `${oneDec(x / 1e6)} M`;
  return String(Math.floor(x));
}

const initialGameState = (): ClickerGameStateV1 => createDefaultClickerState();

type LoadStatus = "loading" | "ready" | "error";

const MECHANIC_DISPLAY_LABELS: Record<string, string> = {
  pond_unlocked: "Pond",
};

function mechanicUnlockLabel(mechanicId: string): string {
  return MECHANIC_DISPLAY_LABELS[mechanicId] ?? mechanicId;
}

function multiplierTargetLabel(target: "global" | "click" | "passive"): string {
  if (target === "click") return "click energy";
  if (target === "passive") return "passive energy";
  return "all outputs";
}

/** Single schema for shop cards: what each owned copy does (no marginal/delta line). */
function shopCardFunctionLine(def: UpgradeDef): string | null {
  const parts: string[] = [];
  for (const e of def.effects) {
    if (e.type === "passive_generation") {
      const meta = RESOURCE_PRESENTATION[e.resource];
      parts.push(`+${formatPassiveRate(e.amount)} ${meta.label}/s`);
    } else if (e.type === "multiplier") {
      const pct = Math.round(e.value * 100);
      parts.push(`Multiplies ${multiplierTargetLabel(e.target)} (+${pct}%)`);
    } else if (e.type === "click_bonus") {
      parts.push(`Adds +${formatPassiveRate(e.amount)} energy per click`);
    } else if (e.type === "unlock") {
      parts.push(`Unlocks ${mechanicUnlockLabel(e.mechanicId)}`);
    } else if (e.type === "threshold_delta") {
      parts.push(`+${formatPassiveRate(e.delta)} ${POND_STAT_LABELS[e.stat]}`);
    }
  }
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

function scaleEffectForDisplay(effect: UpgradeEffect, level: number): UpgradeEffect {
  if (effect.type === "click_bonus") return { ...effect, amount: effect.amount * level };
  if (effect.type === "passive_generation") return { ...effect, amount: effect.amount * level };
  if (effect.type === "multiplier") return { ...effect, value: effect.value * level };
  if (effect.type === "threshold_delta") return { ...effect, delta: effect.delta * level };
  return effect;
}

/** Actual contribution at current stack count (matches simulation; excludes other upgrades’ multipliers). */
function effectSummaryAtLevel(def: UpgradeDef, level: number): string | null {
  if (level <= 0) return null;
  let clickBonus = 0;
  const lines: string[] = [];
  for (const effect of def.effects) {
    const scaled = scaleEffectForDisplay(effect, level);
    if (scaled.type === "click_bonus") clickBonus += scaled.amount;
    if (scaled.type === "passive_generation") {
      const meta = RESOURCE_PRESENTATION[scaled.resource];
      lines.push(`+${formatPassiveRate(scaled.amount)} ${meta.label}/s`);
    }
    if (scaled.type === "multiplier") {
      lines.push(`+${Math.round(scaled.value * 100)}% ${scaled.target}`);
    }
    if (scaled.type === "unlock") {
      lines.push(`Unlock: ${mechanicUnlockLabel(scaled.mechanicId)}`);
    }
    if (scaled.type === "threshold_delta") {
      lines.push(`+${formatPassiveRate(scaled.delta)} ${POND_STAT_LABELS[scaled.stat]}`);
    }
  }
  if (clickBonus > 0) lines.unshift(`+${formatPassiveRate(clickBonus)} per click`);
  return lines.length > 0 ? lines.join(" • ") : null;
}

function formatResourceCostParts(costs: Partial<Record<PrimaryResourceId, number>>): string[] {
  const parts: string[] = [];
  for (const resourceId of PRIMARY_RESOURCE_IDS) {
    const v = costs[resourceId];
    if (typeof v === "number" && v > 0) {
      parts.push(`${v} ${RESOURCE_PRESENTATION[resourceId].symbol}`);
    }
  }
  return parts;
}

type PondGateRow = { title: string; required: number; current: number; met: boolean };

function pondGateRowsForShopCard(
  def: UpgradeDef,
  ownedUpgrades: Record<string, number>,
  pondStats: ReturnType<typeof computePondStats>,
  biodiversity: number,
): PondGateRow[] {
  const rows: PondGateRow[] = [];
  for (const r of def.requirements) {
    if (r.type === "stat_threshold") {
      const required = scaledNumericGateMin(r, def, ownedUpgrades);
      const current = pondStats[r.stat];
      rows.push({
        title: POND_STAT_LABELS[r.stat],
        required,
        current,
        met: current >= required,
      });
    } else if (r.type === "biodiversity_threshold") {
      const required = scaledNumericGateMin(r, def, ownedUpgrades);
      rows.push({
        title: "Biodiversity",
        required,
        current: biodiversity,
        met: biodiversity >= required,
      });
    }
  }
  return rows;
}

/** Mobile / coarse pointer only: small black “?” opens the ecology popover. */
function EcologyHelpMobileButton({ upgradeName, ecologyNote }: { upgradeName: string; ecologyNote: string }) {
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
        <PopoverContent {...ecologyPopoverContentProps} w={{ base: "calc(100vw - 2rem)", md: "auto" }}>
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
  biodiversity,
}: {
  resources: ResourceBalances;
  rates: ResourceBalances;
  /** Energy gained per pond click (0 when paused). */
  clickPower: number;
  /** After Pond Basin, show per-click line in the HUD (hidden before that). */
  hasBasin: boolean;
  pondStats: ReturnType<typeof computePondStats>;
  biodiversity: number;
}) {
  return (
    <Box
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
      bg="bg"
      py="2"
      px={{ base: 2, md: 3 }}
      w={{ base: "full", md: "fit-content" }}
      maxW="100%"
      minW="0"
      alignSelf={{ base: "stretch", md: "flex-start" }}
      overflow="hidden"
    >
      <Grid
        templateColumns="auto auto"
        alignItems="stretch"
        columnGap={{ base: 3, md: 4 }}
        w={{ base: "full", md: "auto" }}
        maxW="100%"
        minW="0"
      >
        <GridItem minW="0" maxW="100%" boxSizing="border-box" display="flex" flexDirection="column">
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
                  <Stack gap="0.5" align={isEnergy ? "center" : "stretch"} w="full">
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
                  <Stack gap="1" justify="center" minW="0" py="0.5" alignSelf="center">
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
                      {formatPassiveRate(rate)}
                      {meta.symbol}/s
                    </Text>
                    {hasBasin ? (
                      <Text
                        fontSize="2xs"
                        color="gray.600"
                        lineHeight="1.2"
                        fontVariantNumeric="tabular-nums"
                        whiteSpace="nowrap"
                        title="Energy per pond click"
                      >
                        {clickPower > 0 ? "+" : ""}
                        {formatPassiveRate(clickPower)}
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
          <SimpleGrid columns={{ base: 2, sm: 3, md: 5 }} gap="2" w="full" minW="0" flex="1">
            {(Object.keys(POND_STAT_LABELS) as Array<keyof typeof POND_STAT_LABELS>).map((k) => (
              <Box
                key={k}
                borderWidth="1px"
                borderColor="border"
                borderRadius="md"
                bg="bg.subtle"
                px="2"
                py="1.5"
                minW="0"
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
                    {POND_STAT_LABELS[k]}
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
            ))}
            <Box
              borderWidth="1px"
              borderColor="border"
              borderRadius="md"
              bg="bg.subtle"
              px="2"
              py="1.5"
              minW="0"
            >
              <Stack gap="0.5" align="center">
                <Text fontSize="2xs" fontWeight="bold" color="fg" lineHeight="1.2" textAlign="center" w="full">
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
                  {Math.round(biodiversity)}
                </Text>
              </Stack>
            </Box>
          </SimpleGrid>
        </GridItem>
      </Grid>
    </Box>
  );
}

function UpgradeCard({
  def,
  resources,
  ownedUpgrades,
  pondStats,
  biodiversity,
  onBuy,
}: {
  def: UpgradeDef;
  resources: ResourceBalances;
  ownedUpgrades: Record<string, number>;
  pondStats: ReturnType<typeof computePondStats>;
  biodiversity: number;
  onBuy: (def: UpgradeDef) => void;
}) {
  const [canHoverFinePointer] = useMediaQuery(["(hover: hover) and (pointer: fine)"], {
    ssr: false,
    fallback: [false],
  });

  const ownedCount = getOwnedCount(ownedUpgrades, def.id);
  const maxed = nextPurchaseCost(def, ownedCount) === null;
  const nextCost = nextPurchaseCost(def, ownedCount);
  const unlocked = isUpgradeUnlocked(def, ownedUpgrades, resources, pondStats, biodiversity);
  const affordable = !maxed && nextCost !== null && unlocked && canAffordCosts(nextCost, resources);
  const cantAfford =
    unlocked && nextCost !== null && !maxed && !canAffordCosts(nextCost, resources);
  const costLine = nextCost ? formatResourceCostParts(nextCost).join(" ") : "";
  const familyMeta = FAMILY_PRESENTATION[def.family];
  const functionLine = shopCardFunctionLine(def);
  const pondGateRows = pondGateRowsForShopCard(def, ownedUpgrades, pondStats, biodiversity);

  const cardBody = (
    <Box
      position="relative"
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
      py={{ base: "1", md: "1.5" }}
      px={{ base: "1.5", md: "2" }}
      pr={{ base: "1.625rem", md: "2" }}
      bg={cantAfford ? "gray.200" : "bg"}
      h="full"
      minH="0"
      w="full"
      display="flex"
      flexDirection="column"
    >
      {!canHoverFinePointer ? (
        <Box position="absolute" top="0.375rem" right="0.375rem" zIndex={1}>
          <EcologyHelpMobileButton upgradeName={def.name} ecologyNote={def.ecologyNote} />
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
          {def.name}
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
      {functionLine ? (
        <Text fontSize="xs" color="gray.700" mt="1" lineHeight="1.3">
          {functionLine}
        </Text>
      ) : null}
      {pondGateRows.length > 0 ? (
        <Stack gap="0.5" mt="1" align="stretch">
          {pondGateRows.map((row) => (
            <Text
              key={row.title}
              fontSize="2xs"
              color={row.met ? "lilypad.solid" : "gray.700"}
              lineHeight="1.3"
              fontVariantNumeric="tabular-nums"
            >
              {row.title} ≥ {row.required}
              <Box as="span" color={row.met ? "lilypad.solid" : "gray.600"} fontWeight="normal">
                {" "}
                ({Math.round(row.current)}/{row.required})
              </Box>
            </Text>
          ))}
        </Stack>
      ) : null}
      {!maxed && nextCost ? (
        <Flex align="center" justify="space-between" gap="1.5" mt="1.5" w="full" minW="0">
          <Text fontSize="xs" color="gray.700" flexShrink={0}>
            <strong>{costLine}</strong>
          </Text>
          <PondButton type="button" size="xs" colorPalette="nautical" disabled={!affordable} flexShrink={0} onClick={() => onBuy(def)}>
            Buy
          </PondButton>
        </Flex>
      ) : null}
    </Box>
  );

  if (canHoverFinePointer) {
    return (
      <TooltipRoot openDelay={1000} closeDelay={150} interactive positioning={{ placement: "top-start" }}>
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

function OwnedChip({ def, ownedUpgrades }: { def: UpgradeDef; ownedUpgrades: Record<string, number> }) {
  const [canHoverFinePointer] = useMediaQuery(["(hover: hover) and (pointer: fine)"], {
    ssr: false,
    fallback: [false],
  });
  const stacks = effectiveOwnedStacks(def, ownedUpgrades);
  const fx = effectSummaryAtLevel(def, stacks);
  const familyMeta = FAMILY_PRESENTATION[def.family];
  const qtyLabel = def.maxOwned !== undefined ? `${stacks} / ${def.maxOwned}` : String(stacks);

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
          <EcologyHelpMobileButton upgradeName={def.name} ecologyNote={def.ecologyNote} />
        </Box>
      ) : null}
      <Text fontSize="sm" fontWeight="bold" lineHeight="1.3" minW="0" lineClamp={2}>
        {def.name}
      </Text>
      {fx ? (
        <Text fontSize={APP_TEXT_SIZES.meta} color="gray.600" lineHeight="1.35">
          {fx}
        </Text>
      ) : null}
      <Flex justify="space-between" align="center" gap="2" w="full" minW="0">
        <Text fontSize="xs" fontWeight="medium" color={familyMeta.accent} lineClamp={2} flex="1" minW="0">
          {familyMeta.symbol} {familyMeta.label}
        </Text>
        <Text fontSize="xs" fontWeight="medium" color="gray.600" fontVariantNumeric="tabular-nums" flexShrink={0}>
          ×{qtyLabel}
        </Text>
      </Flex>
    </Box>
  );

  if (canHoverFinePointer) {
    return (
      <TooltipRoot openDelay={1000} closeDelay={150} interactive positioning={{ placement: "top-start" }}>
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
  const { setResources, setOwnedUpgrades, setOwnedUpgradeOrder, setRevealedUpgrades, setUnlockedMechanics, setCatalogVersion, setActiveBuffs, setStatistics } = setters;
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
  const [ownedUpgrades, setOwnedUpgrades] = useState<Record<string, number>>({});
  const [ownedUpgradeOrder, setOwnedUpgradeOrder] = useState<string[]>(() => initialGameState().owned_upgrade_order);
  const [revealedUpgrades, setRevealedUpgrades] = useState<Record<string, boolean>>({});
  const [unlockedMechanics, setUnlockedMechanics] = useState<string[]>([]);
  const [catalogVersion, setCatalogVersion] = useState(CATALOG_CONTENT_VERSION);
  const [activeBuffs, setActiveBuffs] = useState<Array<{ id: string; expires_at_ms: number }>>([]);
  const [statistics, setStatistics] = useState(() => createDefaultClickerState().statistics);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveAuthBlocked, setSaveAuthBlocked] = useState(false);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [confirmServerReset, setConfirmServerReset] = useState(false);
  const [serverResetBusy, setServerResetBusy] = useState(false);
  const [serverResetError, setServerResetError] = useState<string | null>(null);
  const [confirmTier1Reset, setConfirmTier1Reset] = useState(false);
  const [tier1ResetBusy, setTier1ResetBusy] = useState(false);
  const tier1CompleteBeforeSaveRef = useRef(false);

  const ownedRef = useRef<Record<string, number>>({});
  ownedRef.current = ownedUpgrades;

  const gameRef = useRef(resources);
  gameRef.current = resources;

  const pondStats = useMemo(() => computePondStats(ownedUpgrades), [ownedUpgrades]);
  const biodiversity = useMemo(() => computeBiodiversity(ownedUpgrades), [ownedUpgrades]);

  const tier1Complete = tier1PondComplete(ownedUpgrades);
  /** Tier 1 finished: no passive energy, no clicks, no purchases until reset. */
  const gamePaused = tier1Complete;

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
      setConfirmTier1Reset(false);
      tier1CompleteBeforeSaveRef.current = false;
      setLoadAttempt((n) => n + 1);
    } catch (e) {
      setServerResetError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setServerResetBusy(false);
    }
  }, [getApiAccessToken]);

  const performTier1Reset = useCallback(async () => {
    setTier1ResetBusy(true);
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
      setConfirmTier1Reset(false);
      tier1CompleteBeforeSaveRef.current = false;
      void refreshSession();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setTier1ResetBusy(false);
    }
  }, [getApiAccessToken, refreshSession]);

  useEffect(() => {
    if (!tier1Complete) {
      setConfirmTier1Reset(false);
    }
  }, [tier1Complete]);

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
        const normalized = normalizeClickerStateForSchema(res.state, res.schema_version);
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
        setLoadStatus("ready");
        setSaveAuthBlocked(false);
        setSaveError(null);
        tier1CompleteBeforeSaveRef.current = tier1PondComplete(normalized.owned_upgrades);
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
    if (!isAuthenticated || !sessionUser || loadStatus !== "ready" || saveAuthBlocked) return;
    const tick = () => {
      void (async () => {
        try {
          setSaveError(null);
          const token = await getApiAccessToken();
          await saveClickerState(token, stateRef.current);
          setSaveAuthBlocked(false);
          const nowTier1 = tier1PondComplete(stateRef.current.owned_upgrades);
          if (nowTier1 && !tier1CompleteBeforeSaveRef.current) {
            tier1CompleteBeforeSaveRef.current = true;
            void refreshSession();
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Save failed";
          setSaveError(msg);
          if (isClickerAuthFailureMessage(msg)) {
            setSaveAuthBlocked(true);
          }
        }
      })();
    };
    const id = window.setInterval(tick, SAVE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isAuthenticated, sessionUser, loadStatus, getApiAccessToken, saveAuthBlocked, refreshSession]);

  useEffect(() => {
    if (!isAuthenticated || loadStatus !== "ready" || gamePaused) return;
    const id = window.setInterval(() => {
      const sim = simulateOwnedUpgrades(ownedRef.current);
      const dt = PASSIVE_TICK_MS / 1000;
      const energyGain = Math.max(0, sim.resourceRates.energy * dt);
      setResources((curr) => applyResourceDelta(curr, sim.resourceRates, dt));
      setUnlockedMechanics(sim.unlockedMechanics);
      if (energyGain > 0) {
        setStatistics((s) => ({ ...s, total_energy_earned: s.total_energy_earned + energyGain }));
      }
    }, PASSIVE_TICK_MS);
    return () => window.clearInterval(id);
  }, [isAuthenticated, loadStatus, gamePaused]);

  useEffect(() => {
    if (loadStatus !== "ready") return;
    setRevealedUpgrades((prev) => {
      let next: Record<string, boolean> | null = null;
      for (const def of CATALOG_UPGRADES) {
        if (getOwnedCount(ownedUpgrades, def.id) > 0) continue;
        if ((next ?? prev)[def.id]) continue;
        if (!isUpgradeUnlocked(def, ownedUpgrades, resources, pondStats, biodiversity)) continue;
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
  }, [resources.energy, ownedUpgrades, loadStatus, resources, pondStats, biodiversity]);

  const buyUpgrade = useCallback(
    (def: UpgradeDef) => {
      const owned = ownedRef.current;
      if (tier1PondComplete(owned)) return;
      const resBefore = gameRef.current;
      const statsBefore = computePondStats(owned);
      const bioBefore = computeBiodiversity(owned);
      const ownedCount = getOwnedCount(owned, def.id);
      if (nextPurchaseCost(def, ownedCount) === null) return;
      const nextCost = nextPurchaseCost(def, ownedCount);
      if (!nextCost) return;
      if (!isUpgradeUnlocked(def, owned, resBefore, statsBefore, bioBefore)) return;
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
          if (!isUpgradeUnlocked(u, owned, resBefore, statsBefore, bioBefore)) continue;
          const t = revealEnergyThresholdForNextPurchase(u, oc);
          if (resBefore.energy >= t) {
            next[u.id] = true;
          }
        }

        if (nextPurchaseCost(def, ownedAfterPurchase) !== null) {
          const thrPurchased = revealEnergyThresholdForNextPurchase(def, ownedAfterPurchase);
          if (resAfter.energy < thrPurchased) {
            next[def.id] = false;
          } else {
            next[def.id] = true;
          }
        }

        return next;
      });

      setResources(() => resAfter);
      setOwnedUpgradeOrder((ord) => [def.id, ...ord.filter((k) => k !== def.id)]);
      setOwnedUpgrades((o) => {
        const next = { ...o, [def.id]: ownedCount + 1 };
        ownedRef.current = next;
        return next;
      });
    },
    [],
  );

  const simulation = useMemo(() => simulateOwnedUpgrades(ownedUpgrades), [ownedUpgrades]);
  const rates = gamePaused ? { energy: 0 } : simulation.resourceRates;

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

  const shopVisible = CATALOG_UPGRADES.filter((def) =>
    isUpgradeVisible(def, ownedUpgrades, resources, revealedUpgrades, pondStats, biodiversity),
  );
  const shopOrdered = [...shopVisible].sort((a, b) => {
    const costA = nextPurchaseCost(a, getOwnedCount(ownedUpgrades, a.id));
    const costB = nextPurchaseCost(b, getOwnedCount(ownedUpgrades, b.id));
    const pa =
      costA !== null &&
      isUpgradeUnlocked(a, ownedUpgrades, resources, pondStats, biodiversity) &&
      canAffordCosts(costA, resources);
    const pb =
      costB !== null &&
      isUpgradeUnlocked(b, ownedUpgrades, resources, pondStats, biodiversity) &&
      canAffordCosts(costB, resources);
    if (pa !== pb) return pa ? -1 : 1;
    return a.tier - b.tier;
  });

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
            {sessionError ?? "Could not load your account session. Try signing in again."}
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
                  This is usually a sign-in or session issue. Try signing out and back in.
                </Text>
              ) : null}
            </Box>
            {serverResetError ? (
              <Text role="alert" fontSize={APP_TEXT_SIZES.helper} color="nautical.solid" fontWeight="medium">
                {serverResetError}
              </Text>
            ) : null}
            <Flex flexWrap="wrap" gap="2" align="center">
              <PondButton type="button" size="md" colorPalette="nautical" onClick={() => navigate("/clicker")}>
                Back to lobby
              </PondButton>
              <PondButton type="button" size="md" colorPalette="nautical" variant="outline" onClick={() => setLoadAttempt((n) => n + 1)}>
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
          clickPower={gamePaused ? 0 : simulation.clickValue}
          hasBasin={getOwnedCount(ownedUpgrades, "pond_basin") >= 1}
          pondStats={pondStats}
          biodiversity={biodiversity}
        />
        {tier1Complete ? (
          <Box
            borderWidth="1px"
            borderColor="border"
            borderRadius="md"
            bg="lilypad.subtle"
            py="3"
            px={{ base: 3, md: 4 }}
            role="status"
            aria-live="polite"
          >
            <Stack gap="3">
              <Box>
                <Heading as="h2" size="sm">
                  Tier 1 complete
                </Heading>
                <Text fontSize="sm" color="fg" mt="1">
                  You have welcomed snails, tadpoles, and water fleas—your pond’s first animal web is alive. This is the
                  end of Tier 1. The game is paused for now: you cannot earn more energy or buy upgrades. Reset your
                  pond to play again, or stay tuned for updates with further pond progression. Your game will be
                  unpaused at that point.
                </Text>
              </Box>
              <PondButton
                type="button"
                size="md"
                colorPalette="orange"
                w={{ base: "full", sm: "auto" }}
                alignSelf={{ base: "stretch", sm: "flex-start" }}
                loading={tier1ResetBusy}
                disabled={tier1ResetBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!confirmTier1Reset) {
                    setConfirmTier1Reset(true);
                    return;
                  }
                  void performTier1Reset();
                }}
              >
                {confirmTier1Reset ? "Confirm reset pond" : "Reset pond"}
              </PondButton>
            </Stack>
          </Box>
        ) : null}
        {saveError ? (
          <Stack gap="1">
            <Text fontSize={APP_TEXT_SIZES.helper} color="nautical.solid">
              {saveError}
            </Text>
            {saveAuthBlocked ? (
              <Text fontSize={APP_TEXT_SIZES.meta} color="gray.700">
                Your session may have expired. Try logging out and logging back in.
              </Text>
            ) : null}
          </Stack>
        ) : null}

        <Grid templateColumns={{ base: "1fr", md: "minmax(260px, 1.1fr) minmax(240px, 1fr)" }} gap={{ base: 2, md: 3 }} alignItems="start">
          <Stack
            gap="2"
            order={{ base: 1, md: 1 }}
            w="full"
            minW="0"
            opacity={gamePaused ? 0.55 : 1}
            transition="opacity 0.2s ease"
          >
            <PondStage
              hasBasin={getOwnedCount(ownedUpgrades, "pond_basin") >= 1}
              ownedUpgrades={ownedUpgrades}
              ecologyHoverNote={
                getOwnedCount(ownedUpgrades, "pond_basin") >= 1 ? POND_STAGE_ECOLOGY_NOTE : undefined
              }
              clickDisabled={gamePaused || getOwnedCount(ownedUpgrades, "pond_basin") < 1}
              onClickPond={() => {
                if (gamePaused || getOwnedCount(ownedUpgrades, "pond_basin") < 1) return;
                const gain = simulation.clickValue;
                setResources((curr) => ({ ...curr, energy: curr.energy + gain }));
                setStatistics((s) => ({
                  ...s,
                  total_clicks: s.total_clicks + 1,
                  total_energy_earned: s.total_energy_earned + gain,
                }));
              }}
            />
            {ownedListOrdered.length > 0 ? (
              <Stack gap="1" w="full">
                <Heading as="h2" size="xs">
                  Owned ({ownedListOrdered.length})
                </Heading>
                <Flex
                  gap="1.5"
                  w="full"
                  overflowX={{ base: "auto", md: "visible" }}
                  flexWrap={{ base: "nowrap", md: "wrap" }}
                  pb={{ base: "0.5", md: "0" }}
                  style={{ scrollSnapType: "x mandatory" }}
                >
                  {ownedListOrdered.map((def) => (
                    <Box key={def.id} flexShrink={0} style={{ scrollSnapAlign: "start" }}>
                      <OwnedChip def={def} ownedUpgrades={ownedUpgrades} />
                    </Box>
                  ))}
                </Flex>
              </Stack>
            ) : null}
          </Stack>

          <Stack gap="1.5" order={{ base: 2, md: 2 }} w="full" minW="0" minH="0" opacity={gamePaused ? 0.45 : 1} pointerEvents={gamePaused ? "none" : "auto"}>
            {shopOrdered.length > 0 ? (
              <>
                <Heading as="h2" size="xs">
                  Shop
                </Heading>
                <Grid templateColumns="repeat(2, minmax(0, 1fr))" gap="1.5" w="full" alignItems="stretch">
                  {shopOrdered.map((def) => (
                    <GridItem key={def.id} minW="0" h="full">
                      <UpgradeCard
                        def={def}
                        resources={resources}
                        ownedUpgrades={ownedUpgrades}
                        pondStats={pondStats}
                        biodiversity={biodiversity}
                        onBuy={buyUpgrade}
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
