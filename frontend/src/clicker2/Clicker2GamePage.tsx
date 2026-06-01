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
import { useIsMobile, viewPortWidthBarProps } from "../responsive";
import PondButton from "../PondButton";
import { PanelBlockSkeleton } from "../components/panelStatus";
import { HIDE_SCROLLBAR_CSS } from "../theme/typography";

import "./Clicker2PondStage.css";

import {
  createDefaultClicker2State,
  fetchClicker2State,
  resolvePondStartedAtMs,
  saveClicker2State,
  SCHEMA_VERSION,
  type Clicker2GameState,
} from "./api";
import {
  readClicker2LocalSave,
  finalizeClicker2LoadState,
  resolveClicker2LoadState,
  writeClicker2LocalSave,
} from "./localSave";
import Clicker2PondStage from "./Clicker2PondStage";
import PondDepthChart from "./PondDepthChart";
import { prependDenizenPurchase } from "./purchaseTimeline";
import { rippleVisualStyleFromOwnedSpecialties } from "./rippleVisuals";
import { specialtyAcquiredMigrationPending } from "./specialtyAcquiredAt";
import { stripRetiredWindFromOwnedSpecialties } from "./retiredWindEvolutions";
import {
  listOwnedEvolutionDefs,
  listOwnedFossilShopDefs,
} from "./clicker2OwnedEvolutions";
import Clicker2MobilePanels from "./Clicker2MobilePanels";
import Clicker2MobileHud from "./Clicker2MobileHud";
import Clicker2MobileShopPanels from "./Clicker2MobileShopPanels";
import Clicker2StatsModal, {
  type Clicker2StatsSnapshot,
} from "./Clicker2StatsModal";
import Clicker2WeatherEvent from "./Clicker2WeatherEvent";
import DenizenShopList from "./DenizenShopList";
import { Clicker2HeadlineStrip } from "./Clicker2HeadlineStrip";
import { Clicker2PondHeadline } from "./Clicker2PondHeadline";
import { MilestoneCelebrateCard, MilestoneDismissAllCard } from "./MilestoneCelebrateCard";
import { useClicker2RotatingHeadline } from "./useClicker2RotatingHeadline";
import MutagenPanel from "./MutagenPanel";
import CyclePondConfirmModal from "./CyclePondConfirmModal";
import FossilShopSection from "./FossilShopSection";
import PondCycleFadeOverlay from "./PondCycleFadeOverlay";
import {
  isFossilShopUnlocked,
} from "./fossilShop";
import { applyPondCycle, unfossilizedStrataCount } from "./pondCycle";
import StrataProgressRow from "./StrataProgressRow";
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
import {
  captureClicker2TabTitleBase,
  restoreClicker2TabTitle,
  syncClicker2TabTitle,
  useClicker2TabTitleInterval,
} from "./clicker2TabTitle";
import { ENERGY_EMOJI, formatEnergyAmountHud, formatEnergyRate } from "./formatEnergy";
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
  msUntilMutagenAutoCollect,
  msUntilMutagenCollectible,
  msUntilNextMutagenFormingUiTick,
  settleMutagenPipeline,
} from "./mutagens";
import { denizenPerCopyEpsMap, simulateGame } from "./simulation";
import {
  getDisplayEpsSnapshot,
  subscribeDisplayEps,
} from "./clicker2DisplayEps";
import {
  snapClicker2CounterAtBlusterEnd,
  snapClicker2CounterToEffective,
  useClicker2GameLoop,
  type Clicker2GameLoopRefs,
} from "./useClicker2GameLoop";
import { blossomCountFromMilestones } from "./blossoms";
import {
  energyToNextStratum,
  stratumLevelFromAllTimeEnergy,
} from "./strata";
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
  effectiveClickValue,
  effectiveEnergyPerSecond,
  epsWeatherMultiplier,
  remainingMsUntilWeatherSpawn,
  rollWeatherSpawnDelayMsForOwned,
  startBlusterBoost,
  startRainBoost,
  weatherFamily,
  weatherEventEmoji,
  SUNSHINE_PULSE_MS,
  sunWeatherBonus,
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
/*
 * Staff-only temp dev tools (shop column). Re-enable for local QA:
 * 1. Uncomment SHOW_CLICKER2_DEV_TOOLS below and set true.
 * 2. Uncomment blocks marked CLICKER2_DEV_TOOLS (state, handlers, UI).
 * 3. Restore imports: BLOSSOM_RING_MAX (blossoms), MUTAGEN_UNLOCK_ALL_TIME_ENERGY (mutagens).
 * Gated at runtime: SHOW_CLICKER2_DEV_TOOLS && sessionUser?.user?.is_staff
 */
// const SHOW_CLICKER2_DEV_TOOLS = true;

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
  const [specialtyAcquiredAtMs, setSpecialtyAcquiredAtMs] = useState<
    Record<number, number>
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
  const lastSavedAtMsRef = useRef(0);
  const [pondStartedAtMs, setPondStartedAtMs] = useState(
    () => createDefaultClicker2State().pond_started_at_ms,
  );
  const [pondEra, setPondEra] = useState(() => createDefaultClicker2State().pond_era);
  const [fossils, setFossils] = useState(0);
  const [totalFossilsEarned, setTotalFossilsEarned] = useState(0);
  const [fossilizedStrata, setFossilizedStrata] = useState(0);
  const [cyclePondModalOpen, setCyclePondModalOpen] = useState(false);
  const [pondCycleFadeActive, setPondCycleFadeActive] = useState(false);
  const pondCycleFadeActiveRef = useRef(false);
  /** Frozen HUD counter for the white fade (game loop paused until fade ends). */
  const [pondCycleCounterFrozenText, setPondCycleCounterFrozenText] = useState<
    string | null
  >(null);
  const [resetPondBusy, setResetPondBusy] = useState(false);
  const [resetPondError, setResetPondError] = useState<string | null>(null);
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
  const nextWeatherSpawnRemainingMsRef = useRef(0);
  const weatherSpawnDeadlinePerfMsRef = useRef(0);
  const weatherSpawnArmedForLoadAttemptRef = useRef<number | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  /*
   * CLICKER2_DEV_TOOLS — staff-only shop-column QA controls (see SHOW_CLICKER2_DEV_TOOLS).
   * const showClicker2DevTools =
   *   SHOW_CLICKER2_DEV_TOOLS && !!sessionUser?.user?.is_staff;
   * const showClicker2DevToolsRef = useRef(showClicker2DevTools);
   * showClicker2DevToolsRef.current = showClicker2DevTools;
   * const [devBlossomOverride, setDevBlossomOverride] = useState<number | null>(
   *   null,
   * );
   */

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
  /** Bumped on pond cycle so deferred click flushes cannot restore pre-cycle energy. */
  const pondEnergyEpochRef = useRef(0);
  const flushPondClicksSyncRef = useRef<() => void>(() => {});
  const affordThresholdsRef = useRef<number[]>([]);
  const [shopAffordRevision, setShopAffordRevision] = useState(0);
  const [loopCounterText, setLoopCounterText] = useState("0");
  const publishCounterHud = useCallback((text: string) => {
    setLoopCounterText(text);
  }, []);
  /** 1 Hz while passive EpS accrues — refreshes all-time display without coupling to HUD counter. */
  const [passiveAccrualDisplayTick, setPassiveAccrualDisplayTick] = useState(0);
  const motionPaused = useClicker2MotionPaused();
  const isMobile = useIsMobile();
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
  const specialtyAcquiredAtMsRef = useRef(specialtyAcquiredAtMs);
  specialtyAcquiredAtMsRef.current = specialtyAcquiredAtMs;
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
  const blossomCountRef = useRef(0);
  const milestonesDismissedRef = useRef(milestonesDismissed);
  milestonesDismissedRef.current = milestonesDismissed;
  const pondStartedAtMsRef = useRef(pondStartedAtMs);
  pondStartedAtMsRef.current = pondStartedAtMs;
  const pondEraRef = useRef(pondEra);
  pondEraRef.current = pondEra;
  const fossilsRef = useRef(fossils);
  fossilsRef.current = fossils;
  const totalFossilsEarnedRef = useRef(totalFossilsEarned);
  totalFossilsEarnedRef.current = totalFossilsEarned;
  const fossilizedStrataRef = useRef(fossilizedStrata);
  fossilizedStrataRef.current = fossilizedStrata;
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
      blossomCountRef.current,
      fossilizedStrataRef.current,
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
      energyPerClick: effectiveClickValue(
        sim.clickBreakdown,
        activeRainBoostRef.current,
        activeBlusterBoostRef.current,
        nowPerf,
      ),
      totalClicks: statisticsRef.current.total_clicks ?? 0,
      weatherEventsClicked: statisticsRef.current.weather_events_clicked ?? 0,
      weatherSunClicked: statisticsRef.current.weather_sun_clicked ?? 0,
      weatherWindClicked: statisticsRef.current.weather_wind_clicked ?? 0,
      weatherRainClicked: statisticsRef.current.weather_rain_clicked ?? 0,
      ownedSpecialties: ownedSpecialtiesRef.current,
      ownedDenizens: ownedDenizensRef.current,
      denizenMutationLevels: denizenMutationLevelsRef.current,
      pondEra: pondEraRef.current,
    };
  }, []);

  const refreshWeatherSpawnRemainingForSave = useCallback(() => {
    const deadline = weatherSpawnDeadlinePerfMsRef.current;
    if (deadline > 0) {
      nextWeatherSpawnRemainingMsRef.current =
        remainingMsUntilWeatherSpawn(deadline);
    }
  }, []);

  const snapshotState = useCallback((): Clicker2GameState => {
    refreshWeatherSpawnRemainingForSave();
    const sim = simulateGame(
      ownedDenizensRef.current,
      ownedSpecialtiesRef.current,
      denizenMutationLevelsRef.current,
      blossomCountRef.current,
      fossilizedStrataRef.current,
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
      specialty_acquired_at_ms: specialtyAcquiredAtMsRef.current,
      revealed_denizens: revealedDenizensRef.current,
      catalog_version: stateRef.current.catalog_version,
      pond_started_at_ms: pondStartedAtMsRef.current,
      pond_era: pondEraRef.current,
      next_weather_spawn_remaining_ms: nextWeatherSpawnRemainingMsRef.current,
      denizen_purchase_timeline: denizenPurchaseTimelineRef.current,
      mutagens_bank: mutagensBankRef.current,
      total_mutagens_acquired: totalMutagensAcquiredRef.current,
      mutagen_forming_started_at_ms: mutagenFormingStartedAtMsRef.current,
      denizen_mutation_levels: denizenMutationLevelsRef.current,
      milestones_reached: milestonesReachedRef.current,
      milestones_dismissed: milestonesDismissedRef.current,
      fossils: fossilsRef.current,
      total_fossils_earned: totalFossilsEarnedRef.current,
      fossilized_strata: fossilizedStrataRef.current,
      statistics: statisticsRef.current,
    };
  }, [refreshWeatherSpawnRemainingForSave]);

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
        lastSavedAtMsRef.current = Date.now();
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
    blossomCount: blossomCountRef,
    fossilizedStrata: fossilizedStrataRef,
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
        blossomCountRef.current,
        fossilizedStrataRef.current,
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
      snapClicker2CounterToEffective(gameLoopRefsBox, publishCounterHud, now);
      setEnergy(nextSynced);
      setEnergyAnchorMs(now);
    },
    [bumpShopAffordIfBoundaryCrossed, publishCounterHud],
  );

  const effectiveEnergyNow = useCallback(() => {
    const sim = simulateGame(
      ownedDenizensRef.current,
      ownedSpecialtiesRef.current,
      denizenMutationLevelsRef.current,
      blossomCountRef.current,
      fossilizedStrataRef.current,
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

  useClicker2TabTitleInterval(
    loadStatus === "ready" && !pondCycleFadeActive,
    () => formatEnergyAmountHud(Math.round(effectiveEnergyNow())),
  );

  const pondCycleHudDisplayText =
    pondCycleCounterFrozenText ?? loopCounterText;

  const effectiveAllTimeEnergyEarnedNow = useCallback(() => {
    const sim = simulateGame(
      ownedDenizensRef.current,
      ownedSpecialtiesRef.current,
      denizenMutationLevelsRef.current,
      blossomCountRef.current,
      fossilizedStrataRef.current,
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

  const blossomCount = useMemo(
    () => blossomCountFromMilestones(milestonesReached),
    [milestonesReached],
  );
  blossomCountRef.current = blossomCount;

  const simulation = useMemo(
    () =>
      simulateGame(
        ownedDenizens,
        ownedSpecialties,
        denizenMutationLevels,
        blossomCount,
        fossilizedStrata,
      ),
    [
      ownedDenizens,
      ownedSpecialties,
      denizenMutationLevels,
      blossomCount,
      fossilizedStrata,
    ],
  );

  const rippleVisualStyle = useMemo(
    () => rippleVisualStyleFromOwnedSpecialties(ownedSpecialties),
    [ownedSpecialties],
  );

  const effectiveAllTimeEnergyEarnedDisplay = useMemo(
    () => effectiveAllTimeEnergyEarnedNow(),
    [
      effectiveAllTimeEnergyEarnedNow,
      statistics,
      simulation.energyPerSecond,
      activeBlusterBoost,
      passiveAccrualDisplayTick,
    ],
  );

  const unfossilizedStrataDisplay = useMemo(
    () =>
      unfossilizedStrataCount(
        effectiveAllTimeEnergyEarnedDisplay,
        fossilizedStrata,
      ),
    [effectiveAllTimeEnergyEarnedDisplay, fossilizedStrata],
  );

  const fossilShopVisible = isFossilShopUnlocked(totalFossilsEarned);

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

  const effectiveClickValueDisplay = effectiveClickValue(
    simulation.clickBreakdown,
    activeRainBoostRef.current,
    activeBlusterBoostRef.current,
  );

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
  const ongoingWeatherHudEmoji =
    isMobile &&
    boostBannerVariantId != null &&
    (clickMultiplier > 1 || epsMultiplier > 1)
      ? weatherEventEmoji(boostBannerVariantId)
      : null;

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
    (remainingMs: number) => {
      window.clearTimeout(weatherSpawnTimeoutRef.current);
      const remaining = Math.max(0, remainingMs);
      weatherSpawnTimeoutRef.current = window.setTimeout(
        trySpawnWeatherFromTimer,
        remaining,
      );
    },
    [trySpawnWeatherFromTimer],
  );

  const scheduleNextWeatherSpawn = useCallback(() => {
    const remaining = rollWeatherSpawnDelayMsForOwned(
      ownedSpecialtiesRef.current,
    );
    nextWeatherSpawnRemainingMsRef.current = remaining;
    weatherSpawnDeadlinePerfMsRef.current = performance.now() + remaining;
    markGameDirty();
    armWeatherSpawnTimer(remaining);
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
        blossomCountRef.current,
        fossilizedStrataRef.current,
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
      publishCounterHud(
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
    [bumpShopAffordIfBoundaryCrossed, publishCounterHud, syncMilestones],
  );

  useEffect(() => {
    captureClicker2TabTitleBase();
    return () => restoreClicker2TabTitle();
  }, []);

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

  refreshWeatherSpawnRemainingForSave();
  stateRef.current = {
    energy: computeEffectiveEnergy(
      energy,
      displayEnergyPerSecond,
      energyAnchorMs,
    ),
    owned_denizens: ownedDenizens,
    owned_specialties: ownedSpecialties,
    specialty_acquired_at_ms: specialtyAcquiredAtMs,
    revealed_denizens: revealedDenizens,
    catalog_version: stateRef.current.catalog_version,
    pond_started_at_ms: pondStartedAtMs,
    pond_era: pondEra,
    next_weather_spawn_remaining_ms: nextWeatherSpawnRemainingMsRef.current,
    denizen_purchase_timeline: denizenPurchaseTimelineRef.current,
    mutagens_bank: mutagensBank,
    total_mutagens_acquired: totalMutagensAcquired,
    mutagen_forming_started_at_ms: mutagenFormingStartedAtMs,
    denizen_mutation_levels: denizenMutationLevels,
    milestones_reached: milestonesReached,
    milestones_dismissed: milestonesDismissed,
    fossils,
    total_fossils_earned: totalFossilsEarned,
    fossilized_strata: fossilizedStrata,
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
        const serverSavedAtMs = res.updated_at ? Date.parse(res.updated_at) : 0;
        const localSavedAtMs = local?.savedAtMs ?? 0;
        lastSavedAtMsRef.current = Math.max(
          Number.isFinite(serverSavedAtMs) ? serverSavedAtMs : 0,
          localSavedAtMs,
        );
        const merged = resolveClicker2LoadState(res, local);
        const loadedState = finalizeClicker2LoadState(res, local);
        const loadNowMs = Date.parse(res.server_time) || Date.now();
        const mutagenBoot = bootstrapMutagenPipelineOnLoad(loadedState, loadNowMs);
        let nextWeatherSpawnRemaining =
          loadedState.next_weather_spawn_remaining_ms > 0
            ? loadedState.next_weather_spawn_remaining_ms
            : rollWeatherSpawnDelayMsForOwned(
                stripRetiredWindFromOwnedSpecialties(
                  loadedState.owned_specialties,
                ),
              );
        const { completedCount: mutagenSettledCount, ...mutagenState } =
          mutagenBoot;
        const stateWithWeather = {
          ...loadedState,
          ...mutagenState,
          next_weather_spawn_remaining_ms: nextWeatherSpawnRemaining,
        };
        saveDirtyRef.current =
          loadedState.pond_started_at_ms !== merged.pond_started_at_ms ||
          loadedState.next_weather_spawn_remaining_ms !==
            nextWeatherSpawnRemaining ||
          mutagenSettledCount > 0 ||
          specialtyAcquiredMigrationPending(
            res.state,
            stateWithWeather.owned_specialties,
          ) ||
          (local != null && local.schema_version < SCHEMA_VERSION);
        setEnergy(stateWithWeather.energy);
        energyRef.current = stateWithWeather.energy;
        const loadedAt = performance.now();
        energyAnchorMsRef.current = loadedAt;
        setEnergyAnchorMs(loadedAt);
        setOwnedDenizens(stateWithWeather.owned_denizens);
        setDenizenPurchaseTimeline(stateWithWeather.denizen_purchase_timeline);
        setOwnedSpecialties(
          stripRetiredWindFromOwnedSpecialties(stateWithWeather.owned_specialties),
        );
        setSpecialtyAcquiredAtMs(stateWithWeather.specialty_acquired_at_ms);
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
        setFossils(stateWithWeather.fossils);
        fossilsRef.current = stateWithWeather.fossils;
        setTotalFossilsEarned(stateWithWeather.total_fossils_earned);
        totalFossilsEarnedRef.current = stateWithWeather.total_fossils_earned;
        setFossilizedStrata(stateWithWeather.fossilized_strata);
        fossilizedStrataRef.current = stateWithWeather.fossilized_strata;
        statisticsPassiveAnchorMsRef.current = performance.now();
        nextWeatherSpawnRemainingMsRef.current = nextWeatherSpawnRemaining;
        weatherSpawnDeadlinePerfMsRef.current =
          performance.now() + nextWeatherSpawnRemaining;
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
    armWeatherSpawnTimer(nextWeatherSpawnRemainingMsRef.current);
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
      if (pondCycleFadeActiveRef.current) return;
      const sim = simulateGame(
        ownedDenizensRef.current,
        ownedSpecialtiesRef.current,
        denizenMutationLevelsRef.current,
        blossomCountRef.current,
        fossilizedStrataRef.current,
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
        setPassiveAccrualDisplayTick((n) => n + 1);
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

  const applyMutagenPipelineSettlement = useCallback(
    (nowMs: number): number => {
      const result = settleMutagenPipeline(
        {
          statistics: statisticsRef.current,
          mutagens_bank: mutagensBankRef.current,
          mutagen_forming_started_at_ms: mutagenFormingStartedAtMsRef.current,
          total_mutagens_acquired: totalMutagensAcquiredRef.current,
        },
        nowMs,
      );
      if (result.completedCount === 0) return 0;
      mutagensBankRef.current = result.mutagens_bank;
      mutagenFormingStartedAtMsRef.current =
        result.mutagen_forming_started_at_ms;
      totalMutagensAcquiredRef.current = result.total_mutagens_acquired;
      setMutagensBank(result.mutagens_bank);
      setMutagenFormingStartedAtMs(result.mutagen_forming_started_at_ms);
      setTotalMutagensAcquired(result.total_mutagens_acquired);
      markGameDirty();
      syncMilestones();
      return result.completedCount;
    },
    [markGameDirty, syncMilestones],
  );

  useEffect(() => {
    if (!isAuthenticated || loadStatus !== "ready") return;
    if (!mutagenUnlocked) return;

    let timeoutId = 0;
    const scheduleMutagenUiTick = () => {
      const now = Date.now();
      if (applyMutagenPipelineSettlement(now) > 0) {
        timeoutId = window.setTimeout(() => {
          setMutagenUiTick((n) => n + 1);
          scheduleMutagenUiTick();
        }, 0);
        return;
      }

      const started = mutagenFormingStartedAtMsRef.current;
      const msLeft = msUntilMutagenCollectible(started, now);
      const msUntilAuto = msUntilMutagenAutoCollect(started, now);
      let delay = 60_000;
      if (started > 0) {
        if (msLeft > 0) {
          delay = Math.min(msUntilNextMutagenFormingUiTick(msLeft), msLeft);
        } else if (msUntilAuto > 0) {
          delay = msUntilAuto;
        }
      }
      timeoutId = window.setTimeout(() => {
        setMutagenUiTick((n) => n + 1);
        scheduleMutagenUiTick();
      }, delay);
    };

    scheduleMutagenUiTick();
    return () => window.clearTimeout(timeoutId);
  }, [
    isAuthenticated,
    loadStatus,
    mutagenUnlocked,
    mutagenFormingStartedAtMs,
    applyMutagenPipelineSettlement,
  ]);

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

  const activeHeadlineText = useClicker2RotatingHeadline(ownedDenizens);

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
            blossomCount,
          ),
      ).sort(compareVisibleSpecialtyShopOrder),
    [
      ownedDenizens,
      ownedSpecialties,
      effectiveAllTimeEnergyEarnedDisplay,
      energyFromClickingDisplay,
      blossomCount,
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
        blossomCount,
        fossilizedStrata,
      ),
    [
      ownedDenizens,
      ownedSpecialties,
      denizenMutationLevels,
      blossomCount,
      fossilizedStrata,
    ],
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
    loadStatus === "ready" && !pondCycleFadeActive,
    gameLoopRefsBox,
    publishCounterHud,
    () => setShopAffordRevision((n) => n + 1),
  );

  useEffect(() => {
    if (loadStatus !== "ready") return;
    const onVisibility = () => {
      if (document.hidden) return;
      reanchorEnergyFromEffective();
      snapClicker2CounterToEffective(gameLoopRefsBox, publishCounterHud);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [loadStatus, reanchorEnergyFromEffective, publishCounterHud]);

  useEffect(() => {
    if (loadStatus !== "ready") return;
    snapClicker2CounterToEffective(gameLoopRefsBox, publishCounterHud);
    setShopAffordRevision((n) => n + 1);
  }, [loadStatus, loadAttempt, energy, energyAnchorMs, publishCounterHud]);

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

  const handleDismissAllMilestoneCelebrations = useCallback(
    (ids: readonly string[]) => {
      if (ids.length < 2) return;
      let changed = false;
      const next = { ...milestonesDismissedRef.current };
      for (const id of ids) {
        if (milestonesReachedRef.current[id] == null) continue;
        if (next[id]) continue;
        next[id] = true;
        changed = true;
      }
      if (!changed) return;
      milestonesDismissedRef.current = next;
      setMilestonesDismissed(next);
      markGameDirty();
    },
    [markGameDirty],
  );

  /*
   * CLICKER2_DEV_TOOLS — handlers (staff-gated via showClicker2DevToolsRef).
   *
   * const handleDevGrantMutagenUnlockEnergy = useCallback(() => {
   *   if (!showClicker2DevToolsRef.current) return;
   *   const stats = statisticsRef.current;
   *   const current = stats.all_time_energy_earned ?? 0;
   *   const needed = Math.max(0, MUTAGEN_UNLOCK_ALL_TIME_ENERGY - current);
   *   if (needed <= 0) return;
   *   stats.all_time_energy_earned = current + needed;
   *   setStatistics({ ...stats });
   *   const nowMs = Date.now();
   *   const pipeline = ensureMutagenPipelineStarted(
   *     {
   *       statistics: stats,
   *       mutagens_bank: mutagensBankRef.current,
   *       mutagen_forming_started_at_ms: mutagenFormingStartedAtMsRef.current,
   *     },
   *     nowMs,
   *   );
   *   mutagenFormingStartedAtMsRef.current = pipeline.mutagen_forming_started_at_ms;
   *   setMutagenFormingStartedAtMs(pipeline.mutagen_forming_started_at_ms);
   *   markGameDirty();
   * }, [markGameDirty]);
   *
   * const handleDevGrantMutagen = useCallback(() => {
   *   if (!showClicker2DevToolsRef.current) return;
   *   mutagensBankRef.current += 1;
   *   setMutagensBank(mutagensBankRef.current);
   *   markGameDirty();
   * }, [markGameDirty]);
   *
   * const handleDevSetBlossoms100 = useCallback(() => {
   *   if (!showClicker2DevToolsRef.current) return;
   *   setDevBlossomOverride(BLOSSOM_RING_MAX);
   * }, []);
   *
   * const handleDevRevertBlossomsToEarned = useCallback(() => {
   *   if (!showClicker2DevToolsRef.current) return;
   *   setDevBlossomOverride(null);
   * }, []);
   *
   * const handleDevGainOneOfEachDenizen = useCallback(() => {
   *   if (!showClicker2DevToolsRef.current) return;
   *   const nextOwned = { ...ownedDenizensRef.current };
   *   const toPrepend: string[] = [];
   *   for (const def of DENIZENS) {
   *     const owned = getOwnedDenizenCount(nextOwned, def.id);
   *     if (owned >= def.maxOwned) continue;
   *     nextOwned[def.id] = owned + 1;
   *     toPrepend.push(def.emoji);
   *   }
   *   if (toPrepend.length === 0) return;
   *   ownedDenizensRef.current = nextOwned;
   *   setOwnedDenizens(nextOwned);
   *   let nextTimeline = denizenPurchaseTimelineRef.current;
   *   for (let i = toPrepend.length - 1; i >= 0; i--) {
   *     nextTimeline = prependDenizenPurchase(nextTimeline, toPrepend[i]!);
   *   }
   *   denizenPurchaseTimelineRef.current = nextTimeline;
   *   setDenizenPurchaseTimeline(nextTimeline);
   *   markGameDirty();
   *   syncMilestones();
   * }, [markGameDirty, syncMilestones]);
   */

  const openStatsModal = useCallback(() => {
    flushStatisticsToState();
    const sim = simulateGame(
      ownedDenizensRef.current,
      ownedSpecialtiesRef.current,
      denizenMutationLevelsRef.current,
      blossomCountRef.current,
      fossilizedStrataRef.current,
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
      specialtyAcquiredAtMsRef.current,
    );
    const ownedFossilShopDefs = listOwnedFossilShopDefs(
      ownedSpecialtiesRef.current,
      specialtyAcquiredAtMsRef.current,
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

    const stratumLevel = stratumLevelFromAllTimeEnergy(allTimeEnergyEarned);
    const fossilized = fossilizedStrataRef.current;

    setResetPondError(null);
    setStatsSnapshot({
      energyInPond,
      pondEra: pondEraRef.current,
      eraEnergyEarned,
      allTimeEnergyEarned,
      stratumLevel,
      energyToNextStratum: energyToNextStratum(allTimeEnergyEarned),
      fossilizedStrata: fossilized,
      unfossilizedStrata: unfossilizedStrataCount(
        allTimeEnergyEarned,
        fossilized,
      ),
      fossils: fossilsRef.current,
      totalFossilsEarned: totalFossilsEarnedRef.current,
      pondStartedAtMs: pondStartedAtMsRef.current,
      lastSavedAtMs: lastSavedAtMsRef.current,
      denizensOwned: totalDenizensOwned(ownedDenizensRef.current),
      evolutionsOwned: ownedEvolutionDefs.length,
      ownedEvolutionDefs,
      fossilShopOwned: ownedFossilShopDefs.length,
      ownedFossilShopDefs,
      milestonesReached: milestoneStatuses.filter((m) => m.reachedAtMs != null)
        .length,
      blossoms: blossomCountRef.current,
      milestoneStatuses,
      energyPerSecond: displayEps,
      energyPerClick: effectiveClickValue(
        sim.clickBreakdown,
        activeRainBoostRef.current,
        activeBlusterBoostRef.current,
        capturedPerfMs,
      ),
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
      blossomCountRef.current,
      fossilizedStrataRef.current,
    );
    const nowPerf = performance.now();
    const gain =
      effectiveClickValue(
        sim.clickBreakdown,
        activeRainBoostRef.current,
        activeBlusterBoostRef.current,
        nowPerf,
      ) * clickCount;
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

    const flushEpoch = pondEnergyEpochRef.current;
    startTransition(() => {
      if (flushEpoch !== pondEnergyEpochRef.current) return;
      setEnergy(nextEnergy);
      setEnergyAnchorMs(now);
      setStatistics({ ...stats });
      scheduleLocalSave();
      syncMilestones();
    });
  }, [bumpShopAffordIfBoundaryCrossed, scheduleLocalSave, syncMilestones]);

  const onClickPond = useCallback(() => {
    if (pondCycleFadeActiveRef.current) return;
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
    if (pondCycleFadeActiveRef.current) return;
    const event = activeWeatherRef.current;
    if (!event || performance.now() >= event.expiresAtPerfMs) return;

    const sim = simulateGame(
      ownedDenizensRef.current,
      ownedSpecialtiesRef.current,
      denizenMutationLevelsRef.current,
      blossomCountRef.current,
      fossilizedStrataRef.current,
    );
    const pondEnergy = effectiveEnergyNow();

    const family = weatherFamily(event.variantId);
    if (family === "sun") {
      const bonus = sunWeatherBonus(sim.energyPerSecond, event.variantId);
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
        blossomCountRef.current,
        ownedSpecialtiesRef.current,
      )
    ) {
      return;
    }
    const eff = effectiveEnergyNow();
    if (eff < def.price) return;
    commitSyncedEnergy(eff - def.price);
    const acquiredAt = Date.now();
    setOwnedSpecialties((o) => ({ ...o, [def.id]: true }));
    setSpecialtyAcquiredAtMs((m) => ({ ...m, [def.id]: acquiredAt }));
    markGameDirty();
    syncMilestones();
  }, [
    commitSyncedEnergy,
    effectiveAllTimeEnergyEarnedNow,
    effectiveEnergyNow,
    markGameDirty,
    syncMilestones,
  ]);

  const buyFossilShopSpecialty = useCallback(
    (def: SpecialtyDef) => {
      if (!def.fossilShopOnly || def.priceFossils == null) return;
      if (ownedSpecialtiesRef.current[def.id]) return;
      if (
        !isSpecialtyUnlocked(
          def,
          ownedDenizensRef.current,
          effectiveAllTimeEnergyEarnedNow(),
          statisticsRef.current.energy_from_clicking ?? 0,
          blossomCountRef.current,
          ownedSpecialtiesRef.current,
        )
      ) {
        return;
      }
      const cost = def.priceFossils;
      if (fossilsRef.current < cost) return;
      fossilsRef.current -= cost;
      setFossils(fossilsRef.current);
      const acquiredAt = Date.now();
      setOwnedSpecialties((o) => ({ ...o, [def.id]: true }));
      setSpecialtyAcquiredAtMs((m) => ({ ...m, [def.id]: acquiredAt }));
      markGameDirty();
      syncMilestones();
    },
    [
      effectiveAllTimeEnergyEarnedNow,
      markGameDirty,
      syncMilestones,
    ],
  );

  const applyPondCycleState = useCallback(() => {
    flushPendingPondClicksNow();
    refreshWeatherSpawnRemainingForSave();
    const nowMs = Date.now();
    const cycled = applyPondCycle(snapshotState(), nowMs);

    window.clearTimeout(rainBoostEndTimeoutRef.current);
    window.clearTimeout(blusterBoostEndTimeoutRef.current);
    rainBoostEndTimeoutRef.current = 0;
    blusterBoostEndTimeoutRef.current = 0;
    activeRainBoostRef.current = null;
    activeBlusterBoostRef.current = null;
    setActiveRainBoost(null);
    setActiveBlusterBoost(null);
    setActiveWeather(null);
    setBoostBannerVariantId(null);
    setSunshineBannerVariantId(null);

    const perfNow = performance.now();

    setOwnedDenizens(cycled.owned_denizens);
    ownedDenizensRef.current = cycled.owned_denizens;
    setOwnedSpecialties(cycled.owned_specialties);
    ownedSpecialtiesRef.current = cycled.owned_specialties;
    setSpecialtyAcquiredAtMs(cycled.specialty_acquired_at_ms);
    setRevealedDenizens(cycled.revealed_denizens);
    setDenizenPurchaseTimeline(cycled.denizen_purchase_timeline);
    setStatistics(cycled.statistics);
    statisticsRef.current = cycled.statistics;
    setPondEra(cycled.pond_era);
    pondEraRef.current = cycled.pond_era;
    setPondStartedAtMs(cycled.pond_started_at_ms);
    pondStartedAtMsRef.current = cycled.pond_started_at_ms;
    setFossils(cycled.fossils);
    fossilsRef.current = cycled.fossils;
    setTotalFossilsEarned(cycled.total_fossils_earned);
    totalFossilsEarnedRef.current = cycled.total_fossils_earned;
    setFossilizedStrata(cycled.fossilized_strata);
    fossilizedStrataRef.current = cycled.fossilized_strata;
    setMutagenFormingStartedAtMs(cycled.mutagen_forming_started_at_ms);
    mutagenFormingStartedAtMsRef.current = cycled.mutagen_forming_started_at_ms;
    statisticsPassiveAnchorMsRef.current = perfNow;
    nextWeatherSpawnRemainingMsRef.current = 0;
    stateRef.current = cycled;

    scheduleNextWeatherSpawn();
    syncMilestones();
    commitSyncedEnergy(0);
    pondEnergyEpochRef.current += 1;
    pendingPondClicksRef.current = 0;
    if (pondClickFlushRafRef.current) {
      cancelAnimationFrame(pondClickFlushRafRef.current);
      pondClickFlushRafRef.current = 0;
    }
    stateRef.current = { ...cycled, energy: 0 };
    setShopAffordRevision((n) => n + 1);
    markGameDirty();
    flushStatisticsToState();
    persistLocalSave();
  }, [
    commitSyncedEnergy,
    flushPendingPondClicksNow,
    refreshWeatherSpawnRemainingForSave,
    snapshotState,
    scheduleNextWeatherSpawn,
    markGameDirty,
    flushStatisticsToState,
    persistLocalSave,
    syncMilestones,
  ]);

  const beginPondCycle = useCallback(() => {
    if (motionPaused) {
      applyPondCycleState();
      return;
    }
    flushPendingPondClicksNow();
    snapClicker2CounterToEffective(gameLoopRefsBox, publishCounterHud);
    const frozenHud = formatEnergyAmountHud(
      Math.round(spendableEnergyRef.current),
    );
    setPondCycleCounterFrozenText(frozenHud);
    syncClicker2TabTitle(frozenHud);
    pondCycleFadeActiveRef.current = true;
    setPondCycleFadeActive(true);
  }, [
    motionPaused,
    applyPondCycleState,
    flushPendingPondClicksNow,
    publishCounterHud,
  ]);

  const snapCounterWhileScreenWhite = useCallback(() => {
    setPondCycleCounterFrozenText(null);
    snapClicker2CounterToEffective(gameLoopRefsBox, publishCounterHud);
    syncClicker2TabTitle(
      formatEnergyAmountHud(Math.round(spendableEnergyRef.current)),
    );
    setShopAffordRevision((n) => n + 1);
  }, [publishCounterHud]);

  const handlePondCycleFullyWhite = useCallback(() => {
    applyPondCycleState();
    snapCounterWhileScreenWhite();
  }, [applyPondCycleState, snapCounterWhileScreenWhite]);

  const handlePondCycleFadeComplete = useCallback(() => {
    pondCycleFadeActiveRef.current = false;
    setPondCycleFadeActive(false);
  }, []);

  const handleResetPondSave = useCallback(async () => {
    setResetPondBusy(true);
    setResetPondError(null);
    try {
      const token = await getApiAccessToken();
      const fresh = createDefaultClicker2State();
      const saveRes = await saveClicker2State(token, fresh);
      const userId = sessionUser?.user.id;
      if (userId != null) {
        writeClicker2LocalSave(userId, fresh);
      }
      const serverSavedAtMs = saveRes.updated_at
        ? Date.parse(saveRes.updated_at)
        : Date.now();
      lastSavedAtMsRef.current = Number.isFinite(serverSavedAtMs)
        ? serverSavedAtMs
        : Date.now();
      saveDirtyRef.current = false;
      setStatsModalOpen(false);
      setCyclePondModalOpen(false);
      setLoadAttempt((n) => n + 1);
    } catch (e) {
      setResetPondError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetPondBusy(false);
    }
  }, [getApiAccessToken, sessionUser]);

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

  const pondPanel = (
    <Stack
      flex={isMobile ? "1" : { base: "none", lg: "1 1 0" }}
      minW={isMobile ? undefined : { base: "auto", lg: 0 }}
      minH={0}
      w="full"
      gap="2"
      align="center"
      justify="flex-start"
      position="relative"
    >
      {activeWeather && !isMobile ? (
        <Clicker2WeatherEvent
          variantId={activeWeather.variantId}
          leftPct={activeWeather.leftPct}
          topPct={activeWeather.topPct}
          motionPaused={motionPaused}
          onActivate={onWeatherEventActivate}
        />
      ) : null}
      {!isMobile ? (
        <>
          <RollingEnergyCounter
            syncedEnergy={energy}
            energyPerSecond={displayEnergyPerSecond}
            anchorMs={energyAnchorMs}
            displayText={pondCycleHudDisplayText}
          />
          <Text fontSize="sm" color="gray.700">
            {pondCycleFadeActive
              ? "—"
              : `${formatEnergyRate(displayEnergyPerSecond)} ${ENERGY_EMOJI} per second`}
          </Text>
        </>
      ) : null}
      <Clicker2HeadlineStrip
        mode={celebrationMilestones.length > 0 ? "milestones" : "headline"}
        milestoneLeadingAction={
          celebrationMilestones.length >= 2 ? (
            <MilestoneDismissAllCard
              onDismissAll={() =>
                handleDismissAllMilestoneCelebrations(
                  celebrationMilestones.map((m) => m.id),
                )
              }
              motionPaused={motionPaused}
            />
          ) : undefined
        }
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
      <Box w="full">
        <Clicker2PondStage
          denizens={pondDenizens}
          blossomCount={blossomCount}
          clickValue={effectiveClickValueDisplay}
          rippleOpacityStart={rippleVisualStyle.opacityStart}
          rippleBorderAlpha={rippleVisualStyle.borderAlpha}
          motionPaused={motionPaused || pondCycleFadeActive}
          lightClickFx={clickMultiplier > 1}
          onClickPond={onClickPond}
        />
        {showBannerSlot ? (
          <Box className="pond2MilestoneBannerSlot pond2MilestoneBannerSlot--weather">
            <Stack align="center" gap="0.5">
              {boostBannerVariantId &&
              epsMultiplier > 1 &&
              weatherFamily(boostBannerVariantId) === "bluster" ? (
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
              ) : clickMultiplier > 1 && boostBannerVariantId ? (
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
      </Box>
      {saveError ? (
        <Text fontSize="xs" color="nautical.solid" role="alert">
          {saveError}
        </Text>
      ) : null}
    </Stack>
  );

  const depthPanel = (
    <Box
      flex={isMobile ? "1" : { base: "none", lg: "1 1 0" }}
      minW={isMobile ? undefined : { base: "auto", lg: 0 }}
      minH={0}
      w="full"
      display="flex"
      flexDirection="column"
      alignItems="center"
      overflowY="auto"
      pt={isMobile ? undefined : { lg: "6" }}
      css={HIDE_SCROLLBAR_CSS}
      py={isMobile ? "1" : undefined}
    >
      <Box
        w="full"
        maxW={isMobile ? "full" : { base: "full", lg: "calc(100% - 2.5rem)" }}
        mx="auto"
      >
        <StrataProgressRow
          allTimeEnergyEarned={effectiveAllTimeEnergyEarnedDisplay}
          pondEra={pondEra}
          unfossilizedStrata={unfossilizedStrataDisplay}
          fossils={fossils}
          onCycleClick={() => setCyclePondModalOpen(true)}
          canHoverFinePointer={canHoverFinePointer}
        />
        <Box mb="2" w="full">
          <MutagenPanel
            allTimeEnergyEarned={effectiveAllTimeEnergyEarnedDisplay}
            mutagensBank={mutagensBank}
            mutagenFormingStartedAtMs={mutagenFormingStartedAtMs}
            nowMs={Date.now()}
            onCollect={handleCollectMutagen}
            canHoverFinePointer={canHoverFinePointer}
          />
        </Box>
        <PondDepthChart
          timeline={denizenPurchaseTimeline}
          ownedDenizens={ownedDenizens}
          denizenMutationLevels={denizenMutationLevels}
          mutagenUnlocked={mutagenUnlocked}
          mutagensBank={mutagensBank}
          onMutate={handleMutateDenizen}
        />
      </Box>
    </Box>
  );

  const shopStatsButton = (
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
  );

  /*
   * CLICKER2_DEV_TOOLS — staff-only UI (import BLOSSOM_RING_MAX when re-enabled).
   *
   * const shopDevToolsPanel = showClicker2DevTools ? (
   *   <Flex
   *     gap="1"
   *     flexWrap="wrap"
   *     align="center"
   *     borderWidth="1px"
   *     borderStyle="dashed"
   *     borderColor="gray.400"
   *     borderRadius="md"
   *     p="1.5"
   *   >
   *     <Text fontSize="2xs" color="gray.600" flex="1" minW="6rem">
   *       TEMP dev tools
   *     </Text>
   *     <PondButton
   *       type="button"
   *       size="xs"
   *       variant="outline"
   *       colorPalette="gray"
   *       onClick={handleDevSetBlossoms100}
   *       disabled={blossomCount >= BLOSSOM_RING_MAX}
   *     >
   *       Set blossoms to 100
   *     </PondButton>
   *     <PondButton
   *       type="button"
   *       size="xs"
   *       variant="outline"
   *       colorPalette="gray"
   *       onClick={handleDevRevertBlossomsToEarned}
   *       disabled={devBlossomOverride === null}
   *     >
   *       Revert blossoms to earned
   *     </PondButton>
   *     <PondButton
   *       type="button"
   *       size="xs"
   *       variant="outline"
   *       colorPalette="gray"
   *       onClick={handleDevGainOneOfEachDenizen}
   *     >
   *       +1 of each denizen
   *     </PondButton>
   *     <PondButton
   *       type="button"
   *       size="xs"
   *       variant="outline"
   *       colorPalette="gray"
   *       onClick={handleDevGrantMutagenUnlockEnergy}
   *       disabled={
   *         effectiveAllTimeEnergyEarnedDisplay >= MUTAGEN_UNLOCK_ALL_TIME_ENERGY
   *       }
   *     >
   *       +1B lifetime
   *     </PondButton>
   *     <PondButton
   *       type="button"
   *       size="xs"
   *       variant="outline"
   *       colorPalette="gray"
   *       onClick={handleDevGrantMutagen}
   *     >
   *       +1 mutagen
   *     </PondButton>
   *   </Flex>
   * ) : null;
   */

  const shopDenizensList = (
    <DenizenShopList
      denizens={visibleDenizens}
      spendableEnergy={spendableEnergy}
      ownedDenizens={ownedDenizens}
      revealedDenizens={revealedDenizens}
      savedBannerKey={savedBannerKey}
      hideSavedIndicator={isMobile}
      canHoverFinePointer={canHoverFinePointer}
      effectiveEnergy={spendableEnergy}
      getTooltipSnapshot={getDenizenTooltipSnapshot}
      onBuy={buyDenizen}
    />
  );

  const shopDenizensPanel = shopDenizensList;

  const shopEvolutionsPanel = (
    <Stack gap="3">
      <SpecialtyShopGrid
        specialties={visibleSpecialties}
        spendableEnergy={spendableEnergy}
        canHoverFinePointer={canHoverFinePointer}
        onBuy={buySpecialty}
        headerTrailing={isMobile ? undefined : shopStatsButton}
      />
      {fossilShopVisible ? (
        <FossilShopSection
          fossils={fossils}
          ownedSpecialties={ownedSpecialties}
          canHoverFinePointer={canHoverFinePointer}
          onBuy={buyFossilShopSpecialty}
        />
      ) : null}
    </Stack>
  );

  const shopPanel = (
    <Box
      flex={isMobile ? "1" : { base: "1", lg: "0 0 360px" }}
      minW={isMobile ? undefined : "0"}
      minH={0}
      w="full"
      display="flex"
      flexDirection="column"
      overflowY={isMobile ? "hidden" : "auto"}
      borderRadius="md"
      bg={shopBackground}
      p="2"
      transition={`background-color ${WEATHER_PAGE_BACKGROUND_FADE_MS}ms ease`}
      css={isMobile ? undefined : HIDE_SCROLLBAR_CSS}
    >
      {isMobile ? (
        <Clicker2MobileShopPanels
          denizensPanel={shopDenizensPanel}
          evolutionsPanel={shopEvolutionsPanel}
        />
      ) : (
        <Stack gap="3">
          <SpecialtyShopGrid
            specialties={visibleSpecialties}
            spendableEnergy={spendableEnergy}
            canHoverFinePointer={canHoverFinePointer}
            onBuy={buySpecialty}
            headerTrailing={shopStatsButton}
          />
          {fossilShopVisible ? (
            <FossilShopSection
              fossils={fossils}
              ownedSpecialties={ownedSpecialties}
              canHoverFinePointer={canHoverFinePointer}
              onBuy={buyFossilShopSpecialty}
            />
          ) : null}
          {shopDenizensList}
        </Stack>
      )}
    </Box>
  );

  return (
    <ClickerPageShell
      fullWidthContent
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
        mx={isMobile ? undefined : { base: "-3", md: "-4" }}
        my={{ base: "-1", md: "-2" }}
        px={isMobile ? undefined : { base: "3", md: "4" }}
        py={{ base: "1", md: "2" }}
      >
        {isMobile ? (
          <Box
            flex="1"
            minH="0"
            display="flex"
            flexDirection="column"
            {...viewPortWidthBarProps}
          >
            <Clicker2MobileHud
              syncedEnergy={energy}
              energyPerSecond={displayEnergyPerSecond}
              anchorMs={energyAnchorMs}
              displayText={pondCycleHudDisplayText}
              statsButton={shopStatsButton}
              savedBannerKey={savedBannerKey}
              ongoingWeatherEmoji={ongoingWeatherHudEmoji}
            />
            <Clicker2MobilePanels
              pondPanel={pondPanel}
              shopPanel={shopPanel}
              depthPanel={depthPanel}
              activeWeather={activeWeather}
              onWeatherEventActivate={onWeatherEventActivate}
            />
          </Box>
        ) : (
          <Flex
            direction={{ base: "column", lg: "row" }}
            gap={{ base: "3", lg: "3" }}
            flex="1"
            minH="0"
            w="full"
            align={{ lg: "stretch" }}
            pl={{ base: 0, lg: "6" }}
          >
            {pondPanel}
            {depthPanel}
            {shopPanel}
          </Flex>
        )}
      </Box>
      <Clicker2StatsModal
        open={statsModalOpen}
        onOpenChange={setStatsModalOpen}
        snapshot={statsSnapshot}
        resetPondBusy={resetPondBusy}
        resetPondError={resetPondError}
        onResetPondSave={handleResetPondSave}
      />
      <CyclePondConfirmModal
        open={cyclePondModalOpen}
        onOpenChange={setCyclePondModalOpen}
        unfossilizedStrata={unfossilizedStrataDisplay}
        onConfirm={beginPondCycle}
      />
      <PondCycleFadeOverlay
        active={pondCycleFadeActive}
        motionPaused={motionPaused}
        onFullyWhite={handlePondCycleFullyWhite}
        onComplete={handlePondCycleFadeComplete}
      />
    </ClickerPageShell>
  );
}
