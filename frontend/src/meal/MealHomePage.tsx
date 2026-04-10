import {
  Box,
  Card,
  Heading,
  HStack,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Stack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { fetchFriendsList } from "../friends/api";
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
  declineIncomingPartnerRequest,
  fetchDisconnectPending,
  requestDisconnect,
} from "./api";
import { WEEKDAY_FULL } from "./mealLabels";
import { defaultSlotLabelsForCount, MEAL_SLOT_NAME_OPTIONS } from "./mealSlotLabels";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";

/** Match `MealLayout` shell tabs (`MEAL_TAB_LIST_PROPS` / `mealTabTriggerProps`). */
const MEAL_TIME_NAMES_TAB_LIST_PROPS = {
  px: { base: "2", md: "2" } as const,
  pt: "0",
  pb: "0",
  borderBottomWidth: "1px",
  borderColor: "border",
  gap: "1",
  w: "100%",
};

function mealTimeNamesTabTriggerProps(activeTab: string, value: string) {
  return {
    value,
    bg: activeTab === value ? "lilypad.solid" : undefined,
    color: activeTab === value ? "black" : undefined,
    borderTopRadius: "md" as const,
    borderBottomRadius: "0" as const,
    px: "2",
    py: "2",
    fontWeight: "medium" as const,
    _hover: {
      bg: activeTab === value ? "lilypad.solid" : "transparent",
    },
    _selected: { bg: "lilypad.solid", color: "black" },
  };
}

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
  } = useAppSession();
  const [friends, setFriends] = useState<
    Array<{ id: number; label: string; email: string; meal_crud_partner_id: number | null }>
  >([]);
  const [pending, setPending] = useState<Awaited<ReturnType<typeof fetchDisconnectPending>>>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [disconnectConfirmArmed, setDisconnectConfirmArmed] = useState(false);
  const [acceptDisconnectConfirmArmed, setAcceptDisconnectConfirmArmed] = useState(false);
  const disconnectActionRef = useRef<HTMLDivElement | null>(null);
  const acceptDisconnectActionRef = useRef<HTMLDivElement | null>(null);
  const [partnerQuery, setPartnerQuery] = useState("");
  const [debouncedPartnerQuery, setDebouncedPartnerQuery] = useState("");
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [mealSlotDraft, setMealSlotDraft] = useState<Record<string, string[]>>(() =>
    slotDraftFromProfile(null),
  );
  const [mealTimeNamesTab, setMealTimeNamesTab] = useState("3");
  const mealSlotDraftRef = useRef<Record<string, string[]>>(slotDraftFromProfile(null));
  mealSlotDraftRef.current = mealSlotDraft;

  const loadFriends = useCallback(async () => {
    const token = await getApiAccessToken();
    const data = await fetchFriendsList(token);
    setFriends(
      data.approved_friends.map((f) => ({
        id: f.id,
        label: f.nickname || f.email,
        email: f.email,
        meal_crud_partner_id: f.meal_crud_partner_id ?? null,
      })),
    );
  }, [getApiAccessToken]);

  const loadPending = useCallback(async () => {
    const token = await getApiAccessToken();
    setPending(await fetchDisconnectPending(token));
  }, [getApiAccessToken]);

  useEffect(() => {
    if (!sessionUser?.user.is_approved) return;
    void refreshSession().catch(() => {
      /* ignore initial sync failures; local state still renders */
    });
    const tid = window.setTimeout(() => {
      void loadFriends().catch(() => {
        /* ignore */
      });
      void loadPending().catch(() => {
        /* ignore */
      });
    }, 0);
    return () => window.clearTimeout(tid);
  }, [sessionUser?.user.is_approved, loadFriends, loadPending, refreshSession]);

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
        await refreshSession();
      } catch (err) {
        setNotice({
          tone: "error",
          text: err instanceof Error ? err.message : "Could not save meal time names.",
        });
        await refreshSession().catch(() => {
          /* ignore */
        });
      }
    },
    [patchMyProfile, refreshSession],
  );

  const mutual = profile?.meal_pair_mutual ?? false;

  const myId = sessionUser?.user.id ?? -1;
  const activePartner = partnerId != null ? friends.find((f) => f.id === partnerId) ?? null : null;
  const incomingRequesters = useMemo(
    () => friends.filter((f) => f.meal_crud_partner_id === myId && f.id !== partnerId),
    [friends, myId, partnerId],
  );
  const outgoingPending = partnerId != null && !mutual;
  const showPartnerSelectionCard = !mutual && (!incomingRequesters.length || outgoingPending);

  const partnerOptions = useMemo(
    () =>
      friends.filter(
        (f) =>
          f.meal_crud_partner_id == null ||
          f.meal_crud_partner_id === myId ||
          f.id === partnerId,
      ),
    [friends, myId, partnerId],
  );

  useEffect(() => {
    const tid = window.setTimeout(() => {
      setDebouncedPartnerQuery(partnerQuery.trim().toLowerCase());
    }, 250);
    return () => window.clearTimeout(tid);
  }, [partnerQuery]);

  useEffect(() => {
    if (partnerId == null) {
      setPartnerQuery("");
      setSelectedPartnerId(null);
      return;
    }
    const matched = partnerOptions.find((f) => f.id === partnerId);
    if (!matched) return;
    setPartnerQuery(matched.label);
    setSelectedPartnerId(matched.id);
  }, [partnerId, partnerOptions]);

  const filteredOptions = useMemo(() => {
    if (!debouncedPartnerQuery) return partnerOptions;
    return partnerOptions.filter((f) => {
      const haystack = `${f.label} ${f.email}`.toLowerCase();
      return haystack.includes(debouncedPartnerQuery);
    });
  }, [debouncedPartnerQuery, partnerOptions]);

  const submitPartnerSelection = useCallback(async () => {
    const hasTypedQuery = partnerQuery.trim().length > 0;
    if (hasTypedQuery && selectedPartnerId == null) {
      setNotice({
        tone: "error",
        text: "Choose a friend from the suggestions before submitting.",
      });
      return;
    }
    try {
      await patchMyProfile({ meal_crud_partner_id: selectedPartnerId });
      setNotice({
        tone: "success",
        text:
          selectedPartnerId == null
            ? "Meal partner cleared."
            : "Meal partner selection saved.",
      });
    } catch (err) {
      setNotice({
        tone: "error",
        text: err instanceof Error ? err.message : "Could not save meal partner selection.",
      });
    }
  }, [patchMyProfile, partnerQuery, selectedPartnerId]);

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
      <Heading as="h2" size="md" fontWeight="bold">
        Settings
      </Heading>
      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
        Week start, names for each meal time, meal partner, and optional disconnect when you share editing
        with a friend.
      </Text>
      <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
        <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
          <HStack align="center" flexWrap="wrap" gap="2" w="100%">
            <Heading as="h3" size="sm" fontWeight="semibold" flexShrink={0}>
              Week starts on
            </Heading>
            <NativeSelectRoot size="sm" maxW="xs" flexShrink={0}>
              <NativeSelectField
                {...PANEL_FIELD_PROPS}
                value={String(profile.meal_week_starts_on ?? 0)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  void patchMyProfile({ meal_week_starts_on: v }).catch((err: Error) =>
                    setNotice({ tone: "error", text: err.message }),
                  );
                }}
              >
                {WEEKDAY_FULL.map((label, i) => (
                  <option key={label} value={i}>
                    {label}
                  </option>
                ))}
              </NativeSelectField>
            </NativeSelectRoot>
          </HStack>
        </Card.Body>
      </Card.Root>

      <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
        <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
          <Heading as="h3" size="sm" fontWeight="semibold" mb="2">
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
                <Tabs.Trigger key={k} {...mealTimeNamesTabTriggerProps(mealTimeNamesTab, k)}>
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
                      <NativeSelectRoot key={i} size="sm">
                        <NativeSelectField
                          {...PANEL_FIELD_PROPS}
                          value={row[i]}
                          onChange={(e) => {
                            const v = e.target.value;
                            const prev = mealSlotDraftRef.current;
                            const nextRow = [...(prev[key] ?? defaultSlotLabelsForCount(n))];
                            nextRow[i] = v;
                            const nextDraft = { ...prev, [key]: nextRow };
                            mealSlotDraftRef.current = nextDraft;
                            setMealSlotDraft(nextDraft);
                            void persistMealSlotRow(key, nextRow);
                          }}
                        >
                          {MEAL_SLOT_NAME_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </NativeSelectField>
                      </NativeSelectRoot>
                    ))}
                  </Stack>
                </Tabs.Content>
              );
            })}
          </Tabs.Root>
        </Card.Body>
      </Card.Root>

      {showPartnerSelectionCard ? (
        <Card.Root
          {...PANEL_ENTRY_CARD_PROPS}
          p="0"
          {...(outgoingPending ? { bg: "lilypad.solid", color: "black" } : {})}
        >
          <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
            <Heading size="sm" mb="2" fontWeight="semibold" color={outgoingPending ? "black" : undefined}>
              Meal partner (optional)
            </Heading>
            <Text
              fontSize={APP_TEXT_SIZES.helper}
              color={outgoingPending ? "black" : "fg.muted"}
              mb="2"
            >
              Search approved friends by nickname or email, then submit. Meal sharing activates when
              both of you select each other.
            </Text>
            <Stack gap="2" maxW="lg">
              {outgoingPending ? (
                <HStack align="center" gap="2">
                  <Input
                    {...PANEL_FIELD_PROPS}
                    size="sm"
                    readOnly
                    color="black"
                    value={activePartner ? `${activePartner.label} (${activePartner.email})` : "Pending partner"}
                  />
                  <PondButton
                    size="sm"
                    bg="nautical.solid"
                    color="black"
                    _hover={{ filter: "brightness(0.95)" }}
                    onClick={() => {
                      void (async () => {
                        try {
                          await patchMyProfile({ meal_crud_partner_id: null });
                          await loadFriends();
                          await refreshSession();
                          setNotice({ tone: "success", text: "Partner request canceled." });
                        } catch (err) {
                          setNotice({
                            tone: "error",
                            text: err instanceof Error ? err.message : "Could not cancel request.",
                          });
                        }
                      })();
                    }}
                  >
                    Cancel request
                  </PondButton>
                </HStack>
              ) : (
                <>
                  <HStack align="center" gap="2">
                    <Input
                      {...PANEL_FIELD_PROPS}
                      size="sm"
                      list="meal-partner-options"
                      placeholder="Search friend by nickname or email"
                      value={partnerQuery}
                      onChange={(e) => {
                        const next = e.target.value;
                        setPartnerQuery(next);
                        const exact = partnerOptions.find(
                          (f) => next === f.label || next === f.email,
                        );
                        setSelectedPartnerId(exact?.id ?? null);
                      }}
                    />
                    <PondButton
                      size="sm"
                      colorPalette="lilypad"
                      onClick={() => void submitPartnerSelection()}
                    >
                      Submit
                    </PondButton>
                  </HStack>
                  <datalist id="meal-partner-options">
                    {filteredOptions.map((f) => (
                      <option key={f.id} value={f.label}>
                        {f.email}
                      </option>
                    ))}
                  </datalist>
                </>
              )}
              {outgoingPending ? (
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  fontWeight="medium"
                  color="black"
                  role="status"
                >
                  Waiting for your friend to select you as their meal partner.
                </Text>
              ) : null}
            </Stack>
          </Card.Body>
        </Card.Root>
      ) : null}

      {!mutual && incomingRequesters.length > 0 ? (
        <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0" bg="lilypad.solid" color="black">
          <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
            <Heading size="sm" mb="2" fontWeight="semibold" color="black">
              Incoming partner request
            </Heading>
            <Text fontSize={APP_TEXT_SIZES.helper} color="black" mb="2">
              {incomingRequesters.length > 1
                ? `${incomingRequesters.length} friends requested meal sharing.`
                : "A friend requested meal sharing."}
            </Text>
            {incomingRequesters.map((requester) => (
              <HStack key={requester.id} align="center" gap="2" mb="2">
                <Input
                  {...PANEL_FIELD_PROPS}
                  size="sm"
                  readOnly
                  color="black"
                  value={`${requester.label} (${requester.email})`}
                />
                <PondButton
                  size="sm"
                  bg="sky.solid"
                  color="black"
                  _hover={{ filter: "brightness(0.95)" }}
                  onClick={() => {
                    void (async () => {
                      try {
                        await patchMyProfile({ meal_crud_partner_id: requester.id });
                        await loadFriends();
                        await refreshSession();
                        setNotice({ tone: "success", text: "Meal partner request accepted." });
                      } catch (err) {
                        setNotice({
                          tone: "error",
                          text: err instanceof Error ? err.message : "Could not accept request.",
                        });
                      }
                    })();
                  }}
                >
                  Accept
                </PondButton>
                <PondButton
                  size="sm"
                  bg="nautical.solid"
                  color="black"
                  _hover={{ filter: "brightness(0.95)" }}
                  onClick={() => {
                    void (async () => {
                      try {
                        const token = await getApiAccessToken();
                        await declineIncomingPartnerRequest(token, requester.id);
                        setNotice({ tone: "success", text: "Meal partner request declined." });
                        void loadFriends().catch(() => {
                          /* ignore follow-up refresh errors */
                        });
                        void refreshSession().catch(() => {
                          /* ignore follow-up refresh errors */
                        });
                      } catch (err) {
                        setNotice({
                          tone: "error",
                          text: err instanceof Error ? err.message : "Could not decline request.",
                        });
                      }
                    })();
                  }}
                >
                  Decline
                </PondButton>
              </HStack>
            ))}
          </Card.Body>
        </Card.Root>
      ) : null}

      {mutual ? (
        <Box {...PANEL_NESTED_BLOCK_PROPS} bg="nautical.solid" color="black">
          <Heading size="sm" mb="2" fontWeight="semibold">
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
                  value={activePartner ? `${activePartner.label} (${activePartner.email})` : "Current partner"}
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
                          await refreshSession();
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
                            await refreshSession();
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
                value={activePartner ? `${activePartner.label} (${activePartner.email})` : "Current partner"}
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
    </Stack>
  );
}
