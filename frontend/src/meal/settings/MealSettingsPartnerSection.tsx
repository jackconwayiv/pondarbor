import { Box, Card, Heading, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Profile } from "../../auth/AppSessionContext";
import PondButton from "../../PondButton";
import {
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FIELD_PROPS,
  PANEL_NESTED_BLOCK_PROPS,
} from "../../theme/typography";
import {
  cancelDisconnect,
  confirmDisconnect,
  fetchDisconnectPending,
  requestDisconnect,
} from "../api";
import { useMealData } from "../MealDataContext";
import { MealPartnerPicker, type MealPartnerPickerNotice } from "../MealPartnerPicker";

type MealSettingsPartnerSectionProps = {
  userId: number;
  profile: Profile;
  getApiAccessToken: () => Promise<string | null>;
  patchMyProfile: (patch: { meal_crud_partner_id: number | null }) => Promise<void>;
  resyncSessionSilently: () => Promise<void>;
  onNotice: (notice: MealPartnerPickerNotice | null) => void;
};

export function MealSettingsPartnerSection({
  userId,
  profile,
  getApiAccessToken,
  patchMyProfile,
  resyncSessionSilently,
  onNotice,
}: MealSettingsPartnerSectionProps) {
  const partnerId = profile.meal_crud_partner_id ?? null;
  const mutual = profile.meal_pair_mutual ?? false;
  const partnerLabel = profile.meal_crud_partner_label?.trim() || "Current partner";
  const { disconnectPending: pending, setDisconnectPending: setPending, refreshAll } =
    useMealData();
  const [disconnectConfirmArmed, setDisconnectConfirmArmed] = useState(false);
  const [acceptDisconnectConfirmArmed, setAcceptDisconnectConfirmArmed] = useState(false);
  const disconnectActionRef = useRef<HTMLDivElement | null>(null);
  const acceptDisconnectActionRef = useRef<HTMLDivElement | null>(null);

  const reloadPending = useCallback(async () => {
    const token = await getApiAccessToken();
    setPending(await fetchDisconnectPending(token));
  }, [getApiAccessToken, setPending]);

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

  return (
    <Stack gap="2">
      <Heading as="h3" size="sm">
        Sharing & partner
      </Heading>
      <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
        <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
          <Stack gap="4">
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
              Share meal planning and one combined pantry with an approved friend. Both of you must
              select each other to activate sharing.
            </Text>
            <MealPartnerPicker
              variant="settings"
              userId={userId}
              partnerId={partnerId}
              mutual={mutual}
              getApiAccessToken={getApiAccessToken}
              patchMyProfile={patchMyProfile}
              resyncSessionSilently={resyncSessionSilently}
              onNotice={onNotice}
              onPartnerScopeChanged={() => void refreshAll()}
            />
            {mutual ? (
              <Box {...PANEL_NESTED_BLOCK_PROPS} bg="bg.subtle" borderColor="border.muted">
                <Heading size="sm" mb="2">
                  Disconnect mutual pair
                </Heading>
                <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" mb="3">
                  Ending the pair requires both people to agree. Copied meals you used from your
                  partner in your own plans are forked to your account when disconnect completes.
                </Text>
                {pending ? (
                  <Stack gap="2">
                    <HStack align="center" gap="2" maxW="lg" flexWrap="wrap">
                      <Input
                        {...PANEL_FIELD_PROPS}
                        size="sm"
                        readOnly
                        value={partnerLabel}
                      />
                      {pending.i_am_initiator ? (
                        <PondButton
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            void (async () => {
                              try {
                                const t = await getApiAccessToken();
                                await cancelDisconnect(t);
                                await reloadPending();
                                await resyncSessionSilently();
                                setDisconnectConfirmArmed(false);
                                onNotice(null);
                              } catch (e) {
                                onNotice({
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
                            colorPalette="lilypad"
                            onClick={() => {
                              if (!acceptDisconnectConfirmArmed) {
                                setAcceptDisconnectConfirmArmed(true);
                                return;
                              }
                              void (async () => {
                                try {
                                  const t = await getApiAccessToken();
                                  await confirmDisconnect(t);
                                  await refreshAll();
                                  await resyncSessionSilently();
                                  setDisconnectConfirmArmed(false);
                                  setAcceptDisconnectConfirmArmed(false);
                                  onNotice({ tone: "success", text: "Disconnected." });
                                } catch (e) {
                                  onNotice({
                                    tone: "error",
                                    text: e instanceof Error ? e.message : "Confirm failed",
                                  });
                                }
                              })();
                            }}
                          >
                            {acceptDisconnectConfirmArmed
                              ? "Confirm disconnect"
                              : "Accept disconnect"}
                          </PondButton>
                        </Box>
                      )}
                    </HStack>
                    <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
                      {pending.i_am_initiator
                        ? "Waiting for your partner to confirm disconnect."
                        : "Your partner requested to disconnect. Confirm to end sharing and fork data."}
                    </Text>
                  </Stack>
                ) : (
                  <HStack align="center" gap="2" maxW="lg" flexWrap="wrap">
                    <Input {...PANEL_FIELD_PROPS} size="sm" readOnly value={partnerLabel} />
                    <Box ref={disconnectActionRef}>
                      <PondButton
                        size="sm"
                        variant="outline"
                        colorPalette="nautical"
                        onClick={() => {
                          if (!disconnectConfirmArmed) {
                            setDisconnectConfirmArmed(true);
                            return;
                          }
                          void (async () => {
                            try {
                              const t = await getApiAccessToken();
                              await requestDisconnect(t);
                              await reloadPending();
                              setDisconnectConfirmArmed(false);
                              onNotice({ tone: "success", text: "Disconnect request sent." });
                            } catch (e) {
                              onNotice({
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
          </Stack>
        </Card.Body>
      </Card.Root>
    </Stack>
  );
}
