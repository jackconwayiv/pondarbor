import {
  Box,
  Card,
  Heading,
  HStack,
  Input,
  Stack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import PondNativeSelect from "../components/PondNativeSelect";
import {
  APP_SHELL_TAB_LIST_NESTED_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FIELD_PROPS,
  PANEL_NESTED_BLOCK_PROPS,
} from "../theme/typography";
import {
  cancelDisconnect,
  confirmDisconnect,
  fetchDisconnectPending,
  requestDisconnect,
} from "./api";
import { MealPartnerPicker, type MealPartnerPickerNotice } from "./MealPartnerPicker";
import { WEEKDAY_FULL } from "./mealLabels";
import { defaultSlotLabelsForCount, MEAL_SLOT_NAME_OPTIONS } from "./mealSlotLabels";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import { MealMaestroSetupWizard } from "./wizard/MealMaestroSetupWizard";

const MEAL_TIME_NAMES_TAB_LIST_PROPS = {
  ...APP_SHELL_TAB_LIST_NESTED_PROPS,
  px: { base: "2", md: "2" } as const,
} as const;

function slotDraftFromProfile(raw: Record<string, string[]> | null | undefined): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const n of [1, 2, 3, 4, 5] as const) {
    const key = String(n);
    const custom = raw?.[key];
    if (custom && custom.length === n) {
      out[key] = [...custom];
    } else {
      out[key] = defaultSlotLabelsForCount(n);
    }
  }
  return out;
}

export default function MealHomePage() {
  const {
    isAuthenticated,
    isLoading,
    sessionUser,
    getApiAccessToken,
    patchMyProfile,
    refreshSession,
    resyncSessionSilently,
  } = useAppSession();
  const [pending, setPending] = useState<Awaited<ReturnType<typeof fetchDisconnectPending>>>(null);
  const [notice, setNotice] = useState<MealPartnerPickerNotice | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [disconnectConfirmArmed, setDisconnectConfirmArmed] = useState(false);
  const [acceptDisconnectConfirmArmed, setAcceptDisconnectConfirmArmed] = useState(false);
  const disconnectActionRef = useRef<HTMLDivElement | null>(null);
  const acceptDisconnectActionRef = useRef<HTMLDivElement | null>(null);
  const [mealSlotDraft, setMealSlotDraft] = useState<Record<string, string[]>>(() =>
    slotDraftFromProfile(null),
  );
  const [mealTimeNamesTab, setMealTimeNamesTab] = useState("3");
  const mealSlotDraftRef = useRef<Record<string, string[]>>(slotDraftFromProfile(null));
  mealSlotDraftRef.current = mealSlotDraft;

  const loadPending = useCallback(async () => {
    const token = await getApiAccessToken();
    setPending(await fetchDisconnectPending(token));
  }, [getApiAccessToken]);

  useEffect(() => {
    if (!sessionUser?.user.is_approved) return;
    void resyncSessionSilently().catch(() => {
      /* ignore initial sync failures; local state still renders */
    });
    const tid = window.setTimeout(() => {
      void loadPending().catch(() => {
        /* ignore */
      });
    }, 0);
    return () => window.clearTimeout(tid);
  }, [sessionUser?.user.is_approved, loadPending, resyncSessionSilently]);

  const profile = sessionUser?.profile ?? null;
  const partnerId = profile?.meal_crud_partner_id ?? null;
  const mealSlotLabelsSyncKey = profile ? JSON.stringify(profile.meal_slot_labels ?? null) : "";

  useEffect(() => {
    const p = sessionUser?.profile;
    if (!p) return;
    setMealSlotDraft(slotDraftFromProfile(p.meal_slot_labels));
  }, [mealSlotLabelsSyncKey]);

  const persistMealSlotRow = useCallback(
    async (countKey: string, row: string[]) => {
      try {
        await patchMyProfile({ meal_slot_labels: { [countKey]: row } });
        await resyncSessionSilently();
      } catch (err) {
        setNotice({
          tone: "error",
          text: err instanceof Error ? err.message : "Could not save meal time names.",
        });
        await resyncSessionSilently().catch(() => {
          /* ignore */
        });
      }
    },
    [patchMyProfile, resyncSessionSilently],
  );

  const mutual = profile?.meal_pair_mutual ?? false;
  const partnerLabel = profile?.meal_crud_partner_label?.trim() || "Current partner";

  useEffect(() => {
    if (!disconnectConfirmArmed && !acceptDisconnectConfirmArmed) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (disconnectActionRef.current?.contains(target)) return;
      if (acceptDisconnectActionRef.current?.contains(target)) return;
      setDisconnectConfirmArmed(false);
      setAcceptDisconnectConfirmArmed(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDisconnectConfirmArmed(false);
        setAcceptDisconnectConfirmArmed(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [disconnectConfirmArmed, acceptDisconnectConfirmArmed]);

  if (isLoading) return <MealLoading />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser) {
    return <MealSessionReconnect onRetry={() => void refreshSession()} />;
  }
  if (!sessionUser.user.is_approved || !profile) {
    return <MealApprovalRequired />;
  }

  return (
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
      <Heading as="h2" size="md">
        Settings
      </Heading>
      <HStack justify="space-between" flexWrap="wrap" gap="2" align="flex-start">
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" flex="1">
          Week start, names for each meal time, meal partner, and optional disconnect when you share editing
          with a friend.
        </Text>
        <PondButton size="sm" colorPalette="lilypad" onClick={() => setWizardOpen(true)}>
          Run setup wizard
        </PondButton>
      </HStack>
      <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
        <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
          <HStack align="center" flexWrap="wrap" gap="2" w="100%">
            <Heading as="h3" size="sm" flexShrink={0}>
              Week starts on
            </Heading>
            <PondNativeSelect
              rootProps={{ size: "sm", maxW: "xs", flexShrink: 0 }}
              fieldProps={{
                value: String(profile.meal_week_starts_on ?? 0),
                onChange: (e) => {
                  const v = Number(e.target.value);
                  void patchMyProfile({ meal_week_starts_on: v }).catch((err: Error) =>
                    setNotice({ tone: "error", text: err.message }),
                  );
                },
              }}
            >
              {WEEKDAY_FULL.map((label, i) => (
                <option key={label} value={i}>
                  {label}
                </option>
              ))}
            </PondNativeSelect>
          </HStack>
        </Card.Body>
      </Card.Root>

      <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
        <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
          <Heading as="h3" size="sm" mb="2">
            Meal time names
          </Heading>
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" mb="3">
            These labels appear when you assign meals to a time (for example Lunch). Each tab is how
            many meals you plan per day; choices save when you pick a name.
          </Text>
          <Tabs.Root
            variant="plain"
            value={mealTimeNamesTab}
            onValueChange={(d) => setMealTimeNamesTab(d.value as string)}
          >
            <Tabs.List {...MEAL_TIME_NAMES_TAB_LIST_PROPS}>
              {(["1", "2", "3", "4", "5"] as const).map((k) => (
                <Tabs.Trigger key={k} value={k} {...APP_SHELL_TAB_TRIGGER_PROPS}>
                  {k}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            {([1, 2, 3, 4, 5] as const).map((n) => {
              const key = String(n);
              const row = mealSlotDraft[key] ?? defaultSlotLabelsForCount(n);
              return (
                <Tabs.Content key={key} value={key} p="2" pt="3">
                  <Stack gap="2" maxW="md">
                    {Array.from({ length: n }, (_, i) => (
                      <PondNativeSelect
                        key={i}
                        rootProps={{ size: "sm" }}
                        fieldProps={{
                          value: row[i],
                          onChange: (e) => {
                            const v = e.target.value;
                            const prev = mealSlotDraftRef.current;
                            const nextRow = [...(prev[key] ?? defaultSlotLabelsForCount(n))];
                            nextRow[i] = v;
                            const nextDraft = { ...prev, [key]: nextRow };
                            mealSlotDraftRef.current = nextDraft;
                            setMealSlotDraft(nextDraft);
                            void persistMealSlotRow(key, nextRow);
                          },
                        }}
                      >
                        {MEAL_SLOT_NAME_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </PondNativeSelect>
                    ))}
                  </Stack>
                </Tabs.Content>
              );
            })}
          </Tabs.Root>
        </Card.Body>
      </Card.Root>

      <MealPartnerPicker
        userId={sessionUser.user.id}
        partnerId={partnerId}
        mutual={mutual}
        getApiAccessToken={getApiAccessToken}
        patchMyProfile={patchMyProfile}
        resyncSessionSilently={resyncSessionSilently}
        onNotice={setNotice}
      />

      {mutual ? (
        <Box {...PANEL_NESTED_BLOCK_PROPS} bg="nautical.solid" color="black">
          <Heading size="sm" mb="2">
            Disconnect mutual pair
          </Heading>
          <Text fontSize={APP_TEXT_SIZES.helper} color="black" mb="3">
            Ending the pair requires both people to agree. Copied meals you used from your partner
            in your own plans are forked to your account when disconnect completes.
          </Text>
          {pending ? (
            <Stack gap="2">
              <HStack align="center" gap="2" maxW="lg">
                <Input
                  {...PANEL_FIELD_PROPS}
                  size="sm"
                  readOnly
                  color="black"
                  value={partnerLabel}
                />
                {pending.i_am_initiator ? (
                  <PondButton
                    size="sm"
                    bg="white"
                    color="black"
                    _hover={{ bg: "gray.100" }}
                    onClick={() => {
                      void (async () => {
                        try {
                          const t = await getApiAccessToken();
                          await cancelDisconnect(t);
                          await loadPending();
                            await resyncSessionSilently();
                          setDisconnectConfirmArmed(false);
                          setNotice(null);
                        } catch (e) {
                          setNotice({
                            tone: "error",
                            text: e instanceof Error ? e.message : "Cancel failed",
                          });
                        }
                      })();
                    }}
                  >
                    Cancel disconnect request
                  </PondButton>
                ) : (
                  <Box ref={acceptDisconnectActionRef}>
                    <PondButton
                      size="sm"
                      bg="white"
                      color="black"
                      _hover={{ bg: "gray.100" }}
                      onClick={() => {
                        if (!acceptDisconnectConfirmArmed) {
                          setAcceptDisconnectConfirmArmed(true);
                          return;
                        }
                        void (async () => {
                          try {
                            const t = await getApiAccessToken();
                            await confirmDisconnect(t);
                            await loadPending();
                            await resyncSessionSilently();
                            setDisconnectConfirmArmed(false);
                            setAcceptDisconnectConfirmArmed(false);
                            setNotice({ tone: "success", text: "Disconnected." });
                          } catch (e) {
                            setNotice({
                              tone: "error",
                              text: e instanceof Error ? e.message : "Confirm failed",
                            });
                          }
                        })();
                      }}
                    >
                      {acceptDisconnectConfirmArmed ? "Confirm disconnect" : "Accept disconnect"}
                    </PondButton>
                  </Box>
                )}
              </HStack>
              <Text fontSize={APP_TEXT_SIZES.body} color="whiteAlpha.900">
                {pending.i_am_initiator
                  ? "Waiting for your partner to confirm disconnect."
                  : "Your partner requested to disconnect. Confirm to end sharing and fork data."}
              </Text>
            </Stack>
          ) : (
            <HStack align="center" gap="2" maxW="lg">
              <Input
                {...PANEL_FIELD_PROPS}
                size="sm"
                readOnly
                color="black"
                value={partnerLabel}
              />
              <Box ref={disconnectActionRef}>
                <PondButton
                  size="sm"
                  bg="white"
                  color="black"
                  _hover={{ bg: "gray.100" }}
                  onClick={() => {
                    if (!disconnectConfirmArmed) {
                      setDisconnectConfirmArmed(true);
                      return;
                    }
                    void (async () => {
                      try {
                        const t = await getApiAccessToken();
                        await requestDisconnect(t);
                        await loadPending();
                        setDisconnectConfirmArmed(false);
                        setNotice({ tone: "success", text: "Disconnect request sent." });
                      } catch (e) {
                        setNotice({
                          tone: "error",
                          text: e instanceof Error ? e.message : "Request failed",
                        });
                      }
                    })();
                  }}
                >
                  {disconnectConfirmArmed ? "Confirm disconnect" : "Disconnect"}
                </PondButton>
              </Box>
            </HStack>
          )}
        </Box>
      ) : null}

      {notice ? (
        <Text
          fontSize={APP_TEXT_SIZES.helper}
          fontWeight="medium"
          color={notice.tone === "success" ? "lilypad.solid" : "nautical.solid"}
          role={notice.tone === "success" ? "status" : "alert"}
        >
          {notice.text}
        </Text>
      ) : null}

      <MealMaestroSetupWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        sessionUser={sessionUser}
        getApiAccessToken={getApiAccessToken}
        patchMyProfile={patchMyProfile}
        resyncSessionSilently={resyncSessionSilently}
      />
    </Stack>
  );
}
