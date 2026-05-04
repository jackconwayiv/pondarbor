import {
  Box,
  Card,
  Collapsible,
  HStack,
  Image,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Spinner,
  Stack,
  Tag,
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
import {
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FORM_PLACEHOLDER_PROPS,
} from "../theme/typography";
import {
  approveBorrowRequest,
  cancelPendingCustody,
  completeCustodyReturn,
  declineBorrowRequest,
  deleteItem,
  fetchMyImageInventory,
  markReturnedByOwner,
  patchItem,
  setCustody,
} from "./api";
import { isAllowedClosetCategory } from "./categories";
import { ClosetCategoryFields } from "./ClosetCategoryFields";
import { computeOrderedCustodyFriends } from "./closetOrderedCustodyFriends";
import {
  displayName,
  formatCategoryTagsSummaryLine,
  formatNeedByDateLabel,
  sameClosetUserId,
} from "./closetUtils";
import {
  resizeImageFileToJpegBlob,
  uploadClosetImageBlobViaPresign,
} from "./imageUpload";
import { ClosetItemModalTopNav, type ClosetItemModalNav } from "./ClosetItemModalFooter";
import type { ClosetImageInventoryRow, ClosetItem } from "./types";

const CLOSET_PLACEHOLDER_PROPS = PANEL_FORM_PLACEHOLDER_PROPS;

export type CustodyFriendOption = { id: number; label: string };

type Notice = { kind: "success" | "error"; message: string };

export function ClosetOwnerManagePanel({
  open,
  onClose,
  item,
  custodyFriends,
  getToken,
  meId,
  onRefreshed,
  onNotice,
  itemNav,
}: {
  open: boolean;
  /** Called after item delete (e.g. close modal or clear inline selection). */
  onClose?: () => void;
  item: ClosetItem;
  custodyFriends: CustodyFriendOption[];
  getToken: () => Promise<string>;
  meId: number;
  onRefreshed: (nextItem?: ClosetItem) => Promise<void>;
  onNotice?: (n: Notice) => void;
  itemNav?: ClosetItemModalNav | null;
}) {
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
  const [manageCustodyOpen, setManageCustodyOpen] = useState(false);
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description);
  const [category, setCategory] = useState(item.category);
  const [tagsCsv, setTagsCsv] = useState(item.tags.join(", "));
  const [error, setError] = useState<string | null>(null);
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
  const prevOpenRef = useRef(open);

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
    setEditDetailsOpen(false);
    setManageCustodyOpen(false);
    setError(null);
    setConfirmDelete(false);
    setDeclineMessageByRequestId({});
    setName(item.name);
    setDescription(item.description);
    setCategory(item.category);
    setTagsCsv(item.tags.join(", "));
    if (item.pending_custody_user) {
      setCustodyTargetUserId(String(item.pending_custody_user.id));
    } else {
      setCustodyTargetUserId(String(item.current_holder_user.id));
    }
    // Intentionally keyed by item.id so opening the panel resets fields for that item only.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- full item.* sync would re-reset on every patch
  }, [open, item.id]);

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
    () =>
      (item.pending_borrow_requests ?? []).filter((r) => r.status === "pending"),
    [item.pending_borrow_requests],
  );

  const orderedCustodyFriends = useMemo(
    () => computeOrderedCustodyFriends(custodyFriends, item, pendingRows),
    [custodyFriends, item, pendingRows],
  );

  const apiImageUrl = (item.image_url ?? "").trim();
  const displayImageSrc = apiImageUrl || (localImagePreviewUrl ?? "").trim();
  const hasHeroImage = Boolean(displayImageSrc);
  const categoryLine = formatCategoryTagsSummaryLine(item);
  const tagParts = item.tags.map((t) => t.trim()).filter(Boolean);

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
      const updated = await patchItem(token, item.id, {
        name: nameTrim,
        description: description.trim(),
        category: catTrim,
        tags: tagParts,
      });
      await onRefreshed(updated);
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

  useEffect(() => {
    const prev = prevOpenRef.current;
    prevOpenRef.current = open;
    if (prev && !open) {
      void flushDetails();
    }
  }, [open, flushDetails]);

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
        const updated = await patchItem(token, item.id, { category: catTrim });
        await onRefreshed(updated);
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
        const updated = await setCustody(token, item.id, nextHolderId);
        await onRefreshed(updated);
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
        const updated = await completeCustodyReturn(token, item.id);
        await onRefreshed(updated);
        onNotice?.({ kind: "success", message: "Handoff confirmed. You have custody." });
      } else {
        const updated = await setCustody(token, item.id, item.owner_user.id);
        await onRefreshed(updated);
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
      const updated = await cancelPendingCustody(token, item.id);
      await onRefreshed(updated);
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
      onClose?.();
      await onRefreshed();
      onNotice?.({ kind: "success", message: "Item deleted." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete item";
      setError(message);
      onNotice?.({ kind: "error", message });
    }
  };

  if (!isOwner) return null;

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
                <Image
                  src={displayImageSrc}
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
            <Stack gap="2">
              <HStack flexWrap="wrap" gap="2" align="flex-start">
                {item.pending_request_count > 0 ? (
                  <Tag.Root size="sm" bg="lilypad.solid" color="fg" borderWidth="0">
                    <Tag.Label fontWeight="bold">REQUESTS</Tag.Label>
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
                    <Tag.Root key={tag} size="sm" bg="bg.muted" color="fg.muted" borderWidth="0">
                      <Tag.Label>{tag}</Tag.Label>
                    </Tag.Root>
                  ))}
                </HStack>
              ) : null}
            </Stack>
            <Stack gap="2" w="100%" pt="2" borderTopWidth="1px" borderColor="border">
              <Collapsible.Root
                open={editDetailsOpen}
                onOpenChange={(d: { open: boolean }) => setEditDetailsOpen(d.open)}
              >
                <Collapsible.Trigger asChild>
                  <button
                    type="button"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      width: "100%",
                      textAlign: "left",
                      fontSize: "1rem",
                      fontWeight: 600,
                      color: "inherit",
                      cursor: "pointer",
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      margin: 0,
                    }}
                  >
                    <Text
                      as="span"
                      transform={editDetailsOpen ? "rotate(90deg)" : "rotate(0deg)"}
                      transition="transform 0.15s ease"
                      lineHeight="1"
                      flexShrink={0}
                    >
                      ›
                    </Text>
                    <Text as="span" flex="1">
                      Edit details
                    </Text>
                  </button>
                </Collapsible.Trigger>
                <Collapsible.Content>
                  <Stack
                    gap="3"
                    pt="3"
                    onMouseDownCapture={(event) => {
                      if (!confirmDelete) return;
                      const target = event.target as Node | null;
                      if (!target) return;
                      if (confirmDeleteButtonRef.current?.contains(target)) return;
                      setConfirmDelete(false);
                    }}
                  >
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
                      const updated = await patchItem(token, item.id, { image_key: key });
                      await onRefreshed(updated);
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
                          const updated = await patchItem(token, item.id, { image_key: "" });
                          setLocalImagePreviewUrl((prev) => {
                            if (prev) URL.revokeObjectURL(prev);
                            return null;
                          });
                          await onRefreshed(updated);
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
                                const updated = await patchItem(token, item.id, { image_key: row.image_key });
                                await onRefreshed(updated);
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
                </Collapsible.Content>
              </Collapsible.Root>
              <Collapsible.Root
                open={manageCustodyOpen}
                onOpenChange={(d: { open: boolean }) => setManageCustodyOpen(d.open)}
              >
                <Collapsible.Trigger asChild>
                  <button
                    type="button"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      width: "100%",
                      textAlign: "left",
                      fontSize: "1rem",
                      fontWeight: 600,
                      color: "inherit",
                      cursor: "pointer",
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      margin: 0,
                    }}
                  >
                    <Text
                      as="span"
                      transform={manageCustodyOpen ? "rotate(90deg)" : "rotate(0deg)"}
                      transition="transform 0.15s ease"
                      lineHeight="1"
                      flexShrink={0}
                    >
                      ›
                    </Text>
                    <Text as="span" flex="1">
                      Manage custody
                    </Text>
                  </button>
                </Collapsible.Trigger>
                <Collapsible.Content>
                  <Stack gap="3" pt="3" onClick={(event) => event.stopPropagation()}>
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
                </Collapsible.Content>
              </Collapsible.Root>
            </Stack>
          </Stack>
        </Card.Body>
      </Card.Root>
      {error ? (
        <Text role="alert" color="nautical.solid" fontSize={APP_TEXT_SIZES.helper} mt="2">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}
