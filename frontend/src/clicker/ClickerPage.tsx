import { Box, Flex, Grid, GridItem, Heading, Stack, Text } from "@chakra-ui/react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { fullBleedStackProps } from "../responsive";
import { APP_TEXT_SIZES } from "../theme/typography";
import {
  createDefaultClickerState,
  fetchClickerState,
  normalizeClickerState,
  saveClickerState,
  type ClickerGameStateV1,
} from "./api";
import PondStage from "./PondStage";
import {
  UPGRADES,
  canAfford,
  getLevel,
  idKey,
  nextPurchaseCost,
  prerequisitesMet,
  revealEnergyThreshold,
  shouldShowUpgradeInShop,
  totalClickBonus,
  totalPassivePerSecond,
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

const initialGameState = (): ClickerGameStateV1 => normalizeClickerState(null);

type LoadStatus = "loading" | "ready" | "error";

function ClickerPageShell({
  titleLeft,
  titleRight,
  children,
}: {
  titleLeft?: ReactNode;
  titleRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Stack
      flex="1"
      minH="0"
      gap="0"
      display="flex"
      flexDirection="column"
      {...fullBleedStackProps}
    >
      <Box
        flex="1"
        minH="0"
        display="flex"
        flexDirection="column"
        bg="sky.solid"
        px={{ base: "3", md: "4" }}
        py={{ base: "2", md: "3" }}
      >
        <Stack gap="2" maxW="7xl" mx="auto" w="full" flex="1" minH="0">
          {titleLeft != null || titleRight != null ? (
            <Flex align="center" justify="space-between" gap="3" flexWrap="wrap" w="full">
              <Flex flexWrap="wrap" align="center" gap={{ base: 2, md: 4 }} flex="1" minW="0">
                {titleLeft}
              </Flex>
              {titleRight}
            </Flex>
          ) : null}
          {children}
        </Stack>
      </Box>
    </Stack>
  );
}

function effectSummary(def: UpgradeDef): string | null {
  if (def.passive != null) {
    return `+${formatPassiveRate(def.passive)} energy per second`;
  }
  if (def.click != null) return `+${def.click} per tap`;
  return null;
}

function UpgradeCard({
  def,
  cost,
  energy,
  onBuy,
}: {
  def: UpgradeDef;
  cost: number | null;
  energy: number;
  onBuy: (def: UpgradeDef) => void;
}) {
  const maxed = cost === null;
  const affordable = cost !== null && canAfford(energy, cost);
  const fx = effectSummary(def);
  return (
    <Box
      borderWidth="1px"
      borderColor="border"
      borderRadius="lg"
      p="2"
      bg="bg"
      h="full"
      minH="0"
      w="full"
      display="flex"
      flexDirection="column"
    >
      <Flex justify="space-between" align="flex-start" gap="2" w="full">
        <Text fontWeight="semibold" fontSize="sm" flex="1" minW="0">
          {def.name}
        </Text>
        {maxed ? (
          <Text fontSize={APP_TEXT_SIZES.meta} color="gray.600" flexShrink={0}>
            Owned
          </Text>
        ) : null}
      </Flex>
      {fx ? (
        <Text fontSize={APP_TEXT_SIZES.meta} color="gray.600" mt="2">
          {fx}
        </Text>
      ) : null}
      <Text
        fontSize={APP_TEXT_SIZES.helper}
        color="gray.600"
        mt="2"
        flex="1"
        minH="0"
      >
        {def.description}
      </Text>
      {!maxed ? (
        <Flex align="center" justify="space-between" gap="2" mt="2" w="full" minW="0">
          <Text fontSize="sm" color="gray.700" flexShrink={0}>
            <strong>{cost}</strong>{" "}
            <Box as="span" fontSize="xs" color="gray.600" fontWeight="normal">
              energy
            </Box>
          </Text>
          <PondButton
            type="button"
            size="sm"
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

function OwnedChip({ def, level }: { def: UpgradeDef; level: number }) {
  const fx = effectSummary(def);
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

export default function ClickerPage() {
  const { accessToken, isAuthenticated } = useAppSession();
  const [count, setCount] = useState(0);
  const [ownedUpgrades, setOwnedUpgrades] = useState<Record<string, number>>({});
  const [revealedUpgrades, setRevealedUpgrades] = useState<Record<string, boolean>>({});
  const [lastSyncedEnergy, setLastSyncedEnergy] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const confirmResetButtonRef = useRef<HTMLButtonElement | null>(null);
  const ownedRef = useRef<Record<string, number>>({});
  /** Keep in sync every render so passive ticks and taps never see a stale upgrade set (effect-only sync lagged one frame behind state). */
  ownedRef.current = ownedUpgrades;

  const stateRef = useRef<ClickerGameStateV1>(initialGameState());
  /** Same frame as state — autosave reads this; effect-only sync could persist one-tick-stale upgrades until refresh. */
  stateRef.current = { count, owned_upgrades: ownedUpgrades, revealed_upgrades: revealedUpgrades };

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
        setOwnedUpgrades(normalized.owned_upgrades);
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
      const rate = totalPassivePerSecond(ownedRef.current);
      if (rate <= 0) return;
      setCount((c) => c + rate * (PASSIVE_TICK_MS / 1000));
    }, PASSIVE_TICK_MS);

    return () => window.clearInterval(id);
  }, [isAuthenticated, loadStatus]);

  useEffect(() => {
    if (lastSyncedEnergy !== null) {
      console.log("last synced", Math.floor(lastSyncedEnergy));
    }
  }, [lastSyncedEnergy]);

  /** Exit confirm-reset when clicking anywhere outside the confirm button. */
  useEffect(() => {
    if (!confirmReset) return;
    const onPointerDown = (e: PointerEvent) => {
      const btn = confirmResetButtonRef.current;
      if (btn && e.target instanceof Node && btn.contains(e.target)) return;
      setConfirmReset(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [confirmReset]);

  /** Persist sticky reveal when energy crosses 50% threshold and prerequisites are met. */
  useEffect(() => {
    if (loadStatus !== "ready") return;
    setRevealedUpgrades((prev) => {
      let next: Record<string, boolean> | null = null;
      for (const def of UPGRADES) {
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
    const level = getLevel(ownedUpgrades, def.id);
    const cost = nextPurchaseCost(def, level);
    if (cost === null || count < cost) return;
    if (!prerequisitesMet(def, ownedUpgrades)) return;
    setCount((c) => c - cost);
    setOwnedUpgrades((o) => {
      const next = { ...o, [idKey(def.id)]: level + 1 };
      ownedRef.current = next;
      return next;
    });
  }, [count, ownedUpgrades]);

  const ownedList = UPGRADES.filter((u) => getLevel(ownedUpgrades, u.id) > 0);

  const shopVisible = UPGRADES.filter((def) => {
    const level = getLevel(ownedUpgrades, def.id);
    return shouldShowUpgradeInShop(def, level, count, ownedUpgrades, revealedUpgrades);
  });

  const performReset = useCallback(async () => {
    if (!accessToken) return;
    setResetBusy(true);
    setResetError(null);
    try {
      const fresh = createDefaultClickerState();
      setCount(fresh.count);
      setOwnedUpgrades(fresh.owned_upgrades);
      setRevealedUpgrades(fresh.revealed_upgrades);
      ownedRef.current = fresh.owned_upgrades;
      stateRef.current = fresh;
      const res = await saveClickerState(accessToken, fresh);
      if (res.state && typeof res.state.count === "number") {
        setLastSyncedEnergy(res.state.count);
      }
      setConfirmReset(false);
    } catch (e) {
      setResetError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetBusy(false);
    }
  }, [accessToken]);

  const resetButtonBox = (
    <Box flexShrink={0}>
      <PondButton
        ref={confirmResetButtonRef}
        type="button"
        size="sm"
        colorPalette="nautical"
        loading={resetBusy}
        disabled={resetBusy}
        onClick={(e) => {
          e.stopPropagation();
          if (!confirmReset) {
            setConfirmReset(true);
            setResetError(null);
            return;
          }
          void performReset();
        }}
      >
        {confirmReset ? "Confirm reset" : "Reset game"}
      </PondButton>
    </Box>
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
    <ClickerPageShell
      titleLeft={
        <>
          <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="semibold">
            Energy: {Math.floor(count)}
          </Text>
          {passiveRate > 0 ? (
            <Text fontSize={APP_TEXT_SIZES.meta} color="gray.600">
              +{formatPassiveRate(passiveRate)} energy per second
            </Text>
          ) : null}
          {resetError ? (
            <Text role="alert" fontSize={APP_TEXT_SIZES.helper} color="red.600" fontWeight="medium">
              {resetError}
            </Text>
          ) : null}
        </>
      }
      titleRight={resetButtonBox}
    >
      <Stack gap="3" w="full">
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
              onTap={() =>
                setCount((c) => c + 1 + totalClickBonus(ownedRef.current))
              }
            />
            {ownedList.length > 0 ? (
              <Stack gap="1.5" w="full">
                <Heading as="h2" size="xs">
                  Owned
                </Heading>
                <Flex
                  flexWrap="wrap"
                  gap="2"
                  overflowX={{ base: "auto", md: "visible" }}
                >
                  {ownedList.map((def) => (
                    <OwnedChip key={def.id} def={def} level={getLevel(ownedUpgrades, def.id)} />
                  ))}
                </Flex>
              </Stack>
            ) : null}
          </Stack>

          <Stack gap="2" order={{ base: 2, md: 2 }} w="full" minW="0" minH="0">
            {shopVisible.length > 0 ? (
              <>
                <Heading as="h2" size="xs">
                  Shop
                </Heading>
                <Grid
                  templateColumns="repeat(2, minmax(0, 1fr))"
                  gap="2"
                  w="full"
                  alignItems="stretch"
                >
                  {shopVisible.map((def) => {
                    const level = getLevel(ownedUpgrades, def.id);
                    const cost = nextPurchaseCost(def, level);
                    return (
                      <GridItem key={def.id} minW="0" h="full">
                        <UpgradeCard
                          def={def}
                          cost={cost}
                          energy={count}
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
