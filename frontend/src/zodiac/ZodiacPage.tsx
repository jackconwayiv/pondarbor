import {
  Box,
  Heading,
  HStack,
  Input,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { AppModal } from "../components/AppModal";
import { SessionLoadingCard } from "../components/panelStatus";
import { fullBleedStackProps } from "../responsive";
import {
  APP_SHELL_TAB_LIST_INSET_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FIELD_PROPS,
} from "../theme/typography";
import {
  fetchAstroProfile,
  fetchFriendsWithZodiac,
  putAstroBirth,
  type AstroBirthPayload,
  type AstroProfileRow,
  type FriendWithZodiac,
} from "./api";
import { formatBirthDateLong } from "./birthDateFormat";
import type { NatalChartPayload } from "./chartTypes";
import NatalChartAspectsPanel from "./NatalChartAspectsPanel";
import { buildAspectInterpretWriteup } from "./buildAspectInterpretWriteup";
import { filterAspectsForInterpret } from "./zodiacAspectFilters";
import { normalizedAspectFocus, type ZodiacChartFocus } from "./zodiacChartFocus";
import NatalChartHousesTable from "./NatalChartHousesTable";
import NatalChartPlanetsTable from "./NatalChartPlanetsTable";
import NatalChartWheel from "./NatalChartWheel";
import ZodiacComboDescriptorBodyContent from "./ZodiacComboDescriptorBodyContent";
import ZodiacOverviewCardsStrip, { buildZodiacOverviewTiles } from "./ZodiacOverviewCardsStrip";
import ZodiacOverviewMiniTiles from "./ZodiacOverviewMiniTiles";
import ZodiacPlacementBodyContent from "./ZodiacPlacementBodyContent";
import type { ZodiacSignCardTile } from "./ZodiacSignCardsStrip";
import { signCardAccent } from "./signCardAccent";
import { zodiacTileFromChartBodyKey } from "./zodiacPlacementFromChart";
import ZodiacFriendsTabPanel from "./ZodiacFriendsTabPanel";
import ZodiacInterpretTabPanel from "./ZodiacInterpretTabPanel";
import { INTERPRET_HEADING_SIZE } from "./interpretTypography";
import { youAreSignHeading } from "./astroLexicon";

/** Normalize for API + stable birthKey comparison (optional time → null). */
function normalizeBirthTimeForKey(raw: string | null | undefined): string | null {
  if (raw == null || !String(raw).trim()) return null;
  const t = String(raw).trim();
  if (t.length === 5 && t[2] === ":") return `${t}:00`;
  if (t.length >= 8 && t[2] === ":" && t[5] === ":") return t.slice(0, 8);
  return t;
}

function birthPayloadFromForm(state: {
  birth_date: string;
  birth_time: string;
  country_code: string;
  admin_area: string;
  locality: string;
  postal_code: string;
}): AstroBirthPayload {
  const cc = state.country_code.trim().toUpperCase().slice(0, 2);
  return {
    birth_date: state.birth_date.trim(),
    birth_time: normalizeBirthTimeForKey(state.birth_time),
    country_code: cc,
    admin_area: state.admin_area.trim(),
    locality: state.locality.trim(),
    postal_code: state.postal_code.trim(),
  };
}

function birthKey(p: AstroBirthPayload): string {
  return JSON.stringify([
    p.birth_date,
    p.birth_time,
    p.country_code,
    p.admin_area,
    p.locality,
    p.postal_code,
  ]);
}

function formatBirthTimeDisplay(isoTime: string | null | undefined): string {
  if (!isoTime?.trim()) return "Not provided";
  const t = isoTime.trim();
  if (t.length >= 5 && t[2] === ":") return t.slice(0, 5);
  return t;
}

function natalPlaceLine(p: AstroProfileRow): string {
  const parts = [
    p.locality?.trim(),
    p.admin_area?.trim(),
    p.country_code?.trim(),
  ].filter(Boolean);
  const core = parts.join(", ");
  const zip = p.postal_code?.trim();
  if (core && zip) return `${core} ${zip}`;
  if (core) return core;
  return "—";
}

function natalBirthSummaryStack(p: AstroProfileRow): ReactNode {
  return (
    <Stack gap="2" fontSize={APP_TEXT_SIZES.body} lineHeight="tall" color="fg">
      <Text>
        <Text as="span" fontWeight="semibold">
          Birthday:{" "}
        </Text>
        {formatBirthDateLong(p.birth_date)}
      </Text>
      <Text>
        <Text as="span" fontWeight="semibold">
          Birth time:{" "}
        </Text>
        {formatBirthTimeDisplay(p.birth_time)}
      </Text>
      <Text>
        <Text as="span" fontWeight="semibold">
          Place of birth:{" "}
        </Text>
        {natalPlaceLine(p)}
      </Text>
    </Stack>
  );
}

type MainTab = "overview" | "interpretation" | "data" | "friends";
type DataSubTab = "planets" | "houses" | "aspects" | "natal";

function mainTabFromSearchParams(
  params: URLSearchParams,
  hasStaffImportedChart: boolean,
): MainTab | null {
  const raw = params.get("tab");
  if (raw === "friends") return "friends";
  if (raw === "data") return "data";
  if (raw === "interpretation" && hasStaffImportedChart) return "interpretation";
  if (raw === "overview" && hasStaffImportedChart) return "overview";
  return null;
}

function parseHighlightUserId(params: URLSearchParams): number | null {
  const raw = params.get("user");
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function ZodiacPage() {
  const { sessionUser, getApiAccessToken, resyncSessionSilently } = useAppSession();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<AstroProfileRow | null>(null);

  const [birth_date, setBirthDate] = useState("");
  const [birth_time, setBirthTime] = useState("");
  const [country_code, setCountryCode] = useState("US");
  const [admin_area, setAdminArea] = useState("");
  const [locality, setLocality] = useState("");
  const [postal_code, setPostalCode] = useState("");

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSavePayload, setPendingSavePayload] = useState<AstroBirthPayload | null>(
    null,
  );
  const [showBirthFormWhileWaiting, setShowBirthFormWhileWaiting] = useState(false);
  const [showAlterBirthForm, setShowAlterBirthForm] = useState(false);
  const [waitingBirthSavedAck, setWaitingBirthSavedAck] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const [mainTab, setMainTab] = useState<MainTab>("data");
  const [dataSubTab, setDataSubTab] = useState<DataSubTab>("planets");
  const prevHadImportedChartRef = useRef(false);
  const highlightFriendUserId = useMemo(
    () => parseHighlightUserId(searchParams),
    [searchParams],
  );
  const [placementPaneTile, setPlacementPaneTile] = useState<ZodiacSignCardTile | null>(
    null,
  );
  const [canvasDescriptorSign, setCanvasDescriptorSign] = useState<string | null>(null);
  const [interpretAspectFocus, setInterpretAspectFocus] = useState<
    Extract<ZodiacChartFocus, { kind: "aspect" }> | null
  >(null);
  const [interpretPlacementFocus, setInterpretPlacementFocus] = useState<
    Extract<ZodiacChartFocus, { kind: "body" }> | null
  >(null);

  const [friendsWithZodiac, setFriendsWithZodiac] = useState<FriendWithZodiac[]>([]);
  const [friendsLoadError, setFriendsLoadError] = useState<string | null>(null);

  const viewerUserId = sessionUser?.user.id;
  const visibleFriends = useMemo(
    () =>
      viewerUserId != null
        ? friendsWithZodiac.filter((f) => f.id !== viewerUserId)
        : friendsWithZodiac,
    [friendsWithZodiac, viewerUserId],
  );
  const applyProfileToForm = useCallback((row: AstroProfileRow | null, prefBirth?: string | null) => {
    if (!row) {
      setBirthDate(prefBirth ?? "");
      setBirthTime("");
      setCountryCode("US");
      setAdminArea("");
      setLocality("");
      setPostalCode("");
      return;
    }
    setBirthDate(row.birth_date ?? prefBirth ?? "");
    setBirthTime(row.birth_time ? row.birth_time.slice(0, 5) : "");
    setCountryCode(row.country_code || "US");
    setAdminArea(row.admin_area || "");
    setLocality(row.locality || "");
    setPostalCode(row.postal_code || "");
  }, []);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const token = await getApiAccessToken();
      const res = await fetchAstroProfile(token);
      setProfile(res.profile);
      applyProfileToForm(res.profile, sessionUser?.profile?.birth_date ?? null);
      if (res.profile?.chart_status === "ready" && res.profile.natal_chart) {
        await resyncSessionSilently();
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "pending_approval") {
        setLoadError(
          "Your account must be approved before you can use Zodiackary.",
        );
      } else {
        setLoadError(e instanceof Error ? e.message : "Could not load profile.");
      }
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [
    applyProfileToForm,
    getApiAccessToken,
    resyncSessionSilently,
    sessionUser?.profile?.birth_date,
  ]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!sessionUser?.user?.is_approved) return;
    let cancelled = false;
    setFriendsLoadError(null);
    void (async () => {
      try {
        const token = await getApiAccessToken();
        const payload = await fetchFriendsWithZodiac(token);
        if (cancelled) return;
        setFriendsWithZodiac(payload.friends);
      } catch (e: unknown) {
        if (cancelled) return;
        setFriendsLoadError(e instanceof Error ? e.message : "Failed to load friends.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getApiAccessToken, sessionUser?.user?.is_approved]);

  useEffect(() => {
    if (profile?.chart_status !== "waiting_staff_chart") {
      setShowBirthFormWhileWaiting(false);
    }
  }, [profile?.chart_status]);

  const waitingForStaffChart = profile?.chart_status === "waiting_staff_chart";

  const chart = profile?.natal_chart;
  const birthTimeUnknown = Boolean(profile?.birth_time_unknown);

  const hasStaffImportedChart = Boolean(
    profile?.chart_status === "ready" &&
      chart &&
      profile.sun_sign &&
      profile.moon_sign &&
      (birthTimeUnknown || Boolean(profile.rising_sign?.trim())),
  );

  const interpretableSextileKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!chart) return keys;
    for (const aspect of filterAspectsForInterpret(chart.aspects, { birthTimeUnknown })) {
      if (!buildAspectInterpretWriteup(aspect, chart)) continue;
      const focus = normalizedAspectFocus(aspect.body_a, aspect.body_b, aspect.type);
      keys.add(`${focus.bodyLo}|${focus.bodyHi}|${focus.type}`);
    }
    return keys;
  }, [chart, birthTimeUnknown]);

  const isAspectInterpretable = useCallback(
    (aspect: NatalChartPayload["aspects"][number]) => {
      const focus = normalizedAspectFocus(aspect.body_a, aspect.body_b, aspect.type);
      return interpretableSextileKeys.has(`${focus.bodyLo}|${focus.bodyHi}|${focus.type}`);
    },
    [interpretableSextileKeys],
  );

  const overviewTiles = useMemo(() => {
    if (!hasStaffImportedChart || !profile || !chart) return [];
    return buildZodiacOverviewTiles({
      sunSign: profile.sun_sign!,
      moonSign: profile.moon_sign!,
      risingSign: birthTimeUnknown ? undefined : (profile.rising_sign ?? undefined),
      mercurySign: chart.points.mercury?.sign,
      venusSign: chart.points.venus?.sign,
      marsSign: chart.points.mars?.sign,
      natalChart: chart,
    });
  }, [hasStaffImportedChart, profile, chart, birthTimeUnknown]);

  const overviewShowsBigThreeStrip =
    placementPaneTile == null && canvasDescriptorSign == null;

  const youAreSunSignLine = useMemo(
    () => (profile?.sun_sign ? youAreSignHeading(profile.sun_sign) : null),
    [profile?.sun_sign],
  );

  const onMiniPlacementSelect = useCallback((tile: ZodiacSignCardTile) => {
    setCanvasDescriptorSign(null);
    setPlacementPaneTile((prev) => (prev?.id === tile.id ? null : tile));
  }, []);

  const openPlacementTile = useCallback((tile: ZodiacSignCardTile) => {
    setCanvasDescriptorSign(null);
    setPlacementPaneTile(tile);
  }, []);

  const canvasShellSign = canvasDescriptorSign ?? placementPaneTile?.sign ?? null;

  useEffect(() => {
    if (!hasStaffImportedChart) {
      setShowAlterBirthForm(false);
    }
  }, [hasStaffImportedChart]);

  useEffect(() => {
    if (!waitingForStaffChart) {
      setWaitingBirthSavedAck(false);
    }
  }, [waitingForStaffChart]);

  useEffect(() => {
    if (!hasStaffImportedChart) {
      setPlacementPaneTile(null);
      setCanvasDescriptorSign(null);
    }
  }, [hasStaffImportedChart]);

  useEffect(() => {
    const fromUrl = mainTabFromSearchParams(searchParams, hasStaffImportedChart);
    if (fromUrl) {
      setMainTab(fromUrl);
      return;
    }
    setMainTab(hasStaffImportedChart ? "overview" : "data");
  }, [searchParams, hasStaffImportedChart]);

  useEffect(() => {
    if (hasStaffImportedChart && !prevHadImportedChartRef.current) {
      setMainTab("overview");
      setDataSubTab("planets");
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("tab");
          next.delete("user");
          return next;
        },
        { replace: true },
      );
    }
    prevHadImportedChartRef.current = hasStaffImportedChart;
  }, [hasStaffImportedChart, setSearchParams]);

  useEffect(() => {
    if (
      !hasStaffImportedChart &&
      (mainTab === "interpretation" || mainTab === "overview")
    ) {
      setMainTab("data");
    }
  }, [hasStaffImportedChart, mainTab]);

  const onMainTabChange = useCallback(
    (tab: MainTab) => {
      setMainTab(tab);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === "overview") {
            next.delete("tab");
          } else {
            next.set("tab", tab);
          }
          if (tab !== "friends") {
            next.delete("user");
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const openPlacementInInterpret = useCallback(
    (chartKey: string) => {
      onMainTabChange("interpretation");
      setInterpretPlacementFocus({ kind: "body", chartKey });
    },
    [onMainTabChange],
  );

  const openAspectInInterpret = useCallback(
    (aspect: NatalChartPayload["aspects"][number]) => {
      if (!isAspectInterpretable(aspect)) return;
      onMainTabChange("interpretation");
      setInterpretAspectFocus(
        normalizedAspectFocus(aspect.body_a, aspect.body_b, aspect.type),
      );
    },
    [isAspectInterpretable, onMainTabChange],
  );

  useEffect(() => {
    setPlacementPaneTile(null);
    setCanvasDescriptorSign(null);
  }, [chart]);

  const chartIncompleteReady =
    Boolean(profile) &&
    !hasStaffImportedChart &&
    !waitingForStaffChart &&
    profile?.chart_status === "ready";

  const birthFormInWaitingNatalPanel = waitingForStaffChart && showBirthFormWhileWaiting;

  const showBirthFormAtBottom =
    profile === null ||
    (!birthFormInWaitingNatalPanel &&
      profile != null &&
      profile.chart_status !== "waiting_staff_chart" &&
      profile.chart_status !== "ready");

  const formPayload = useMemo(
    () =>
      birthPayloadFromForm({
        birth_date,
        birth_time,
        country_code,
        admin_area,
        locality,
        postal_code,
      }),
    [birth_date, birth_time, country_code, admin_area, locality, postal_code],
  );

  const baselineKey = useMemo(() => {
    if (!profile) return "";
    return birthKey({
      birth_date: profile.birth_date ?? "",
      birth_time: normalizeBirthTimeForKey(profile.birth_time),
      country_code: profile.country_code,
      admin_area: profile.admin_area,
      locality: profile.locality,
      postal_code: profile.postal_code,
    });
  }, [profile]);

  const submitBirth = async (payload: AstroBirthPayload) => {
    setSaveBusy(true);
    setSaveError(null);
    const wasWaitingForStaffChart = profile?.chart_status === "waiting_staff_chart";
    try {
      const token = await getApiAccessToken();
      const res = await putAstroBirth(token, payload);
      setProfile(res.profile);
      applyProfileToForm(res.profile, sessionUser?.profile?.birth_date ?? null);
      setConfirmOpen(false);
      setPendingSavePayload(null);
      setShowAlterBirthForm(false);
      if (wasWaitingForStaffChart) {
        setShowBirthFormWhileWaiting(false);
        setWaitingBirthSavedAck(true);
      }
      await resyncSessionSilently();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaveBusy(false);
    }
  };

  const validateBirthForm = (): string | null => {
    if (!birth_date.trim()) return "Birth date is required.";
    if (!locality.trim()) return "City is required.";
    if (!admin_area.trim()) return "State is required.";
    const cc = country_code.trim().toUpperCase();
    if (cc.length !== 2) return "Country is required (two-letter code, e.g. US).";
    return null;
  };

  const onSaveClick = () => {
    setSaveError(null);
    const clientErr = validateBirthForm();
    if (clientErr) {
      setSaveError(clientErr);
      return;
    }
    const payload = formPayload;
    if (
      profile?.chart_status === "ready" &&
      baselineKey &&
      birthKey(payload) !== baselineKey
    ) {
      setPendingSavePayload(payload);
      setConfirmOpen(true);
      return;
    }
    void submitBirth(payload);
  };

  const cancelWaitingBirthForm = useCallback(() => {
    setSaveError(null);
    if (profile) {
      applyProfileToForm(profile, sessionUser?.profile?.birth_date ?? null);
    }
    setShowBirthFormWhileWaiting(false);
  }, [applyProfileToForm, profile, sessionUser?.profile?.birth_date]);

  const cancelAlterBirthForm = useCallback(() => {
    setSaveError(null);
    if (profile) {
      applyProfileToForm(profile, sessionUser?.profile?.birth_date ?? null);
    }
    setShowAlterBirthForm(false);
  }, [applyProfileToForm, profile, sessionUser?.profile?.birth_date]);

  const renderBirthInformationCard = (onCancel?: () => void) => (
    <Box {...PANEL_ENTRY_CARD_PROPS}>
      <Heading as="h2" size="md" mb="3">
        Birth information
      </Heading>

      <Stack gap="5" w="100%">
        <SimpleGrid columns={{ base: 1, sm: 2 }} gap="3" alignItems="start">
          <Stack gap="1">
            <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium">
              Birth date *
            </Text>
            <Input
              type="date"
              value={birth_date}
              onChange={(e) => setBirthDate(e.target.value)}
              required
              {...PANEL_FIELD_PROPS}
            />
          </Stack>
          <Stack gap="1">
            <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium">
              Birth time
            </Text>
            <Input
              type="time"
              value={birth_time}
              onChange={(e) => setBirthTime(e.target.value)}
              {...PANEL_FIELD_PROPS}
            />
            <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
              Best results require a birth time; leave blank if unknown.
            </Text>
          </Stack>
        </SimpleGrid>

        <Stack gap="3">
          <Heading as="h3" size="sm">
            Birth place *
          </Heading>
          <SimpleGrid columns={{ base: 1, sm: 2 }} gap="3" alignItems="start">
            <Stack gap="1">
              <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium">
                City *
              </Text>
              <Input
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
                autoComplete="address-level2"
                required
                {...PANEL_FIELD_PROPS}
              />
            </Stack>
            <Stack gap="1">
              <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium">
                State *
              </Text>
              <Input
                value={admin_area}
                onChange={(e) => setAdminArea(e.target.value)}
                autoComplete="address-level1"
                required
                {...PANEL_FIELD_PROPS}
              />
            </Stack>
            <Stack gap="1">
              <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium">
                Country *
              </Text>
              <Input
                value={country_code}
                onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                maxLength={2}
                placeholder="US"
                autoComplete="country"
                required
                {...PANEL_FIELD_PROPS}
              />
            </Stack>
            <Stack gap="1">
              <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium">
                ZIP code (optional)
              </Text>
              <Input
                value={postal_code}
                onChange={(e) => setPostalCode(e.target.value)}
                autoComplete="postal-code"
                {...PANEL_FIELD_PROPS}
              />
            </Stack>
          </SimpleGrid>
        </Stack>

        {saveError && (
          <Text fontSize="sm" color="fg.error">
            {saveError}
          </Text>
        )}
        <HStack gap="3" flexWrap="wrap" alignItems="center">
          <PondButton
            colorPalette="sky"
            onClick={() => void onSaveClick()}
            disabled={saveBusy}
          >
            {saveBusy ? "Saving…" : "Save birth information"}
          </PondButton>
          {onCancel ? (
            <PondButton variant="ghost" onClick={onCancel}>
              Cancel
            </PondButton>
          ) : null}
        </HStack>
      </Stack>
    </Box>
  );

  const trayShell = (children: ReactNode) => (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box flex="1" bg="bg" px={0} py={{ base: "2", md: "2" }}>
        <Box {...APP_SHELL_TRAY_PROPS}>
          <Stack
            gap={{ base: "3", md: "3" }}
            px={{ base: "2", md: "2" }}
            pt={{ base: "2", md: "2" }}
            pb="2"
          >
            {children}
          </Stack>
        </Box>
      </Box>
    </Stack>
  );

  if (loading) {
    return <SessionLoadingCard />;
  }

  if (loadError) {
    return trayShell(
      <>
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <Heading as="h1" size={{ base: "lg", md: "xl" }} mb="2">
            <HStack as="span" display="inline-flex" gap="2" alignItems="center" flexWrap="wrap">
              <Text as="span" aria-hidden="true">
                🌞
              </Text>
              <Text as="span">Zodiackary</Text>
            </HStack>
          </Heading>
          <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
            {loadError}
          </Text>
        </Box>
      </>,
    );
  }

  const overviewCanvas = hasStaffImportedChart && chart && profile ? (
    <Box
      borderRadius="xl"
      bg={canvasShellSign ? signCardAccent(canvasShellSign).bg : "transparent"}
      p={canvasShellSign ? { base: "4", md: "5" } : undefined}
      minH={canvasShellSign ? { base: "240px", md: "260px" } : undefined}
    >
      {canvasDescriptorSign ? (
        <ZodiacComboDescriptorBodyContent signRaw={canvasDescriptorSign} />
      ) : placementPaneTile ? (
        <ZodiacPlacementBodyContent
          tile={placementPaneTile}
          onOpenModeElementDetail={() => setCanvasDescriptorSign(placementPaneTile.sign)}
          onLearnMore={() => openPlacementInInterpret(placementPaneTile.id)}
        />
      ) : (
        <ZodiacOverviewCardsStrip
          sunSign={profile.sun_sign!}
          moonSign={profile.moon_sign!}
          risingSign={birthTimeUnknown ? undefined : (profile.rising_sign ?? undefined)}
          mercurySign={chart.points.mercury?.sign}
          venusSign={chart.points.venus?.sign}
          marsSign={chart.points.mars?.sign}
          natalChart={chart}
          onTileOpen={openPlacementTile}
          onInterpretClick={() => onMainTabChange("interpretation")}
        />
      )}
    </Box>
  ) : null;

  return (
    <>
      {trayShell(
        <>
          <Box {...PANEL_ENTRY_CARD_PROPS}>
            <Tabs.Root
              value={mainTab}
              onValueChange={(d) => onMainTabChange(d.value as MainTab)}
              variant="plain"
            >
              <Tabs.List {...APP_SHELL_TAB_LIST_INSET_PROPS}>
                {hasStaffImportedChart ? (
                  <Tabs.Trigger value="overview" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                    Overview
                  </Tabs.Trigger>
                ) : null}
                {hasStaffImportedChart ? (
                  <Tabs.Trigger value="interpretation" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                    Interpret
                  </Tabs.Trigger>
                ) : null}
                <Tabs.Trigger value="data" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                  Data
                </Tabs.Trigger>
                <Tabs.Trigger value="friends" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                  Friends
                </Tabs.Trigger>
              </Tabs.List>

              {hasStaffImportedChart ? (
                <Tabs.Content value="overview" pt="4">
                  <Stack gap="4" w="100%">
                    {overviewTiles.length > 0 ? (
                      <ZodiacOverviewMiniTiles
                        fillRow
                        tiles={overviewTiles}
                        activeTileId={placementPaneTile?.id ?? ""}
                        onSelect={onMiniPlacementSelect}
                      />
                    ) : null}
                    {overviewShowsBigThreeStrip && youAreSunSignLine ? (
                      <Heading
                        as="h2"
                        size={INTERPRET_HEADING_SIZE}
                        fontFamily="heading"
                        fontWeight="normal"
                        lineHeight="short"
                        color="fg"
                        mb="0"
                      >
                        {youAreSunSignLine}
                      </Heading>
                    ) : null}
                    {overviewCanvas}
                  </Stack>
                </Tabs.Content>
              ) : null}

              {hasStaffImportedChart && chart ? (
                <Tabs.Content value="interpretation" pt="4">
                  <ZodiacInterpretTabPanel
                    chart={chart}
                    includeHouses={!birthTimeUnknown}
                    includeRising={!birthTimeUnknown}
                    birthTimeUnknown={birthTimeUnknown}
                    aspectFocus={interpretAspectFocus}
                    onAspectFocusConsumed={() => setInterpretAspectFocus(null)}
                    placementFocus={interpretPlacementFocus}
                    onPlacementFocusConsumed={() => setInterpretPlacementFocus(null)}
                  />
                </Tabs.Content>
              ) : null}

              <Tabs.Content value="data" pt="4">
                <Stack gap="6" w="100%">
                  {!hasStaffImportedChart ? (
                    <Box>
                      <Heading as="h1" size={{ base: "lg", md: "xl" }} mb="2">
                        <HStack
                          as="span"
                          display="inline-flex"
                          gap="2"
                          alignItems="center"
                          flexWrap="wrap"
                        >
                          <Text as="span" aria-hidden="true">
                            🌞
                          </Text>
                          <Text as="span">Zodiackary</Text>
                        </HStack>
                      </Heading>
                      <Text fontSize={APP_TEXT_SIZES.body} lineHeight="tall" color="fg">
                        What did the stars say about the moment of your birth?
                      </Text>
                    </Box>
                  ) : null}

                  {hasStaffImportedChart && chart && profile ? (
                    <Tabs.Root
                      value={dataSubTab}
                      onValueChange={(d) => setDataSubTab(d.value as DataSubTab)}
                      variant="plain"
                    >
                        <Tabs.List {...APP_SHELL_TAB_LIST_INSET_PROPS}>
                          <Tabs.Trigger value="planets" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                            Planets
                          </Tabs.Trigger>
                          <Tabs.Trigger value="houses" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                            Houses
                          </Tabs.Trigger>
                          <Tabs.Trigger value="aspects" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                            Aspects
                          </Tabs.Trigger>
                          <Tabs.Trigger value="natal" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                            Natal
                          </Tabs.Trigger>
                        </Tabs.List>
                        <Tabs.Content value="planets" pt="4">
                          <NatalChartPlanetsTable
                            chart={chart}
                            hideAngles={birthTimeUnknown}
                            onBodyRowClick={(key) => {
                              const t = zodiacTileFromChartBodyKey(key, chart);
                              if (t) openPlacementTile(t);
                            }}
                          />
                        </Tabs.Content>
                        <Tabs.Content value="houses" pt="4">
                          {birthTimeUnknown ? (
                            <Text
                              fontSize={APP_TEXT_SIZES.body}
                              color="fg.muted"
                              lineHeight="tall"
                            >
                              House cusps and the chart wheel are hidden when no reliable birth time
                              is available. If you obtain a birth time, ask staff to refresh your
                              chart.
                            </Text>
                          ) : (
                            <Stack gap="6" w="100%">
                              <NatalChartWheel chart={chart} />
                              <NatalChartHousesTable chart={chart} />
                            </Stack>
                          )}
                        </Tabs.Content>
                        <Tabs.Content value="aspects" pt="4">
                          <NatalChartAspectsPanel
                            chart={chart}
                            excludeAngleBodies={birthTimeUnknown}
                            onAspectRowClick={openAspectInInterpret}
                            isAspectInterpretable={isAspectInterpretable}
                          />
                        </Tabs.Content>
                        <Tabs.Content value="natal" pt="4">
                          <Stack gap="4" w="100%">
                            {natalBirthSummaryStack(profile)}
                            <PondButton
                              size="sm"
                              variant="outline"
                              colorPalette="sky"
                              alignSelf="flex-start"
                              onClick={() => setShowAlterBirthForm(true)}
                            >
                              Alter details
                            </PondButton>
                            {showAlterBirthForm
                              ? renderBirthInformationCard(cancelAlterBirthForm)
                              : null}
                          </Stack>
                        </Tabs.Content>
                    </Tabs.Root>
                  ) : null}

                  {waitingForStaffChart && profile ? (
                    <Box {...PANEL_ENTRY_CARD_PROPS}>
                      <Heading as="h2" size="md" mb="3">
                        Natal
                      </Heading>
                      {natalBirthSummaryStack(profile)}
                      <Stack gap="4" mt="4">
                        {!showBirthFormWhileWaiting ? (
                          <PondButton
                            colorPalette="sky"
                            onClick={() => {
                              setWaitingBirthSavedAck(false);
                              setShowBirthFormWhileWaiting(true);
                            }}
                          >
                            Edit birth details
                          </PondButton>
                        ) : null}
                        <Box
                          borderRadius="lg"
                          borderWidth="1px"
                          borderColor="border"
                          bg="sky.subtle"
                          p={{ base: "3", md: "4" }}
                        >
                          <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.title}>
                            Waiting for your chart
                          </Text>
                          <Text fontSize={APP_TEXT_SIZES.body} color="fg" mt="2" lineHeight="tall">
                            We have your birth details. A staff member will import your chart soon —
                            watch this page for your details.
                          </Text>
                        </Box>
                        {waitingBirthSavedAck ? (
                          <Text fontSize={APP_TEXT_SIZES.body} color="fg" lineHeight="tall">
                            Your birth details were updated.
                          </Text>
                        ) : null}
                        {birthFormInWaitingNatalPanel
                          ? renderBirthInformationCard(cancelWaitingBirthForm)
                          : null}
                      </Stack>
                    </Box>
                  ) : null}

                  {chartIncompleteReady && profile ? (
                    <Box {...PANEL_ENTRY_CARD_PROPS}>
                      <Heading as="h2" size="md" mb="3">
                        Natal
                      </Heading>
                      {natalBirthSummaryStack(profile)}
                      <PondButton
                        mt="4"
                        size="sm"
                        variant="outline"
                        colorPalette="sky"
                        onClick={() => setShowAlterBirthForm(true)}
                      >
                        Alter details
                      </PondButton>
                      {showAlterBirthForm ? renderBirthInformationCard(cancelAlterBirthForm) : null}
                    </Box>
                  ) : null}

                  {showBirthFormAtBottom
                    ? renderBirthInformationCard(
                        waitingForStaffChart && showBirthFormWhileWaiting
                          ? cancelWaitingBirthForm
                          : undefined,
                      )
                    : null}
                </Stack>
              </Tabs.Content>

              <Tabs.Content value="friends" pt="4">
                <ZodiacFriendsTabPanel
                  friends={visibleFriends}
                  friendsLoadError={friendsLoadError}
                  highlightUserId={highlightFriendUserId}
                />
              </Tabs.Content>
            </Tabs.Root>
          </Box>
        </>,
      )}

      <AppModal
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmOpen(false);
            setPendingSavePayload(null);
          }
        }}
        title="Reset chart data?"
        description="Editing your birth details will reset your chart data. You will return to the waiting list until staff imports a new chart for you. OK to proceed?"
        showCloseButton={false}
        size="sm"
      >
        <Stack direction="row" gap="2" justify="flex-end" pt="2">
          <PondButton variant="ghost" onClick={() => setConfirmOpen(false)}>
            Cancel
          </PondButton>
          <PondButton
            colorPalette="nautical"
            onClick={() => {
              if (pendingSavePayload) void submitBirth(pendingSavePayload);
            }}
          >
            OK
          </PondButton>
        </Stack>
      </AppModal>
    </>
  );
}
