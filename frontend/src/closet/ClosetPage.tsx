import {
  Box,
  HStack,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Stack,
  Tabs,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import PondButton from "../PondButton";
import { useAppSession } from "../auth/AppSessionContext";
import { fetchFriendsList } from "../friends/api";
import { fullBleedStackProps } from "../responsive";
import { APP_TEXT_SIZES } from "../theme/typography";
import {
  acceptCustody,
  approveBorrowRequest,
  cancelBorrowRequest,
  cancelPendingCustody,
  completeCustodyReturn,
  createBorrowRequest,
  createItem,
  declineBorrowRequest,
  deleteBorrowRequest,
  deleteItem,
  denyCustody,
  fetchBorrowRequests,
  fetchFriendsItems,
  fetchMyItems,
  markCustodyReturnedByHolder,
  markReturnedByBorrower,
  markReturnedByOwner,
  patchItem,
  rejectPendingCustody,
  setCustody,
} from "./api";
import type { BorrowRequest, ClosetItem } from "./types";

type ClosetTab = "my" | "friends";
const FRIENDS_PAGE_SIZE = 10;
const MY_ITEMS_PAGE_SIZE = 10;
const CLOSET_PLACEHOLDER_PROPS = {
  _placeholder: {
    color: "gray.400",
    fontStyle: "italic",
    fontSize: "inherit",
  },
} as const;

function parseTab(value: string | null): ClosetTab {
  return value === "friends" ? "friends" : "my";
}

function displayName(itemUser: { display_name: string; email: string }): string {
  return itemUser.display_name || itemUser.email;
}

function formatNeedByDateLabel(dateOnly: string): string {
  const parts = dateOnly.split("-");
  if (parts.length !== 3) return dateOnly;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return dateOnly;
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(utcDate.getTime())) return dateOnly;
  const nowYear = new Date().getFullYear();
  const needsYear = year !== nowYear;
  return utcDate.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    ...(needsYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

function ItemCard({
  item,
  meId,
  onRefresh,
  getToken,
  custodyFriends,
  mode,
  onModeChange,
  onOwnedNotice,
  titlePrefix,
  showPendingCount = true,
  onCardClick,
  dashedBorder = false,
  listKind = "default",
}: {
  item: ClosetItem;
  meId: number;
  onRefresh: () => Promise<void>;
  getToken: () => Promise<string>;
  custodyFriends: Array<{ id: number; label: string }>;
  mode: "closed" | "edit" | "custody";
  onModeChange: (next: "closed" | "edit" | "custody") => void;
  onOwnedNotice?: (notice: { kind: "success" | "error"; message: string }) => void;
  titlePrefix?: { text: string; color: string; hideBorrowerLabel?: boolean };
  showPendingCount?: boolean;
  onCardClick?: () => void;
  dashedBorder?: boolean;
  listKind?: "default" | "borrowed";
}) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description);
  const [category, setCategory] = useState(item.category);
  const [tagsCsv, setTagsCsv] = useState(item.tags.join(", "));
  const [error, setError] = useState<string | null>(null);
  const [borrowRows, setBorrowRows] = useState<BorrowRequest[] | null>(null);
  const [declineMessageByRequestId, setDeclineMessageByRequestId] = useState<Record<number, string>>({});
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [custodyTargetUserId, setCustodyTargetUserId] = useState<string>("");
  const [markReturnedBusy, setMarkReturnedBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmDeleteButtonRef = useRef<HTMLButtonElement | null>(null);
  const cardContainerRef = useRef<HTMLDivElement | null>(null);
  const isOwner = item.owner_user.id === meId;
  const isHolder = item.current_holder_user.id === meId;
  const borrowedByMe = isHolder && !isOwner;
  const editing = mode === "edit";
  const handlingCustody = mode === "custody";

  const canMarkReturnedAsOwner = useMemo(
    () =>
      Boolean(
        item.active_loan_id ||
          item.custody_marked_returned_by_holder ||
          item.pending_custody_user ||
          item.current_holder_user.id !== item.owner_user.id,
      ),
    [
      item.active_loan_id,
      item.custody_marked_returned_by_holder,
      item.pending_custody_user,
      item.current_holder_user.id,
      item.owner_user.id,
    ],
  );

  const loadRequests = useCallback(async () => {
    if (!isOwner && !isHolder) return;
    const token = await getToken();
    const rows = await fetchBorrowRequests(token, item.id);
    setBorrowRows(rows);
  }, [getToken, isHolder, isOwner, item.id]);

  const pendingRows = useMemo(
    () => (borrowRows ?? []).filter((r) => r.status === "pending"),
    [borrowRows],
  );
  const orderedCustodyFriends = useMemo(() => {
    const byId = new Map(custodyFriends.map((f) => [f.id, f]));
    const prioritizedIds: number[] = [];
    const pendingAssignee = item.pending_custody_user;
    if (pendingAssignee && pendingAssignee.id !== item.owner_user.id) {
      prioritizedIds.push(pendingAssignee.id);
    }
    if (
      item.current_holder_user.id !== item.owner_user.id &&
      !prioritizedIds.includes(item.current_holder_user.id)
    ) {
      prioritizedIds.push(item.current_holder_user.id);
    }
    for (const row of pendingRows) {
      if (!byId.has(row.requester_user.id)) continue;
      if (prioritizedIds.includes(row.requester_user.id)) continue;
      prioritizedIds.push(row.requester_user.id);
    }

    const labelForId = (id: number): string => {
      const f = byId.get(id);
      if (f) return f.label;
      if (pendingAssignee && id === pendingAssignee.id) return displayName(pendingAssignee);
      if (id === item.current_holder_user.id) return displayName(item.current_holder_user);
      return String(id);
    };

    const prioritized = prioritizedIds.map((id) => {
      const f = byId.get(id);
      if (f) return f;
      return { id, label: labelForId(id) };
    });
    const rest = custodyFriends.filter((f) => !prioritizedIds.includes(f.id));
    return { prioritized, rest };
  }, [
    custodyFriends,
    item.current_holder_user,
    item.owner_user.id,
    item.pending_custody_user,
    pendingRows,
  ]);

  const saveEdit = async () => {
    setError(null);
    try {
      const token = await getToken();
      await patchItem(token, item.id, {
        name: name.trim(),
        description: description.trim(),
        category: category.trim(),
        tags: tagsCsv
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      onModeChange("closed");
      await onRefresh();
      onOwnedNotice?.({ kind: "success", message: "Item saved." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update item";
      setError(message);
      onOwnedNotice?.({ kind: "error", message });
    }
  };

  const onDelete = async () => {
    setError(null);
    try {
      const token = await getToken();
      await deleteItem(token, item.id);
      onModeChange("closed");
      await onRefresh();
      onOwnedNotice?.({ kind: "success", message: "Item deleted." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete item";
      setError(message);
      onOwnedNotice?.({ kind: "error", message });
    }
  };

  useEffect(() => {
    if (mode === "closed") {
      setName(item.name);
      setDescription(item.description);
      setCategory(item.category);
      setTagsCsv(item.tags.join(", "));
      setError(null);
      setConfirmDelete(false);
      setDeclineMessageByRequestId({});
      setRequestsOpen(false);
      setBorrowRows(null);
    }
  }, [item.category, item.description, item.name, item.tags, mode]);

  useEffect(() => {
    if (!handlingCustody) return;
    if (isOwner) {
      if (item.pending_custody_user) {
        setCustodyTargetUserId(String(item.pending_custody_user.id));
      } else {
        setCustodyTargetUserId(String(item.current_holder_user.id));
      }
    }
    if (isOwner || isHolder) {
      setRequestsOpen(true);
      if (borrowRows == null) {
        void loadRequests();
      }
    }
  }, [
    borrowRows,
    handlingCustody,
    isHolder,
    isOwner,
    item.current_holder_user.id,
    item.pending_custody_user?.id,
    loadRequests,
  ]);

  useEffect(() => {
    if (mode === "closed") return;
    if (!isOwner) return;
    if (item.pending_custody_user) {
      setCustodyTargetUserId(String(item.pending_custody_user.id));
    } else {
      setCustodyTargetUserId(String(item.current_holder_user.id));
    }
  }, [isOwner, item.current_holder_user.id, item.pending_custody_user?.id, mode]);

  useEffect(() => {
    if (mode === "closed") return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (cardContainerRef.current?.contains(target)) return;
      onModeChange("closed");
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [mode, onModeChange]);

  const onDenyCustody = async () => {
    setError(null);
    try {
      const token = await getToken();
      await denyCustody(token, item.id);
      await onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to deny custody");
    }
  };

  const onMarkReturnedByBorrower = async () => {
    if (!item.active_loan_id) return;
    setError(null);
    try {
      const token = await getToken();
      await markReturnedByBorrower(token, item.active_loan_id);
      await onRefresh();
      onOwnedNotice?.({
        kind: "success",
        message: "Return noted. The owner still needs to mark the loan returned.",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to signal return";
      setError(message);
      onOwnedNotice?.({ kind: "error", message });
    }
  };

  const onMarkCustodyReturnedByHolder = async () => {
    if (item.active_loan_id) return;
    setError(null);
    try {
      const token = await getToken();
      await markCustodyReturnedByHolder(token, item.id);
      await onRefresh();
      onOwnedNotice?.({
        kind: "success",
        message: "Return noted. The owner still needs to confirm the handoff.",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to signal return";
      setError(message);
      onOwnedNotice?.({ kind: "error", message });
    }
  };

  const onCompleteCustodyReturn = async () => {
    if (item.active_loan_id || !item.custody_marked_returned_by_holder) return;
    setError(null);
    try {
      const token = await getToken();
      await completeCustodyReturn(token, item.id);
      onModeChange("closed");
      await onRefresh();
      onOwnedNotice?.({ kind: "success", message: "Handoff confirmed. You have custody." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to confirm handoff";
      setError(message);
      onOwnedNotice?.({ kind: "error", message });
    }
  };

  const onMarkReturnedByOwner = async () => {
    if (!item.active_loan_id) return;
    setError(null);
    try {
      const token = await getToken();
      await markReturnedByOwner(token, item.active_loan_id);
      await onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to complete return");
    }
  };

  const onSetCurrentHolder = async () => {
    setError(null);
    const nextHolderId = Number(custodyTargetUserId);
    if (!Number.isFinite(nextHolderId)) return;
    try {
      const token = await getToken();
      await setCustody(token, item.id, nextHolderId);
      if (editing) {
        onModeChange("closed");
      }
      await onRefresh();
      if (nextHolderId === item.owner_user.id) {
        onOwnedNotice?.({ kind: "success", message: "Custody updated." });
      } else {
        onOwnedNotice?.({
          kind: "success",
          message: "Custody offer sent. They must accept before it takes effect.",
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to set custody";
      setError(message);
      onOwnedNotice?.({ kind: "error", message });
    }
  };

  const onMarkReturnedAsOwner = async () => {
    if (!canMarkReturnedAsOwner) return;
    setError(null);
    setMarkReturnedBusy(true);
    try {
      const token = await getToken();
      if (item.active_loan_id) {
        await markReturnedByOwner(token, item.active_loan_id);
        await onRefresh();
        onOwnedNotice?.({ kind: "success", message: "Loan completed. You have custody." });
      } else if (item.custody_marked_returned_by_holder) {
        await completeCustodyReturn(token, item.id);
        onModeChange("closed");
        await onRefresh();
        onOwnedNotice?.({ kind: "success", message: "Handoff confirmed. You have custody." });
      } else {
        await setCustody(token, item.id, item.owner_user.id);
        if (editing) {
          onModeChange("closed");
        }
        await onRefresh();
        onOwnedNotice?.({ kind: "success", message: "Custody updated." });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to mark returned";
      setError(message);
      onOwnedNotice?.({ kind: "error", message });
    } finally {
      setMarkReturnedBusy(false);
    }
  };

  const onCancelPendingCustody = async () => {
    setError(null);
    try {
      const token = await getToken();
      await cancelPendingCustody(token, item.id);
      await onRefresh();
      onOwnedNotice?.({ kind: "success", message: "Custody offer canceled." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to cancel offer";
      setError(message);
      onOwnedNotice?.({ kind: "error", message });
    }
  };

  return (
    <Box
      ref={cardContainerRef}
      bg="white"
      borderWidth="1px"
      borderStyle={dashedBorder ? "dashed" : "solid"}
      borderColor="border"
      borderRadius="xl"
      p="4"
      cursor={onCardClick ? "pointer" : "default"}
      onClick={() => onCardClick?.()}
    >
      <Stack gap="3">
        <HStack justify="space-between" align="start">
          <Stack gap="1">
            <HStack gap="1">
              {titlePrefix ? (
                <Text fontWeight="bold" color={titlePrefix.color}>
                  {titlePrefix.text}
                </Text>
              ) : null}
              <Text fontWeight="bold">{item.name}</Text>
            </HStack>
            {listKind === "default" &&
            item.current_holder_user.id !== meId &&
            !titlePrefix?.hideBorrowerLabel ? (
              <Text fontSize={APP_TEXT_SIZES.helper}>
                Borrower: {displayName(item.current_holder_user)}
              </Text>
            ) : null}
            {item.custody_disputed ? (
              <Text color="orange.solid" fontWeight="semibold" fontSize={APP_TEXT_SIZES.helper}>
                Custody disputed: holder denied possession.
              </Text>
            ) : null}
            {item.pending_custody_user && isOwner ? (
              <Text color="sky.solid" fontWeight="semibold" fontSize={APP_TEXT_SIZES.helper}>
                Waiting for {displayName(item.pending_custody_user)} to accept custody.
              </Text>
            ) : null}
            {item.active_loan_marked_returned_by_borrower && isOwner ? (
              <Text color="lilypad.solid" fontWeight="semibold" fontSize={APP_TEXT_SIZES.helper}>
                Borrower marked this item as returned. Use Mark returned to complete the loan.
              </Text>
            ) : null}
            {item.active_loan_marked_returned_by_borrower && borrowedByMe ? (
              <Text color="lilypad.solid" fontWeight="semibold" fontSize={APP_TEXT_SIZES.helper}>
                You marked this item as returned. Waiting for owner confirmation.
              </Text>
            ) : null}
            {!item.active_loan_id && item.custody_marked_returned_by_holder && isOwner ? (
              <Text color="lilypad.solid" fontWeight="semibold" fontSize={APP_TEXT_SIZES.helper}>
                Current holder marked this item as returned. Use Mark returned to complete the handoff.
              </Text>
            ) : null}
            {!item.active_loan_id && item.custody_marked_returned_by_holder && borrowedByMe ? (
              <Text color="lilypad.solid" fontWeight="semibold" fontSize={APP_TEXT_SIZES.helper}>
                You marked this item as returned. Waiting for the owner to confirm.
              </Text>
            ) : null}
          </Stack>
          {showPendingCount && item.pending_request_count > 0 ? (
            <Text fontSize={APP_TEXT_SIZES.helper} color="orange.solid" fontWeight="bold">
              {item.pending_request_count} pending{" "}
              {item.pending_request_count === 1 ? "request" : "requests"}
            </Text>
          ) : null}
        </HStack>

        {item.description ? <Text>{item.description}</Text> : null}
        {listKind !== "borrowed" ? (
          <Text fontSize={APP_TEXT_SIZES.helper}>
            Category: {item.category || "—"} | Tags: {item.tags.join(", ") || "—"}
          </Text>
        ) : null}

        {editing ? (
          <Stack
            p="3"
            onClick={(event) => event.stopPropagation()}
            onMouseDownCapture={(event) => {
              if (!confirmDelete) return;
              const target = event.target as Node | null;
              if (!target) return;
              if (confirmDeleteButtonRef.current?.contains(target)) return;
              setConfirmDelete(false);
            }}
            onTouchStartCapture={(event) => {
              if (!confirmDelete) return;
              const target = event.target as Node | null;
              if (!target) return;
              if (confirmDeleteButtonRef.current?.contains(target)) return;
              setConfirmDelete(false);
            }}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              {...CLOSET_PLACEHOLDER_PROPS}
            />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              {...CLOSET_PLACEHOLDER_PROPS}
            />
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category"
              {...CLOSET_PLACEHOLDER_PROPS}
            />
            <Input
              value={tagsCsv}
              onChange={(e) => setTagsCsv(e.target.value)}
              placeholder="tag1, tag2"
              {...CLOSET_PLACEHOLDER_PROPS}
            />
            <HStack>
              <PondButton size="sm" colorPalette="lilypad" onClick={() => void saveEdit()}>
                Save
              </PondButton>
              <PondButton size="sm" colorPalette="sky" onClick={() => onModeChange("closed")}>
                Cancel
              </PondButton>
              <Box flex="1" />
              {isOwner ? (
                <PondButton
                  ref={confirmDeleteButtonRef}
                  size="sm"
                  colorPalette="nautical"
                  onClick={() => {
                    if (!confirmDelete) {
                      setConfirmDelete(true);
                      return;
                    }
                    void onDelete();
                  }}
                >
                  {confirmDelete ? "Confirm Delete" : "Delete"}
                </PondButton>
              ) : null}
            </HStack>
            {isOwner ? (
              <Stack gap="2">
                {item.pending_custody_user ? (
                  <Text fontSize={APP_TEXT_SIZES.helper} color="orange.solid">
                    A custody offer is pending. You can cancel it below or choose a different holder to replace the
                    offer.
                  </Text>
                ) : (
                  <Text fontSize={APP_TEXT_SIZES.helper}>
                    Set who currently has this item (you or a friend). Assigning a friend sends an offer they must
                    accept.
                  </Text>
                )}
                <HStack align="end" flexWrap="wrap" gap="2">
                  <NativeSelectRoot maxW="320px">
                    <NativeSelectField
                      value={custodyTargetUserId}
                      onChange={(e) => setCustodyTargetUserId(e.target.value)}
                    >
                      <option value={String(item.owner_user.id)}>Me</option>
                      {orderedCustodyFriends.prioritized.length > 0 ? (
                        <optgroup label="Active participants">
                          {orderedCustodyFriends.prioritized.map((friend) => (
                            <option key={`holder-priority-edit-${friend.id}`} value={String(friend.id)}>
                              {friend.label}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                      {orderedCustodyFriends.rest.length > 0 ? (
                        <optgroup label="Other friends">
                          {orderedCustodyFriends.rest.map((friend) => (
                            <option key={`holder-rest-edit-${friend.id}`} value={String(friend.id)}>
                              {friend.label}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                    </NativeSelectField>
                  </NativeSelectRoot>
                  <PondButton size="sm" colorPalette="orange" onClick={() => void onSetCurrentHolder()}>
                    Set current holder
                  </PondButton>
                  <PondButton
                    size="sm"
                    colorPalette="lilypad"
                    loading={markReturnedBusy}
                    disabled={!canMarkReturnedAsOwner}
                    onClick={() => void onMarkReturnedAsOwner()}
                  >
                    Mark Returned
                  </PondButton>
                </HStack>
              </Stack>
            ) : null}
          </Stack>
        ) : null}

        {handlingCustody ? (
          <Stack p="3" onClick={(event) => event.stopPropagation()}>
            {requestsOpen && (isOwner || isHolder) && pendingRows.length > 0 ? (
              <Stack>
                {pendingRows.map((row) => (
                  <Box key={row.id} borderWidth="1px" borderColor="border" borderRadius="md" p="3">
                    <Stack gap="1">
                      <Text fontSize={APP_TEXT_SIZES.helper}>
                        {displayName(row.requester_user)} would like to borrow{" "}
                        {displayName(item.owner_user)}
                        {"'s"} item before{" "}
                        {formatNeedByDateLabel(row.date_needed_by)}
                        {row.message ? `: '${row.message}.'` : "."}
                      </Text>
                      <HStack justify="space-between" align="end" gap="3" flexWrap="wrap">
                        {isOwner ? (
                          <>
                            <PondButton
                              size="sm"
                              colorPalette="lilypad"
                              onClick={async () => {
                                try {
                                  const token = await getToken();
                                  await approveBorrowRequest(token, row.id);
                                  onModeChange("closed");
                                  await onRefresh();
                                } catch (err: unknown) {
                                  setError(err instanceof Error ? err.message : "Failed to approve request");
                                }
                              }}
                            >
                              Approve
                            </PondButton>
                            <Box flex="1" />
                            <HStack align="end" justify="flex-end" gap="2">
                              <Input
                                value={declineMessageByRequestId[row.id] ?? ""}
                                onChange={(e) =>
                                  setDeclineMessageByRequestId((prev) => ({
                                    ...prev,
                                    [row.id]: e.target.value,
                                  }))
                                }
                                placeholder="optional message"
                                maxW="280px"
                                {...CLOSET_PLACEHOLDER_PROPS}
                              />
                              <PondButton
                                size="sm"
                                colorPalette="nautical"
                                onClick={async () => {
                                  try {
                                    const token = await getToken();
                                    await declineBorrowRequest(token, row.id, {
                                      decline_message: (declineMessageByRequestId[row.id] ?? "").trim(),
                                    });
                                    setDeclineMessageByRequestId((prev) => ({ ...prev, [row.id]: "" }));
                                    onModeChange("closed");
                                    await onRefresh();
                                  } catch (err: unknown) {
                                    setError(err instanceof Error ? err.message : "Failed to decline request");
                                  }
                                }}
                              >
                                Decline
                              </PondButton>
                            </HStack>
                          </>
                        ) : null}
                      </HStack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            ) : null}
            {item.pending_custody_user && isOwner ? (
              <HStack>
                <PondButton size="sm" colorPalette="nautical" onClick={() => void onCancelPendingCustody()}>
                  Cancel custody offer
                </PondButton>
              </HStack>
            ) : null}
            {item.active_loan_id && isOwner ? (
              <Text fontSize={APP_TEXT_SIZES.helper}>
                When the borrower gives the item back, use{" "}
                <Text as="span" fontWeight="semibold">
                  Mark returned
                </Text>{" "}
                to close the active loan and put custody back on you.{" "}
                <Text as="span" fontWeight="semibold">
                  Set holder
                </Text>{" "}
                below only changes who the app thinks physically has the item; it does not end the loan.
              </Text>
            ) : null}
            {item.active_loan_id && borrowedByMe ? (
              <Text fontSize={APP_TEXT_SIZES.helper}>
                Tap{" "}
                <Text as="span" fontWeight="semibold">
                  I returned this
                </Text>{" "}
                after you give the item back. The owner still completes the loan with Mark returned. Use{" "}
                <Text as="span" fontWeight="semibold">
                  I do not have this item
                </Text>{" "}
                if records show you as holder but you do not have it (flags a dispute for the owner).
              </Text>
            ) : null}
            {borrowedByMe && !item.active_loan_id ? (
              <Text fontSize={APP_TEXT_SIZES.helper}>
                No loan is on record—only custody was assigned. Tap{" "}
                <Text as="span" fontWeight="semibold">
                  I returned this
                </Text>{" "}
                after you give the item back to the owner; they confirm with Mark returned to move custody. Use{" "}
                <Text as="span" fontWeight="semibold">
                  I do not have this item
                </Text>{" "}
                if you are listed as holder but do not have it.
              </Text>
            ) : null}
            {!item.active_loan_id && item.custody_marked_returned_by_holder && isOwner ? (
              <Text fontSize={APP_TEXT_SIZES.helper}>
                The holder said they returned this item. Use{" "}
                <Text as="span" fontWeight="semibold">
                  Mark returned
                </Text>{" "}
                to put custody back on you once you have it.
              </Text>
            ) : null}
            <HStack flexWrap="wrap">
              {item.active_loan_id && isOwner ? (
                <PondButton size="sm" colorPalette="lilypad" onClick={() => void onMarkReturnedByOwner()}>
                  Mark returned (complete loan)
                </PondButton>
              ) : null}
              {!item.active_loan_id && item.custody_marked_returned_by_holder && isOwner ? (
                <PondButton size="sm" colorPalette="lilypad" onClick={() => void onCompleteCustodyReturn()}>
                  Mark returned (complete handoff)
                </PondButton>
              ) : null}
              {borrowedByMe ? (
                <PondButton
                  size="sm"
                  colorPalette="lilypad"
                  onClick={() =>
                    void (
                      item.active_loan_id ? onMarkReturnedByBorrower() : onMarkCustodyReturnedByHolder()
                    )
                  }
                >
                  I returned this
                </PondButton>
              ) : null}
              {borrowedByMe ? (
                <PondButton size="sm" colorPalette="nautical" onClick={() => void onDenyCustody()}>
                  I do not have this item
                </PondButton>
              ) : null}
            </HStack>
            {isOwner ? (
              <Stack gap="2">
                {item.active_loan_id ? (
                  <Text fontSize={APP_TEXT_SIZES.helper} color="orange.solid">
                    While a loan is active, prefer Mark returned when the item is back. Change holder here only if
                    you need to correct who has the item without closing the loan yet.
                  </Text>
                ) : item.custody_marked_returned_by_holder ? (
                  <Text fontSize={APP_TEXT_SIZES.helper} color="orange.solid">
                    The holder marked a return. Prefer Mark returned above before changing holder here.
                  </Text>
                ) : (
                  <Text fontSize={APP_TEXT_SIZES.helper}>
                    Choose who physically has this item right now (you or a friend).
                  </Text>
                )}
                <HStack align="end" flexWrap="wrap" gap="2">
                  <NativeSelectRoot maxW="320px">
                    <NativeSelectField
                      value={custodyTargetUserId}
                      onChange={(e) => setCustodyTargetUserId(e.target.value)}
                    >
                      <option value={String(item.owner_user.id)}>Me</option>
                      {orderedCustodyFriends.prioritized.length > 0 ? (
                        <optgroup label="Active participants">
                          {orderedCustodyFriends.prioritized.map((friend) => (
                            <option key={`holder-priority-${friend.id}`} value={String(friend.id)}>
                              {friend.label}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                      {orderedCustodyFriends.rest.length > 0 ? (
                        <optgroup label="Other friends">
                          {orderedCustodyFriends.rest.map((friend) => (
                            <option key={`holder-rest-${friend.id}`} value={String(friend.id)}>
                              {friend.label}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                    </NativeSelectField>
                  </NativeSelectRoot>
                  <PondButton size="sm" colorPalette="orange" onClick={() => void onSetCurrentHolder()}>
                    Set current holder
                  </PondButton>
                  <PondButton
                    size="sm"
                    colorPalette="lilypad"
                    loading={markReturnedBusy}
                    disabled={!canMarkReturnedAsOwner}
                    onClick={() => void onMarkReturnedAsOwner()}
                  >
                    Mark Returned
                  </PondButton>
                </HStack>
              </Stack>
            ) : null}
          </Stack>
        ) : null}

        {error ? (
          <Text role="alert" color="red.600" fontSize={APP_TEXT_SIZES.helper}>
            {error}
          </Text>
        ) : null}
      </Stack>
    </Box>
  );
}

export default function ClosetPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));
  const {
    isAuthenticated,
    isLoading,
    sessionUser,
    getApiAccessToken,
    refreshSession,
    error: sessionError,
  } = useAppSession();
  const [myItems, setMyItems] = useState<{
    declined_by_me: ClosetItem[];
    borrowed_by_me: ClosetItem[];
    custody_offered_to_me: ClosetItem[];
    requested_by_me: ClosetItem[];
    owned_by_me: ClosetItem[];
  }>({
    declined_by_me: [],
    borrowed_by_me: [],
    custody_offered_to_me: [],
    requested_by_me: [],
    owned_by_me: [],
  });
  const [friendsItems, setFriendsItems] = useState<ClosetItem[]>([]);
  const [friendsPage, setFriendsPage] = useState(1);
  const [declinedPage, setDeclinedPage] = useState(1);
  const [borrowedPage, setBorrowedPage] = useState(1);
  const [custodyOfferedPage, setCustodyOfferedPage] = useState(1);
  const [requestedPage, setRequestedPage] = useState(1);
  const [ownedPage, setOwnedPage] = useState(1);
  const [loanedPage, setLoanedPage] = useState(1);
  const [friendsTotal, setFriendsTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [newNeedBy, setNewNeedBy] = useState("");
  const [newRequestMessage, setNewRequestMessage] = useState("");
  const [requestingItemId, setRequestingItemId] = useState<number | null>(null);
  const [expandedFriendItemId, setExpandedFriendItemId] = useState<number | null>(null);
  const [editingRequestItemId, setEditingRequestItemId] = useState<number | null>(null);
  const [confirmCancelRequestItemId, setConfirmCancelRequestItemId] = useState<number | null>(null);
  const confirmCancelRequestButtonRef = useRef<HTMLButtonElement | null>(null);
  const [confirmCancelMyRequestedItemId, setConfirmCancelMyRequestedItemId] = useState<number | null>(null);
  const confirmCancelMyRequestedButtonRef = useRef<HTMLButtonElement | null>(null);
  const [confirmDeleteDeclinedRequestItemId, setConfirmDeleteDeclinedRequestItemId] = useState<number | null>(null);
  const confirmDeleteDeclinedRequestButtonRef = useRef<HTMLButtonElement | null>(null);
  const requestedByMeCardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const friendsCardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [friendsForCustody, setFriendsForCustody] = useState<Array<{ id: number; label: string }>>([]);
  const [activeItemId, setActiveItemId] = useState<number | null>(null);
  const [activeItemMode, setActiveItemMode] = useState<"closed" | "edit" | "custody">("closed");
  const [ownedNotice, setOwnedNotice] = useState<{ kind: "success" | "error"; message: string } | null>(
    null,
  );
  const [friendsNotice, setFriendsNotice] = useState<{ kind: "success" | "error"; message: string } | null>(
    null,
  );

  const meId = sessionUser?.user.id ?? 0;
  const totalFriendsPages = Math.max(1, Math.ceil(friendsTotal / FRIENDS_PAGE_SIZE));
  const totalDeclinedPages = Math.max(1, Math.ceil(myItems.declined_by_me.length / MY_ITEMS_PAGE_SIZE));
  const totalBorrowedPages = Math.max(1, Math.ceil(myItems.borrowed_by_me.length / MY_ITEMS_PAGE_SIZE));
  const totalCustodyOfferedPages = Math.max(
    1,
    Math.ceil(myItems.custody_offered_to_me.length / MY_ITEMS_PAGE_SIZE),
  );
  const totalRequestedPages = Math.max(1, Math.ceil(myItems.requested_by_me.length / MY_ITEMS_PAGE_SIZE));
  const loanedItems = useMemo(
    () => myItems.owned_by_me.filter((item) => item.current_holder_user.id !== meId),
    [myItems.owned_by_me, meId],
  );
  const ownedWithPendingRequests = useMemo(
    () =>
      myItems.owned_by_me.filter(
        (item) =>
          item.pending_request_count > 0 && item.current_holder_user.id === meId,
      ),
    [myItems.owned_by_me, meId],
  );
  const ownedWithoutPendingRequests = useMemo(
    () =>
      myItems.owned_by_me.filter(
        (item) =>
          item.pending_request_count === 0 && item.current_holder_user.id === meId,
      ),
    [myItems.owned_by_me, meId],
  );
  const totalLoanedPages = Math.max(1, Math.ceil(loanedItems.length / MY_ITEMS_PAGE_SIZE));
  const totalOwnedPages = Math.max(1, Math.ceil(ownedWithoutPendingRequests.length / MY_ITEMS_PAGE_SIZE));
  const safeDeclinedPage = Math.min(declinedPage, totalDeclinedPages);
  const safeBorrowedPage = Math.min(borrowedPage, totalBorrowedPages);
  const safeCustodyOfferedPage = Math.min(custodyOfferedPage, totalCustodyOfferedPages);
  const safeRequestedPage = Math.min(requestedPage, totalRequestedPages);
  const safeOwnedPage = Math.min(ownedPage, totalOwnedPages);
  const safeLoanedPage = Math.min(loanedPage, totalLoanedPages);
  const declinedStart = (safeDeclinedPage - 1) * MY_ITEMS_PAGE_SIZE;
  const borrowedStart = (safeBorrowedPage - 1) * MY_ITEMS_PAGE_SIZE;
  const custodyOfferedStart = (safeCustodyOfferedPage - 1) * MY_ITEMS_PAGE_SIZE;
  const requestedStart = (safeRequestedPage - 1) * MY_ITEMS_PAGE_SIZE;
  const ownedStart = (safeOwnedPage - 1) * MY_ITEMS_PAGE_SIZE;
  const loanedStart = (safeLoanedPage - 1) * MY_ITEMS_PAGE_SIZE;
  const visibleDeclined = myItems.declined_by_me.slice(declinedStart, declinedStart + MY_ITEMS_PAGE_SIZE);
  const visibleBorrowed = myItems.borrowed_by_me.slice(borrowedStart, borrowedStart + MY_ITEMS_PAGE_SIZE);
  const visibleCustodyOffered = myItems.custody_offered_to_me.slice(
    custodyOfferedStart,
    custodyOfferedStart + MY_ITEMS_PAGE_SIZE,
  );
  const visibleRequested = myItems.requested_by_me.slice(
    requestedStart,
    requestedStart + MY_ITEMS_PAGE_SIZE,
  );
  const visibleOwned = ownedWithoutPendingRequests.slice(ownedStart, ownedStart + MY_ITEMS_PAGE_SIZE);
  const visibleLoaned = loanedItems.slice(loanedStart, loanedStart + MY_ITEMS_PAGE_SIZE);

  const setActiveTab = (tab: ClosetTab) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  const loadMine = useCallback(async () => {
    const token = await getApiAccessToken();
    const payload = await fetchMyItems(token);
    setMyItems(payload);
  }, [getApiAccessToken]);

  const loadFriends = useCallback(async () => {
    const token = await getApiAccessToken();
    const payload = await fetchFriendsItems(token, friendsPage, FRIENDS_PAGE_SIZE);
    setFriendsItems(payload.results);
    setFriendsTotal(payload.total);
  }, [friendsPage, getApiAccessToken]);

  const loadFriendsForCustody = useCallback(async () => {
    const token = await getApiAccessToken();
    const payload = await fetchFriendsList(token);
    setFriendsForCustody(
      payload.approved_friends.map((f) => ({
        id: f.id,
        label: f.nickname || f.email,
      })),
    );
  }, [getApiAccessToken]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadMine(), loadFriends(), loadFriendsForCustody()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load closet");
    } finally {
      setLoading(false);
    }
  }, [loadFriends, loadFriendsForCustody, loadMine]);

  const resetRequestEditors = useCallback(() => {
    setEditingRequestItemId(null);
    setRequestingItemId(null);
    setConfirmCancelRequestItemId(null);
    setConfirmCancelMyRequestedItemId(null);
    setNewNeedBy("");
    setNewRequestMessage("");
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !sessionUser) return;
    void refreshAll();
  }, [friendsPage, isAuthenticated, refreshAll, sessionUser]);

  useEffect(() => {
    if (declinedPage > totalDeclinedPages) setDeclinedPage(totalDeclinedPages);
  }, [declinedPage, totalDeclinedPages]);

  useEffect(() => {
    if (borrowedPage > totalBorrowedPages) setBorrowedPage(totalBorrowedPages);
  }, [borrowedPage, totalBorrowedPages]);

  useEffect(() => {
    if (custodyOfferedPage > totalCustodyOfferedPages) setCustodyOfferedPage(totalCustodyOfferedPages);
  }, [custodyOfferedPage, totalCustodyOfferedPages]);

  useEffect(() => {
    if (requestedPage > totalRequestedPages) setRequestedPage(totalRequestedPages);
  }, [requestedPage, totalRequestedPages]);

  useEffect(() => {
    if (ownedPage > totalOwnedPages) setOwnedPage(totalOwnedPages);
  }, [ownedPage, totalOwnedPages]);

  useEffect(() => {
    if (loanedPage > totalLoanedPages) setLoanedPage(totalLoanedPages);
  }, [loanedPage, totalLoanedPages]);

  useEffect(() => {
    if (!ownedNotice) return;
    const timer = window.setTimeout(() => setOwnedNotice(null), 7000);
    return () => window.clearTimeout(timer);
  }, [ownedNotice]);

  useEffect(() => {
    if (!friendsNotice) return;
    const timer = window.setTimeout(() => setFriendsNotice(null), 7000);
    return () => window.clearTimeout(timer);
  }, [friendsNotice]);

  useEffect(() => {
    if (
      confirmCancelRequestItemId == null &&
      confirmCancelMyRequestedItemId == null &&
      confirmDeleteDeclinedRequestItemId == null
    ) {
      return;
    }
    let onPointerDown: ((event: PointerEvent) => void) | undefined;
    const attachId = window.setTimeout(() => {
      onPointerDown = (event: PointerEvent) => {
        const target = event.target as Node | null;
        if (!target) return;
        if (confirmCancelRequestButtonRef.current?.contains(target)) return;
        if (confirmCancelMyRequestedButtonRef.current?.contains(target)) return;
        if (confirmDeleteDeclinedRequestButtonRef.current?.contains(target)) return;
        setConfirmCancelRequestItemId(null);
        setConfirmCancelMyRequestedItemId(null);
        setConfirmDeleteDeclinedRequestItemId(null);
      };
      document.addEventListener("pointerdown", onPointerDown);
    }, 0);
    return () => {
      window.clearTimeout(attachId);
      if (onPointerDown) document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [
    confirmCancelRequestItemId,
    confirmCancelMyRequestedItemId,
    confirmDeleteDeclinedRequestItemId,
  ]);

  useEffect(() => {
    if (editingRequestItemId == null && expandedFriendItemId == null) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (editingRequestItemId != null) {
        const requestedCard = requestedByMeCardRefs.current[editingRequestItemId];
        const friendCard = friendsCardRefs.current[editingRequestItemId];
        if (requestedCard?.contains(target) || friendCard?.contains(target)) return;
      }
      if (expandedFriendItemId != null) {
        const expandedCard = friendsCardRefs.current[expandedFriendItemId];
        if (expandedCard?.contains(target)) return;
      }
      if (expandedFriendItemId != null) {
        setExpandedFriendItemId(null);
      }
      resetRequestEditors();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [editingRequestItemId, expandedFriendItemId, resetRequestEditors]);

  if (isLoading) return <Text>Loading…</Text>;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser) {
    return (
      <Stack gap="4" maxW="3xl">
        <Text fontWeight="semibold">Reconnecting your API session…</Text>
        <Text fontSize={APP_TEXT_SIZES.helper}>
          {sessionError || "You are authenticated, but the API session is not ready yet."}
        </Text>
        <HStack>
          <PondButton colorPalette="sky" onClick={() => void refreshSession()}>
            Retry session sync
          </PondButton>
        </HStack>
      </Stack>
    );
  }

  const restrictToFocusedItem = activeItemMode === "edit" && activeItemId != null;
  const visibleDeclinedFiltered = restrictToFocusedItem
    ? visibleDeclined.filter((item) => item.id === activeItemId)
    : visibleDeclined;
  const visibleBorrowedFiltered = restrictToFocusedItem
    ? visibleBorrowed.filter((item) => item.id === activeItemId)
    : visibleBorrowed;
  const visibleCustodyOfferedFiltered = restrictToFocusedItem
    ? visibleCustodyOffered.filter((item) => item.id === activeItemId)
    : visibleCustodyOffered;
  const visibleOwnedFiltered = restrictToFocusedItem
    ? visibleOwned.filter((item) => item.id === activeItemId)
    : visibleOwned;
  const visibleRequestedOwnedFiltered = restrictToFocusedItem
    ? ownedWithPendingRequests.filter((item) => item.id === activeItemId)
    : ownedWithPendingRequests;
  const visibleLoanedFiltered = restrictToFocusedItem
    ? visibleLoaned.filter((item) => item.id === activeItemId)
    : visibleLoaned;

  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Tabs.Root
        value={activeTab}
        display="flex"
        flexDirection="column"
        flex="1"
        minH="full"
        onValueChange={(details) => setActiveTab(parseTab(details.value))}
        variant="plain"
      >
        <Box flex="1" bg="sky.solid" px={{ base: "4", md: "6" }} py={{ base: "5", md: "6" }}>
          <Box
            maxW="4xl"
            w="100%"
            mx="auto"
            bg="gray.100"
            borderWidth="1px"
            borderColor="border"
            borderRadius="xl"
            overflow="hidden"
          >
            <Tabs.List
              px={{ base: "4", md: "6" }}
              pt={{ base: "4", md: "4" }}
              pb="0"
              borderBottomWidth="1px"
              borderColor="border"
              gap="1"
              w="100%"
            >
              <Tabs.Trigger
                value="my"
                bg={activeTab === "my" ? "lilypad.solid" : undefined}
                color={activeTab === "my" ? "black" : undefined}
                borderTopRadius="md"
                borderBottomRadius="0"
                px="4"
                py="2"
                fontWeight="medium"
                _hover={{ bg: activeTab === "my" ? "lilypad.solid" : "transparent" }}
                _selected={{ bg: "lilypad.solid", color: "black" }}
              >
                My Items
              </Tabs.Trigger>
              <Tabs.Trigger
                value="friends"
                bg={activeTab === "friends" ? "lilypad.solid" : undefined}
                color={activeTab === "friends" ? "black" : undefined}
                borderTopRadius="md"
                borderBottomRadius="0"
                px="4"
                py="2"
                fontWeight="medium"
                _hover={{ bg: activeTab === "friends" ? "lilypad.solid" : "transparent" }}
                _selected={{ bg: "lilypad.solid", color: "black" }}
              >
                Friends&apos; Items
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="my" p={{ base: "4", md: "6" }}>
              <Stack gap="4">
                <Text>Create and manage items you wish to allow your friends to borrow.</Text>

                {ownedNotice ? (
                  <HStack justify="flex-end">
                    <Text
                      fontSize={APP_TEXT_SIZES.helper}
                      color={ownedNotice.kind === "success" ? "green.600" : "red.600"}
                      fontWeight="medium"
                      textAlign="right"
                    >
                      {ownedNotice.message}
                    </Text>
                  </HStack>
                ) : null}

                {!isAddItemOpen &&
                  !restrictToFocusedItem &&
                  myItems.declined_by_me.length > 0 &&
                  visibleDeclinedFiltered.map((item) => (
                    <Box
                      key={`declined-${item.id}`}
                      bg="white"
                      borderWidth="1px"
                      borderStyle="dashed"
                      borderColor="border"
                      borderRadius="xl"
                      p="4"
                    >
                      <Stack gap="2">
                        <HStack gap="1">
                          <Text fontWeight="bold" color="orange.solid">
                            DECLINED REQUEST:
                          </Text>
                          <Text fontWeight="bold">{item.name}</Text>
                        </HStack>
                        <Text fontSize={APP_TEXT_SIZES.helper}>
                          Owner: {displayName(item.owner_user)} | Need by:{" "}
                          {item.my_declined_request?.date_needed_by ?? "—"}
                        </Text>
                        {item.my_declined_request?.message ? (
                          <Text fontSize={APP_TEXT_SIZES.helper}>
                            Your request: {item.my_declined_request.message}
                          </Text>
                        ) : null}
                        {item.my_declined_request?.decline_message ? (
                          <Text fontSize={APP_TEXT_SIZES.helper}>
                            Decline message: {item.my_declined_request.decline_message}
                          </Text>
                        ) : null}
                        {item.my_declined_request ? (
                          <HStack>
                            <PondButton
                              ref={
                                confirmDeleteDeclinedRequestItemId === item.id
                                  ? confirmDeleteDeclinedRequestButtonRef
                                  : undefined
                              }
                              size="sm"
                              colorPalette="nautical"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const declinedRequest = item.my_declined_request;
                                if (!declinedRequest) return;
                                if (confirmDeleteDeclinedRequestItemId !== item.id) {
                                  setConfirmCancelRequestItemId(null);
                                  setConfirmCancelMyRequestedItemId(null);
                                  setConfirmDeleteDeclinedRequestItemId(item.id);
                                  return;
                                }
                                try {
                                  const token = await getApiAccessToken();
                                  await deleteBorrowRequest(token, declinedRequest.id);
                                  setConfirmDeleteDeclinedRequestItemId(null);
                                  await refreshAll();
                                } catch (err: unknown) {
                                  setError(err instanceof Error ? err.message : "Failed to delete request");
                                }
                              }}
                            >
                              {confirmDeleteDeclinedRequestItemId === item.id
                                ? "Confirm delete"
                                : "Delete request"}
                            </PondButton>
                          </HStack>
                        ) : null}
                      </Stack>
                    </Box>
                  ))}
                {!isAddItemOpen && !restrictToFocusedItem && myItems.declined_by_me.length > MY_ITEMS_PAGE_SIZE ? (
                  <HStack justify="space-between">
                    <Text fontSize={APP_TEXT_SIZES.helper}>
                      Page {safeDeclinedPage} / {totalDeclinedPages}
                    </Text>
                    <HStack>
                      <PondButton
                        size="sm"
                        colorPalette="nautical"
                        disabled={safeDeclinedPage <= 1}
                        onClick={() => setDeclinedPage((p) => Math.max(1, p - 1))}
                      >
                        ←
                      </PondButton>
                      <PondButton
                        size="sm"
                        colorPalette="nautical"
                        disabled={safeDeclinedPage >= totalDeclinedPages}
                        onClick={() => setDeclinedPage((p) => Math.min(totalDeclinedPages, p + 1))}
                      >
                        →
                      </PondButton>
                    </HStack>
                  </HStack>
                ) : null}

                {!isAddItemOpen &&
                  !restrictToFocusedItem &&
                  myItems.custody_offered_to_me.length > 0 &&
                  visibleCustodyOfferedFiltered.map((item) => (
                    <Box
                      key={`custody-offer-${item.id}`}
                      bg="white"
                      borderWidth="1px"
                      borderStyle="dashed"
                      borderColor="border"
                      borderRadius="xl"
                      p="4"
                    >
                      <Stack gap="2">
                        <HStack gap="1">
                          <Text fontWeight="bold" color="sky.solid">
                            CUSTODY OFFERED:
                          </Text>
                          <Text fontWeight="bold">{item.name}</Text>
                        </HStack>
                        <Text fontSize={APP_TEXT_SIZES.helper}>
                          Owner: {displayName(item.owner_user)} wants you to hold this item.
                        </Text>
                        {item.description ? <Text fontSize={APP_TEXT_SIZES.helper}>{item.description}</Text> : null}
                        <HStack flexWrap="wrap">
                          <PondButton
                            size="sm"
                            colorPalette="lilypad"
                            onClick={async () => {
                              try {
                                const token = await getApiAccessToken();
                                await acceptCustody(token, item.id);
                                setOwnedNotice({ kind: "success", message: "Custody accepted." });
                                await refreshAll();
                              } catch (err: unknown) {
                                setError(err instanceof Error ? err.message : "Failed to accept custody");
                              }
                            }}
                          >
                            Accept custody
                          </PondButton>
                          <PondButton
                            size="sm"
                            colorPalette="nautical"
                            onClick={async () => {
                              try {
                                const token = await getApiAccessToken();
                                await rejectPendingCustody(token, item.id);
                                setOwnedNotice({ kind: "success", message: "Custody offer declined." });
                                await refreshAll();
                              } catch (err: unknown) {
                                setError(err instanceof Error ? err.message : "Failed to decline custody");
                              }
                            }}
                          >
                            Decline
                          </PondButton>
                        </HStack>
                      </Stack>
                    </Box>
                  ))}
                {!isAddItemOpen && !restrictToFocusedItem && myItems.custody_offered_to_me.length > MY_ITEMS_PAGE_SIZE ? (
                  <HStack justify="space-between">
                    <Text fontSize={APP_TEXT_SIZES.helper}>
                      Page {safeCustodyOfferedPage} / {totalCustodyOfferedPages}
                    </Text>
                    <HStack>
                      <PondButton
                        size="sm"
                        colorPalette="nautical"
                        disabled={safeCustodyOfferedPage <= 1}
                        onClick={() => setCustodyOfferedPage((p) => Math.max(1, p - 1))}
                      >
                        ←
                      </PondButton>
                      <PondButton
                        size="sm"
                        colorPalette="nautical"
                        disabled={safeCustodyOfferedPage >= totalCustodyOfferedPages}
                        onClick={() =>
                          setCustodyOfferedPage((p) => Math.min(totalCustodyOfferedPages, p + 1))
                        }
                      >
                        →
                      </PondButton>
                    </HStack>
                  </HStack>
                ) : null}

                {!isAddItemOpen && ownedWithPendingRequests.length > 0
                  ? visibleRequestedOwnedFiltered.map((item) => (
                      <ItemCard
                        key={`requested-owned-${item.id}`}
                        item={item}
                        meId={meId}
                        onRefresh={refreshAll}
                        getToken={getApiAccessToken}
                        custodyFriends={friendsForCustody}
                        onOwnedNotice={setOwnedNotice}
                        dashedBorder
                        titlePrefix={{
                          text: `${item.pending_request_count} ${
                            item.pending_request_count === 1 ? "REQUEST" : "REQUESTS"
                          }:`,
                          color: "orange.solid",
                        }}
                        showPendingCount={false}
                        onCardClick={() => {
                          const nextMode =
                            item.active_loan_id || item.pending_request_count > 0 ? "custody" : "edit";
                          setActiveItemId(item.id);
                          setActiveItemMode(nextMode);
                        }}
                        mode={activeItemId === item.id ? activeItemMode : "closed"}
                        onModeChange={(next) => {
                          if (next === "closed") {
                            setActiveItemId(null);
                            setActiveItemMode("closed");
                            return;
                          }
                          setActiveItemId(item.id);
                          setActiveItemMode(next);
                        }}
                      />
                    ))
                  : null}

                {!isAddItemOpen && myItems.borrowed_by_me.length > 0 ? (
                  <>
                    {visibleBorrowedFiltered.map((item) => (
                      <ItemCard
                        key={`borrowed-${item.id}`}
                        item={item}
                        meId={meId}
                        onRefresh={refreshAll}
                        getToken={getApiAccessToken}
                        custodyFriends={friendsForCustody}
                        onOwnedNotice={setOwnedNotice}
                        listKind="borrowed"
                        titlePrefix={{
                          text: `BORROWED FROM ${displayName(item.owner_user).toUpperCase()}:`,
                          color: "orange.solid",
                        }}
                        onCardClick={() => {
                          setActiveItemId(item.id);
                          setActiveItemMode("custody");
                        }}
                        mode={activeItemId === item.id ? activeItemMode : "closed"}
                        onModeChange={(next) => {
                          if (next === "closed") {
                            setActiveItemId(null);
                            setActiveItemMode("closed");
                            return;
                          }
                          setActiveItemId(item.id);
                          setActiveItemMode(next);
                        }}
                      />
                    ))}
                    {activeItemMode !== "edit" &&
                    activeItemId == null &&
                    myItems.borrowed_by_me.length > MY_ITEMS_PAGE_SIZE ? (
                      <HStack justify="space-between">
                        <Text fontSize={APP_TEXT_SIZES.helper}>
                          Page {safeBorrowedPage} / {totalBorrowedPages}
                        </Text>
                        <HStack>
                          <PondButton
                            size="sm"
                            colorPalette="nautical"
                            disabled={safeBorrowedPage <= 1}
                            onClick={() => setBorrowedPage((p) => Math.max(1, p - 1))}
                          >
                            ←
                          </PondButton>
                          <PondButton
                            size="sm"
                            colorPalette="nautical"
                            disabled={safeBorrowedPage >= totalBorrowedPages}
                            onClick={() => setBorrowedPage((p) => Math.min(totalBorrowedPages, p + 1))}
                          >
                            →
                          </PondButton>
                        </HStack>
                      </HStack>
                    ) : null}
                  </>
                ) : null}

                {!isAddItemOpen &&
                  !restrictToFocusedItem &&
                  myItems.requested_by_me.length > 0 &&
                  visibleRequested.map((item) => (
                  <Box
                    key={`requested-${item.id}`}
                    bg="white"
                    ref={(node: HTMLDivElement | null) => {
                      requestedByMeCardRefs.current[item.id] = node;
                    }}
                    borderWidth="1px"
                    borderStyle="dashed"
                    borderColor="border"
                    borderRadius="xl"
                    p="4"
                    cursor="pointer"
                    onClick={() => {
                      if (editingRequestItemId === item.id) {
                        setEditingRequestItemId(null);
                        setRequestingItemId(null);
                        setConfirmCancelMyRequestedItemId(null);
                        return;
                      }
                      setEditingRequestItemId(item.id);
                      setRequestingItemId(item.id);
                      setNewNeedBy(item.my_pending_request?.date_needed_by ?? "");
                      setNewRequestMessage(item.my_pending_request?.message ?? "");
                    }}
                  >
                    <Stack gap="2">
                      <HStack gap="1">
                        <Text fontWeight="bold" color="lilypad.solid">
                          PENDING APPROVAL:
                        </Text>
                        <Text fontWeight="bold">{item.name}</Text>
                      </HStack>
                      <Text fontSize={APP_TEXT_SIZES.helper}>
                        Owner: {displayName(item.owner_user)} | Need by:{" "}
                        {item.my_pending_request?.date_needed_by ?? "—"}
                      </Text>
                      {item.my_pending_request?.message ? (
                        <Text fontSize={APP_TEXT_SIZES.helper}>{item.my_pending_request.message}</Text>
                      ) : null}
                      {item.my_pending_request && editingRequestItemId === item.id ? (
                        <Stack gap="2" onClick={(event) => event.stopPropagation()}>
                          <HStack>
                            <Input
                              type="date"
                              value={requestingItemId === item.id ? newNeedBy : ""}
                              onChange={(e) => {
                                setRequestingItemId(item.id);
                                setNewNeedBy(e.target.value);
                              }}
                              maxW="200px"
                            />
                            <Input
                              value={requestingItemId === item.id ? newRequestMessage : ""}
                              onChange={(e) => {
                                setRequestingItemId(item.id);
                                setNewRequestMessage(e.target.value);
                              }}
                              placeholder="Optional message"
                              {...CLOSET_PLACEHOLDER_PROPS}
                            />
                            <PondButton
                              size="sm"
                              colorPalette="lilypad"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!newNeedBy) {
                                  setError("Need-by date is required.");
                                  return;
                                }
                                try {
                                  const token = await getApiAccessToken();
                                  await createBorrowRequest(token, item.id, {
                                    date_needed_by: newNeedBy,
                                    message: newRequestMessage.trim(),
                                  });
                                  setEditingRequestItemId(null);
                                  setRequestingItemId(null);
                                  setNewNeedBy("");
                                  setNewRequestMessage("");
                                  await refreshAll();
                                } catch (err: unknown) {
                                  setError(err instanceof Error ? err.message : "Failed to update request");
                                }
                              }}
                            >
                              Update request
                            </PondButton>
                            <PondButton
                              ref={
                                confirmCancelMyRequestedItemId === item.id
                                  ? confirmCancelMyRequestedButtonRef
                                  : undefined
                              }
                              size="sm"
                              colorPalette="orange"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (confirmCancelMyRequestedItemId !== item.id) {
                                  setConfirmCancelRequestItemId(null);
                                  setConfirmCancelMyRequestedItemId(item.id);
                                  return;
                                }
                                try {
                                  const token = await getApiAccessToken();
                                  await cancelBorrowRequest(token, item.my_pending_request!.id);
                                  setConfirmCancelMyRequestedItemId(null);
                                  setEditingRequestItemId(null);
                                  setRequestingItemId(null);
                                  setNewNeedBy("");
                                  setNewRequestMessage("");
                                  await refreshAll();
                                } catch (err: unknown) {
                                  setError(err instanceof Error ? err.message : "Failed to cancel request");
                                }
                              }}
                            >
                              {confirmCancelMyRequestedItemId === item.id
                                ? "Confirm cancel"
                                : "Cancel request"}
                            </PondButton>
                          </HStack>
                        </Stack>
                      ) : null}
                    </Stack>
                  </Box>
                  ))}
                {!isAddItemOpen && !restrictToFocusedItem && myItems.requested_by_me.length > MY_ITEMS_PAGE_SIZE ? (
                  <HStack justify="space-between">
                    <Text fontSize={APP_TEXT_SIZES.helper}>
                      Page {safeRequestedPage} / {totalRequestedPages}
                    </Text>
                    <HStack>
                      <PondButton
                        size="sm"
                        colorPalette="nautical"
                        disabled={safeRequestedPage <= 1}
                        onClick={() => setRequestedPage((p) => Math.max(1, p - 1))}
                      >
                        ←
                      </PondButton>
                      <PondButton
                        size="sm"
                        colorPalette="nautical"
                        disabled={safeRequestedPage >= totalRequestedPages}
                        onClick={() => setRequestedPage((p) => Math.min(totalRequestedPages, p + 1))}
                      >
                        →
                      </PondButton>
                    </HStack>
                  </HStack>
                ) : null}

                {!isAddItemOpen && loanedItems.length > 0 ? (
                  <>
                    {visibleLoanedFiltered.map((item) => (
                      <ItemCard
                        key={`loaned-${item.id}`}
                        item={item}
                        meId={meId}
                        onRefresh={refreshAll}
                        getToken={getApiAccessToken}
                        custodyFriends={friendsForCustody}
                        onOwnedNotice={setOwnedNotice}
                        titlePrefix={{
                          text: `LOANED TO ${displayName(item.current_holder_user).toUpperCase()}:`,
                          color: "lilypad.solid",
                          hideBorrowerLabel: true,
                        }}
                        onCardClick={() => {
                          const nextMode =
                            item.active_loan_id || item.pending_request_count > 0 ? "custody" : "edit";
                          setActiveItemId(item.id);
                          setActiveItemMode(nextMode);
                        }}
                        mode={activeItemId === item.id ? activeItemMode : "closed"}
                        onModeChange={(next) => {
                          if (next === "closed") {
                            setActiveItemId(null);
                            setActiveItemMode("closed");
                            return;
                          }
                          setActiveItemId(item.id);
                          setActiveItemMode(next);
                        }}
                      />
                    ))}
                    {activeItemMode !== "edit" &&
                    activeItemId == null &&
                    loanedItems.length > MY_ITEMS_PAGE_SIZE ? (
                      <HStack justify="space-between">
                        <Text fontSize={APP_TEXT_SIZES.helper}>
                          Page {safeLoanedPage} / {totalLoanedPages}
                        </Text>
                        <HStack>
                          <PondButton
                            size="sm"
                            colorPalette="nautical"
                            disabled={safeLoanedPage <= 1}
                            onClick={() => setLoanedPage((p) => Math.max(1, p - 1))}
                          >
                            ←
                          </PondButton>
                          <PondButton
                            size="sm"
                            colorPalette="nautical"
                            disabled={safeLoanedPage >= totalLoanedPages}
                            onClick={() => setLoanedPage((p) => Math.min(totalLoanedPages, p + 1))}
                          >
                            →
                          </PondButton>
                        </HStack>
                      </HStack>
                    ) : null}
                  </>
                ) : null}

                <>
                    {activeItemMode !== "edit" ? (
                      isAddItemOpen ? (
                        <Box bg="white" borderWidth="1px" borderColor="border" borderRadius="xl" p="4">
                          <Stack gap="3">
                            <Text fontWeight="semibold">Add Item</Text>
                            <Input
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              placeholder="Item name"
                              {...CLOSET_PLACEHOLDER_PROPS}
                            />
                            <Textarea
                              value={newDescription}
                              onChange={(e) => setNewDescription(e.target.value)}
                              placeholder="Description"
                              {...CLOSET_PLACEHOLDER_PROPS}
                            />
                            <HStack>
                              <PondButton
                                colorPalette="lilypad"
                                onClick={async () => {
                                  setError(null);
                                  try {
                                    const token = await getApiAccessToken();
                                    await createItem(token, {
                                      name: newName,
                                      description: newDescription,
                                    });
                                    setNewName("");
                                    setNewDescription("");
                                    setIsAddItemOpen(false);
                                    setOwnedPage(1);
                                    setActiveItemId(null);
                                    setActiveItemMode("closed");
                                    await refreshAll();
                                    setOwnedNotice({ kind: "success", message: "Item added." });
                                  } catch (err: unknown) {
                                    const message =
                                      err instanceof Error ? err.message : "Failed to create item";
                                    setOwnedNotice({ kind: "error", message });
                                  }
                                }}
                                disabled={!newName.trim()}
                              >
                                Save Item
                              </PondButton>
                              <PondButton
                                colorPalette="sky"
                                onClick={() => {
                                  setNewName("");
                                  setNewDescription("");
                                  setIsAddItemOpen(false);
                                }}
                              >
                                Cancel
                              </PondButton>
                            </HStack>
                          </Stack>
                        </Box>
                      ) : (
                        <HStack justify="flex-start">
                          <PondButton colorPalette="lilypad" onClick={() => setIsAddItemOpen(true)}>
                            Add Item
                          </PondButton>
                        </HStack>
                      )
                    ) : null}
                    <HStack align="center" gap="3" justify="space-between">
                      <Text fontWeight="semibold">Owned by me</Text>
                    </HStack>
                    {ownedWithoutPendingRequests.length === 0 ? (
                      <Text fontSize={APP_TEXT_SIZES.helper}>None.</Text>
                    ) : null}
                    {visibleOwnedFiltered.map((item) => (
                      <ItemCard
                        key={`owned-wrap-${item.id}`}
                        item={item}
                        meId={meId}
                        onRefresh={refreshAll}
                        getToken={getApiAccessToken}
                        custodyFriends={friendsForCustody}
                        onOwnedNotice={setOwnedNotice}
                        onCardClick={() => {
                          const nextMode =
                            item.active_loan_id || item.pending_request_count > 0 ? "custody" : "edit";
                          setActiveItemId(item.id);
                          setActiveItemMode(nextMode);
                        }}
                        mode={activeItemId === item.id ? activeItemMode : "closed"}
                        onModeChange={(next) => {
                          if (next === "closed") {
                            setActiveItemId(null);
                            setActiveItemMode("closed");
                            return;
                          }
                          setActiveItemId(item.id);
                          setActiveItemMode(next);
                        }}
                      />
                    ))}
                    {activeItemMode !== "edit" &&
                    activeItemId == null &&
                    ownedWithoutPendingRequests.length > MY_ITEMS_PAGE_SIZE ? (
                      <HStack justify="space-between">
                        <Text fontSize={APP_TEXT_SIZES.helper}>
                          Page {safeOwnedPage} / {totalOwnedPages}
                        </Text>
                        <HStack>
                          <PondButton
                            size="sm"
                            colorPalette="nautical"
                            disabled={safeOwnedPage <= 1}
                            onClick={() => setOwnedPage((p) => Math.max(1, p - 1))}
                          >
                            ←
                          </PondButton>
                          <PondButton
                            size="sm"
                            colorPalette="nautical"
                            disabled={safeOwnedPage >= totalOwnedPages}
                            onClick={() => setOwnedPage((p) => Math.min(totalOwnedPages, p + 1))}
                          >
                            →
                          </PondButton>
                        </HStack>
                      </HStack>
                    ) : null}
                  </>
              </Stack>
            </Tabs.Content>

            <Tabs.Content value="friends" p={{ base: "4", md: "6" }}>
              <Stack gap="4">
                <HStack justify="space-between" align="center" gap="3">
                  <Text>Click an item to see details and request to borrow.</Text>
                  {friendsNotice ? (
                    <Text
                      color={friendsNotice.kind === "success" ? "green.600" : "red.600"}
                      fontSize={APP_TEXT_SIZES.helper}
                      fontWeight="medium"
                      textAlign="right"
                    >
                      {friendsNotice.message}
                    </Text>
                  ) : null}
                </HStack>
                {friendsItems.length === 0 ? <Text>No items from friends yet.</Text> : null}
                {friendsItems.map((item) => {
                  const isCurrentlyBorrowedByMe =
                    item.current_holder_user.id === meId && item.owner_user.id !== meId;
                  return (
                  <Box
                    key={`friend-${item.id}`}
                    bg="white"
                    ref={(node: HTMLDivElement | null) => {
                      friendsCardRefs.current[item.id] = node;
                    }}
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="xl"
                    p="4"
                    cursor="pointer"
                    onClick={() =>
                      setExpandedFriendItemId((current) => (current === item.id ? null : item.id))
                    }
                  >
                    <Stack gap="2">
                      <HStack justify="space-between" align="start">
                        <HStack gap="1">
                          {item.pending_custody_user?.id === meId ? (
                            <Text fontWeight="bold" color="sky.solid">
                              CUSTODY OFFERED:
                            </Text>
                          ) : null}
                          {item.my_pending_request ? (
                            <Text fontWeight="bold" color="lilypad.solid">
                              REQUESTED:
                            </Text>
                          ) : null}
                          <Text fontWeight="bold">{item.name}</Text>
                        </HStack>
                        {item.my_pending_request ? null : item.pending_request_count > 0 ? (
                          <Text fontSize={APP_TEXT_SIZES.helper}>
                            {item.pending_request_count} outstanding{" "}
                            {item.pending_request_count === 1 ? "request" : "requests"}
                          </Text>
                        ) : null}
                      </HStack>
                      <Text fontSize={APP_TEXT_SIZES.helper}>
                        Owner: {displayName(item.owner_user)}
                        {item.current_holder_user.id !== item.owner_user.id
                          ? ` | Holding: ${displayName(item.current_holder_user)}`
                          : ""}
                      </Text>
                      {item.description ? <Text>{item.description}</Text> : null}
                      {expandedFriendItemId === item.id ? (
                        <Stack gap="2" onClick={(e) => e.stopPropagation()}>
                          {isCurrentlyBorrowedByMe ? (
                            <Text fontSize={APP_TEXT_SIZES.helper} color="orange.solid">
                              You are already borrowing this item.
                            </Text>
                          ) : null}
                          {item.my_pending_request && editingRequestItemId !== item.id ? (
                            <Stack gap="2">
                              <HStack>
                                <PondButton
                                  size="sm"
                                  colorPalette="lilypad"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingRequestItemId(item.id);
                                    setRequestingItemId(item.id);
                                    setNewNeedBy(item.my_pending_request?.date_needed_by ?? "");
                                    setNewRequestMessage(item.my_pending_request?.message ?? "");
                                  }}
                                >
                                  Edit request
                                </PondButton>
                              </HStack>
                            </Stack>
                          ) : null}

                          {!isCurrentlyBorrowedByMe &&
                          (!item.my_pending_request || editingRequestItemId === item.id) ? (
                            <HStack>
                              <Input
                                type="date"
                                value={requestingItemId === item.id ? newNeedBy : ""}
                                onChange={(e) => {
                                  setRequestingItemId(item.id);
                                  setNewNeedBy(e.target.value);
                                }}
                                maxW="200px"
                              />
                              <Input
                                value={requestingItemId === item.id ? newRequestMessage : ""}
                                onChange={(e) => {
                                  setRequestingItemId(item.id);
                                  setNewRequestMessage(e.target.value);
                                }}
                                placeholder="Optional message"
                                {...CLOSET_PLACEHOLDER_PROPS}
                              />
                              <PondButton
                                size="sm"
                                colorPalette="lilypad"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!newNeedBy) {
                                    setFriendsNotice({ kind: "error", message: "Need-by date is required." });
                                    return;
                                  }
                                  try {
                                    const token = await getApiAccessToken();
                                    await createBorrowRequest(token, item.id, {
                                      date_needed_by: newNeedBy,
                                      message: newRequestMessage.trim(),
                                    });
                                    setRequestingItemId(null);
                                    setEditingRequestItemId(null);
                                    setNewNeedBy("");
                                    setNewRequestMessage("");
                                    setFriendsNotice({
                                      kind: "success",
                                      message: item.my_pending_request ? "Borrow request updated." : "Borrow request sent.",
                                    });
                                setExpandedFriendItemId(null);
                                    await refreshAll();
                                setExpandedFriendItemId(item.id);
                                  } catch (err: unknown) {
                                    setFriendsNotice({
                                      kind: "error",
                                      message: err instanceof Error ? err.message : "Failed to request borrow",
                                    });
                                  }
                                }}
                              >
                                {item.my_pending_request ? "Update request" : "Request borrow"}
                              </PondButton>
                              {item.my_pending_request ? (
                                <PondButton
                                  ref={
                                    confirmCancelRequestItemId === item.id
                                      ? confirmCancelRequestButtonRef
                                      : undefined
                                  }
                                  size="sm"
                                  colorPalette="nautical"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirmCancelRequestItemId !== item.id) {
                                      setConfirmCancelMyRequestedItemId(null);
                                      setConfirmCancelRequestItemId(item.id);
                                      return;
                                    }
                                    try {
                                      const token = await getApiAccessToken();
                                      await cancelBorrowRequest(token, item.my_pending_request!.id);
                                      setConfirmCancelRequestItemId(null);
                                      setEditingRequestItemId(null);
                                      setRequestingItemId(null);
                                      setNewNeedBy("");
                                      setNewRequestMessage("");
                                      setFriendsNotice({ kind: "success", message: "Borrow request canceled." });
                                      setExpandedFriendItemId(null);
                                      await refreshAll();
                                      setExpandedFriendItemId(item.id);
                                    } catch (err: unknown) {
                                      setFriendsNotice({
                                        kind: "error",
                                        message: err instanceof Error ? err.message : "Failed to cancel request",
                                      });
                                    }
                                  }}
                                >
                                  {confirmCancelRequestItemId === item.id ? "Confirm cancel" : "Cancel request"}
                                </PondButton>
                              ) : null}
                            </HStack>
                          ) : null}
                        </Stack>
                      ) : null}
                    </Stack>
                  </Box>
                  );
                })}
                <HStack justify="space-between">
                  <Text fontSize={APP_TEXT_SIZES.helper}>
                    Page {friendsPage} / {totalFriendsPages}
                  </Text>
                  <HStack>
                    <PondButton
                      size="sm"
                      colorPalette="nautical"
                      disabled={friendsPage <= 1}
                      onClick={() => setFriendsPage((p) => Math.max(1, p - 1))}
                    >
                      ←
                    </PondButton>
                    <PondButton
                      size="sm"
                      colorPalette="nautical"
                      disabled={friendsPage >= totalFriendsPages}
                      onClick={() => setFriendsPage((p) => Math.min(totalFriendsPages, p + 1))}
                    >
                      →
                    </PondButton>
                  </HStack>
                </HStack>
              </Stack>
            </Tabs.Content>
          </Box>
        </Box>
      </Tabs.Root>
      {loading ? <Text px="6">Loading closet…</Text> : null}
      {error ? (
        <Text px="6" pb="4" color="red.600" role="alert">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}

