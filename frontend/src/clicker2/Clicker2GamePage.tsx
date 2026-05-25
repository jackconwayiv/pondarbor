import {
  Box,
  Flex,
  Stack,
  Text,
  useMediaQuery,
} from "@chakra-ui/react";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Navigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { ClickerPageShell } from "../clicker/ClickerShell";
import PondButton from "../PondButton";
import { PanelBlockSkeleton } from "../components/panelStatus";
import { HIDE_SCROLLBAR_CSS } from "../theme/typography";

import "./Clicker2PondStage.css";

import {
  createDefaultClicker2State,
  fetchClicker2State,
  resolvePondStartedAtMs,
  saveClicker2State,
  type Clicker2GameState,
} from "./api";
import {
  readClicker2LocalSave,
  finalizeClicker2LoadState,
  resolveClicker2LoadState,
  writeClicker2LocalSave,
} from "./localSave";
import Clicker2PondStage from "./Clicker2PondStage";
import DenizenPurchaseTimeline from "./DenizenPurchaseTimeline";
import { prependDenizenPurchase } from "./purchaseTimeline";
import { listOwnedEvolutionDefs } from "./clicker2OwnedEvolutions";
import Clicker2StatsModal, {
  type Clicker2StatsSnapshot,
} from "./Clicker2StatsModal";
import Clicker2WeatherEvent from "./Clicker2WeatherEvent";
import DenizenShopList from "./DenizenShopList";
import { Clicker2HeadlineStrip } from "./Clicker2HeadlineStrip";
import { Clicker2PondHeadline } from "./Clicker2PondHeadline";
import { MilestoneCelebrateCard } from "./MilestoneCelebrateCard";
import { activeHeadlineForEps } from "./headlines";
import MutagenPanel from "./MutagenPanel";
import {
  celebrationMilestoneDefs,
  evaluateNewMilestones,
  milestoneStatusList,
  type MilestoneEvalContext,
} from "./milestones";
import {
  DENIZENS,
  getOwnedDenizenCount,
  nextDenizenCost,
  totalDenizensOwned,
  type DenizenDef,
} from "./denizens";
import { ENERGY_EMOJI, formatEnergyRate } from "./formatEnergy";
import RollingEnergyCounter from "./RollingEnergyCounter";
import SpecialtyShopGrid from "./SpecialtyShopGrid";
import {
  collectShopAffordThresholds,
  spendableCrossedAffordBoundary,
} from "./clicker2Afford";
import type { GetDenizenShopTooltipSnapshot } from "./denizenShopTooltip";
import {
  accrueGrossEnergyBonus,
  accruePassiveStatistics,
  effectiveAllTimeEnergyEarned,
} from "./clicker2Statistics";
import { useClicker2MotionPaused } from "./useClicker2MotionPaused";
import {
  applyMutation,
  bootstrapMutagenPipelineOnLoad,
  collectMutagen,
  ensureMutagenPipelineStarted,
  getMutationLevel,
  isMutagenSystemUnlocked,
  MUTAGEN_UNLOCK_ALL_TIME_ENERGY,
} from "./mutagens";
import { denizenPerCopyEpsMap, simulateGame } from "./simulation";
import {
  getDisplayEpsSnapshot,
  subscribeDisplayEps,
} from "./clicker2DisplayEps";
import {
  snapClicker2CounterAtBlusterEnd,
  snapClicker2CounterDisplay,
  snapClicker2CounterToEffective,
  useClicker2GameLoop,
  type Clicker2GameLoopRefs,
} from "./useClicker2GameLoop";
import {
  SPECIALTIES,
  compareVisibleSpecialtyShopOrder,
  type SpecialtyDef,
} from "./specialties";
import {
  computeEffectiveEnergy,
  computeEffectiveEnergyAtBlusterEnd,
} from "./useEffectiveEnergy";
import {
  isDenizenTeased,
  isSpecialtyShopVisible,
  isSpecialtyUnlocked,
  mergeNewlyRevealedDenizens,
} from "./visibility";
import {
  SUNSHINE_PAGE_BACKGROUND,
  shopSurfaceForWeather,
  weatherAmbientFromBoosts,
  weatherSurfacesForAmbient,
  sunshineBoostBannerSubtitle,
  weatherBoostBannerSubtitle,
  weatherBoostBannerTitle,
  WEATHER_PAGE_BACKGROUND_FADE_MS,
  clickWeatherMultiplier,
  createWeatherEvent,
  effectiveEnergyPerSecond,
  epsWeatherMultiplier,
  msUntilWeatherSpawn,
  nextWeatherSpawnAtMsFromNow,
  startBlusterBoost,
  startRainBoost,
  SUNSHINE_PULSE_MS,
  sunWeatherBonus,
  weatherFamily,
  type ActiveBlusterBoost,
  type ActiveRainBoost,
  type ActiveWeatherEvent,
  type WeatherVariantId,
} from "./weatherEvents";

const BACKGROUND_TICK_MS = 1000;
const MILESTONE_SYNC_INTERVAL_MS = 3000;
const STATISTICS_UI_SYNC_MS = 5000;
const LOCAL_SAVE_INTERVAL_MS = 5000;
const LOCAL_SAVE_DEBOUNCE_MS = 500;
const BACKEND_SAVE_INTERVAL_MS = 60_000;
const BACKEND_SAVE_RETRY_DELAY_MS = 10_000;
const BACKEND_SAVE_MAX_RETRIES = 3;
const SAVED_BANNER_MS = 5000;
/** Set true to show mutagen testing controls in the shop column (staff only). */
const SHOW_MUTAGEN_DEV_TOOLS = false;

type LoadStatus = "loading" | "ready" | "error";

function isAuthFailure(msg: string): boolean {
  return msg.includes("(401)") || msg.includes("(403)");
}

export default function Clicker2GamePage() {
  const {
    isAuthenticated,
    sessionUser,
    isLoading: sessionLoading,
    getApiAccessToken,
    resyncSessionSilently,
  } = useAppSession();

  const [energy, setEnergy] = useState(0);
  /** Timestamp when `energy` last synced (passive tick, click, purchase, load). */
  const [energyAnchorMs, setEnergyAnchorMs] = useState(() => performance.now());
  const energyAnchorMsRef = useRef(energyAnchorMs);
  energyAnchorMsRef.current = energyAnchorMs;
  const [ownedDenizens, setOwnedDenizens] = useState<Record<string, number>>({});
  const [denizenPurchaseTimeline, setDenizenPurchaseTimeline] = useState<
    string[]
  >([]);
  const [ownedSpecialties, setOwnedSpecialties] = useState<
    Record<number, boolean>
  >({});
  const [revealedDenizens, setRevealedDenizens] = useState<
    Record<string, boolean>
  >(() => createDefaultClicker2State().revealed_denizens);
  const [statistics, setStatistics] = useState(
    () => createDefaultClicker2State().statistics,
  );
  const [mutagensBank, setMutagensBank] = useState(0);
  const [totalMutagensAcquired, setTotalMutagensAcquired] = useState(0);
  const [mutagenFormingStartedAtMs, setMutagenFormingStartedAtMs] = useState(0);
  const [denizenMutationLevels, setDenizenMutationLevels] = useState<
    Record<string, number>
  >({});
  const [milestonesReached, setMilestonesReached] = useState<
    Record<string, number>
  >({});
  const [milestonesDismissed, setMilestonesDismissed] = useState<
    Record<string, true>
  >({});
  const [mutagenUiTick, setMutagenUiTick] = useState(0);
  const [savedBannerKey, setSavedBannerKey] = useState(0);
  const savedBannerTimeoutRef = useRef(0);
  const [pondStartedAtMs, setPondStartedAtMs] = useState(
    () => createDefaultClicker2State().pond_started_at_ms,
  );
  const [pondEra, setPondEra] = useState(() => createDefaultClicker2State().pond_era);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [statsSnapshot, setStatsSnapshot] = useState<Clicker2StatsSnapshot | null>(
    null,
  );
  const statisticsPassiveAnchorMsRef = useRef(performance.now());
  const [activeWeather, setActiveWeather] = useState<ActiveWeatherEvent | null>(
    null,
  );
  const activeWeatherRef = useRef<ActiveWeatherEvent | null>(null);
  activeWeatherRef.current = activeWeather;
  const [activeRainBoost, setActiveRainBoost] = useState<ActiveRainBoost | null>(
    null,
  );
  const activeRainBoostRef = useRef<ActiveRainBoost | null>(null);
  activeRainBoostRef.current = activeRainBoost;
  const [activeBlusterBoost, setActiveBlusterBoost] =
    useState<ActiveBlusterBoost | null>(null);
  const activeBlusterBoostRef = useRef<ActiveBlusterBoost | null>(null);
  activeBlusterBoostRef.current = activeBlusterBoost;
  const [boostBannerVariantId, setBoostBannerVariantId] =
    useState<WeatherVariantId | null>(null);
  const boostBannerVariantIdRef = useRef<WeatherVariantId | null>(null);
  boostBannerVariantIdRef.current = boostBannerVariantId;
  const [sunshineBannerVariantId, setSunshineBannerVariantId] =
    useState<WeatherVariantId | null>(null);
  const [weatherUiRevision, setWeatherUiRevision] = useState(0);
  const [sunshinePulseKey, setSunshinePulseKey] = useState(0);
  const [sunshineBannerBonus, setSunshineBannerBonus] = useState(0);
  const sunshinePulseTimeoutRef = useRef(0);
  const rainBoostEndTimeoutRef = useRef(0);
  const blusterBoostEndTimeoutRef = useRef(0);
  const lastMilestoneSyncMsRef = useRef(0);
  const weatherSpawnTimeoutRef = useRef(0);
  const nextWeatherSpawnAtMsRef = useRef(0);
  const weatherSpawnArmedForLoadAttemptRef = useRef<number | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const showMutagenDevTools =
    SHOW_MUTAGEN_DEV_TOOLS && !!sessionUser?.user?.is_staff;
  const showMutagenDevToolsRef = useRef(showMutagenDevTools);
  showMutagenDevToolsRef.current = showMutagenDevTools;

  const saveDirtyRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const saveFailureCountRef = useRef(0);
  const saveRetryTimeoutRef = useRef(0);
  const localSaveDebounceRef = useRef(0);
  const spendableEnergyRef = useRef(0);
  const lastSpendableForAffordRef = useRef(0);
  const counterDisplayValueRef = useRef(0);
  const lastShownCounterIntRef = useRef(0);
  const pendingPondClicksRef = useRef(0);
  const pondClickFlushRafRef = useRef(0);
  const flushPondClicksSyncRef = useRef<() => void>(() => {});
  const affordThresholdsRef = useRef<number[]>([]);
  const [shopAffordRevision, setShopAffordRevision] = useState(0);
  const [loopCounterText, setLoopCounterText] = useState("0");
  const motionPaused = useClicker2MotionPaused();
  const [canHoverFinePointer] = useMediaQuery(
    ["(hover: hover) and (pointer: fine)"],
    { ssr: false, fallback: [false] },
  );
  const ownedDenizensRef = useRef(ownedDenizens);
  ownedDenizensRef.current = ownedDenizens;
  const denizenPurchaseTimelineRef = useRef(denizenPurchaseTimeline);
  denizenPurchaseTimelineRef.current = denizenPurchaseTimeline;
  const ownedSpecialtiesRef = useRef(ownedSpecialties);
  ownedSpecialtiesRef.current = ownedSpecialties;
  const revealedDenizensRef = useRef(revealedDenizens);
  revealedDenizensRef.current = revealedDenizens;
  const statisticsRef = useRef(statistics);
  const mutagensBankRef = useRef(mutagensBank);
  mutagensBankRef.current = mutagensBank;
  const totalMutagensAcquiredRef = useRef(totalMutagensAcquired);
  totalMutagensAcquiredRef.current = totalMutagensAcquired;
  const mutagenFormingStartedAtMsRef = useRef(mutagenFormingStartedAtMs);
  mutagenFormingStartedAtMsRef.current = mutagenFormingStartedAtMs;
  const denizenMutationLevelsRef = useRef(denizenMutationLevels);
  denizenMutationLevelsRef.current = denizenMutationLevels;
  const milestonesReachedRef = useRef(milestonesReached);
  milestonesReachedRef.current = milestonesReached;
  const milestonesDismissedRef = useRef(milestonesDismissed);
  milestonesDismissedRef.current = milestonesDismissed;
  const pondStartedAtMsRef = useRef(pondStartedAtMs);
  pondStartedAtMsRef.current = pondStartedAtMs;
  const pondEraRef = useRef(pondEra);
  pondEraRef.current = pondEra;
  const energyRef = useRef(energy);
  energyRef.current = energy;
  const stateRef = useRef<Clicker2GameState>(createDefaultClicker2State());
  const userIdRef = useRef<number | null>(sessionUser?.user.id ?? null);
  userIdRef.current = sessionUser?.user.id ?? null;

  const buildMilestoneEvalContext = useCallback((): MilestoneEvalContext => {
    const sim = simulateGame(
      ownedDenizensRef.current,
      ownedSpecialtiesRef.current,
      denizenMutationLevelsRef.current,
    );
    const nowPerf = performance.now();
    const boostedEps = effectiveEnergyPerSecond(
      sim.energyPerSecond,
      activeBlusterBoostRef.current,
      nowPerf,
    );
    return {
      energyInPond: computeEffectiveEnergy(
        energyRef.current,
        boostedEps,
        energyAnchorMsRef.current,
        nowPerf,
      ),
      allTimeEnergyEarned: effectiveAllTimeEnergyEarned(
        statisticsRef.current,
        boostedEps,
        statisticsPassiveAnchorMsRef.current,
        nowPerf,
      ),
      energyPerSecond: sim.energyPerSecond,
      energyPerClick: sim.clickValue,
      totalClicks: statisticsRef.current.total_clicks ?? 0,
      weatherEventsClicked: statisticsRef.current.weather_events_clicked ?? 0,
      weatherSunClicked: statisticsRef.current.weather_sun_clicked ?? 0,
      weatherWindClicked: statisticsRef.current.weather_wind_clicked ?? 0,
      weatherRainClicked: statisticsRef.current.weather_rain_clicked ?? 0,
      ownedSpecialties: ownedSpecialtiesRef.current,
      ownedDenizens: ownedDenizensRef.current,
      denizenMutationLevels: denizenMutationLevelsRef.current,
    };
  }, []);

  const snapshotState = useCallback((): Clicker2GameState => {
    const sim = simulateGame(
      ownedDenizensRef.current,
      ownedSpecialtiesRef.current,
      denizenMutationLevelsRef.current,
    );
    const eps = effectiveEnergyPerSecond(
      sim.energyPerSecond,
      activeBlusterBoostRef.current,
    );
    return {
      energy: computeEffectiveEnergy(
        energyRef.current,
        eps,
        energyAnchorMsRef.current,
      ),
      owned_denizens: ownedDenizensRef.current,
      owned_specialties: ownedSpecialtiesRef.current,
      revealed_denizens: revealedDenizensRef.current,
      catalog_version: stateRef.current.catalog_version,
      pond_started_at_ms: pondStartedAtMsRef.current,
      pond_era: pondEraRef.current,
      next_weather_spawn_at_ms: nextWeatherSpawnAtMsRef.current,
      denizen_purchase_timeline: denizenPurchaseTimelineRef.current,
      mutagens_bank: mutagensBankRef.current,
      total_mutagens_acquired: totalMutagensAcquiredRef.current,
      mutagen_forming_started_at_ms: mutagenFormingStartedAtMsRef.current,
      denizen_mutation_levels: denizenMutationLevelsRef.current,
      milestones_reached: milestonesReachedRef.current,
      milestones_dismissed: milestonesDismissedRef.current,
      statistics: statisticsRef.current,
    };
  }, []);

  const persistLocalSave = useCallback(() => {
    const userId = userIdRef.current;
    if (userId === null) return;
    writeClicker2LocalSave(userId, snapshotState());
  }, [snapshotState]);

  const flushStatisticsToState = useCallback(() => {
    setStatistics(statisticsRef.current);
  }, []);

  const flushLocalSaveNow = useCallback(() => {
    flushPondClicksSyncRef.current();
    window.clearTimeout(localSaveDebounceRef.current);
    localSaveDebounceRef.current = 0;
    flushStatisticsToState();
    persistLocalSave();
  }, [flushStatisticsToState, persistLocalSave]);

  const scheduleLocalSave = useCallback(() => {
    window.clearTimeout(localSaveDebounceRef.current);
    localSaveDebounceRef.current = window.setTimeout(() => {
      localSaveDebounceRef.current = 0;
      persistLocalSave();
    }, LOCAL_SAVE_DEBOUNCE_MS);
  }, [persistLocalSave]);

  const markGameDirty = useCallback(() => {
    saveDirtyRef.current = true;
    scheduleLocalSave();
  }, [scheduleLocalSave]);

  const syncMilestones = useCallback(() => {
    const newly = evaluateNewMilestones(
      buildMilestoneEvalContext(),
      milestonesReachedRef.current,
    );
    if (newly.length > 0) {
      const now = Date.now();
      const next = { ...milestonesReachedRef.current };
      for (let i = 0; i < newly.length; i++) {
        next[newly[i]!] = now + i;
      }
      milestonesReachedRef.current = next;
      setMilestonesReached(next);
      markGameDirty();
    }
  }, [buildMilestoneEvalContext, markGameDirty]);

  const showSavedBanner = useCallback(() => {
    window.clearTimeout(savedBannerTimeoutRef.current);
    const key = performance.now();
    setSavedBannerKey(key);
    savedBannerTimeoutRef.current = window.setTimeout(() => {
      savedBannerTimeoutRef.current = 0;
      setSavedBannerKey((current) => (current === key ? 0 : current));
    }, SAVED_BANNER_MS);
  }, []);

  const runBackendSave = useCallback(
    async (fromScheduledRetry = false) => {
      if (!saveDirtyRef.current) return;
      if (saveInFlightRef.current) return;

      if (!fromScheduledRetry) saveFailureCountRef.current = 0;

      saveInFlightRef.current = true;
      flushLocalSaveNow();
      const state = snapshotState();
      stateRef.current = state;

      let scheduledRetry = false;
      try {
        const token = await getApiAccessToken();
        const saveRes = await saveClicker2State(token, state);
        saveDirtyRef.current = false;
        saveFailureCountRef.current = 0;
        setSaveError(null);
        showSavedBanner();
        persistLocalSave();
        if (saveRes.clicker2_badges_unlocked) {
          void resyncSessionSilently();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Save failed";
        if (isAuthFailure(msg)) void resyncSessionSilently();

        saveFailureCountRef.current += 1;
        if (saveFailureCountRef.current <= BACKEND_SAVE_MAX_RETRIES) {
          scheduledRetry = true;
          saveRetryTimeoutRef.current = window.setTimeout(() => {
            saveRetryTimeoutRef.current = 0;
            saveInFlightRef.current = false;
            void runBackendSave(true);
          }, BACKEND_SAVE_RETRY_DELAY_MS);
        } else {
          setSaveError(msg);
          saveFailureCountRef.current = 0;
        }
      } finally {
        if (!scheduledRetry) saveInFlightRef.current = false;
      }
    },
    [
      flushLocalSaveNow,
      getApiAccessToken,
      persistLocalSave,
      resyncSessionSilently,
      showSavedBanner,
      snapshotState,
    ],
  );

  const gameLoopRefsBox = useRef<Clicker2GameLoopRefs>({
    ownedDenizens: ownedDenizensRef,
    ownedSpecialties: ownedSpecialtiesRef,
    denizenMutationLevels: denizenMutationLevelsRef,
    energy: energyRef,
    energyAnchorMs: energyAnchorMsRef,
    activeBlusterBoost: activeBlusterBoostRef,
    affordThresholds: affordThresholdsRef,
    spendableEnergy: spendableEnergyRef,
    lastSpendableForAfford: lastSpendableForAffordRef,
    displayValue: counterDisplayValueRef,
    lastShownCounterInt: lastShownCounterIntRef,
  });

  const bumpShopAffordIfBoundaryCrossed = useCallback(
    (prevSpendable: number, nextSpendable: number) => {
      spendableEnergyRef.current = nextSpendable;
      lastSpendableForAffordRef.current = nextSpendable;
      if (
        spendableCrossedAffordBoundary(
          prevSpendable,
          nextSpendable,
          affordThresholdsRef.current,
        )
      ) {
        setShopAffordRevision((n) => n + 1);
      }
    },
    [],
  );

  const commitSyncedEnergy = useCallback(
    (nextSynced: number) => {
      const prevSpendable = spendableEnergyRef.current;
      const now = performance.now();
      energyRef.current = nextSynced;
      energyAnchorMsRef.current = now;
      const sim = simulateGame(
        ownedDenizensRef.current,
        ownedSpecialtiesRef.current,
        denizenMutationLevelsRef.current,
      );
      const eps = effectiveEnergyPerSecond(
        sim.energyPerSecond,
        activeBlusterBoostRef.current,
        now,
      );
      const nextSpendable = computeEffectiveEnergy(
        nextSynced,
        eps,
        now,
        now,
      );
      bumpShopAffordIfBoundaryCrossed(prevSpendable, nextSpendable);
      setLoopCounterText(
        snapClicker2CounterDisplay(gameLoopRefsBox.current, eps, now),
      );
      setEnergy(nextSynced);
      setEnergyAnchorMs(now);
    },
    [bumpShopAffordIfBoundaryCrossed],
  );

  const effectiveEnergyNow = useCallback(() => {
    const sim = simulateGame(
      ownedDenizensRef.current,
      ownedSpecialtiesRef.current,
      denizenMutationLevelsRef.current,
    );
    const eps = effectiveEnergyPerSecond(
      sim.energyPerSecond,
      activeBlusterBoostRef.current,
    );
    return computeEffectiveEnergy(
      energyRef.current,
      eps,
      energyAnchorMsRef.current,
    );
  }, []);

  const effectiveAllTimeEnergyEarnedNow = useCallback(() => {
    const sim = simulateGame(
      ownedDenizensRef.current,
      ownedSpecialtiesRef.current,
      denizenMutationLevelsRef.current,
    );
    const nowPerf = performance.now();
    const boostedEps = effectiveEnergyPerSecond(
      sim.energyPerSecond,
      activeBlusterBoostRef.current,
      nowPerf,
    );
    return effectiveAllTimeEnergyEarned(
      statisticsRef.current,
      boostedEps,
      statisticsPassiveAnchorMsRef.current,
      nowPerf,
    );
  }, []);

  const reanchorEnergyFromEffective = useCallback(() => {
    commitSyncedEnergy(effectiveEnergyNow());
  }, [commitSyncedEnergy, effectiveEnergyNow]);

  const simulation = useMemo(
    () =>
      simulateGame(ownedDenizens, ownedSpecialties, denizenMutationLevels),
    [ownedDenizens, ownedSpecialties, denizenMutationLevels],
  );

  const effectiveAllTimeEnergyEarnedDisplay = useMemo(
    () => effectiveAllTimeEnergyEarnedNow(),
    [
      effectiveAllTimeEnergyEarnedNow,
      loopCounterText,
      statistics,
      simulation.energyPerSecond,
      activeBlusterBoost,
    ],
  );

  const mutagenUnlocked = isMutagenSystemUnlocked(
    effectiveAllTimeEnergyEarnedDisplay,
  );
  void mutagenUiTick;

  void weatherUiRevision;
  const clickMultiplier = clickWeatherMultiplier(activeRainBoostRef.current);
  const epsMultiplier = epsWeatherMultiplier(activeBlusterBoostRef.current);

  const displayEnergyPerSecond = useSyncExternalStore(
    subscribeDisplayEps,
    getDisplayEpsSnapshot,
    getDisplayEpsSnapshot,
  );

  const effectiveClickValue = simulation.clickValue * clickMultiplier;

  const weatherAmbient = weatherAmbientFromBoosts({
    clickMultiplier,
    epsMultiplier,
  });
  const weatherSurfaces = weatherSurfacesForAmbient(weatherAmbient);
  const shopBackground = shopSurfaceForWeather({
    clickMultiplier,
    epsMultiplier,
    sunshinePulseActive: sunshinePulseKey > 0,
  });
  const showWeatherBoostBanner =
    clickMultiplier > 1 || epsMultiplier > 1 || sunshinePulseKey > 0;
  const showBannerSlot = showWeatherBoostBanner;

  const trySpawnWeatherFromTimer = useCallback(() => {
    weatherSpawnTimeoutRef.current = 0;
    setActiveWeather((current) => {
      if (current && performance.now() < current.expiresAtPerfMs) {
        return current;
      }
      return createWeatherEvent();
    });
  }, []);

  const armWeatherSpawnTimer = useCallback(
    (spawnAtMs: number) => {
      window.clearTimeout(weatherSpawnTimeoutRef.current);
      const remaining = msUntilWeatherSpawn(spawnAtMs);
      weatherSpawnTimeoutRef.current = window.setTimeout(
        trySpawnWeatherFromTimer,
        remaining,
      );
    },
    [trySpawnWeatherFromTimer],
  );

  const scheduleNextWeatherSpawn = useCallback(() => {
    const spawnAtMs = nextWeatherSpawnAtMsFromNow();
    nextWeatherSpawnAtMsRef.current = spawnAtMs;
    markGameDirty();
    armWeatherSpawnTimer(spawnAtMs);
  }, [armWeatherSpawnTimer, markGameDirty]);

  const handleBlusterBoostEnd = useCallback(
    (endedBoost: ActiveBlusterBoost) => {
      const now = performance.now();
      if (now < endedBoost.untilPerfMs - 50) return;

      const prevSpendable = spendableEnergyRef.current;
      const sim = simulateGame(
        ownedDenizensRef.current,
        ownedSpecialtiesRef.current,
        denizenMutationLevelsRef.current,
      );
      const frozen = computeEffectiveEnergyAtBlusterEnd(
        energyRef.current,
        sim.energyPerSecond,
        energyAnchorMsRef.current,
        endedBoost.untilPerfMs,
        endedBoost.peakMultiplier,
      );
      activeBlusterBoostRef.current = null;
      setActiveBlusterBoost(null);
      energyRef.current = frozen;
      energyAnchorMsRef.current = now;
      bumpShopAffordIfBoundaryCrossed(prevSpendable, frozen);
      setLoopCounterText(
        snapClicker2CounterAtBlusterEnd(gameLoopRefsBox.current, endedBoost),
      );
      setEnergy(frozen);
      setEnergyAnchorMs(now);
      setBoostBannerVariantId((id) =>
        id && weatherFamily(id) === "bluster" ? null : id,
      );
      setWeatherUiRevision((n) => n + 1);
      saveDirtyRef.current = true;
      syncMilestones();
    },
    [bumpShopAffordIfBoundaryCrossed, syncMilestones],
  );

  const scheduleBlusterBoostEnd = useCallback(
    (boost: ActiveBlusterBoost) => {
      window.clearTimeout(blusterBoostEndTimeoutRef.current);
      const delay = Math.max(0, boost.untilPerfMs - performance.now());
      blusterBoostEndTimeoutRef.current = window.setTimeout(() => {
        blusterBoostEndTimeoutRef.current = 0;
        handleBlusterBoostEnd(boost);
      }, delay);
    },
    [handleBlusterBoostEnd],
  );

  const scheduleRainBoostEnd = useCallback((boost: ActiveRainBoost) => {
    window.clearTimeout(rainBoostEndTimeoutRef.current);
    const delay = Math.max(0, boost.untilPerfMs - performance.now());
    rainBoostEndTimeoutRef.current = window.setTimeout(() => {
      rainBoostEndTimeoutRef.current = 0;
      activeRainBoostRef.current = null;
      setActiveRainBoost(null);
      setBoostBannerVariantId((id) =>
        id && weatherFamily(id) === "rain" ? null : id,
      );
      setWeatherUiRevision((n) => n + 1);
    }, delay);
  }, []);

  stateRef.current = {
    energy: computeEffectiveEnergy(
      energy,
      displayEnergyPerSecond,
      energyAnchorMs,
    ),
    owned_denizens: ownedDenizens,
    owned_specialties: ownedSpecialties,
    revealed_denizens: revealedDenizens,
    catalog_version: stateRef.current.catalog_version,
    pond_started_at_ms: pondStartedAtMs,
    pond_era: pondEra,
    next_weather_spawn_at_ms: nextWeatherSpawnAtMsRef.current,
    denizen_purchase_timeline: denizenPurchaseTimelineRef.current,
    mutagens_bank: mutagensBank,
    total_mutagens_acquired: totalMutagensAcquired,
    mutagen_forming_started_at_ms: mutagenFormingStartedAtMs,
    denizen_mutation_levels: denizenMutationLevels,
    milestones_reached: milestonesReached,
    milestones_dismissed: milestonesDismissed,
    statistics,
  };

  useEffect(() => {
    if (!isAuthenticated || !sessionUser) return;
    let cancelled = false;
    void (async () => {
      setLoadStatus("loading");
      setLoadError(null);
      try {
        const token = await getApiAccessToken();
        const res = await fetchClicker2State(token);
        if (cancelled) return;
        const userId = sessionUser.user.id;
        const local = readClicker2LocalSave(userId);
        const merged = resolveClicker2LoadState(res, local);
        const loadedState = finalizeClicker2LoadState(res, local);
        const loadNowMs = Date.parse(res.server_time) || Date.now();
        const mutagenBoot = bootstrapMutagenPipelineOnLoad(loadedState, loadNowMs);
        let nextWeatherSpawnAt =
          loadedState.next_weather_spawn_at_ms > 0
            ? loadedState.next_weather_spawn_at_ms
            : nextWeatherSpawnAtMsFromNow();
        const stateWithWeather = {
          ...loadedState,
          ...mutagenBoot,
          next_weather_spawn_at_ms: nextWeatherSpawnAt,
        };
        saveDirtyRef.current =
          loadedState.pond_started_at_ms !== merged.pond_started_at_ms ||
          loadedState.next_weather_spawn_at_ms !== nextWeatherSpawnAt;
        setEnergy(stateWithWeather.energy);
        energyRef.current = stateWithWeather.energy;
        const loadedAt = performance.now();
        energyAnchorMsRef.current = loadedAt;
        setEnergyAnchorMs(loadedAt);
        setOwnedDenizens(stateWithWeather.owned_denizens);
        setDenizenPurchaseTimeline(stateWithWeather.denizen_purchase_timeline);
        setOwnedSpecialties(stateWithWeather.owned_specialties);
        setRevealedDenizens(
          mergeNewlyRevealedDenizens(
            stateWithWeather.energy,
            stateWithWeather.owned_denizens,
            stateWithWeather.revealed_denizens,
          ),
        );
        setStatistics(stateWithWeather.statistics);
        statisticsRef.current = stateWithWeather.statistics;
        setMutagensBank(stateWithWeather.mutagens_bank);
        setTotalMutagensAcquired(stateWithWeather.total_mutagens_acquired);
        setMutagenFormingStartedAtMs(stateWithWeather.mutagen_forming_started_at_ms);
        setDenizenMutationLevels(stateWithWeather.denizen_mutation_levels);
        setMilestonesReached(stateWithWeather.milestones_reached);
        milestonesReachedRef.current = stateWithWeather.milestones_reached;
        setMilestonesDismissed(stateWithWeather.milestones_dismissed);
        milestonesDismissedRef.current = stateWithWeather.milestones_dismissed;
        const pondStart = resolvePondStartedAtMs(
          stateWithWeather,
          res.created_at,
        );
        const stateToSave = {
          ...stateWithWeather,
          pond_started_at_ms: pondStart,
        };
        setPondStartedAtMs(pondStart);
        setPondEra(stateWithWeather.pond_era);
        pondEraRef.current = stateWithWeather.pond_era;
        statisticsPassiveAnchorMsRef.current = performance.now();
        nextWeatherSpawnAtMsRef.current = nextWeatherSpawnAt;
        stateRef.current = stateToSave;
        writeClicker2LocalSave(userId, stateToSave);
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
  }, [isAuthenticated, sessionUser, getApiAccessToken, loadAttempt]);

  useEffect(() => {
    if (loadStatus !== "ready") return;
    setRevealedDenizens((prev) =>
      mergeNewlyRevealedDenizens(
        effectiveEnergyNow(),
        ownedDenizens,
        prev,
      ),
    );
  }, [ownedDenizens, loadStatus, effectiveEnergyNow]);

  useEffect(() => {
    if (loadStatus !== "ready") return;
    if (weatherSpawnArmedForLoadAttemptRef.current === loadAttempt) {
      return;
    }
    weatherSpawnArmedForLoadAttemptRef.current = loadAttempt;
    armWeatherSpawnTimer(nextWeatherSpawnAtMsRef.current);
  }, [loadStatus, loadAttempt, armWeatherSpawnTimer]);

  useEffect(() => {
    return () => {
      window.clearTimeout(weatherSpawnTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!activeWeather) return;
    const remaining = activeWeather.expiresAtPerfMs - performance.now();
    if (remaining <= 0) {
      setActiveWeather(null);
      scheduleNextWeatherSpawn();
      return;
    }
    const id = window.setTimeout(() => {
      setActiveWeather(null);
      scheduleNextWeatherSpawn();
    }, remaining);
    return () => window.clearTimeout(id);
  }, [activeWeather, scheduleNextWeatherSpawn]);

  useEffect(() => {
    return () => {
      window.clearTimeout(rainBoostEndTimeoutRef.current);
      window.clearTimeout(blusterBoostEndTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || loadStatus !== "ready") return;
    const id = window.setInterval(() => {
      const sim = simulateGame(
        ownedDenizensRef.current,
        ownedSpecialtiesRef.current,
        denizenMutationLevelsRef.current,
      );
      const passiveEps = effectiveEnergyPerSecond(
        sim.energyPerSecond,
        activeBlusterBoostRef.current,
      );
      if (passiveEps > 0) {
        saveDirtyRef.current = true;
        statisticsRef.current = accruePassiveStatistics(
          statisticsRef.current,
          passiveEps,
          sim,
        );
        statisticsPassiveAnchorMsRef.current = performance.now();
      }
      if (
        isMutagenSystemUnlocked(
          statisticsRef.current.all_time_energy_earned ?? 0,
        )
      ) {
        const pipeline = ensureMutagenPipelineStarted(
          {
            statistics: statisticsRef.current,
            mutagens_bank: mutagensBankRef.current,
            mutagen_forming_started_at_ms: mutagenFormingStartedAtMsRef.current,
          },
          Date.now(),
        );
        if (
          pipeline.mutagen_forming_started_at_ms !==
          mutagenFormingStartedAtMsRef.current
        ) {
          mutagenFormingStartedAtMsRef.current =
            pipeline.mutagen_forming_started_at_ms;
          setMutagenFormingStartedAtMs(pipeline.mutagen_forming_started_at_ms);
          saveDirtyRef.current = true;
        }
      }
      const eff = computeEffectiveEnergy(
        energyRef.current,
        passiveEps,
        energyAnchorMsRef.current,
      );
      setRevealedDenizens((prev) =>
        mergeNewlyRevealedDenizens(
          eff,
          ownedDenizensRef.current,
          prev,
        ),
      );
      const milestoneNow = Date.now();
      if (
        milestoneNow - lastMilestoneSyncMsRef.current >=
        MILESTONE_SYNC_INTERVAL_MS
      ) {
        lastMilestoneSyncMsRef.current = milestoneNow;
        syncMilestones();
      }
    }, BACKGROUND_TICK_MS);
    return () => window.clearInterval(id);
  }, [isAuthenticated, loadStatus, syncMilestones]);

  useEffect(() => {
    if (loadStatus !== "ready") return;
    syncMilestones();
  }, [loadStatus, syncMilestones]);

  useEffect(() => {
    if (!isAuthenticated || loadStatus !== "ready") return;
    const id = window.setInterval(flushStatisticsToState, STATISTICS_UI_SYNC_MS);
    return () => window.clearInterval(id);
  }, [isAuthenticated, loadStatus, flushStatisticsToState]);

  useEffect(() => {
    if (!isAuthenticated || loadStatus !== "ready") return;
    if (!mutagenUnlocked) return;
    const id = window.setInterval(() => setMutagenUiTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [isAuthenticated, loadStatus, mutagenUnlocked]);

  useEffect(() => {
    if (!isAuthenticated || loadStatus !== "ready") return;

    const localId = window.setInterval(() => {
      flushStatisticsToState();
      persistLocalSave();
    }, LOCAL_SAVE_INTERVAL_MS);

    const backendId = window.setInterval(() => {
      void runBackendSave(false);
    }, BACKEND_SAVE_INTERVAL_MS);

    const flushLocal = () => flushLocalSaveNow();
    window.addEventListener("pagehide", flushLocal);
    window.addEventListener("beforeunload", flushLocal);

    return () => {
      window.clearInterval(localId);
      window.clearInterval(backendId);
      window.clearTimeout(localSaveDebounceRef.current);
      window.clearTimeout(savedBannerTimeoutRef.current);
      window.clearTimeout(saveRetryTimeoutRef.current);
      saveRetryTimeoutRef.current = 0;
      saveInFlightRef.current = false;
      window.removeEventListener("pagehide", flushLocal);
      window.removeEventListener("beforeunload", flushLocal);
    };
  }, [
    isAuthenticated,
    loadStatus,
    flushLocalSaveNow,
    flushStatisticsToState,
    persistLocalSave,
    runBackendSave,
  ]);

  const pondDenizens = useMemo(
    () =>
      DENIZENS.filter((d) => getOwnedDenizenCount(ownedDenizens, d.id) > 0).map(
        (d) => ({ id: d.id, emoji: d.emoji }),
      ),
    [ownedDenizens],
  );

  const celebrationMilestones = useMemo(
    () => celebrationMilestoneDefs(milestonesReached, milestonesDismissed),
    [milestonesReached, milestonesDismissed],
  );

  const activeHeadlineText = useMemo(
    () => activeHeadlineForEps(displayEnergyPerSecond)?.text ?? "",
    [displayEnergyPerSecond],
  );

  const visibleDenizens = useMemo(
    () => {
      const pondEnergy = computeEffectiveEnergy(
        energy,
        effectiveEnergyPerSecond(
          simulation.energyPerSecond,
          activeBlusterBoost,
        ),
        energyAnchorMs,
      );
      return DENIZENS.filter((d) =>
        isDenizenTeased(
          d.id,
          pondEnergy,
          ownedDenizens,
          revealedDenizens,
        ),
      );
    },
    [
      energy,
      simulation.energyPerSecond,
      activeBlusterBoost,
      energyAnchorMs,
      ownedDenizens,
      revealedDenizens,
    ],
  );

  const energyFromClickingDisplay =
    statistics.energy_from_clicking ?? 0;

  const visibleSpecialties = useMemo(
    () =>
      SPECIALTIES.filter(
        (s) =>
          !ownedSpecialties[s.id] &&
          isSpecialtyShopVisible(
            s,
            ownedDenizens,
            ownedSpecialties,
            effectiveAllTimeEnergyEarnedDisplay,
            energyFromClickingDisplay,
          ),
      ).sort(compareVisibleSpecialtyShopOrder),
    [
      ownedDenizens,
      ownedSpecialties,
      effectiveAllTimeEnergyEarnedDisplay,
      energyFromClickingDisplay,
    ],
  );

  const affordThresholds = useMemo(
    () =>
      collectShopAffordThresholds(
        visibleDenizens,
        visibleSpecialties,
        ownedDenizens,
      ),
    [visibleDenizens, visibleSpecialties, ownedDenizens],
  );

  useEffect(() => {
    affordThresholdsRef.current = affordThresholds;
    setShopAffordRevision((n) => n + 1);
  }, [affordThresholds]);

  const denizenPerCopyEps = useMemo(
    () =>
      denizenPerCopyEpsMap(
        ownedDenizens,
        ownedSpecialties,
        denizenMutationLevels,
      ),
    [ownedDenizens, ownedSpecialties, denizenMutationLevels],
  );

  const getDenizenTooltipSnapshot = useCallback<GetDenizenShopTooltipSnapshot>(
    (defId, owned, cost, maxed) => ({
      owned,
      eps: simulation.denizenEps[defId] ?? 0,
      perCopyEps: denizenPerCopyEps[defId] ?? 0,
      totalEpS: displayEnergyPerSecond,
      energyProduced:
        statisticsRef.current.denizen_energy_earned?.[defId] ?? 0,
      cost,
      maxed,
      mutationLevel: mutagenUnlocked
        ? getMutationLevel(denizenMutationLevelsRef.current, defId)
        : undefined,
    }),
    [simulation.denizenEps, denizenPerCopyEps, displayEnergyPerSecond, mutagenUnlocked],
  );

  useClicker2GameLoop(
    loadStatus === "ready",
    gameLoopRefsBox,
    setLoopCounterText,
    () => setShopAffordRevision((n) => n + 1),
  );

  useEffect(() => {
    if (loadStatus !== "ready") return;
    const onVisibility = () => {
      if (document.hidden) return;
      reanchorEnergyFromEffective();
      snapClicker2CounterToEffective(gameLoopRefsBox, setLoopCounterText);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [loadStatus, reanchorEnergyFromEffective]);

  useEffect(() => {
    if (loadStatus !== "ready") return;
    setLoopCounterText(
      snapClicker2CounterDisplay(
        gameLoopRefsBox.current,
        effectiveEnergyPerSecond(
          simulateGame(
            ownedDenizensRef.current,
            ownedSpecialtiesRef.current,
            denizenMutationLevelsRef.current,
          ).energyPerSecond,
          activeBlusterBoostRef.current,
        ),
      ),
    );
  }, [loadStatus, energy, energyAnchorMs]);

  const handleCollectMutagen = useCallback(() => {
    const nowMs = Date.now();
    const result = collectMutagen(
      {
        statistics: statisticsRef.current,
        mutagens_bank: mutagensBankRef.current,
        mutagen_forming_started_at_ms: mutagenFormingStartedAtMsRef.current,
      },
      nowMs,
    );
    if (!result) return;
    mutagensBankRef.current = result.mutagens_bank;
    mutagenFormingStartedAtMsRef.current = result.mutagen_forming_started_at_ms;
    totalMutagensAcquiredRef.current += 1;
    setMutagensBank(result.mutagens_bank);
    setMutagenFormingStartedAtMs(result.mutagen_forming_started_at_ms);
    setTotalMutagensAcquired(totalMutagensAcquiredRef.current);
    markGameDirty();
    syncMilestones();
  }, [markGameDirty, syncMilestones]);

  const handleMutateDenizen = useCallback(
    (def: DenizenDef) => {
      const owned = getOwnedDenizenCount(ownedDenizensRef.current, def.id);
      const result = applyMutation(
        {
          mutagens_bank: mutagensBankRef.current,
          denizen_mutation_levels: denizenMutationLevelsRef.current,
        },
        def.id,
        owned,
      );
      if (!result) return;
      mutagensBankRef.current = result.mutagens_bank;
      denizenMutationLevelsRef.current = result.denizen_mutation_levels;
      setMutagensBank(result.mutagens_bank);
      setDenizenMutationLevels(result.denizen_mutation_levels);
      reanchorEnergyFromEffective();
      markGameDirty();
      syncMilestones();
    },
    [markGameDirty, reanchorEnergyFromEffective, syncMilestones],
  );

  const handleDismissMilestoneCelebration = useCallback(
    (id: string) => {
      if (milestonesReachedRef.current[id] == null) return;
      if (milestonesDismissedRef.current[id]) return;
      const next = { ...milestonesDismissedRef.current, [id]: true as const };
      milestonesDismissedRef.current = next;
      setMilestonesDismissed(next);
      markGameDirty();
    },
    [markGameDirty],
  );

  /** TEMP: remove before release — tops up lifetime energy to mutagen unlock threshold. */
  const handleDevGrantMutagenUnlockEnergy = useCallback(() => {
    if (!showMutagenDevToolsRef.current) return;
    const stats = statisticsRef.current;
    const current = stats.all_time_energy_earned ?? 0;
    const needed = Math.max(0, MUTAGEN_UNLOCK_ALL_TIME_ENERGY - current);
    if (needed <= 0) return;
    stats.all_time_energy_earned = current + needed;
    setStatistics({ ...stats });
    const nowMs = Date.now();
    const pipeline = ensureMutagenPipelineStarted(
      {
        statistics: stats,
        mutagens_bank: mutagensBankRef.current,
        mutagen_forming_started_at_ms: mutagenFormingStartedAtMsRef.current,
      },
      nowMs,
    );
    mutagenFormingStartedAtMsRef.current = pipeline.mutagen_forming_started_at_ms;
    setMutagenFormingStartedAtMs(pipeline.mutagen_forming_started_at_ms);
    markGameDirty();
  }, [markGameDirty]);

  /** TEMP: remove before release */
  const handleDevGrantMutagen = useCallback(() => {
    if (!showMutagenDevToolsRef.current) return;
    mutagensBankRef.current += 1;
    setMutagensBank(mutagensBankRef.current);
    markGameDirty();
  }, [markGameDirty]);

  const openStatsModal = useCallback(() => {
    flushStatisticsToState();
    const sim = simulateGame(
      ownedDenizensRef.current,
      ownedSpecialtiesRef.current,
      denizenMutationLevelsRef.current,
    );
    const stats = statisticsRef.current;
    const capturedWallMs = Date.now();
    const capturedPerfMs = performance.now();
    const displayEps = effectiveEnergyPerSecond(
      sim.energyPerSecond,
      activeBlusterBoostRef.current,
      capturedPerfMs,
    );
    const energyInPond = computeEffectiveEnergy(
      energyRef.current,
      displayEps,
      energyAnchorMsRef.current,
      capturedPerfMs,
    );
    const eraEnergyEarned = computeEffectiveEnergy(
      stats.era_energy_earned ?? 0,
      displayEps,
      statisticsPassiveAnchorMsRef.current,
      capturedPerfMs,
    );
    const allTimeEnergyEarned = computeEffectiveEnergy(
      stats.all_time_energy_earned ?? 0,
      displayEps,
      statisticsPassiveAnchorMsRef.current,
      capturedPerfMs,
    );

    const ownedEvolutionDefs = listOwnedEvolutionDefs(
      ownedSpecialtiesRef.current,
    );

    const milestoneStatuses = milestoneStatusList(milestonesReachedRef.current).map(
      ({ def, reachedAtMs }) => ({
        id: def.id,
        title: def.title,
        description: def.description,
        criteriaText: def.criteriaText,
        reachedAtMs,
      }),
    );

    setStatsSnapshot({
      energyInPond,
      pondEra: pondEraRef.current,
      eraEnergyEarned,
      allTimeEnergyEarned,
      pondStartedAtMs: pondStartedAtMsRef.current,
      denizensOwned: totalDenizensOwned(ownedDenizensRef.current),
      evolutionsOwned: ownedEvolutionDefs.length,
      ownedEvolutionDefs,
      milestonesReached: milestoneStatuses.filter((m) => m.reachedAtMs != null)
        .length,
      milestoneStatuses,
      energyPerSecond: displayEps,
      energyPerClick:
        sim.clickValue * clickWeatherMultiplier(activeRainBoostRef.current),
      totalClicks: stats.total_clicks ?? 0,
      energyFromClicking: stats.energy_from_clicking ?? 0,
      weatherEventsClicked: stats.weather_events_clicked ?? 0,
      totalMutagensAcquired: totalMutagensAcquiredRef.current,
      capturedAtWallMs: capturedWallMs,
    });
    setStatsModalOpen(true);
  }, [flushStatisticsToState]);

  const spendableEnergy = useMemo(() => {
    void shopAffordRevision;
    if (loadStatus === "ready") {
      return spendableEnergyRef.current;
    }
    return computeEffectiveEnergy(
      energy,
      displayEnergyPerSecond,
      energyAnchorMs,
    );
  }, [
    shopAffordRevision,
    energy,
    displayEnergyPerSecond,
    energyAnchorMs,
    loadStatus,
  ]);

  const flushPondClicks = useCallback(() => {
    pondClickFlushRafRef.current = 0;
    const clickCount = pendingPondClicksRef.current;
    pendingPondClicksRef.current = 0;
    if (clickCount <= 0) return;

    const sim = simulateGame(
      ownedDenizensRef.current,
      ownedSpecialtiesRef.current,
      denizenMutationLevelsRef.current,
    );
    const gain =
      sim.clickValue *
      clickWeatherMultiplier(activeRainBoostRef.current) *
      clickCount;
    const eps = effectiveEnergyPerSecond(
      sim.energyPerSecond,
      activeBlusterBoostRef.current,
    );
    const now = performance.now();
    const prevSpendable = spendableEnergyRef.current;
    const nextEnergy =
      computeEffectiveEnergy(
        energyRef.current,
        eps,
        energyAnchorMsRef.current,
        now,
      ) + gain;
    energyRef.current = nextEnergy;
    energyAnchorMsRef.current = now;
    bumpShopAffordIfBoundaryCrossed(prevSpendable, nextEnergy);

    const stats = statisticsRef.current;
    stats.total_clicks = (stats.total_clicks ?? 0) + clickCount;
    stats.era_energy_earned = (stats.era_energy_earned ?? 0) + gain;
    stats.all_time_energy_earned = (stats.all_time_energy_earned ?? 0) + gain;
    stats.energy_from_clicking = (stats.energy_from_clicking ?? 0) + gain;
    saveDirtyRef.current = true;

    startTransition(() => {
      setEnergy(nextEnergy);
      setEnergyAnchorMs(now);
      setStatistics({ ...stats });
      scheduleLocalSave();
      syncMilestones();
    });
  }, [bumpShopAffordIfBoundaryCrossed, scheduleLocalSave, syncMilestones]);

  const onClickPond = useCallback(() => {
    pendingPondClicksRef.current += 1;
    if (pondClickFlushRafRef.current) return;
    pondClickFlushRafRef.current = requestAnimationFrame(flushPondClicks);
  }, [flushPondClicks]);

  const flushPendingPondClicksNow = useCallback(() => {
    if (pondClickFlushRafRef.current) {
      cancelAnimationFrame(pondClickFlushRafRef.current);
      pondClickFlushRafRef.current = 0;
    }
    flushPondClicks();
  }, [flushPondClicks]);
  flushPondClicksSyncRef.current = flushPendingPondClicksNow;

  useEffect(() => {
    return () => {
      flushPendingPondClicksNow();
    };
  }, [flushPendingPondClicksNow]);

  const onWeatherEventActivate = useCallback(() => {
    const event = activeWeatherRef.current;
    if (!event || performance.now() >= event.expiresAtPerfMs) return;

    const sim = simulateGame(
      ownedDenizensRef.current,
      ownedSpecialtiesRef.current,
      denizenMutationLevelsRef.current,
    );
    const pondEnergy = effectiveEnergyNow();

    const family = weatherFamily(event.variantId);
    if (family === "sun") {
      const bonus = sunWeatherBonus(
        pondEnergy,
        sim.energyPerSecond,
        event.variantId,
      );
      if (bonus > 0) {
        commitSyncedEnergy(pondEnergy + bonus);
        statisticsRef.current = accrueGrossEnergyBonus(
          statisticsRef.current,
          bonus,
        );
        setStatistics({ ...statisticsRef.current });
        saveDirtyRef.current = true;
      }
      const pulseKey = performance.now();
      setSunshineBannerBonus(bonus);
      setSunshineBannerVariantId(event.variantId);
      setSunshinePulseKey(pulseKey);
      window.clearTimeout(sunshinePulseTimeoutRef.current);
      sunshinePulseTimeoutRef.current = window.setTimeout(() => {
        setSunshinePulseKey((key) => {
          if (key !== pulseKey) return key;
          setSunshineBannerBonus(0);
          setSunshineBannerVariantId(null);
          return 0;
        });
      }, SUNSHINE_PULSE_MS);
    } else if (family === "rain") {
      const boost = startRainBoost(event.variantId);
      activeRainBoostRef.current = boost;
      setActiveRainBoost(boost);
      setBoostBannerVariantId(event.variantId);
      scheduleRainBoostEnd(boost);
      setWeatherUiRevision((n) => n + 1);
    } else {
      commitSyncedEnergy(effectiveEnergyNow());
      const boost = startBlusterBoost(event.variantId);
      activeBlusterBoostRef.current = boost;
      setActiveBlusterBoost(boost);
      setBoostBannerVariantId(event.variantId);
      scheduleBlusterBoostEnd(boost);
      setWeatherUiRevision((n) => n + 1);
    }

    {
      const stats = statisticsRef.current;
      const next = {
        ...stats,
        weather_events_clicked: (stats.weather_events_clicked ?? 0) + 1,
      };
      if (family === "sun") {
        next.weather_sun_clicked = (stats.weather_sun_clicked ?? 0) + 1;
      } else if (family === "bluster") {
        next.weather_wind_clicked = (stats.weather_wind_clicked ?? 0) + 1;
      } else {
        next.weather_rain_clicked = (stats.weather_rain_clicked ?? 0) + 1;
      }
      statisticsRef.current = next;
      setStatistics(next);
    }
    setActiveWeather(null);
    scheduleNextWeatherSpawn();
    markGameDirty();
    syncMilestones();
  }, [
    commitSyncedEnergy,
    effectiveEnergyNow,
    markGameDirty,
    scheduleBlusterBoostEnd,
    scheduleNextWeatherSpawn,
    scheduleRainBoostEnd,
    syncMilestones,
  ]);

  const buyDenizen = useCallback((def: DenizenDef) => {
    const owned = getOwnedDenizenCount(ownedDenizensRef.current, def.id);
    const cost = nextDenizenCost(def, owned);
    const eff = effectiveEnergyNow();
    if (cost === null || eff < cost) return;
    commitSyncedEnergy(eff - cost);
    setOwnedDenizens((o) => ({
      ...o,
      [def.id]: owned + 1,
    }));
    setDenizenPurchaseTimeline((t) => prependDenizenPurchase(t, def.emoji));
    markGameDirty();
    syncMilestones();
  }, [commitSyncedEnergy, effectiveEnergyNow, markGameDirty, syncMilestones]);

  const buySpecialty = useCallback((def: SpecialtyDef) => {
    if (ownedSpecialtiesRef.current[def.id]) return;
    if (
      !isSpecialtyUnlocked(
        def,
        ownedDenizensRef.current,
        effectiveAllTimeEnergyEarnedNow(),
        statisticsRef.current.energy_from_clicking ?? 0,
      )
    ) {
      return;
    }
    const eff = effectiveEnergyNow();
    if (eff < def.price) return;
    commitSyncedEnergy(eff - def.price);
    setOwnedSpecialties((o) => ({ ...o, [def.id]: true }));
    markGameDirty();
    syncMilestones();
  }, [
    commitSyncedEnergy,
    effectiveAllTimeEnergyEarnedNow,
    effectiveEnergyNow,
    markGameDirty,
    syncMilestones,
  ]);

  if (!isAuthenticated && !sessionLoading) {
    return <Navigate to="/clicker" replace />;
  }

  if (loadStatus === "loading" || (isAuthenticated && !sessionUser)) {
    return (
      <ClickerPageShell>
        <PanelBlockSkeleton lines={4} showTitleLine />
      </ClickerPageShell>
    );
  }

  if (loadStatus === "error") {
    return (
      <ClickerPageShell>
        <Stack gap="3">
          <Text color="nautical.solid" fontWeight="medium" role="alert">
            {loadError}
          </Text>
          <PondButton
            type="button"
            size="sm"
            colorPalette="teal"
            onClick={() => setLoadAttempt((n) => n + 1)}
          >
            Retry
          </PondButton>
        </Stack>
      </ClickerPageShell>
    );
  }

  return (
    <ClickerPageShell
      defaultPageBackground={weatherSurfaces.page}
      pageBackgroundFadeOutMs={WEATHER_PAGE_BACKGROUND_FADE_MS}
      sunshinePulseKey={
        clickMultiplier > 1 || epsMultiplier > 1 ? 0 : sunshinePulseKey
      }
      sunshinePageBackground={SUNSHINE_PAGE_BACKGROUND}
      sunshinePulseDurationMs={SUNSHINE_PULSE_MS}
    >
      <Box
        flex="1"
        minH="0"
        w="full"
        display="flex"
        flexDirection="column"
        position="relative"
        mx={{ base: "-3", md: "-4" }}
        my={{ base: "-1", md: "-2" }}
        px={{ base: "3", md: "4" }}
        py={{ base: "1", md: "2" }}
      >
        <Flex
          direction={{ base: "column", lg: "row" }}
          gap={{ base: "3", lg: "4" }}
          flex="1"
          minH="0"
          w="full"
          position="relative"
        >
        {activeWeather ? (
          <Clicker2WeatherEvent
            variantId={activeWeather.variantId}
            leftPct={activeWeather.leftPct}
            topPct={activeWeather.topPct}
            motionPaused={motionPaused}
            onActivate={onWeatherEventActivate}
          />
        ) : null}
        <Stack
          flex={{ base: "none", lg: "1" }}
          minW="0"
          gap="2"
          align="center"
          justify="flex-start"
        >
          <RollingEnergyCounter
            syncedEnergy={energy}
            energyPerSecond={displayEnergyPerSecond}
            anchorMs={energyAnchorMs}
            displayText={loopCounterText}
          />
          <Text fontSize="sm" color="gray.700">
            {formatEnergyRate(displayEnergyPerSecond)} {ENERGY_EMOJI} per second
          </Text>
          <Clicker2HeadlineStrip
            mode={celebrationMilestones.length > 0 ? "milestones" : "headline"}
          >
            {celebrationMilestones.length > 0 ? (
              celebrationMilestones.map((milestone) => (
                <MilestoneCelebrateCard
                  key={milestone.id}
                  milestone={milestone}
                  onDismiss={() =>
                    handleDismissMilestoneCelebration(milestone.id)
                  }
                  motionPaused={motionPaused}
                />
              ))
            ) : activeHeadlineText ? (
              <Clicker2PondHeadline text={activeHeadlineText} />
            ) : null}
          </Clicker2HeadlineStrip>
          <Box w="full" maxW={{ base: "full", lg: "520px" }}>
            <Clicker2PondStage
              denizens={pondDenizens}
              clickValue={effectiveClickValue}
              motionPaused={motionPaused}
              lightClickFx={clickMultiplier > 1}
              onClickPond={onClickPond}
            />
            {showBannerSlot ? (
            <Box
              className="pond2MilestoneBannerSlot pond2MilestoneBannerSlot--weather"
            >
              <Stack align="center" gap="0.5">
                {clickMultiplier > 1 && boostBannerVariantId ? (
                  <>
                    <Text
                      as="span"
                      className={
                        motionPaused
                          ? "pond2RainstormBanner pond2RainstormBanner--paused"
                          : "pond2RainstormBanner"
                      }
                    >
                      {weatherBoostBannerTitle(boostBannerVariantId)}
                    </Text>
                    <Text
                      as="span"
                      className="pond2WeatherBannerSub pond2WeatherBannerSubRain"
                    >
                      {weatherBoostBannerSubtitle(boostBannerVariantId)}
                    </Text>
                  </>
                ) : epsMultiplier > 1 && boostBannerVariantId ? (
                  <>
                    <Text
                      as="span"
                      className={
                        motionPaused
                          ? "pond2BlusterBanner pond2BlusterBanner--paused"
                          : "pond2BlusterBanner"
                      }
                    >
                      {weatherBoostBannerTitle(boostBannerVariantId)}
                    </Text>
                    <Text
                      as="span"
                      className="pond2WeatherBannerSub pond2WeatherBannerSubBluster"
                    >
                      {weatherBoostBannerSubtitle(boostBannerVariantId)}
                    </Text>
                  </>
                ) : sunshinePulseKey > 0 && sunshineBannerVariantId ? (
                  <>
                    <Text as="span" className="pond2SunshineBanner">
                      {weatherBoostBannerTitle(sunshineBannerVariantId)}
                    </Text>
                    <Text
                      as="span"
                      className="pond2WeatherBannerSub pond2WeatherBannerSubSun"
                    >
                      {sunshineBoostBannerSubtitle(sunshineBannerBonus)}
                    </Text>
                  </>
                ) : null}
              </Stack>
            </Box>
            ) : null}
            <DenizenPurchaseTimeline timeline={denizenPurchaseTimeline} />
          </Box>
          {saveError ? (
            <Text fontSize="xs" color="nautical.solid" role="alert">
              {saveError}
            </Text>
          ) : null}
        </Stack>

        <Box
          flex={{ base: "1", lg: "0 0 360px" }}
          minW="0"
          minH="0"
          overflowY="auto"
          borderRadius="md"
          bg={shopBackground}
          p="2"
          transition={`background-color ${WEATHER_PAGE_BACKGROUND_FADE_MS}ms ease`}
          css={HIDE_SCROLLBAR_CSS}
        >
          <Stack gap="3">
            <SpecialtyShopGrid
              specialties={visibleSpecialties}
              spendableEnergy={spendableEnergy}
              canHoverFinePointer={canHoverFinePointer}
              onBuy={buySpecialty}
              headerTrailing={
                <PondButton
                  type="button"
                  size="xs"
                  variant="outline"
                  colorPalette="lilypad"
                  bg="whiteAlpha.900"
                  borderColor="lilypad.muted"
                  color="lilypad.emphasized"
                  fontWeight="semibold"
                  px="2.5"
                  boxShadow="0 1px 2px rgba(0, 0, 0, 0.06)"
                  _hover={{
                    bg: "lilypad.subtle",
                    borderColor: "lilypad.border",
                    color: "lilypad.emphasized",
                  }}
                  onClick={openStatsModal}
                >
                  Stats
                </PondButton>
              }
            />

            <MutagenPanel
              allTimeEnergyEarned={effectiveAllTimeEnergyEarnedDisplay}
              mutagensBank={mutagensBank}
              mutagenFormingStartedAtMs={mutagenFormingStartedAtMs}
              nowMs={Date.now()}
              onCollect={handleCollectMutagen}
              canHoverFinePointer={canHoverFinePointer}
            />

            {showMutagenDevTools ? (
              <Flex
                gap="1"
                flexWrap="wrap"
                align="center"
                borderWidth="1px"
                borderStyle="dashed"
                borderColor="gray.400"
                borderRadius="md"
                p="1.5"
              >
                <Text fontSize="2xs" color="gray.600" flex="1" minW="6rem">
                  TEMP dev tools
                </Text>
                <PondButton
                  type="button"
                  size="xs"
                  variant="outline"
                  colorPalette="gray"
                  onClick={handleDevGrantMutagenUnlockEnergy}
                  disabled={
                    effectiveAllTimeEnergyEarnedDisplay >=
                    MUTAGEN_UNLOCK_ALL_TIME_ENERGY
                  }
                >
                  +1B lifetime
                </PondButton>
                <PondButton
                  type="button"
                  size="xs"
                  variant="outline"
                  colorPalette="gray"
                  onClick={handleDevGrantMutagen}
                >
                  +1 mutagen
                </PondButton>
              </Flex>
            ) : null}

            <DenizenShopList
              denizens={visibleDenizens}
              spendableEnergy={spendableEnergy}
              ownedDenizens={ownedDenizens}
              revealedDenizens={revealedDenizens}
              savedBannerKey={savedBannerKey}
              canHoverFinePointer={canHoverFinePointer}
              effectiveEnergy={computeEffectiveEnergy(
                energy,
                displayEnergyPerSecond,
                energyAnchorMs,
              )}
              getTooltipSnapshot={getDenizenTooltipSnapshot}
              onBuy={buyDenizen}
              mutagenUnlocked={mutagenUnlocked}
              mutagensBank={mutagensBank}
              denizenMutationLevels={denizenMutationLevels}
              onMutate={handleMutateDenizen}
            />
          </Stack>
        </Box>
      </Flex>
      </Box>
      <Clicker2StatsModal
        open={statsModalOpen}
        onOpenChange={setStatsModalOpen}
        snapshot={statsSnapshot}
      />
    </ClickerPageShell>
  );
}
