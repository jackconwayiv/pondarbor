import { Box, Flex, Grid, GridItem, Heading, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";
import {
  CATALOG_UPGRADES,
  FAMILY_PRESENTATION,
  PRIMARY_RESOURCE_IDS,
  RESOURCE_PRESENTATION,
  effectiveOwnedStacks,
  nextPurchaseCost,
  type PrimaryResourceId,
  type UpgradeDef,
  type UpgradeEffect,
  type UpgradeFamily,
} from "./catalog";
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
  getOwnedCount,
  isUpgradeUnlocked,
  isUpgradeVisible,
  revealEnergyThresholdForNextPurchase,
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

function multiplierTargetLabel(
  target: "global" | "click" | "passive" | UpgradeFamily | PrimaryResourceId,
): string {
  if (target === "click") return "click energy";
  if (target === "passive") return "all passive outputs";
  if (target === "global") return "global output";
  if (target === "energy" || target === "oxygen" || target === "vegetation" || target === "abundance") {
    return `passive ${RESOURCE_PRESENTATION[target].label}`;
  }
  const row = FAMILY_PRESENTATION[target as UpgradeFamily];
  return row ? `${row.label} outputs` : String(target);
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
    } else if (e.type === "converter") {
      parts.push(
        `Converts ${formatPassiveRate(e.rate)}/s ${RESOURCE_PRESENTATION[e.from].label} to ${RESOURCE_PRESENTATION[e.to].label}`,
      );
    } else if (e.type === "unlock") {
      parts.push(`Unlocks ${e.mechanicId}`);
    }
  }
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

function scaleEffectForDisplay(effect: UpgradeEffect, level: number): UpgradeEffect {
  if (effect.type === "click_bonus") return { ...effect, amount: effect.amount * level };
  if (effect.type === "passive_generation") return { ...effect, amount: effect.amount * level };
  if (effect.type === "converter") return { ...effect, rate: effect.rate * level };
  if (effect.type === "multiplier") return { ...effect, value: effect.value * level };
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
    if (scaled.type === "converter") {
      lines.push(`Converts ${formatPassiveRate(scaled.rate)}/s ${scaled.from} → ${scaled.to}`);
    }
    if (scaled.type === "unlock") {
      lines.push(`Unlock: ${scaled.mechanicId}`);
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

function ClickerResourceHud({
  resources,
  rates,
}: {
  resources: ResourceBalances;
  rates: ResourceBalances;
}) {
  return (
    <Stack gap="1.5" w="full" minW="0">
      <Box
        borderWidth="1px"
        borderColor="border"
        borderRadius="md"
        bg="bg"
        py="2"
        px={{ base: 2, md: 3 }}
        w="full"
        minW="0"
        overflow="hidden"
      >
        <Grid
          templateColumns={{ base: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" }}
          gap={{ base: 2, sm: 2 }}
          rowGap={{ base: 3, sm: 2 }}
          w="full"
          minW="0"
        >
          {PRIMARY_RESOURCE_IDS.map((resourceId) => {
            const rate = rates[resourceId];
            const hidden = resourceId !== "energy" && resources[resourceId] <= 0;
            return (
              <GridItem key={resourceId} minW="0">
                <Stack align="center" minW="0" w="full" gap="0.5">
                  <Stack
                    align="center"
                    gap="0.5"
                    w="full"
                    minW="0"
                    maxW="100%"
                    visibility={hidden ? "hidden" : "visible"}
                    aria-hidden={hidden}
                  >
                    <Text
                      fontSize={{ base: "xs", md: "sm" }}
                      color="gray.600"
                      textAlign="center"
                      lineHeight="1.2"
                      textTransform="uppercase"
                      w="full"
                      maxW="100%"
                      px="0.5"
                      overflowWrap="break-word"
                      wordBreak="break-word"
                    >
                      {RESOURCE_PRESENTATION[resourceId].symbol}{" "}
                      <Box as="span" fontWeight="bold">
                        {RESOURCE_PRESENTATION[resourceId].label}
                      </Box>
                    </Text>
                    <Text
                      fontSize="sm"
                      fontWeight="semibold"
                      fontVariantNumeric="tabular-nums"
                      textAlign="center"
                      w="full"
                      maxW="100%"
                      lineClamp={1}
                    >
                      {formatHudResourceAmount(resources[resourceId])}
                    </Text>
                    <Text
                      fontSize="2xs"
                      color="gray.600"
                      textAlign="center"
                      lineHeight="1.2"
                      w="full"
                      maxW="100%"
                      lineClamp={2}
                      overflowWrap="break-word"
                      visibility={rate !== 0 ? "visible" : "hidden"}
                      aria-hidden={rate === 0}
                    >
                      {rate > 0 ? "+" : ""}
                      {formatPassiveRate(rate)}
                      {RESOURCE_PRESENTATION[resourceId].symbol}/s
                    </Text>
                  </Stack>
                </Stack>
              </GridItem>
            );
          })}
        </Grid>
      </Box>
    </Stack>
  );
}

function UpgradeCard({
  def,
  resources,
  ownedUpgrades,
  onBuy,
}: {
  def: UpgradeDef;
  resources: ResourceBalances;
  ownedUpgrades: Record<string, number>;
  onBuy: (def: UpgradeDef) => void;
}) {
  const ownedCount = getOwnedCount(ownedUpgrades, def.id);
  const maxed = nextPurchaseCost(def, ownedCount) === null;
  const nextCost = nextPurchaseCost(def, ownedCount);
  const unlocked = isUpgradeUnlocked(def, ownedUpgrades, resources);
  const affordable = !maxed && nextCost !== null && unlocked && canAffordCosts(nextCost, resources);
  const cantAfford =
    unlocked && nextCost !== null && !maxed && !canAffordCosts(nextCost, resources);
  const costLine = nextCost ? formatResourceCostParts(nextCost).join(" ") : "";
  const familyMeta = FAMILY_PRESENTATION[def.family];
  const functionLine = shopCardFunctionLine(def);
  return (
    <Box
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
      py={{ base: "1", md: "1.5" }}
      px={{ base: "1.5", md: "2" }}
      bg={cantAfford ? "gray.200" : "bg"}
      h="full"
      minH="0"
      w="full"
      display="flex"
      flexDirection="column"
    >
      <Flex justify="space-between" align="flex-start" gap="2" w="full">
        <Text fontWeight="semibold" fontSize={{ base: "xs", md: "sm" }} lineHeight="1.2" textAlign="left" flex="1" minW="0">
          {def.name}
        </Text>
        <Text fontSize="xs" fontWeight="medium" color={familyMeta.accent} whiteSpace="nowrap" lineHeight="1.2" flexShrink={0}>
          {familyMeta.symbol} {familyMeta.label}
        </Text>
      </Flex>
      {functionLine ? (
        <Text fontSize="xs" color="gray.700" mt="1" lineHeight="1.3">
          {functionLine}
        </Text>
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
}

function isClickerAuthFailureMessage(msg: string): boolean {
  return msg.includes("(401)") || msg.includes("(403)");
}

function OwnedChip({ def, ownedUpgrades }: { def: UpgradeDef; ownedUpgrades: Record<string, number> }) {
  const stacks = effectiveOwnedStacks(def, ownedUpgrades);
  const fx = effectSummaryAtLevel(def, stacks);
  const familyMeta = FAMILY_PRESENTATION[def.family];
  const qtyLabel = def.maxOwned !== undefined ? `${stacks} / ${def.maxOwned}` : String(stacks);
  const tooltip =
    fx != null
      ? `${def.name} ×${qtyLabel}. ${fx} Does not include global or cross-upgrade multipliers.`
      : def.name;
  return (
    <Box
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
      px="3"
      py="1.5"
      bg="bg"
      flexShrink={0}
      title={tooltip}
      display="flex"
      flexDirection="column"
      gap="1"
      minW="0"
    >
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
}

export default function ClickerGamePage() {
  const navigate = useNavigate();
  const {
    isAuthenticated,
    sessionUser,
    isLoading: sessionLoading,
    error: sessionError,
    getApiAccessToken,
  } = useAppSession();

  const [resources, setResources] = useState<ResourceBalances>({
    energy: 0,
    oxygen: 0,
    vegetation: 0,
    abundance: 0,
  });
  const [ownedUpgrades, setOwnedUpgrades] = useState<Record<string, number>>({});
  const [ownedUpgradeOrder, setOwnedUpgradeOrder] = useState<string[]>(() => initialGameState().owned_upgrade_order);
  const [revealedUpgrades, setRevealedUpgrades] = useState<Record<string, boolean>>({});
  const [unlockedMechanics, setUnlockedMechanics] = useState<string[]>([]);
  const [catalogVersion, setCatalogVersion] = useState(CATALOG_CONTENT_VERSION);
  const [prestigePoints, setPrestigePoints] = useState(0);
  const [prestigeUpgrades, setPrestigeUpgrades] = useState<Record<string, number>>({});
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
  const ownedRef = useRef<Record<string, number>>({});
  ownedRef.current = ownedUpgrades;

  const gameRef = useRef(resources);
  gameRef.current = resources;

  const stateRef = useRef<ClickerGameStateV1>(initialGameState());
  stateRef.current = {
    energy: resources.energy,
    oxygen: resources.oxygen,
    vegetation: resources.vegetation,
    abundance: resources.abundance,
    owned_upgrades: ownedUpgrades,
    owned_upgrade_order: ownedUpgradeOrder,
    revealed_upgrades: revealedUpgrades,
    unlocked_mechanics: unlockedMechanics,
    catalog_version: catalogVersion,
    prestige_points: prestigePoints,
    prestige_upgrades: prestigeUpgrades,
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
      setLoadAttempt((n) => n + 1);
    } catch (e) {
      setServerResetError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setServerResetBusy(false);
    }
  }, [getApiAccessToken]);

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
        setResources({
          energy: normalized.energy,
          oxygen: normalized.oxygen,
          vegetation: normalized.vegetation,
          abundance: normalized.abundance,
        });
        setOwnedUpgrades(normalized.owned_upgrades);
        setOwnedUpgradeOrder(normalized.owned_upgrade_order);
        setRevealedUpgrades(normalized.revealed_upgrades);
        setUnlockedMechanics(normalized.unlocked_mechanics);
        setCatalogVersion(normalized.catalog_version);
        setPrestigePoints(normalized.prestige_points);
        setPrestigeUpgrades(normalized.prestige_upgrades);
        setActiveBuffs(normalized.active_buffs);
        setStatistics(normalized.statistics);
        ownedRef.current = normalized.owned_upgrades;
        stateRef.current = normalized;
        setLoadStatus("ready");
        setSaveAuthBlocked(false);
        setSaveError(null);
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
  }, [isAuthenticated, sessionUser, loadStatus, getApiAccessToken, saveAuthBlocked]);

  useEffect(() => {
    if (!isAuthenticated || loadStatus !== "ready") return;
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
  }, [isAuthenticated, loadStatus, CATALOG_UPGRADES]);

  useEffect(() => {
    if (loadStatus !== "ready") return;
    setRevealedUpgrades((prev) => {
      let next: Record<string, boolean> | null = null;
      for (const def of CATALOG_UPGRADES) {
        if (getOwnedCount(ownedUpgrades, def.id) > 0) continue;
        if ((next ?? prev)[def.id]) continue;
        if (!isUpgradeUnlocked(def, ownedUpgrades, resources)) continue;
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
  }, [resources.energy, ownedUpgrades, loadStatus, resources, CATALOG_UPGRADES]);

  const buyUpgrade = useCallback((def: UpgradeDef) => {
    const owned = ownedRef.current;
    const resBefore = gameRef.current;
    const ownedCount = getOwnedCount(owned, def.id);
    if (nextPurchaseCost(def, ownedCount) === null) return;
    const nextCost = nextPurchaseCost(def, ownedCount);
    if (!nextCost) return;
    if (!isUpgradeUnlocked(def, owned, resBefore)) return;
    if (!canAffordCosts(nextCost, resBefore)) return;

    const resAfter: ResourceBalances = { ...resBefore };
    for (const resourceId of PRIMARY_RESOURCE_IDS) {
      resAfter[resourceId] = Math.max(0, resAfter[resourceId] - (nextCost[resourceId] ?? 0));
    }
    const ownedAfterPurchase = ownedCount + 1;

    setRevealedUpgrades((prev) => {
      const next = { ...prev };

      // Every other line that was visible by energy before this spend (any owned count) stays sticky.
      for (const u of CATALOG_UPGRADES) {
        if (u.id === def.id) continue;
        const oc = getOwnedCount(owned, u.id);
        if (!isUpgradeUnlocked(u, owned, resBefore)) continue;
        const t = revealEnergyThresholdForNextPurchase(u, oc);
        if (resBefore.energy >= t) {
          next[u.id] = true;
        }
      }

      // Only the purchased line may lose sticky reveal when post-purchase energy is below half of its next purchase cost.
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

    setResources((curr) => {
      const next = { ...curr };
      for (const resourceId of PRIMARY_RESOURCE_IDS) {
        next[resourceId] = Math.max(0, next[resourceId] - (nextCost[resourceId] ?? 0));
      }
      return next;
    });
    setOwnedUpgradeOrder((ord) => [def.id, ...ord.filter((k) => k !== def.id)]);
    setOwnedUpgrades((o) => {
      const next = { ...o, [def.id]: ownedCount + 1 };
      ownedRef.current = next;
      return next;
    });
  }, []);

  const simulation = useMemo(
    () => simulateOwnedUpgrades(ownedUpgrades),
    // CATALOG_UPGRADES: new reference after Vite HMR when catalog.ts edits, so simulation stays in sync in dev.
    [ownedUpgrades, CATALOG_UPGRADES],
  );
  const rates = simulation.resourceRates;

  const ownedListOrdered = useMemo(() => {
    const byKey = new Map(CATALOG_UPGRADES.map((u) => [u.id, u] as const));
    const seen = new Set<string>();
    const list: UpgradeDef[] = [];
    for (const k of ownedUpgradeOrder) {
      const def = byKey.get(k);
      if (!def || getOwnedCount(ownedUpgrades, def.id) <= 0) continue;
      list.push(def);
      seen.add(k);
    }
    for (const def of CATALOG_UPGRADES) {
      if (getOwnedCount(ownedUpgrades, def.id) > 0 && !seen.has(def.id)) {
        list.push(def);
        seen.add(def.id);
      }
    }
    return list;
  }, [ownedUpgradeOrder, ownedUpgrades, CATALOG_UPGRADES]);

  const shopVisible = CATALOG_UPGRADES.filter((def) =>
    isUpgradeVisible(def, ownedUpgrades, resources, revealedUpgrades),
  );
  const shopOrdered = [...shopVisible].sort((a, b) => {
    const costA = nextPurchaseCost(a, getOwnedCount(ownedUpgrades, a.id));
    const costB = nextPurchaseCost(b, getOwnedCount(ownedUpgrades, b.id));
    const pa =
      costA !== null &&
      isUpgradeUnlocked(a, ownedUpgrades, resources) &&
      canAffordCosts(costA, resources);
    const pb =
      costB !== null &&
      isUpgradeUnlocked(b, ownedUpgrades, resources) &&
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
              <Text role="alert" fontSize={APP_TEXT_SIZES.helper} color="red.600" fontWeight="medium">
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
        <ClickerResourceHud resources={resources} rates={rates} />
        {saveError ? (
          <Stack gap="1">
            <Text fontSize={APP_TEXT_SIZES.helper} color="orange.600">
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
          <Stack gap="2" order={{ base: 1, md: 1 }} w="full" minW="0">
            <PondStage
              energy={resources.energy}
              onClickPond={() => {
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
                <Flex gap="1.5" w="full" overflowX={{ base: "auto", md: "visible" }} flexWrap={{ base: "nowrap", md: "wrap" }} pb={{ base: "0.5", md: "0" }} style={{ scrollSnapType: "x mandatory" }}>
                  {ownedListOrdered.map((def) => (
                    <Box key={def.id} flexShrink={0} style={{ scrollSnapAlign: "start" }}>
                      <OwnedChip def={def} ownedUpgrades={ownedUpgrades} />
                    </Box>
                  ))}
                </Flex>
              </Stack>
            ) : null}
          </Stack>

          <Stack gap="1.5" order={{ base: 2, md: 2 }} w="full" minW="0" minH="0">
            {shopOrdered.length > 0 ? (
              <>
                <Heading as="h2" size="xs">
                  Shop
                </Heading>
                <Grid templateColumns="repeat(2, minmax(0, 1fr))" gap="1.5" w="full" alignItems="stretch">
                  {shopOrdered.map((def) => (
                    <GridItem key={def.id} minW="0" h="full">
                      <UpgradeCard def={def} resources={resources} ownedUpgrades={ownedUpgrades} onBuy={buyUpgrade} />
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
