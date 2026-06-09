import {
  Box,
  Card,
  HStack,
  Input,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import {
  validateClosetFreeText,
  validateIsoDateRequired,
} from "../forms/validation";
import PresignedImage from "../lib/PresignedImage";
import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FORM_PLACEHOLDER_PROPS,
} from "../theme/typography";
import {
  acceptCustody,
  cancelBorrowRequest,
  createBorrowRequest,
  deleteBorrowRequest,
  denyCustody,
  hideClosetItem,
  markCustodyReturnedByHolder,
  markReturnedByBorrower,
  rejectPendingCustody,
  unhideClosetItem,
} from "./api";
import {
  coerceClosetUserId,
  displayName,
  sameClosetUserId,
} from "./closetUtils";
import type { ClosetItem } from "./types";
import {
  ClosetItemModalFooter,
  ClosetItemModalTopNav,
  type ClosetItemModalNav,
} from "./ClosetItemModalFooter";

const PLACEHOLDER = PANEL_FORM_PLACEHOLDER_PROPS;

export type ClosetItemDetailContentProps = {
  item: ClosetItem;
  meId: number;
  getApiAccessToken: () => Promise<string>;
  onReload: () => Promise<void>;
  /** When set (e.g. item modal on Items grid), prev/next above image; borrow row below card. */
  itemNav?: ClosetItemModalNav | null;
};

export function ClosetItemDetailContent({
  item,
  meId,
  getApiAccessToken,
  onReload,
  itemNav,
}: ClosetItemDetailContentProps) {
  const meIdNum = coerceClosetUserId(meId);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(
    null,
  );
  const [borrowInlineOpen, setBorrowInlineOpen] = useState(false);
  const [borrowMessage, setBorrowMessage] = useState("");
  const [confirmCancelRequest, setConfirmCancelRequest] = useState(false);
  const [confirmDeleteDeclined, setConfirmDeleteDeclined] = useState(false);
  const [returnBusy, setReturnBusy] = useState(false);
  const [custodyActionBusy, setCustodyActionBusy] = useState(false);
  const [hideBusy, setHideBusy] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 7000);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!borrowInlineOpen) return;
    setBorrowMessage(item.my_pending_request?.message ?? "");
  }, [borrowInlineOpen, item]);

  const reload = useCallback(async () => {
    await onReload();
  }, [onReload]);

  const isOwner = sameClosetUserId(item.owner_user.id, meIdNum);
  const isHolder = sameClosetUserId(item.current_holder_user.id, meIdNum);
  const borrowedByMe = Boolean(isHolder && !isOwner);
  const custodyOfferedToMe = Boolean(
    item.pending_custody_user && sameClosetUserId(item.pending_custody_user.id, meIdNum),
  );
  const canHideItem = Boolean(
    !isOwner &&
      !isHolder &&
      !custodyOfferedToMe &&
      !item.my_pending_request &&
      !item.my_declined_request,
  );

  const submitBorrowDate = useCallback(
    async (dateIso: string) => {
      const dateErr = validateIsoDateRequired(dateIso, "Need-by date");
      if (dateErr) {
        setNotice({ kind: "error", message: dateErr });
        return;
      }
      const msgErr = validateClosetFreeText(borrowMessage, "Message");
      if (msgErr) {
        setNotice({ kind: "error", message: msgErr });
        return;
      }
      try {
        const token = await getApiAccessToken();
        await createBorrowRequest(token, item.id, {
          date_needed_by: dateIso.trim(),
          message: borrowMessage.trim(),
        });
        setBorrowInlineOpen(false);
        setBorrowMessage("");
        setNotice({
          kind: "success",
          message: item.my_pending_request ? "Borrow request updated." : "Borrow request sent.",
        });
        await reload();
      } catch (e) {
        setNotice({
          kind: "error",
          message: e instanceof Error ? e.message : "Failed to send request",
        });
      }
    },
    [item, borrowMessage, getApiAccessToken, reload],
  );

  const imageUrl = (item.image_url ?? "").trim();
  const hasHeroImage = Boolean(imageUrl);
  const categoryText = (item.category ?? "").trim();
  const tagParts = (item.tags ?? []).map((t) => t.trim()).filter(Boolean);
  const tagsText = tagParts.length > 0 ? `Tags: ${tagParts.join(", ")}` : null;

  const canRequestBorrow =
    !isOwner &&
    !borrowedByMe &&
    sameClosetUserId(item.current_holder_user.id, item.owner_user.id);

  /** Custody / loan / request-status UI inside the card (omit wrapper when empty to avoid extra gap). */
  const hasStatusActionBlocks =
    custodyOfferedToMe ||
    borrowedByMe ||
    (!isOwner && Boolean(item.my_pending_request)) ||
    (!isOwner && Boolean(item.my_declined_request));

  const borrowRequestForm = (
    <Stack gap="3">
      <Text fontSize="sm" fontWeight="medium">
        Need-by date
      </Text>
      <Input
        type="date"
        defaultValue={item.my_pending_request?.date_needed_by ?? ""}
        key={`${item.id}-${item.my_pending_request?.date_needed_by ?? "new"}`}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          void submitBorrowDate(v);
        }}
        {...PLACEHOLDER}
      />
      <Text fontSize="sm" color="fg.muted">
        Optional message
      </Text>
      <Textarea
        value={borrowMessage}
        onChange={(e) => setBorrowMessage(e.target.value)}
        placeholder="Message to owner"
        minH="4rem"
        {...PLACEHOLDER}
      />
      <Text fontSize="xs" color="fg.muted">
        Pick a date to send the request. Use Cancel to close this form.
      </Text>
      <HStack justify="flex-end">
        <PondButton
          size="sm"
          variant="outline"
          colorPalette="sky"
          onClick={() => setBorrowInlineOpen(false)}
        >
          Cancel
        </PondButton>
      </HStack>
    </Stack>
  );

  return (
    <Stack gap="2" w="100%">
      <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
        <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
          <Stack gap="4" w="100%">
            {itemNav ? <ClosetItemModalTopNav itemNav={itemNav} /> : null}
            <Box
              w="100%"
              minH={
                hasHeroImage
                  ? { base: "min(48vh, 400px)", md: "min(45vh, 480px)" }
                  : { base: "112px", md: "140px" }
              }
              maxH={hasHeroImage ? "70vh" : { base: "160px", md: "200px" }}
              bg="bg.subtle"
              borderRadius="md"
              overflow="hidden"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              {hasHeroImage ? (
                <PresignedImage
                  src={imageUrl}
                  imageKey={isOwner ? item.image_key : undefined}
                  getApiAccessToken={isOwner ? getApiAccessToken : undefined}
                  onRefresh={!isOwner ? reload : undefined}
                  alt=""
                  w="100%"
                  h="100%"
                  objectFit="contain"
                  objectPosition="center"
                  draggable={false}
                />
              ) : (
                <Text fontSize={{ base: "4xl", md: "5xl" }} fontWeight="bold" color="fg.muted">
                  {(item.name.trim().slice(0, 1) || "?").toUpperCase()}
                </Text>
              )}
            </Box>

            <HStack w="100%" align="flex-start" justify="space-between" gap="3" flexWrap="wrap">
              <Stack gap="2" flex="1" minW="0">
                {borrowInlineOpen && canRequestBorrow ? (
                  <Box borderWidth="1px" borderColor="border" borderRadius="md" p="2" bg="bg.subtle">
                    {borrowRequestForm}
                  </Box>
                ) : (
                  <>
                    <Text fontWeight="semibold" fontSize="lg">
                      {item.name}
                    </Text>
                    {notice ? (
                      <Text
                        fontSize={APP_TEXT_SIZES.helper}
                        fontWeight="medium"
                        color={notice.kind === "error" ? "nautical.solid" : "lilypad.solid"}
                        role={notice.kind === "error" ? "alert" : "status"}
                      >
                        {notice.message}
                      </Text>
                    ) : null}
                    <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
                      Owner: {displayName(item.owner_user)}
                    </Text>
                    {item.current_holder_user.id !== item.owner_user.id ? (
                      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                        Holding: {displayName(item.current_holder_user)}
                      </Text>
                    ) : null}
                    {item.description ? (
                      <Text fontSize={APP_TEXT_SIZES.body} whiteSpace="pre-wrap">
                        {item.description}
                      </Text>
                    ) : null}
                    {categoryText || tagsText ? (
                      <Stack gap="1">
                        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" flex="1" minW="0">
                          {categoryText ? `Category: ${categoryText}` : "\u00A0"}
                        </Text>
                        {tagsText ? (
                          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                            {tagsText}
                          </Text>
                        ) : null}
                      </Stack>
                    ) : null}
                  </>
                )}
              </Stack>
              {canRequestBorrow || canHideItem ? (
                <Stack align="flex-end" gap="2" flexShrink={0} ms="auto">
                  {canRequestBorrow ? (
                    <PondButton
                      size="sm"
                      colorPalette="lilypad"
                      onClick={() => setBorrowInlineOpen((open) => !open)}
                    >
                      {borrowInlineOpen
                        ? "Close request form"
                        : item.my_pending_request
                          ? "Update borrow request"
                          : "Request to borrow"}
                    </PondButton>
                  ) : null}
                  {canHideItem ? (
                    <PondButton
                      size="sm"
                      variant="outline"
                      colorPalette="sky"
                      loading={hideBusy}
                      disabled={hideBusy}
                      onClick={() =>
                        void (async () => {
                          setHideBusy(true);
                          try {
                            const token = await getApiAccessToken();
                            await (item.hidden_by_me
                              ? unhideClosetItem(token, item.id)
                              : hideClosetItem(token, item.id));
                            setNotice({
                              kind: "success",
                              message: item.hidden_by_me
                                ? "Item unhidden."
                                : "Item hidden from your Items list.",
                            });
                            await reload();
                          } catch (e) {
                            setNotice({
                              kind: "error",
                              message:
                                e instanceof Error
                                  ? e.message
                                  : "Failed to update hidden state",
                            });
                          } finally {
                            setHideBusy(false);
                          }
                        })()
                      }
                    >
                      {item.hidden_by_me ? "Unhide this item" : "Hide this item"}
                    </PondButton>
                  ) : null}
                </Stack>
              ) : null}
            </HStack>

            {hasStatusActionBlocks ? (
              <Stack gap="3">
              {custodyOfferedToMe ? (
                <Stack gap="2">
                  <Text fontWeight="semibold" color="sky.solid">
                    Custody offered
                  </Text>
                  <Text fontSize={APP_TEXT_SIZES.helper}>
                    {displayName(item.owner_user)} wants you to hold this item.
                  </Text>
                  <HStack flexWrap="wrap">
                    <PondButton
                      size="sm"
                      colorPalette="lilypad"
                      loading={custodyActionBusy}
                      onClick={() =>
                        void (async () => {
                          setCustodyActionBusy(true);
                          try {
                            const token = await getApiAccessToken();
                            await acceptCustody(token, item.id);
                            setNotice({ kind: "success", message: "Custody accepted." });
                            await reload();
                          } catch (e) {
                            setNotice({
                              kind: "error",
                              message: e instanceof Error ? e.message : "Failed to accept",
                            });
                          } finally {
                            setCustodyActionBusy(false);
                          }
                        })()
                      }
                    >
                      Accept custody
                    </PondButton>
                    <PondButton
                      size="sm"
                      colorPalette="nautical"
                      loading={custodyActionBusy}
                      onClick={() =>
                        void (async () => {
                          setCustodyActionBusy(true);
                          try {
                            const token = await getApiAccessToken();
                            await rejectPendingCustody(token, item.id);
                            setNotice({ kind: "success", message: "Custody offer declined." });
                            await reload();
                          } catch (e) {
                            setNotice({
                              kind: "error",
                              message: e instanceof Error ? e.message : "Failed to decline",
                            });
                          } finally {
                            setCustodyActionBusy(false);
                          }
                        })()
                      }
                    >
                      Decline
                    </PondButton>
                  </HStack>
                </Stack>
              ) : null}

              {borrowedByMe ? (
                <Stack gap="2">
                  <Text fontSize={APP_TEXT_SIZES.helper} color="nautical.solid">
                    You are borrowing this item.
                  </Text>
                  {item.active_loan_marked_returned_by_borrower ||
                  item.custody_marked_returned_by_holder ? (
                    <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                      You marked this item as returned. Waiting for owner confirmation.
                    </Text>
                  ) : (
                    <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                      After you return it in person, tap the button below.
                    </Text>
                  )}
                  <HStack flexWrap="wrap">
                    <PondButton
                      size="sm"
                      colorPalette="lilypad"
                      loading={returnBusy}
                      disabled={
                        returnBusy ||
                        item.active_loan_marked_returned_by_borrower ||
                        item.custody_marked_returned_by_holder
                      }
                      onClick={() =>
                        void (async () => {
                          setReturnBusy(true);
                          try {
                            const token = await getApiAccessToken();
                            if (item.active_loan_id) {
                              await markReturnedByBorrower(token, item.active_loan_id);
                            } else {
                              await markCustodyReturnedByHolder(token, item.id);
                            }
                            setNotice({ kind: "success", message: "Return noted." });
                            await reload();
                          } catch (e) {
                            setNotice({
                              kind: "error",
                              message: e instanceof Error ? e.message : "Failed",
                            });
                          } finally {
                            setReturnBusy(false);
                          }
                        })()
                      }
                    >
                      I returned this
                    </PondButton>
                    <PondButton
                      size="sm"
                      colorPalette="nautical"
                      loading={returnBusy}
                      disabled={returnBusy}
                      onClick={() =>
                        void (async () => {
                          setReturnBusy(true);
                          try {
                            const token = await getApiAccessToken();
                            await denyCustody(token, item.id);
                            setNotice({ kind: "success", message: "Custody dispute flagged." });
                            await reload();
                          } catch (e) {
                            setNotice({
                              kind: "error",
                              message: e instanceof Error ? e.message : "Failed",
                            });
                          } finally {
                            setReturnBusy(false);
                          }
                        })()
                      }
                    >
                      I do not have this item
                    </PondButton>
                  </HStack>
                </Stack>
              ) : null}

              {item.my_pending_request && !isOwner ? (
                <HStack flexWrap="wrap">
                  <PondButton
                    size="sm"
                    colorPalette="nautical"
                    onClick={() => {
                      if (!confirmCancelRequest) {
                        setConfirmCancelRequest(true);
                        return;
                      }
                      void (async () => {
                        try {
                          const token = await getApiAccessToken();
                          await cancelBorrowRequest(token, item.my_pending_request!.id);
                          setConfirmCancelRequest(false);
                          setNotice({ kind: "success", message: "Borrow request canceled." });
                          await reload();
                        } catch (e) {
                          setNotice({
                            kind: "error",
                            message: e instanceof Error ? e.message : "Failed to cancel",
                          });
                        }
                      })();
                    }}
                  >
                    {confirmCancelRequest ? "Confirm cancel" : "Cancel request"}
                  </PondButton>
                </HStack>
              ) : null}

              {item.my_declined_request && !isOwner ? (
                <Stack gap="2">
                  <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                    Your borrow request was declined
                    {item.my_declined_request.decline_message
                      ? `: ${item.my_declined_request.decline_message}`
                      : "."}
                  </Text>
                  <PondButton
                    size="sm"
                    colorPalette="nautical"
                    onClick={() => {
                      if (!confirmDeleteDeclined) {
                        setConfirmDeleteDeclined(true);
                        return;
                      }
                      void (async () => {
                        try {
                          const token = await getApiAccessToken();
                          await deleteBorrowRequest(token, item.my_declined_request!.id);
                          setConfirmDeleteDeclined(false);
                          setNotice({ kind: "success", message: "Declined request removed." });
                          await reload();
                        } catch (e) {
                          setNotice({
                            kind: "error",
                            message: e instanceof Error ? e.message : "Failed",
                          });
                        }
                      })();
                    }}
                  >
                    {confirmDeleteDeclined ? "Confirm remove" : "Remove from list"}
                  </PondButton>
                </Stack>
              ) : null}

              </Stack>
            ) : null}
          </Stack>
        </Card.Body>
      </Card.Root>

      <Stack gap="1" w="100%" align="stretch">
        <ClosetItemModalFooter borrowSlot={null} />
        {item.hidden_by_me && canHideItem ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" textAlign="center">
            Hidden from your Items list. Use &lsquo;Show Hidden&rsquo; on the Items page to see it.
          </Text>
        ) : null}
      </Stack>
    </Stack>
  );
}
