import {
  Box,
  HStack,
  Image,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Spinner,
  Stack,
  Tabs,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  validateClosetCategory,
  validateClosetFreeText,
  validateClosetItemName,
  validateClosetTagList,
} from "../forms/validation";
import PondButton from "../PondButton";
import { AppModal } from "../components/AppModal";
import { useIsMobile } from "../responsive";
import {
  APP_TEXT_SIZES,
  PANEL_FORM_PLACEHOLDER_PROPS,
} from "../theme/typography";
import {
  approveBorrowRequest,
  cancelPendingCustody,
  completeCustodyReturn,
  declineBorrowRequest,
  deleteItem,
  fetchBorrowRequests,
  fetchMyImageInventory,
  markReturnedByOwner,
  patchItem,
  setCustody,
} from "./api";
import { isAllowedClosetCategory } from "./categories";
import { ClosetCategoryFields } from "./ClosetCategoryFields";
import {
  CLOSET_MODAL_TAB_LIST_PROPS,
  closetModalTabTriggerProps,
} from "./closetModalTabs";
import { computeOrderedCustodyFriends } from "./closetOrderedCustodyFriends";
import { displayName, formatNeedByDateLabel, sameClosetUserId } from "./closetUtils";
import {
  resizeImageFileToJpegBlob,
  uploadClosetImageBlobViaPresign,
} from "./imageUpload";
import type { BorrowRequest, ClosetImageInventoryRow, ClosetItem } from "./types";

const CLOSET_PLACEHOLDER_PROPS = PANEL_FORM_PLACEHOLDER_PROPS;

export type CustodyFriendOption = { id: number; label: string };

type Notice = { kind: "success" | "error"; message: string };

export function ClosetOwnerManageModal({
  open,
  onOpenChange,
  item,
  custodyFriends,
  getToken,
  meId,
  onRefreshed,
  onNotice,
  initialTab,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ClosetItem;
  custodyFriends: CustodyFriendOption[];
  getToken: () => Promise<string>;
  meId: number;
  onRefreshed: () => Promise<void>;
  onNotice?: (n: Notice) => void;
  initialTab: "details" | "custody";
}) {
  const [activeTab, setActiveTab] = useState<"details" | "custody">(initialTab);
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description);
  const [category, setCategory] = useState(item.category);
  const [tagsCsv, setTagsCsv] = useState(item.tags.join(", "));
  const [error, setError] = useState<string | null>(null);
  const [borrowRows, setBorrowRows] = useState<BorrowRequest[] | null>(null);
  const [declineMessageByRequestId, setDeclineMessageByRequestId] = useState<
    Record<number, string>
  >({});
  const [custodyTargetUserId, setCustodyTargetUserId] = useState("");
  const [markReturnedBusy, setMarkReturnedBusy] = useState(false);
  const [imageUploadBusy, setImageUploadBusy] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imagePickerLoading, setImagePickerLoading] = useState(false);
  const [imagePickerRows, setImagePickerRows] = useState<ClosetImageInventoryRow[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmDeleteButtonRef = useRef<HTMLButtonElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [localImagePreviewUrl, setLocalImagePreviewUrl] = useState<string | null>(null);
  const localImagePreviewUrlRef = useRef<string | null>(null);
  localImagePreviewUrlRef.current = localImagePreviewUrl;
  const isMobile = useIsMobile();

  const isOwner = sameClosetUserId(item.owner_user.id, meId);

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

  useEffect(() => {
    return () => {
      const u = localImagePreviewUrlRef.current;
      if (u) URL.revokeObjectURL(u);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab);
    setError(null);
    setConfirmDelete(false);
    setDeclineMessageByRequestId({});
    setBorrowRows(null);
    setName(item.name);
    setDescription(item.description);
    setCategory(item.category);
    setTagsCsv(item.tags.join(", "));
    if (item.pending_custody_user) {
      setCustodyTargetUserId(String(item.pending_custody_user.id));
    } else {
      setCustodyTargetUserId(String(item.current_holder_user.id));
    }
  }, [open, initialTab, item.id]);

  useEffect(() => {
    if (!open) return;
    setName(item.name);
    setDescription(item.description);
    setCategory(item.category);
    setTagsCsv(item.tags.join(", "));
  }, [
    open,
    item.name,
    item.description,
    item.category,
    item.tags,
    item.updated_at,
  ]);

  const loadRequests = useCallback(async () => {
    const token = await getToken();
    const rows = await fetchBorrowRequests(token, item.id);
    setBorrowRows(rows);
  }, [getToken, item.id]);

  useEffect(() => {
    if (!open || !isOwner) return;
    void loadRequests();
  }, [open, isOwner, loadRequests]);

  const loadExistingImageRows = useCallback(async () => {
    setImagePickerLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const payload = await fetchMyImageInventory(token);
      const rows = payload.results.filter((row) => (row.image_url ?? "").trim().length > 0);
      setImagePickerRows(rows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load uploaded images");
    } finally {
      setImagePickerLoading(false);
    }
  }, [getToken]);

  const pendingRows = useMemo(
    () => (borrowRows ?? []).filter((r) => r.status === "pending"),
    [borrowRows],
  );

  const orderedCustodyFriends = useMemo(
    () => computeOrderedCustodyFriends(custodyFriends, item, pendingRows),
    [custodyFriends, item, pendingRows],
  );

  const apiImageUrl = (item.image_url ?? "").trim();
  const displayImageSrc = apiImageUrl || (localImagePreviewUrl ?? "").trim();

  const flushDetails = useCallback(async () => {
    if (!isOwner) return;
    setError(null);
    if (!isAllowedClosetCategory(category)) {
      setError("Category must use only letters and /, or pick a suggested option.");
      return;
    }
    const nameTrim = name.trim();
    const nameErr = validateClosetItemName(nameTrim);
    if (nameErr) {
      setError(nameErr);
      return;
    }
    const descErr = validateClosetFreeText(description, "Description");
    if (descErr) {
      setError(descErr);
      return;
    }
    const catTrim = category.trim();
    const catErr = validateClosetCategory(catTrim);
    if (catErr) {
      setError(catErr);
      return;
    }
    const tagParts = tagsCsv
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const tagErr = validateClosetTagList(tagParts);
    if (tagErr) {
      setError(tagErr);
      return;
    }
    const unchanged =
      nameTrim === item.name &&
      description.trim() === item.description &&
      catTrim === item.category.trim() &&
      tagParts.join(",") === item.tags.join(",");
    if (unchanged) return;
    try {
      const token = await getToken();
      await patchItem(token, item.id, {
        name: nameTrim,
        description: description.trim(),
        category: catTrim,
        tags: tagParts,
      });
      await onRefreshed();
      onNotice?.({ kind: "success", message: "Item saved." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update item";
      setError(message);
      onNotice?.({ kind: "error", message });
    }
  }, [
    isOwner,
    category,
    name,
    description,
    tagsCsv,
    item,
    getToken,
    onRefreshed,
    onNotice,
  ]);

  const patchCategoryNow = useCallback(
    async (nextCategory: string) => {
      if (!isOwner) return;
      setCategory(nextCategory);
      setError(null);
      if (!isAllowedClosetCategory(nextCategory)) {
        setError("Category must use only letters and /, or pick a suggested option.");
        return;
      }
      const catTrim = nextCategory.trim();
      const catErr = validateClosetCategory(catTrim);
      if (catErr) {
        setError(catErr);
        return;
      }
      if (catTrim === item.category.trim()) return;
      try {
        const token = await getToken();
        await patchItem(token, item.id, { category: catTrim });
        await onRefreshed();
        onNotice?.({ kind: "success", message: "Item saved." });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to update item";
        setError(message);
        onNotice?.({ kind: "error", message });
      }
    },
    [isOwner, item.category, item.id, getToken, onRefreshed, onNotice],
  );

  const onSetCurrentHolder = useCallback(
    async (nextHolderId: number) => {
      if (!isOwner) return;
      setError(null);
      if (!Number.isFinite(nextHolderId)) return;
      try {
        const token = await getToken();
        await setCustody(token, item.id, nextHolderId);
        await onRefreshed();
        if (nextHolderId === item.owner_user.id) {
          onNotice?.({ kind: "success", message: "Custody updated." });
        } else {
          onNotice?.({
            kind: "success",
            message: "Custody offer sent. They must accept before it takes effect.",
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to set custody";
        setError(message);
        onNotice?.({ kind: "error", message });
      }
    },
    [isOwner, item.id, item.owner_user.id, getToken, onRefreshed, onNotice],
  );

  const onMarkReturnedAsOwner = async () => {
    if (!canMarkReturnedAsOwner) return;
    setError(null);
    setMarkReturnedBusy(true);
    try {
      const token = await getToken();
      if (item.active_loan_id) {
        await markReturnedByOwner(token, item.active_loan_id);
        await onRefreshed();
        onNotice?.({ kind: "success", message: "Loan completed. You have custody." });
      } else if (item.custody_marked_returned_by_holder) {
        await completeCustodyReturn(token, item.id);
        await onRefreshed();
        onNotice?.({ kind: "success", message: "Handoff confirmed. You have custody." });
      } else {
        await setCustody(token, item.id, item.owner_user.id);
        await onRefreshed();
        onNotice?.({ kind: "success", message: "Custody updated." });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to mark returned";
      setError(message);
      onNotice?.({ kind: "error", message });
    } finally {
      setMarkReturnedBusy(false);
    }
  };

  const onCancelPendingCustody = async () => {
    setError(null);
    try {
      const token = await getToken();
      await cancelPendingCustody(token, item.id);
      await onRefreshed();
      onNotice?.({ kind: "success", message: "Custody offer canceled." });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to cancel offer");
    }
  };

  const onDelete = async () => {
    setError(null);
    try {
      const token = await getToken();
      await deleteItem(token, item.id);
      onOpenChange(false);
      await onRefreshed();
      onNotice?.({ kind: "success", message: "Item deleted." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete item";
      setError(message);
      onNotice?.({ kind: "error", message });
    }
  };

  const handleModalOpenChange = (next: boolean) => {
    if (!next) {
      void flushDetails();
    }
    onOpenChange(next);
  };

  if (!isOwner) return null;

  return (
    <AppModal
      open={open}
      onOpenChange={handleModalOpenChange}
      title="Manage item"
      size="lg"
      positionerProps={
        isMobile
          ? { px: "0", py: "0", alignItems: "stretch", justifyContent: "center" }
          : undefined
      }
      contentProps={
        isMobile
          ? {
              maxW: "100vw",
              w: "100vw",
              minH: "100dvh",
              borderRadius: "0",
              borderWidth: "0",
            }
          : undefined
      }
    >
      <Tabs.Root
        value={activeTab}
        onValueChange={(d) => setActiveTab(d.value === "custody" ? "custody" : "details")}
        variant="plain"
      >
        <Tabs.List {...CLOSET_MODAL_TAB_LIST_PROPS}>
          <Tabs.Trigger {...closetModalTabTriggerProps(activeTab, "details")}>
            Edit details
          </Tabs.Trigger>
          <Tabs.Trigger {...closetModalTabTriggerProps(activeTab, "custody")}>
            Manage custody
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="details" pt="3">
          <Stack
            gap="3"
            onMouseDownCapture={(event) => {
              if (!confirmDelete) return;
              const target = event.target as Node | null;
              if (!target) return;
              if (confirmDeleteButtonRef.current?.contains(target)) return;
              setConfirmDelete(false);
            }}
          >
            {displayImageSrc ? (
              <Stack gap="1" align="stretch">
                <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
                  Current photo
                </Text>
                <Image
                  src={displayImageSrc}
                  alt=""
                  aria-hidden
                  maxH="220px"
                  objectFit="cover"
                  borderRadius="md"
                />
              </Stack>
            ) : null}
            <Stack gap="1" align="stretch">
              <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
                Item name
              </Text>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => void flushDetails()}
                placeholder="Name"
                {...CLOSET_PLACEHOLDER_PROPS}
              />
            </Stack>
            <Stack gap="1" align="stretch">
              <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
                Description
              </Text>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => void flushDetails()}
                placeholder="Description"
                {...CLOSET_PLACEHOLDER_PROPS}
              />
            </Stack>
            <ClosetCategoryFields
              category={category}
              onCategoryChange={(v) => void patchCategoryNow(v)}
            />
            <Stack gap="1" align="stretch">
              <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
                Tags (comma-separated)
              </Text>
              <Input
                value={tagsCsv}
                onChange={(e) => setTagsCsv(e.target.value)}
                onBlur={() => void flushDetails()}
                placeholder="tag1, tag2"
                {...CLOSET_PLACEHOLDER_PROPS}
              />
            </Stack>
            <Stack gap="1" align="stretch">
              <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
                Photo
              </Text>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  void (async () => {
                    setError(null);
                    setImageUploadBusy(true);
                    let previewUrl: string | null = null;
                    try {
                      const blob = await resizeImageFileToJpegBlob(f);
                      previewUrl = URL.createObjectURL(blob);
                      setLocalImagePreviewUrl((prev) => {
                        if (prev) URL.revokeObjectURL(prev);
                        return previewUrl;
                      });
                      const key = await uploadClosetImageBlobViaPresign(getToken, blob);
                      const token = await getToken();
                      await patchItem(token, item.id, { image_key: key });
                      await onRefreshed();
                      onNotice?.({ kind: "success", message: "Photo updated." });
                    } catch (err: unknown) {
                      if (previewUrl) {
                        URL.revokeObjectURL(previewUrl);
                        setLocalImagePreviewUrl((prev) => (prev === previewUrl ? null : prev));
                      }
                      setError(err instanceof Error ? err.message : "Failed to upload photo");
                    } finally {
                      setImageUploadBusy(false);
                    }
                  })();
                }}
              />
              <HStack flexWrap="wrap" gap="2">
                <PondButton
                  type="button"
                  size="sm"
                  colorPalette="sky"
                  loading={imageUploadBusy}
                  onClick={() => photoInputRef.current?.click()}
                >
                  Upload new photo
                </PondButton>
                <PondButton
                  type="button"
                  size="sm"
                  colorPalette="teal"
                  loading={imagePickerLoading}
                  disabled={imageUploadBusy}
                  onClick={() => {
                    setImagePickerOpen((prev) => !prev);
                    if (!imagePickerOpen) void loadExistingImageRows();
                  }}
                >
                  Select uploaded image
                </PondButton>
                {item.image_url?.trim() || item.image_key?.trim() ? (
                  <PondButton
                    type="button"
                    size="sm"
                    colorPalette="nautical"
                    loading={imageUploadBusy}
                    onClick={() =>
                      void (async () => {
                        setError(null);
                        setImageUploadBusy(true);
                        try {
                          const token = await getToken();
                          await patchItem(token, item.id, { image_key: "" });
                          setLocalImagePreviewUrl((prev) => {
                            if (prev) URL.revokeObjectURL(prev);
                            return null;
                          });
                          await onRefreshed();
                          onNotice?.({ kind: "success", message: "Photo removed." });
                        } catch (err: unknown) {
                          setError(err instanceof Error ? err.message : "Failed to remove photo");
                        } finally {
                          setImageUploadBusy(false);
                        }
                      })()
                    }
                  >
                    Remove photo
                  </PondButton>
                ) : null}
              </HStack>
              {imagePickerOpen ? (
                <Stack gap="2" borderWidth="1px" borderColor="border" borderRadius="md" p="2">
                  <Text fontSize={APP_TEXT_SIZES.helper} color="gray.600">
                    Choose from your uploaded images (tap to apply).
                  </Text>
                  {imagePickerRows.length === 0 ? (
                    <Text fontSize={APP_TEXT_SIZES.helper} color="gray.600">
                      No uploaded images available
                    </Text>
                  ) : (
                    <HStack flexWrap="wrap" gap="2" align="stretch">
                      {imagePickerRows.map((row) => (
                        <Box
                          key={row.image_key}
                          as="button"
                          borderWidth="2px"
                          borderColor="teal.solid"
                          borderRadius="md"
                          overflow="hidden"
                          onClick={() =>
                            void (async () => {
                              setError(null);
                              setImageUploadBusy(true);
                              try {
                                const token = await getToken();
                                await patchItem(token, item.id, { image_key: row.image_key });
                                await onRefreshed();
                                setImagePickerOpen(false);
                                onNotice?.({ kind: "success", message: "Photo updated." });
                              } catch (err: unknown) {
                                setError(
                                  err instanceof Error ? err.message : "Failed to update photo",
                                );
                              } finally {
                                setImageUploadBusy(false);
                              }
                            })()
                          }
                        >
                          <Image
                            src={row.image_url}
                            alt=""
                            aria-hidden
                            w="84px"
                            h="84px"
                            objectFit="cover"
                            draggable={false}
                          />
                        </Box>
                      ))}
                    </HStack>
                  )}
                </Stack>
              ) : null}
              {imageUploadBusy ? (
                <HStack gap="2" align="center" color="gray.700">
                  <Spinner size="sm" colorPalette="teal" />
                  <Text fontSize={APP_TEXT_SIZES.helper}>Uploading photo…</Text>
                </HStack>
              ) : null}
              <Text fontSize={APP_TEXT_SIZES.helper} color="gray.600">
                JPEG, PNG, or WebP. Images are resized in the browser before upload.
              </Text>
            </Stack>
            <HStack>
              <Box flex="1" />
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
            </HStack>
          </Stack>
        </Tabs.Content>
        <Tabs.Content value="custody" pt="3">
          <Stack gap="3" onClick={(event) => event.stopPropagation()}>
            {pendingRows.length > 0 ? (
              <Stack>
                {pendingRows.map((row) => (
                  <Box key={row.id} borderWidth="1px" borderColor="border" borderRadius="md" p="2">
                    <Stack gap="1">
                      <Text fontSize={APP_TEXT_SIZES.helper}>
                        {displayName(row.requester_user)} would like to borrow{" "}
                        {displayName(item.owner_user)}
                        {"'s"} item before {formatNeedByDateLabel(row.date_needed_by)}
                        {row.message ? `: '${row.message}.'` : "."}
                      </Text>
                      <HStack justify="space-between" align="end" gap="3" flexWrap="wrap">
                        <PondButton
                          size="sm"
                          colorPalette="teal"
                          onClick={async () => {
                            try {
                              const token = await getToken();
                              await approveBorrowRequest(token, row.id);
                              await onRefreshed();
                              await loadRequests();
                            } catch (err: unknown) {
                              setError(
                                err instanceof Error ? err.message : "Failed to approve request",
                              );
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
                              const dmErr = validateClosetFreeText(
                                declineMessageByRequestId[row.id] ?? "",
                                "Decline message",
                              );
                              if (dmErr) {
                                setError(dmErr);
                                return;
                              }
                              const dm = (declineMessageByRequestId[row.id] ?? "").trim();
                              try {
                                const token = await getToken();
                                await declineBorrowRequest(token, row.id, {
                                  decline_message: dm,
                                });
                                setDeclineMessageByRequestId((prev) => ({
                                  ...prev,
                                  [row.id]: "",
                                }));
                                await onRefreshed();
                                await loadRequests();
                              } catch (err: unknown) {
                                setError(
                                  err instanceof Error ? err.message : "Failed to decline request",
                                );
                              }
                            }}
                          >
                            Decline
                          </PondButton>
                        </HStack>
                      </HStack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            ) : null}
            {item.pending_custody_user ? (
              <HStack>
                <PondButton size="sm" colorPalette="nautical" onClick={() => void onCancelPendingCustody()}>
                  Cancel custody offer
                </PondButton>
              </HStack>
            ) : null}
            {item.active_loan_id ? (
              <Text fontSize={APP_TEXT_SIZES.helper}>
                When the borrower gives the item back, use{" "}
                <Text as="span" fontWeight="semibold">
                  Mark returned
                </Text>{" "}
                to close the active loan and put custody back on you.
              </Text>
            ) : null}
            {!item.active_loan_id && item.custody_marked_returned_by_holder ? (
              <Text fontSize={APP_TEXT_SIZES.helper}>
                The holder said they returned this item. Use{" "}
                <Text as="span" fontWeight="semibold">
                  Mark returned
                </Text>{" "}
                to put custody back on you once you have it.
              </Text>
            ) : null}
            <HStack flexWrap="wrap">
              {item.active_loan_id ? (
                <PondButton size="sm" colorPalette="teal" onClick={() => void onMarkReturnedAsOwner()}>
                  Mark returned (complete loan)
                </PondButton>
              ) : null}
              {!item.active_loan_id && item.custody_marked_returned_by_holder ? (
                <PondButton size="sm" colorPalette="teal" onClick={() => void onMarkReturnedAsOwner()}>
                  Mark returned (complete handoff)
                </PondButton>
              ) : null}
            </HStack>
            <Stack gap="2">
              {item.active_loan_id ? (
                <Text fontSize={APP_TEXT_SIZES.helper} color="orange.solid">
                  While a loan is active, prefer Mark returned when the item is back. Change holder
                  here only if you need to correct who has the item without closing the loan yet.
                </Text>
              ) : item.custody_marked_returned_by_holder ? (
                <Text fontSize={APP_TEXT_SIZES.helper} color="orange.solid">
                  The holder marked a return. Prefer Mark returned above before changing holder
                  here.
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
                    onChange={(e) => {
                      const v = e.target.value;
                      const nextId = Number(v);
                      if (!Number.isFinite(nextId)) return;
                      setCustodyTargetUserId(v);
                      if (
                        nextId === item.current_holder_user.id &&
                        !item.pending_custody_user
                      ) {
                        return;
                      }
                      void onSetCurrentHolder(nextId);
                    }}
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
                <PondButton
                  size="sm"
                  colorPalette="teal"
                  loading={markReturnedBusy}
                  disabled={!canMarkReturnedAsOwner}
                  onClick={() => void onMarkReturnedAsOwner()}
                >
                  Mark returned
                </PondButton>
              </HStack>
            </Stack>
          </Stack>
        </Tabs.Content>
      </Tabs.Root>
      {error ? (
        <Text role="alert" color="nautical.solid" fontSize={APP_TEXT_SIZES.helper} mt="2">
          {error}
        </Text>
      ) : null}
    </AppModal>
  );
}
