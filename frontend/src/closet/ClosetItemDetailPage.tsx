import {
  Box,
  Card,
  HStack,
  Image,
  Input,
  PopoverBody,
  PopoverContent,
  PopoverPositioner,
  PopoverRoot,
  PopoverTrigger,
  Stack,
  Tag,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link as RouterLink,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import {
  validateClosetFreeText,
  validateIsoDateRequired,
} from "../forms/validation";
import { fetchFriendsList } from "../friends/api";
import PondButton from "../PondButton";
import { MealEditorBackdropDismiss } from "../meal/MealEditorBackdropDismiss";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
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
  fetchItem,
  markCustodyReturnedByHolder,
  markReturnedByBorrower,
  rejectPendingCustody,
} from "./api";
import {
  coerceClosetUserId,
  displayName,
  formatCategoryTagsSummaryLine,
  sameClosetUserId,
} from "./closetUtils";
import { ClosetOwnerManageModal } from "./ClosetOwnerManageModal";
import type { ClosetItem } from "./types";

const PLACEHOLDER = PANEL_FORM_PLACEHOLDER_PROPS;

function defaultManageTab(item: ClosetItem): "details" | "custody" {
  if (item.pending_request_count > 0) return "custody";
  if (item.active_loan_id) return "custody";
  if (item.pending_custody_user) return "custody";
  if (item.current_holder_user.id !== item.owner_user.id) return "custody";
  if (item.custody_marked_returned_by_holder) return "custody";
  return "details";
}

export default function ClosetItemDetailPage() {
  const { itemId: itemIdParam } = useParams<{ itemId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    isAuthenticated,
    isLoading,
    sessionUser,
    getApiAccessToken,
    refreshSession,
    error: sessionError,
  } = useAppSession();

  const itemId = itemIdParam ? Number.parseInt(itemIdParam, 10) : Number.NaN;
  const [item, setItem] = useState<ClosetItem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(
    null,
  );
  const [manageOpen, setManageOpen] = useState(false);
  const [borrowPopoverOpen, setBorrowPopoverOpen] = useState(false);
  const [borrowMessage, setBorrowMessage] = useState("");
  const [confirmCancelRequest, setConfirmCancelRequest] = useState(false);
  const [confirmDeleteDeclined, setConfirmDeleteDeclined] = useState(false);
  const [returnBusy, setReturnBusy] = useState(false);
  const [custodyActionBusy, setCustodyActionBusy] = useState(false);
  const [friendsForCustody, setFriendsForCustody] = useState<
    Array<{ id: number; label: string }>
  >([]);

  const meIdNum = coerceClosetUserId(sessionUser?.user?.id);

  const closetReturnTo = useMemo(() => {
    const fromState = (location.state as { closetReturnTo?: string } | null)?.closetReturnTo;
    if (fromState) return fromState;
    if (!item) return "/closet?tab=my";
    return sameClosetUserId(item.owner_user.id, meIdNum) ? "/closet?tab=my" : "/closet?tab=friends";
  }, [location.state, item, meIdNum]);

  const reload = useCallback(async () => {
    if (!Number.isFinite(itemId) || itemId < 1) return;
    const token = await getApiAccessToken();
    const row = await fetchItem(token, itemId);
    setItem(row);
    setLoadError(null);
  }, [itemId, getApiAccessToken]);

  useEffect(() => {
    if (!sessionUser?.user?.is_approved || !Number.isFinite(itemId) || itemId < 1) return;
    void reload().catch((e) => setLoadError(e instanceof Error ? e.message : "Load failed"));
  }, [sessionUser?.user?.is_approved, itemId, reload]);

  useEffect(() => {
    if (!sessionUser?.user?.is_approved) return;
    void (async () => {
      try {
        const token = await getApiAccessToken();
        const payload = await fetchFriendsList(token);
        setFriendsForCustody(
          payload.approved_friends.map((f) => ({
            id: f.id,
            label: f.nickname || f.email,
          })),
        );
      } catch {
        // optional for non-owner; modal still works with empty friend list for holder dropdown
      }
    })();
  }, [sessionUser?.user?.is_approved, getApiAccessToken]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 7000);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!borrowPopoverOpen || !item) return;
    setBorrowMessage(item.my_pending_request?.message ?? "");
  }, [borrowPopoverOpen, item]);

  const dismiss = useCallback(() => {
    navigate(closetReturnTo);
  }, [navigate, closetReturnTo]);

  const isOwner = item ? sameClosetUserId(item.owner_user.id, meIdNum) : false;
  const isHolder = item ? sameClosetUserId(item.current_holder_user.id, meIdNum) : false;
  const borrowedByMe = Boolean(item && isHolder && !isOwner);
  const custodyOfferedToMe = Boolean(
    item?.pending_custody_user && sameClosetUserId(item.pending_custody_user.id, meIdNum),
  );

  const submitBorrowDate = useCallback(
    async (dateIso: string) => {
      if (!item) return;
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
        setBorrowPopoverOpen(false);
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

  if (isLoading) return <Text fontSize={APP_TEXT_SIZES.helper}>Loading…</Text>;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser) {
    return (
      <Stack gap="4" maxW="3xl">
        <Text fontWeight="semibold">Reconnecting your API session…</Text>
        <Text fontSize={APP_TEXT_SIZES.helper}>{sessionError ?? "Session not ready."}</Text>
        <PondButton colorPalette="sky" onClick={() => void refreshSession()}>
          Retry session sync
        </PondButton>
      </Stack>
    );
  }
  if (!sessionUser.user.is_approved) {
    return <Text fontSize={APP_TEXT_SIZES.helper}>Your account is not approved yet.</Text>;
  }
  if (!Number.isFinite(itemId) || itemId < 1) {
    return (
      <Text fontSize={APP_TEXT_SIZES.helper} color="nautical.solid" role="alert">
        Invalid item.
      </Text>
    );
  }
  if (loadError && !item) {
    return (
      <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
        <Text fontSize={APP_TEXT_SIZES.helper} color="nautical.solid" role="alert">
          {loadError}
        </Text>
        <RouterLink to={closetReturnTo}>
          <Text as="span" color="lilypad.solid" fontWeight="bold">
            ← Back
          </Text>
        </RouterLink>
      </Stack>
    );
  }
  if (!item) {
    return <Text fontSize={APP_TEXT_SIZES.helper}>Loading…</Text>;
  }

  const imageUrl = (item.image_url ?? "").trim();
  const categoryLine = formatCategoryTagsSummaryLine(item);
  const tagParts = item.tags.map((t) => t.trim()).filter(Boolean);

  const canRequestBorrow =
    !isOwner &&
    !borrowedByMe &&
    sameClosetUserId(item.current_holder_user.id, item.owner_user.id);

  return (
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
      <Text fontSize={APP_TEXT_SIZES.helper}>
        <RouterLink to={closetReturnTo}>
          <Text as="span" color="lilypad.solid" fontWeight="bold">
            ← Back
          </Text>
        </RouterLink>
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

      <MealEditorBackdropDismiss onDismiss={dismiss}>
        <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
          <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
            <Stack gap="4" w="100%">
              <Box
                w="100%"
                minH={{ base: "min(55vh, 420px)", md: "min(50vh, 480px)" }}
                maxH="70vh"
                bg="gray.100"
                borderRadius="md"
                overflow="hidden"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt=""
                    w="100%"
                    h="100%"
                    objectFit="contain"
                    objectPosition="center"
                    draggable={false}
                  />
                ) : (
                  <Text fontSize="5xl" fontWeight="bold" color="gray.400">
                    {(item.name.trim().slice(0, 1) || "?").toUpperCase()}
                  </Text>
                )}
              </Box>

              <Stack gap="2">
                <HStack flexWrap="wrap" gap="2" align="flex-start">
                  {item.my_pending_request ? (
                    <Tag.Root size="sm" bg="lilypad.solid" color="black" borderWidth="0">
                      <Tag.Label fontWeight="bold">REQUESTED</Tag.Label>
                    </Tag.Root>
                  ) : null}
                  <Text fontWeight="semibold" fontSize="lg">
                    {item.name}
                  </Text>
                </HStack>
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
                {categoryLine ? (
                  <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                    {categoryLine}
                  </Text>
                ) : null}
                {tagParts.length > 0 ? (
                  <HStack flexWrap="wrap" gap="2">
                    {tagParts.map((tag) => (
                      <Tag.Root key={tag} size="sm" bg="gray.100" color="gray.600" borderWidth="0">
                        <Tag.Label>{tag}</Tag.Label>
                      </Tag.Root>
                    ))}
                  </HStack>
                ) : null}
              </Stack>

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

                {isOwner ? (
                  <PondButton
                    colorPalette="lilypad"
                    alignSelf="flex-start"
                    onClick={() => setManageOpen(true)}
                  >
                    Manage item
                  </PondButton>
                ) : null}

                {canRequestBorrow ? (
                  <PopoverRoot
                    open={borrowPopoverOpen}
                    onOpenChange={(d: { open: boolean }) => setBorrowPopoverOpen(d.open)}
                    positioning={{ placement: "bottom-start" }}
                  >
                    <PopoverTrigger asChild>
                      <PondButton colorPalette="lilypad" alignSelf="flex-start">
                        {item.my_pending_request ? "Update borrow request" : "Request to borrow"}
                      </PondButton>
                    </PopoverTrigger>
                    <PopoverPositioner>
                      <PopoverContent
                        bg="white"
                        borderWidth="1px"
                        borderColor="border"
                        borderRadius="md"
                        boxShadow="md"
                        p="0"
                        minW="280px"
                      >
                        <PopoverBody p="3">
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
                              Pick a date to send the request. Click away to cancel.
                            </Text>
                          </Stack>
                        </PopoverBody>
                      </PopoverContent>
                    </PopoverPositioner>
                  </PopoverRoot>
                ) : null}

                {borrowedByMe ? (
                  <Stack gap="2">
                    <Text fontSize={APP_TEXT_SIZES.helper} color="orange.solid">
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
            </Stack>
          </Card.Body>
        </Card.Root>
      </MealEditorBackdropDismiss>

      {isOwner ? (
        <ClosetOwnerManageModal
          open={manageOpen}
          onOpenChange={setManageOpen}
          item={item}
          meId={meIdNum}
          getToken={getApiAccessToken}
          custodyFriends={friendsForCustody}
          onRefreshed={reload}
          onNotice={setNotice}
          initialTab={defaultManageTab(item)}
        />
      ) : null}
    </Stack>
  );
}
