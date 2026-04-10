import {
  Box,
  Card,
  Heading,
  NativeSelectField,
  NativeSelectRoot,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
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
  fetchDisconnectPending,
  requestDisconnect,
} from "./api";
import { WEEKDAY_SHORT } from "./mealLabels";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";

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
    Array<{ id: number; label: string; meal_crud_partner_id: number | null }>
  >([]);
  const [pending, setPending] = useState<Awaited<ReturnType<typeof fetchDisconnectPending>>>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const loadFriends = useCallback(async () => {
    const token = await getApiAccessToken();
    const data = await fetchFriendsList(token);
    setFriends(
      data.approved_friends.map((f) => ({
        id: f.id,
        label: f.nickname || f.email,
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
    const tid = window.setTimeout(() => {
      void loadFriends().catch(() => {
        /* ignore */
      });
      void loadPending().catch(() => {
        /* ignore */
      });
    }, 0);
    return () => window.clearTimeout(tid);
  }, [sessionUser?.user.is_approved, loadFriends, loadPending]);

  if (isLoading) return <MealLoading />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser) {
    return <MealSessionReconnect onRetry={() => void refreshSession()} />;
  }
  if (!sessionUser.user.is_approved) {
    return <MealApprovalRequired />;
  }

  const profile = sessionUser.profile;
  const partnerId = profile.meal_crud_partner_id;
  const mutual = profile.meal_pair_mutual;

  const myId = sessionUser.user.id;
  const partnerOptions = friends.filter(
    (f) =>
      f.meal_crud_partner_id == null ||
      f.meal_crud_partner_id === myId ||
      f.id === partnerId,
  );

  return (
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
      <Heading as="h2" size="md" fontWeight="bold">
        Settings
      </Heading>
      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
        Week start, meal partner, and optional disconnect when you share editing with a friend.
      </Text>
      <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
        <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
          <Heading size="sm" mb="2" fontWeight="semibold">
            Week starts on
          </Heading>
          <NativeSelectRoot size="sm" maxW="xs">
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
              {WEEKDAY_SHORT.map((label, i) => (
                <option key={label} value={i}>
                  {label}
                </option>
              ))}
            </NativeSelectField>
          </NativeSelectRoot>
        </Card.Body>
      </Card.Root>

      <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
        <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
          <Heading size="sm" mb="2" fontWeight="semibold">
            Meal partner (optional)
          </Heading>
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" mb="2">
            Choose one approved friend. When both of you select each other, you can edit each
            other&apos;s Meal Maestro data. To end a mutual pair, both must confirm disconnect
            (see below).
          </Text>
          <NativeSelectRoot size="sm" maxW="md">
            <NativeSelectField
              {...PANEL_FIELD_PROPS}
              value={partnerId != null ? String(partnerId) : ""}
              onChange={(e) => {
                const raw = e.target.value;
                void patchMyProfile({
                  meal_crud_partner_id: raw === "" ? null : Number(raw),
                }).catch((err: Error) => setNotice({ tone: "error", text: err.message }));
              }}
            >
              <option value="">None</option>
              {partnerOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </NativeSelectField>
          </NativeSelectRoot>
          {partnerId != null ? (
            <Text
              fontSize={APP_TEXT_SIZES.helper}
              mt="2"
              fontWeight="medium"
              color={mutual ? "lilypad.solid" : "fg.muted"}
              role="status"
            >
              {mutual
                ? "Mutual meal sharing is active."
                : "Waiting for your friend to select you as their partner."}
            </Text>
          ) : null}
        </Card.Body>
      </Card.Root>

      {mutual ? (
        <Box {...PANEL_NESTED_BLOCK_PROPS} bg="bg">
          <Heading size="sm" mb="2" fontWeight="semibold">
            Disconnect mutual pair
          </Heading>
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" mb="3">
            Ending the pair requires both people to agree. Copied meals you used from your partner
            in your own plans are forked to your account when disconnect completes.
          </Text>
          {pending ? (
            <Stack gap="2">
              <Text fontSize={APP_TEXT_SIZES.body}>
                {pending.i_am_initiator
                  ? "Waiting for your partner to confirm disconnect."
                  : "Your partner requested to disconnect. Confirm to end sharing and fork data."}
              </Text>
              <Stack direction="row" gap="2" flexWrap="wrap">
                {pending.i_am_initiator ? (
                  <PondButton
                    size="sm"
                    colorPalette="sky"
                    variant="outline"
                    onClick={() => {
                      void (async () => {
                        try {
                          const t = await getApiAccessToken();
                          await cancelDisconnect(t);
                          await loadPending();
                          await refreshSession();
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
                    Cancel request
                  </PondButton>
                ) : (
                  <PondButton
                    size="sm"
                    colorPalette="nautical"
                    onClick={() => {
                      void (async () => {
                        try {
                          const t = await getApiAccessToken();
                          await confirmDisconnect(t);
                          await loadPending();
                          await refreshSession();
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
                    Confirm disconnect
                  </PondButton>
                )}
              </Stack>
            </Stack>
          ) : (
            <PondButton
              size="sm"
              colorPalette="sky"
              variant="outline"
              onClick={() => {
                void (async () => {
                  try {
                    const t = await getApiAccessToken();
                    await requestDisconnect(t);
                    await loadPending();
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
              Request disconnect
            </PondButton>
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
