import { Box, Flex, Grid, GridItem, Heading, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";
import { fetchClickerState, normalizeClickerState, saveClickerState, type ClickerGameStateV1 } from "./api";
import PondStage from "./PondStage";
import { ClickerPageShell } from "./ClickerShell";
import {
  UPGRADES,
  ECO_KEYS,
  canAffordCost,
  formatResourceCostParts,
  getUpgradeClassPresentation,
  getLevel,
  idKey,
  nextPurchaseCost,
  prerequisitesMet,
  requirementSummary,
  revealEnergyThreshold,
  STARTER_REVEALED_IDS,
  shouldShowUpgradeInShop,
  totalClickBonus,
  totalEcoIncomeRates,
  totalPassivePerSecond,
  type EcoValues,
  type ResourceCost,
  type UpgradeDef,
} from "./upgrades";

const SAVE_INTERVAL_MS = 2000;
/** Passive income is applied once per second. */
const PASSIVE_TICK_MS = 1000;

/** Passive rates use quarter steps; avoid one-decimal rounding (e.g. 1.25 → "1.3"). */
function formatPassiveRate(n: number): string {
  const r = Math.round(n * 100) / 100;
  if (Number.isInteger(r)) return String(r);
  const s = r.toFixed(2);
  return s.endsWith("0") ? s.slice(0, -1) : s;
}

/** Resource HUD balances: compact at 1M+ / 1B+ / 1T+ (e.g. 1.3 M, 305.8 B, 33.8 T). */
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

const initialGameState = (): ClickerGameStateV1 => normalizeClickerState(null);

type LoadStatus = "loading" | "ready" | "error";
const RESOURCE_SYMBOLS = {
  energy: "⚡",
  fertility: "🌾",
  oxygen: "🫧",
  verdancy: "🍃",
  wildlife: "🐸",
} as const;

function effectSummary(def: UpgradeDef): string | null {
  if (def.effects?.passive != null && def.effects?.click != null) {
    return `+${def.effects.click} per click, +${formatPassiveRate(def.effects.passive)} energy per second`;
  }
  if (def.effects?.passive != null) {
    return `+${formatPassiveRate(def.effects.passive)} energy per second`;
  }
  if (def.effects?.click != null) return `+${def.effects.click} per click`;
  if (def.effects?.mult != null && def.effects?.target) {
    return `+${Math.round(def.effects.mult * 100)}% ${def.effects.target} (reserved)`;
  }
  return null;
}

function ecoIncomeSummary(def: UpgradeDef): string | null {
  if (!def.ecoIncome) return null;
  const parts: string[] = [];
  for (const key of ECO_KEYS) {
    const delta = def.ecoIncome[key];
    if (typeof delta !== "number" || delta === 0) continue;
    const label = `${key[0].toUpperCase()}${key.slice(1)}`;
    const sign = delta > 0 ? "+" : "";
    parts.push(`${sign}${formatPassiveRate(delta)} ${label}/s`);
  }
  return parts.length > 0 ? parts.join(" • ") : null;
}

function ClickerResourceHud({
  count,
  passiveRate,
  eco,
  ecoRates,
}: {
  count: number;
  passiveRate: number;
  eco: EcoValues;
  ecoRates: EcoValues;
}) {
  const ecoEntries: Array<{ key: keyof EcoValues; label: string; symbol: string }> = [
    { key: "fertility", label: "Fertility", symbol: RESOURCE_SYMBOLS.fertility },
    { key: "oxygen", label: "Oxygen", symbol: RESOURCE_SYMBOLS.oxygen },
    { key: "verdancy", label: "Verdancy", symbol: RESOURCE_SYMBOLS.verdancy },
    { key: "wildlife", label: "Wildlife", symbol: RESOURCE_SYMBOLS.wildlife },
  ];

  const energyRateMeta =
    passiveRate > 0 ? (
      <Text
        as="span"
        fontSize={{ base: "2xs", md: "xs" }}
        color="gray.600"
        fontWeight="medium"
        whiteSpace="nowrap"
      >
        +{formatPassiveRate(passiveRate)}
        {RESOURCE_SYMBOLS.energy}/s
      </Text>
    ) : null;

  return (
    <Stack gap="2" w="full">
      <Box display={{ base: "block", md: "none" }} borderWidth="1px" borderColor="border" borderRadius="md" bg="bg" p="2">
        <Stack gap="1.5">
          <Flex align="center" flexWrap="wrap" gap="2" columnGap="3" rowGap="0" w="full">
            <Text fontSize="lg" fontWeight="semibold">
              {RESOURCE_SYMBOLS.energy} Energy: {formatHudResourceAmount(count)}
            </Text>
            {energyRateMeta}
          </Flex>
          <Flex gap="1" justify="space-between" align="stretch" w="full" flexWrap="nowrap">
            {ecoEntries.map(({ key, symbol, label }) => {
              const r = ecoRates[key];
              const ecoHidden = eco[key] <= 0;
              return (
                <Stack key={key} align="center" flex="1" minW="0" gap="0">
                  <Stack
                    align="center"
                    gap="0"
                    w="full"
                    visibility={ecoHidden ? "hidden" : "visible"}
                    aria-hidden={ecoHidden}
                  >
                    <Text fontSize="2xs" color="gray.600" textAlign="center" lineHeight="1.2">
                      {symbol} {label}
                    </Text>
                    <Text fontSize="xs" fontWeight="semibold" fontVariantNumeric="tabular-nums" textAlign="center">
                      {formatHudResourceAmount(eco[key])}
                    </Text>
                    {r !== 0 ? (
                      <Text fontSize="2xs" color="gray.600" textAlign="center" lineHeight="1.2">
                        {r > 0 ? "+" : ""}
                        {formatPassiveRate(r)}
                        {symbol}/s
                      </Text>
                    ) : null}
                  </Stack>
                </Stack>
              );
            })}
          </Flex>
        </Stack>
      </Box>

      <Box
        display={{ base: "none", md: "block" }}
        borderWidth="1px"
        borderColor="border"
        borderRadius="md"
        bg="bg"
        p="3"
      >
        <Stack gap="2">
          <Flex align="center" flexWrap="wrap" gap="3" columnGap="4" rowGap="1" w="full">
            <Text fontSize={{ md: "xl", lg: "2xl" }} fontWeight="semibold">
              {RESOURCE_SYMBOLS.energy} Energy: {formatHudResourceAmount(count)}
            </Text>
            {passiveRate > 0 ? (
              <Text as="span" fontSize="sm" color="gray.600" fontWeight="medium" whiteSpace="nowrap">
                +{formatPassiveRate(passiveRate)}
                {RESOURCE_SYMBOLS.energy}/s
              </Text>
            ) : null}
          </Flex>
          <Flex gap="2" justify="space-between" align="stretch" w="full" flexWrap="nowrap">
            {ecoEntries.map(({ key, symbol, label }) => {
              const r = ecoRates[key];
              const ecoHidden = eco[key] <= 0;
              return (
                <Stack key={key} align="center" flex="1" minW="0" gap="0.5">
                  <Stack
                    align="center"
                    gap="0.5"
                    w="full"
                    visibility={ecoHidden ? "hidden" : "visible"}
                    aria-hidden={ecoHidden}
                  >
                    <Text fontSize="xs" color="gray.600" textAlign="center" lineHeight="1.2">
                      {symbol} {label}
                    </Text>
                    <Text fontSize="sm" fontWeight="semibold" fontVariantNumeric="tabular-nums" textAlign="center">
                      {formatHudResourceAmount(eco[key])}
                    </Text>
                    {r !== 0 ? (
                      <Text fontSize="2xs" color="gray.600" textAlign="center" lineHeight="1.2">
                        {r > 0 ? "+" : ""}
                        {formatPassiveRate(r)}
                        {symbol}/s
                      </Text>
                    ) : null}
                  </Stack>
                </Stack>
              );
            })}
          </Flex>
        </Stack>
      </Box>
    </Stack>
  );
}

function UpgradeCard({
  def,
  cost,
  energy,
  eco,
  ownedUpgrades,
  onBuy,
}: {
  def: UpgradeDef;
  cost: ResourceCost | null;
  energy: number;
  eco: EcoValues;
  ownedUpgrades: Record<string, number>;
  onBuy: (def: UpgradeDef) => void;
}) {
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const maxed = cost === null;
  const unlocked = prerequisitesMet(def, ownedUpgrades);
  const affordable = cost !== null && canAffordCost(energy, eco, cost) && unlocked;
  const fx = effectSummary(def);
  const ecoFx = ecoIncomeSummary(def);
  const reqText = requirementSummary(def);
  const costLine = cost !== null ? formatResourceCostParts(cost).join(" ") : "";
  const canExpandDescription = def.description.length > 84;
  const classMeta = getUpgradeClassPresentation(def.class);
  return (
    <Box
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
      p={{ base: "1.5", md: "2" }}
      bg="bg"
      h="full"
      minH="0"
      w="full"
      display="flex"
      flexDirection="column"
    >
      <Box
        h="4px"
        borderRadius="sm"
        bg={classMeta.accent}
        opacity={0.9}
        mb="1.5"
      />
      <Flex justify="space-between" align="flex-start" gap="2" w="full">
        <Text
          fontWeight="semibold"
          fontSize={{ base: "xs", md: "sm" }}
          flex="1"
          minW="0"
          lineHeight="1.2"
          textAlign="left"
        >
          {def.name}
        </Text>
        <Stack align="flex-end" gap="0.5" flexShrink={0}>
          <Text fontSize="xs" fontWeight="medium" color={classMeta.accent} whiteSpace="nowrap" lineHeight="1.2">
            {classMeta.symbol} {classMeta.label}
          </Text>
          {maxed ? (
            <Text fontSize="xs" color="gray.600">
              Owned
            </Text>
          ) : null}
        </Stack>
      </Flex>
      {fx ? (
        <Text fontSize="xs" color="gray.700" mt="1">
          {fx}
        </Text>
      ) : null}
      {ecoFx ? (
        <Text fontSize="xs" color="gray.700" mt="0.5">
          {ecoFx}
        </Text>
      ) : null}
      {!maxed && !unlocked && reqText.length > 0 ? (
        <Text fontSize="xs" color="orange.700" mt="0.5">
          {reqText.join(" • ")}
        </Text>
      ) : null}
      <Box mt="1" flex="1" minH="0">
        <Text
          fontSize="xs"
          color="gray.600"
          lineClamp={descriptionExpanded ? undefined : { base: 2, md: 3 }}
        >
          {def.description}
        </Text>
        {canExpandDescription ? (
          <PondButton
            type="button"
            size="xs"
            colorPalette="nautical"
            mt="1"
            onClick={() => setDescriptionExpanded((v) => !v)}
          >
            {descriptionExpanded ? "Less" : "More"}
          </PondButton>
        ) : null}
      </Box>
      {!maxed ? (
        <Flex align="center" justify="space-between" gap="1.5" mt="1" w="full" minW="0">
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
}

function isShopPurchasableNow(
  def: UpgradeDef,
  ownedUpgrades: Record<string, number>,
  energy: number,
  eco: EcoValues,
): boolean {
  const level = getLevel(ownedUpgrades, def.id);
  const cost = nextPurchaseCost(def, level);
  if (cost === null) return false;
  if (!prerequisitesMet(def, ownedUpgrades)) return false;
  return canAffordCost(energy, eco, cost);
}

function OwnedChip({ def, level }: { def: UpgradeDef; level: number }) {
  const fx = effectSummary(def);
  const classMeta = getUpgradeClassPresentation(def.class);
  return (
    <Box
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
      px="3"
      py="2"
      bg="bg"
      flexShrink={0}
    >
      <Text fontSize="xs" fontWeight="medium" color={classMeta.accent}>
        {classMeta.symbol} {classMeta.label}
      </Text>
      <Text fontWeight="medium" fontSize="sm">
        {def.name}
      </Text>
      {fx ? (
        <Text fontSize={APP_TEXT_SIZES.meta} color="gray.600">
          {fx}
        </Text>
      ) : (
        <Text fontSize={APP_TEXT_SIZES.meta} color="gray.600">
          Lv {level}/{def.maxLevel}
        </Text>
      )}
    </Box>
  );
}

export default function ClickerGamePage() {
  const { accessToken, isAuthenticated } = useAppSession();
  const [count, setCount] = useState(0);
  const [fertility, setFertility] = useState(0);
  const [oxygen, setOxygen] = useState(0);
  const [verdancy, setVerdancy] = useState(0);
  const [wildlife, setWildlife] = useState(0);
  const [ownedUpgrades, setOwnedUpgrades] = useState<Record<string, number>>({});
  const [ownedUpgradeOrder, setOwnedUpgradeOrder] = useState<string[]>(
    () => initialGameState().owned_upgrade_order,
  );
  const [revealedUpgrades, setRevealedUpgrades] = useState<Record<string, boolean>>({});
  const [lastSyncedEnergy, setLastSyncedEnergy] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const shopCarouselRef = useRef<HTMLDivElement | null>(null);
  const ownedRef = useRef<Record<string, number>>({});
  /** Keep in sync every render so passive ticks and taps never see a stale upgrade set (effect-only sync lagged one frame behind state). */
  ownedRef.current = ownedUpgrades;

  const gameRef = useRef({
    count,
    fertility,
    oxygen,
    verdancy,
    wildlife,
  });
  gameRef.current = { count, fertility, oxygen, verdancy, wildlife };

  const stateRef = useRef<ClickerGameStateV1>(initialGameState());
  /** Same frame as state — autosave reads this; effect-only sync could persist one-tick-stale upgrades until refresh. */
  stateRef.current = {
    count,
    fertility,
    oxygen,
    verdancy,
    wildlife,
    owned_upgrades: ownedUpgrades,
    owned_upgrade_order: ownedUpgradeOrder,
    revealed_upgrades: revealedUpgrades,
  };

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    if (!accessToken) {
      queueMicrotask(() => setLoadStatus("loading"));
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoadStatus("loading");
      setLoadError(null);
      try {
        const res = await fetchClickerState(accessToken);
        if (cancelled) return;
        const normalized = normalizeClickerState(res.state);
        setCount(normalized.count);
        setFertility(normalized.fertility);
        setOxygen(normalized.oxygen);
        setVerdancy(normalized.verdancy);
        setWildlife(normalized.wildlife);
        setOwnedUpgrades(normalized.owned_upgrades);
        setOwnedUpgradeOrder(normalized.owned_upgrade_order);
        setRevealedUpgrades(normalized.revealed_upgrades);
        ownedRef.current = normalized.owned_upgrades;
        stateRef.current = normalized;
        if (res.state !== null && typeof res.state === "object") {
          const st = res.state as { count?: unknown };
          if (typeof st.count === "number") {
            setLastSyncedEnergy(st.count);
          }
        } else {
          setLastSyncedEnergy(null);
        }
        setLoadStatus("ready");
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
  }, [isAuthenticated, accessToken]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken || loadStatus !== "ready") return;

    const tick = () => {
      void (async () => {
        try {
          setSaveError(null);
          const res = await saveClickerState(accessToken, stateRef.current);
          if (res.state && typeof res.state.count === "number") {
            setLastSyncedEnergy(res.state.count);
          }
        } catch (e) {
          setSaveError(e instanceof Error ? e.message : "Save failed");
        }
      })();
    };

    const id = window.setInterval(tick, SAVE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isAuthenticated, accessToken, loadStatus]);

  useEffect(() => {
    if (!isAuthenticated || loadStatus !== "ready") return;

    const id = window.setInterval(() => {
      const owned = ownedRef.current;
      const ecoRates = totalEcoIncomeRates(owned);
      const energyBase = totalPassivePerSecond(owned);
      const dt = PASSIVE_TICK_MS / 1000;
      if (energyBase !== 0) {
        setCount((c) => c + energyBase * dt);
      }
      if (
        ecoRates.fertility !== 0 ||
        ecoRates.oxygen !== 0 ||
        ecoRates.verdancy !== 0 ||
        ecoRates.wildlife !== 0
      ) {
        setFertility((f) => Math.max(0, f + ecoRates.fertility * dt));
        setOxygen((f) => Math.max(0, f + ecoRates.oxygen * dt));
        setVerdancy((f) => Math.max(0, f + ecoRates.verdancy * dt));
        setWildlife((f) => Math.max(0, f + ecoRates.wildlife * dt));
      }
    }, PASSIVE_TICK_MS);

    return () => window.clearInterval(id);
  }, [isAuthenticated, loadStatus]);

  useEffect(() => {
    if (lastSyncedEnergy !== null) {
      console.log("last synced", Math.floor(lastSyncedEnergy));
    }
  }, [lastSyncedEnergy]);

  const eco: EcoValues = { fertility, oxygen, verdancy, wildlife };
  const ecoRates = totalEcoIncomeRates(ownedUpgrades);

  /** Persist sticky reveal once prereqs are met and energy crosses 50% rounded-up threshold. */
  useEffect(() => {
    if (loadStatus !== "ready") return;
    setRevealedUpgrades((prev) => {
      let next: Record<string, boolean> | null = null;
      for (const def of UPGRADES) {
        if (STARTER_REVEALED_IDS.has(def.id)) continue;
        const level = getLevel(ownedUpgrades, def.id);
        if (level >= def.maxLevel) continue;
        const key = idKey(def.id);
        if ((next ?? prev)[key]) continue;
        if (!prerequisitesMet(def, ownedUpgrades)) continue;
        if (count >= revealEnergyThreshold(def)) {
          if (!next) next = { ...prev };
          next[key] = true;
        }
      }
      return next ?? prev;
    });
  }, [count, ownedUpgrades, loadStatus]);

  const buyUpgrade = useCallback((def: UpgradeDef) => {
    const owned = ownedRef.current;
    const level = getLevel(owned, def.id);
    const cost = nextPurchaseCost(def, level);
    if (cost === null) return;
    if (!prerequisitesMet(def, owned)) return;
    const g = gameRef.current;
    const balances: EcoValues = {
      fertility: g.fertility,
      oxygen: g.oxygen,
      verdancy: g.verdancy,
      wildlife: g.wildlife,
    };
    if (!canAffordCost(g.count, balances, cost)) return;
    setCount((c) => c - (cost.energy ?? 0));
    setFertility((f) => Math.max(0, f - (cost.fertility ?? 0)));
    setOxygen((f) => Math.max(0, f - (cost.oxygen ?? 0)));
    setVerdancy((f) => Math.max(0, f - (cost.verdancy ?? 0)));
    setWildlife((f) => Math.max(0, f - (cost.wildlife ?? 0)));
    const key = idKey(def.id);
    setOwnedUpgradeOrder((ord) => [key, ...ord.filter((k) => k !== key)]);
    setOwnedUpgrades((o) => {
      const next = { ...o, [key]: level + 1 };
      ownedRef.current = next;
      return next;
    });
  }, []);

  const ownedList = UPGRADES.filter((u) => getLevel(ownedUpgrades, u.id) > 0);
  const ownedListOrdered = useMemo(() => {
    const byKey = new Map(UPGRADES.map((u) => [idKey(u.id), u] as const));
    const seen = new Set<string>();
    const list: UpgradeDef[] = [];
    for (const k of ownedUpgradeOrder) {
      const def = byKey.get(k);
      if (!def || getLevel(ownedUpgrades, def.id) <= 0) continue;
      list.push(def);
      seen.add(k);
    }
    for (const def of UPGRADES) {
      const k = idKey(def.id);
      if (getLevel(ownedUpgrades, def.id) > 0 && !seen.has(k)) {
        list.push(def);
        seen.add(k);
      }
    }
    return list;
  }, [ownedUpgradeOrder, ownedUpgrades]);

  const shopVisible = UPGRADES.filter((def) => {
    const level = getLevel(ownedUpgrades, def.id);
    return shouldShowUpgradeInShop(def, level, count, ownedUpgrades, revealedUpgrades);
  });
  const shopOrdered = [...shopVisible].sort((a, b) => {
    const pa = isShopPurchasableNow(a, ownedUpgrades, count, eco);
    const pb = isShopPurchasableNow(b, ownedUpgrades, count, eco);
    if (pa !== pb) return pa ? -1 : 1;
    return a.id - b.id;
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

  if (!accessToken || loadStatus === "loading") {
    return (
      <ClickerPageShell>
        <Text fontSize={{ base: "sm", md: "md" }}>Loading…</Text>
      </ClickerPageShell>
    );
  }

  if (loadStatus === "error") {
    return (
      <ClickerPageShell>
        <Box maxW="7xl" mx="auto">
          <Text fontWeight="semibold" color="fg">
            Could not load your game state.
          </Text>
          <Text mt="1" fontSize={APP_TEXT_SIZES.helper} color="fg">
            {loadError ?? "Failed to load game state."}
          </Text>
        </Box>
      </ClickerPageShell>
    );
  }

  const passiveRate = totalPassivePerSecond(ownedUpgrades);

  return (
    <ClickerPageShell>
      <Stack gap={{ base: "2", md: "3" }} w="full">
        <ClickerResourceHud count={count} passiveRate={passiveRate} eco={eco} ecoRates={ecoRates} />
        {saveError ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="orange.600">
            {saveError}
          </Text>
        ) : null}

        <Grid
          templateColumns={{ base: "1fr", md: "minmax(260px, 1.1fr) minmax(240px, 1fr)" }}
          gap={{ base: 3, md: 4 }}
          alignItems="start"
        >
          <Stack gap="3" order={{ base: 1, md: 1 }} w="full" minW="0">
            <PondStage
              energy={count}
              onClickPond={() =>
                setCount((c) => c + 1 + totalClickBonus(ownedRef.current))
              }
            />
            {ownedList.length > 0 ? (
              <Stack gap="1.5" w="full">
                <Heading as="h2" size="xs">
                  Owned ({ownedList.length})
                </Heading>
                <Flex
                  gap="2"
                  w="full"
                  overflowX={{ base: "auto", md: "visible" }}
                  flexWrap={{ base: "nowrap", md: "wrap" }}
                  pb={{ base: "1", md: "0" }}
                  style={{ scrollSnapType: "x mandatory" }}
                >
                  {ownedListOrdered.map((def) => (
                    <Box key={def.id} flexShrink={0} style={{ scrollSnapAlign: "start" }}>
                      <OwnedChip def={def} level={getLevel(ownedUpgrades, def.id)} />
                    </Box>
                  ))}
                </Flex>
              </Stack>
            ) : null}
          </Stack>

          <Stack gap="2" order={{ base: 2, md: 2 }} w="full" minW="0" minH="0">
            {shopOrdered.length > 0 ? (
              <>
                <Heading as="h2" size="xs">
                  Shop
                </Heading>
                <Stack display={{ base: "flex", md: "none" }} gap="1.5">
                  <Flex
                    ref={shopCarouselRef}
                    gap="2"
                    overflowX="auto"
                    pb="1"
                    style={{ scrollSnapType: "x mandatory" }}
                  >
                    {shopOrdered.map((def) => {
                      const level = getLevel(ownedUpgrades, def.id);
                      const cost = nextPurchaseCost(def, level);
                      return (
                        <Box
                          key={def.id}
                          minW="78%"
                          maxW="78%"
                          flexShrink={0}
                          style={{ scrollSnapAlign: "start" }}
                        >
                          <UpgradeCard
                            def={def}
                            cost={cost}
                            energy={count}
                            eco={eco}
                            ownedUpgrades={ownedUpgrades}
                            onBuy={buyUpgrade}
                          />
                        </Box>
                      );
                    })}
                  </Flex>
                </Stack>

                <Grid
                  display={{ base: "none", md: "grid" }}
                  templateColumns="repeat(2, minmax(0, 1fr))"
                  gap="2"
                  w="full"
                  alignItems="stretch"
                >
                  {shopOrdered.map((def) => {
                    const level = getLevel(ownedUpgrades, def.id);
                    const cost = nextPurchaseCost(def, level);
                    return (
                      <GridItem key={def.id} minW="0" h="full">
                        <UpgradeCard
                          def={def}
                          cost={cost}
                          energy={count}
                          eco={eco}
                          ownedUpgrades={ownedUpgrades}
                          onBuy={buyUpgrade}
                        />
                      </GridItem>
                    );
                  })}
                </Grid>
              </>
            ) : null}
          </Stack>
        </Grid>
      </Stack>
    </ClickerPageShell>
  );
}
