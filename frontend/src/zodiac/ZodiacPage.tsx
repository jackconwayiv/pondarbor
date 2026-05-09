import {
  Box,
  Flex,
  Heading,
  HStack,
  Input,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

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
  putAstroBirth,
  type AstroBirthPayload,
  type AstroProfileRow,
} from "./api";
import BigThreeStrip from "./BigThreeStrip";
import NatalChartAspectsPanel from "./NatalChartAspectsPanel";
import NatalChartHousesTable from "./NatalChartHousesTable";
import NatalChartPlanetsTable from "./NatalChartPlanetsTable";
import NatalChartWheel from "./NatalChartWheel";

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

/** Compare only fields collected on the member form (server may still store tz/coords from elsewhere). */
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

export default function ZodiacPage() {
  const { sessionUser, getApiAccessToken } = useAppSession();
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
  /** While staff chart is pending, birth form is hidden until the user chooses to edit. */
  const [showBirthFormWhileWaiting, setShowBirthFormWhileWaiting] = useState(false);
  /** When chart is ready, birth form opens only from Alter Details (between big three and tabs). */
  const [showAlterBirthForm, setShowAlterBirthForm] = useState(false);
  /** After saving birth info while waiting for staff chart, show inline confirmation below the banner. */
  const [waitingBirthSavedAck, setWaitingBirthSavedAck] = useState(false);

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
  }, [applyProfileToForm, getApiAccessToken, sessionUser?.profile?.birth_date]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (profile?.chart_status !== "waiting_staff_chart") {
      setShowBirthFormWhileWaiting(false);
    }
  }, [profile?.chart_status]);

  const waitingForStaffChart = profile?.chart_status === "waiting_staff_chart";

  const chart = profile?.natal_chart;
  const hasFullReadyChart = Boolean(
    profile?.chart_status === "ready" &&
      chart &&
      profile.sun_sign &&
      profile.moon_sign &&
      profile.rising_sign,
  );

  useEffect(() => {
    if (!hasFullReadyChart) {
      setShowAlterBirthForm(false);
    }
  }, [hasFullReadyChart]);

  useEffect(() => {
    if (!waitingForStaffChart) {
      setWaitingBirthSavedAck(false);
    }
  }, [waitingForStaffChart]);

  /** Bottom card: waiting (expanded), or non-ready/non-waiting states, or ready without a complete chart UI. */
  const showBirthFormAtBottom =
    (waitingForStaffChart && showBirthFormWhileWaiting) ||
    (profile != null &&
      profile.chart_status !== "waiting_staff_chart" &&
      profile.chart_status !== "ready") ||
    (profile != null && profile.chart_status === "ready" && !hasFullReadyChart);

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
    [
      birth_date,
      birth_time,
      country_code,
      admin_area,
      locality,
      postal_code,
    ],
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
      <Heading as="h2" size="md" fontWeight="bold" mb="3">
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
          <Heading as="h3" size="sm" fontWeight="semibold">
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
          <Heading as="h1" size={{ base: "lg", md: "xl" }} fontWeight="bold" mb="2">
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

  return (
    <>
      {trayShell(
        <>
          <Box {...PANEL_ENTRY_CARD_PROPS}>
            <Flex
              align={{ base: "flex-start", sm: "center" }}
              justify="space-between"
              gap="3"
              direction={{ base: "column", sm: "row" }}
              mb="2"
            >
              <Heading
                as="h1"
                size={{ base: "lg", md: "xl" }}
                fontWeight="bold"
                flex="1"
                minW="0"
              >
                <HStack as="span" display="inline-flex" gap="2" alignItems="center" flexWrap="wrap">
                  <Text as="span" aria-hidden="true">
                    🌞
                  </Text>
                  <Text as="span">Zodiackary</Text>
                </HStack>
              </Heading>
              {hasFullReadyChart ? (
                <Box flexShrink={0} w={{ base: "full", sm: "auto" }}>
                  <PondButton
                    size="sm"
                    variant="outline"
                    colorPalette="sky"
                    w={{ base: "full", sm: "auto" }}
                    onClick={() => setShowAlterBirthForm(true)}
                  >
                    Alter Details
                  </PondButton>
                </Box>
              ) : null}
            </Flex>
            <Text fontSize={APP_TEXT_SIZES.body} lineHeight="tall" color="fg">
              Your unique natal chart, derived from your birth details.
            </Text>
          </Box>

          {profile?.chart_status === "ready" && chart && profile.sun_sign && profile.moon_sign && profile.rising_sign && (
            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Stack gap="6" w="100%">
                <Stack gap="4">
                  <Heading as="h2" size="md" fontWeight="bold">
                    Your big three
                  </Heading>
                  <BigThreeStrip
                    sunSign={profile.sun_sign}
                    moonSign={profile.moon_sign}
                    risingSign={profile.rising_sign}
                  />
                </Stack>

                {showAlterBirthForm
                  ? renderBirthInformationCard(cancelAlterBirthForm)
                  : null}

                <Tabs.Root defaultValue="chart" variant="plain">
                <Tabs.List {...APP_SHELL_TAB_LIST_INSET_PROPS}>
                  <Tabs.Trigger value="chart" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                    Chart
                  </Tabs.Trigger>
                  <Tabs.Trigger value="planets" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                    Planets
                  </Tabs.Trigger>
                  <Tabs.Trigger value="houses" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                    Houses
                  </Tabs.Trigger>
                  <Tabs.Trigger value="aspects" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                    Aspects
                  </Tabs.Trigger>
                </Tabs.List>
                <Tabs.Content value="chart" pt="4">
                  <NatalChartWheel chart={chart} />
                </Tabs.Content>
                <Tabs.Content value="planets" pt="4">
                  <NatalChartPlanetsTable chart={chart} />
                </Tabs.Content>
                <Tabs.Content value="houses" pt="4">
                  <NatalChartHousesTable chart={chart} />
                </Tabs.Content>
                <Tabs.Content value="aspects" pt="4">
                  <NatalChartAspectsPanel
                    chart={chart}
                    aspectsNote="Parsed from your birth details."
                  />
                </Tabs.Content>
              </Tabs.Root>
              </Stack>
            </Box>
          )}

          {waitingForStaffChart && (
            <Stack gap="3" w="100%">
              <Box
                borderRadius="xl"
                borderWidth="1px"
                borderColor="border"
                bg="sky.subtle"
                p={{ base: "4", md: "5" }}
                boxShadow="sm"
              >
                <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.title}>
                  Waiting for your chart
                </Text>
                <Text fontSize={APP_TEXT_SIZES.body} color="fg" mt="2" lineHeight="tall">
                  We have your birth details. A staff member will import your chart soon — watch
                  this page for your details.
                </Text>
                {!showBirthFormWhileWaiting ? (
                  <Box mt="4">
                    <PondButton
                      colorPalette="sky"
                      onClick={() => {
                        setWaitingBirthSavedAck(false);
                        setShowBirthFormWhileWaiting(true);
                      }}
                    >
                      Edit Birth Details
                    </PondButton>
                  </Box>
                ) : null}
              </Box>
              {waitingBirthSavedAck ? (
                <Text fontSize={APP_TEXT_SIZES.body} color="fg" lineHeight="tall">
                  Your birth details were updated.
                </Text>
              ) : null}
            </Stack>
          )}

          {showBirthFormAtBottom
            ? renderBirthInformationCard(
                waitingForStaffChart && showBirthFormWhileWaiting
                  ? cancelWaitingBirthForm
                  : undefined,
              )
            : null}
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
