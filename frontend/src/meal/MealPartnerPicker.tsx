import { Card, Heading, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import PondButton from "../PondButton";
import { fetchFriendsList } from "../friends/api";
import {
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FIELD_PROPS,
} from "../theme/typography";
import { declineIncomingPartnerRequest } from "./api";

export type MealPartnerPickerNotice = { tone: "success" | "error"; text: string };

type MealPartnerPickerProps = {
  userId: number;
  partnerId: number | null;
  mutual: boolean;
  getApiAccessToken: () => Promise<string | null>;
  patchMyProfile: (patch: { meal_crud_partner_id: number | null }) => Promise<void>;
  resyncSessionSilently: () => Promise<void>;
  onNotice?: (notice: MealPartnerPickerNotice | null) => void;
  onPartnerScopeChanged?: () => void | Promise<void>;
  /** Intro copy for wizard vs settings */
  helperText?: string;
  /** Settings embeds picker inside a parent card; wizard uses standalone cards. */
  variant?: "default" | "settings";
};

export function MealPartnerPicker({
  userId,
  partnerId,
  mutual,
  getApiAccessToken,
  patchMyProfile,
  resyncSessionSilently,
  onNotice,
  onPartnerScopeChanged,
  helperText,
  variant = "default",
}: MealPartnerPickerProps) {
  const embedded = variant === "settings";
  const [friends, setFriends] = useState<
    Array<{ id: number; label: string; meal_crud_partner_id: number | null }>
  >([]);
  const [partnerQuery, setPartnerQuery] = useState("");
  const [debouncedPartnerQuery, setDebouncedPartnerQuery] = useState("");
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);

  const loadFriends = useCallback(async () => {
    const token = await getApiAccessToken();
    const data = await fetchFriendsList(token);
    setFriends(
      data.approved_friends.map((f) => ({
        id: f.id,
        label: f.nickname,
        meal_crud_partner_id: f.meal_crud_partner_id ?? null,
      })),
    );
  }, [getApiAccessToken]);

  useEffect(() => {
    void loadFriends().catch(() => {});
  }, [loadFriends]);

  const activePartner = partnerId != null ? friends.find((f) => f.id === partnerId) ?? null : null;
  const incomingRequesters = useMemo(
    () => friends.filter((f) => f.meal_crud_partner_id === userId && f.id !== partnerId),
    [friends, userId, partnerId],
  );
  const outgoingPending = partnerId != null && !mutual;
  const showPartnerSelectionCard = !mutual && (!incomingRequesters.length || outgoingPending);

  const partnerOptions = useMemo(
    () =>
      friends.filter(
        (f) =>
          f.meal_crud_partner_id == null ||
          f.meal_crud_partner_id === userId ||
          f.id === partnerId,
      ),
    [friends, userId, partnerId],
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
    return partnerOptions.filter((f) => f.label.toLowerCase().includes(debouncedPartnerQuery));
  }, [debouncedPartnerQuery, partnerOptions]);

  const submitPartnerSelection = useCallback(async () => {
    const hasTypedQuery = partnerQuery.trim().length > 0;
    if (hasTypedQuery && selectedPartnerId == null) {
      onNotice?.({
        tone: "error",
        text: "Choose a friend from the suggestions before submitting.",
      });
      return;
    }
    try {
      await patchMyProfile({ meal_crud_partner_id: selectedPartnerId });
      await loadFriends();
      await resyncSessionSilently();
      await onPartnerScopeChanged?.();
      onNotice?.({
        tone: "success",
        text:
          selectedPartnerId == null
            ? "Meal partner cleared."
            : "Meal partner selection saved.",
      });
    } catch (err) {
      onNotice?.({
        tone: "error",
        text: err instanceof Error ? err.message : "Could not save meal partner selection.",
      });
    }
  }, [
    loadFriends,
    onNotice,
    onPartnerScopeChanged,
    partnerQuery,
    patchMyProfile,
    resyncSessionSilently,
    selectedPartnerId,
  ]);

  const defaultHelper =
    helperText ??
    "Search approved friends by nickname, then submit. Meal sharing activates when both of you select each other. With a mutual partner, you share one combined pantry.";

  if (mutual && activePartner && !embedded) {
    return (
      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
        Sharing meals and pantry with{" "}
        <Text as="span" fontWeight="semibold">
          {activePartner.label}
        </Text>
        . Change or disconnect in Meal Settings.
      </Text>
    );
  }

  const selectionShell = (children: ReactNode, opts?: { highlight?: boolean }) => {
    if (embedded) {
      return (
        <Stack
          gap="2"
          p={opts?.highlight ? "3" : "0"}
          borderWidth={opts?.highlight ? "1px" : undefined}
          borderColor={opts?.highlight ? "border.muted" : undefined}
          borderRadius={opts?.highlight ? "md" : undefined}
          bg={opts?.highlight ? "bg.subtle" : undefined}
        >
          {children}
        </Stack>
      );
    }
    return (
      <Card.Root
        {...PANEL_ENTRY_CARD_PROPS}
        p="0"
        {...(opts?.highlight ? { bg: "teal.solid", color: "black" } : {})}
      >
        <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>{children}</Card.Body>
      </Card.Root>
    );
  };

  return (
    <Stack gap="3">
      {mutual && activePartner && embedded ? (
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
          Sharing meals and pantry with{" "}
          <Text as="span" fontWeight="semibold">
            {activePartner.label}
          </Text>
          .
        </Text>
      ) : null}
      {showPartnerSelectionCard ? (
        selectionShell(
          <>
            {!embedded ? (
              <Heading size="sm" mb="2" color={outgoingPending ? "black" : undefined}>
                Meal partner (optional)
              </Heading>
            ) : null}
            <Text
              fontSize={APP_TEXT_SIZES.helper}
              color={outgoingPending ? "black" : "fg.muted"}
              mb="2"
            >
              {defaultHelper}
            </Text>
            <Stack gap="2" maxW="lg">
              {outgoingPending ? (
                <HStack align="center" gap="2">
                  <Input
                    {...PANEL_FIELD_PROPS}
                    size="sm"
                    readOnly
                    color="black"
                    value={activePartner ? activePartner.label : "Pending partner"}
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
                          await resyncSessionSilently();
                          await onPartnerScopeChanged?.();
                          onNotice?.({ tone: "success", text: "Partner request canceled." });
                        } catch (err) {
                          onNotice?.({
                            tone: "error",
                            text:
                              err instanceof Error ? err.message : "Could not cancel request.",
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
                      list="meal-partner-options-picker"
                      placeholder="Search friend by nickname"
                      value={partnerQuery}
                      onChange={(e) => {
                        const next = e.target.value;
                        setPartnerQuery(next);
                        const exact = partnerOptions.find((f) => next === f.label);
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
                  <datalist id="meal-partner-options-picker">
                    {filteredOptions.map((f) => (
                      <option key={f.id} value={f.label} />
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
          </>,
          { highlight: outgoingPending || embedded },
        )
      ) : null}

      {!mutual && incomingRequesters.length > 0 ? (
        selectionShell(
          <>
            <Heading size="sm" mb="2" color={embedded ? undefined : "black"}>
              Incoming partner request
            </Heading>
            <Text
              fontSize={APP_TEXT_SIZES.helper}
              color={embedded ? "fg.muted" : "black"}
              mb="2"
            >
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
                  value={requester.label}
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
                        await resyncSessionSilently();
                        await onPartnerScopeChanged?.();
                        onNotice?.({ tone: "success", text: "Meal partner request accepted." });
                      } catch (err) {
                        onNotice?.({
                          tone: "error",
                          text:
                            err instanceof Error ? err.message : "Could not accept request.",
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
                        onNotice?.({ tone: "success", text: "Meal partner request declined." });
                        void loadFriends().catch(() => {});
                        void resyncSessionSilently().catch(() => {});
                      } catch (err) {
                        onNotice?.({
                          tone: "error",
                          text:
                            err instanceof Error ? err.message : "Could not decline request.",
                        });
                      }
                    })();
                  }}
                >
                  Decline
                </PondButton>
              </HStack>
            ))}
          </>,
          { highlight: !embedded },
        )
      ) : null}
    </Stack>
  );
}
