import {
  Box,
  Collapsible,
  HStack,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Stack,
  Tag,
  Text,
  Textarea,
  Tabs,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import PondButton from "../PondButton";
import { useAppSession } from "../auth/AppSessionContext";
import { fullBleedStackProps, usePrefersCoarsePointer } from "../responsive";
import { APP_TEXT_SIZES, FIELD_PLACEHOLDER_PROPS } from "../theme/typography";
import PublicQuotesPage from "./PublicQuotesPage";
import QuoteCardBase from "./QuoteCardBase";
import {
  createQuote,
  deleteQuote,
  fetchMyQuoteFeed,
  fetchQuoteLabels,
  patchQuote,
} from "./api";
import { quoteOwnerDisplayLabel } from "./ownerDisplay";
import type { Quote, QuoteCreatePayload, QuoteLabel, QuotePatchPayload } from "./types";
import { fetchFriendsList, searchFriends, type FriendUser } from "../friends/api";

const PAGE_SIZE = 10;
type QuoteTab = "add" | "my" | "published";

function parseQuoteTab(value: string | null, isApproved: boolean): QuoteTab {
  if (value === "my") return value;
  if (value === "published" || value === "public") return isApproved ? "published" : "add";
  return "add";
}

const PLACEHOLDER_QUICK_BODY = "Paste or type a quote...";
const PLACEHOLDER_TAGS = "poetry, lyrics, musings";
const PLACEHOLDER_ATTRIBUTION_NAMES = "David Bowie, Cormac McCarthy";
const PLACEHOLDER_ATTRIBUTION_EMAILS = "tag a friend by nickname or email";

function parseCsv(raw: string): string[] {
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function normalizeCsv(raw: string): string {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const item of parseCsv(raw)) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(item);
  }
  return next.join(", ");
}

/** API stores full `User.email` in label `name` for linked attributions; use `email` in payloads only for strings that look like addresses (DRF validates `email`). */
function isLikelyEmail(value: string): boolean {
  const v = value.trim();
  return v.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function attributionInputFromValue(
  value: string,
  friendLookup?: Map<string, number>,
): {
  kind: "attribution";
  name?: string;
  email?: string;
  friend_user_id?: number;
} {
  const trimmed = value.trim();
  const friendUserId = friendLookup?.get(trimmed.toLowerCase());
  if (friendUserId) {
    return { kind: "attribution", friend_user_id: friendUserId, name: trimmed };
  }
  if (isLikelyEmail(trimmed)) {
    return { kind: "attribution", email: trimmed.toLowerCase() };
  }
  return { kind: "attribution", name: trimmed };
}

function appendCsvValue(existing: string, value: string): string {
  const items = parseCsv(existing);
  if (items.some((x) => x.toLowerCase() === value.toLowerCase())) {
    return existing;
  }
  return items.length === 0 ? value : `${items.join(", ")}, ${value}`;
}

function removeCsvValue(existing: string, value: string): string {
  const needle = value.trim().toLowerCase();
  const next = parseCsv(existing).filter((x) => x.toLowerCase() !== needle);
  return next.join(", ");
}

function toggleCsvValue(existing: string, value: string): string {
  return csvHasValue(existing, value)
    ? removeCsvValue(existing, value)
    : appendCsvValue(existing, value);
}

function csvHasValue(existing: string, value: string): boolean {
  const needle = value.trim().toLowerCase();
  return parseCsv(existing).some((x) => x.toLowerCase() === needle);
}

function labelsToCsv(quote: Quote) {
  const tagNames = quote.labels.filter((l) => l.kind === "tag").map((l) => l.name);
  const attributionNames = quote.labels
    .filter((l) => l.kind === "attribution" && !l.linked_user_id)
    .map((l) => l.name);
  const attributionEmails = quote.labels
    .filter((l) => l.kind === "attribution" && !!l.linked_user_id)
    .map((l) => l.name);
  return {
    tags: tagNames.join(", "),
    attributionNames: attributionNames.join(", "),
    attributionEmails: attributionEmails.join(", "),
  };
}

function mergeSuggestionLabels(
  existing: QuoteLabel[],
  incoming: QuoteLabel[],
  kind: "tag" | "attribution",
): QuoteLabel[] {
  const seen = new Set(
    existing
      .filter((l) => l.kind === kind)
      .map((l) => `${l.kind}|${l.name.toLowerCase()}|${l.linked_user_id ?? ""}`),
  );
  const next = [...existing];
  for (const label of incoming) {
    if (label.kind !== kind) continue;
    const key = `${label.kind}|${label.name.toLowerCase()}|${label.linked_user_id ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(label);
  }
  return next;
}

function isAuthFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  if (msg.includes("pending approval")) return false;
  return msg.includes("(401)") || msg.includes("(403)");
}

function QuoteCard({
  quote,
  getApiAccessToken,
  viewerUserId,
  onQuoteUpdated,
  onQuoteDeleted,
  onSuggestionsChanged,
  onSessionMayNeedRefresh,
  tagSuggestions,
  attributionSuggestions,
  friendLookup,
  isEditing,
  onBeginEditing,
  onEndEditing,
}: {
  quote: Quote;
  getApiAccessToken: () => Promise<string>;
  viewerUserId: number | null;
  onQuoteUpdated: (next: Quote) => void;
  onQuoteDeleted: (quoteId: number) => void;
  onSuggestionsChanged: () => Promise<void>;
  onSessionMayNeedRefresh?: () => Promise<void>;
  tagSuggestions: QuoteLabel[];
  attributionSuggestions: QuoteLabel[];
  friendLookup: Map<string, number>;
  isEditing: boolean;
  onBeginEditing: () => void;
  onEndEditing: () => void;
}) {
  const canEdit = viewerUserId != null && quote.owner.id === viewerUserId;
  const defaults = useMemo(() => labelsToCsv(quote), [quote]);
  const [editBody, setEditBody] = useState(quote.body);
  const [editVisibility, setEditVisibility] = useState<"private" | "published">(quote.visibility);
  const [editDateOfQuote, setEditDateOfQuote] = useState(quote.date_of_quote ?? "");
  const [editTagsCsv, setEditTagsCsv] = useState(defaults.tags);
  const [editAttributionNamesCsv, setEditAttributionNamesCsv] = useState(
    defaults.attributionNames,
  );
  const [editAttributionEmailsCsv, setEditAttributionEmailsCsv] = useState(
    defaults.attributionEmails,
  );
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [cardSuccess, setCardSuccess] = useState<string | null>(null);
  const prefersCoarsePointer = usePrefersCoarsePointer();
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const confirmDeleteButtonRef = useRef<HTMLButtonElement | null>(null);
  const isDirty =
    editBody.trim() !== quote.body.trim() ||
    editVisibility !== quote.visibility ||
    (editDateOfQuote || "") !== (quote.date_of_quote || "") ||
    editTagsCsv.trim() !== defaults.tags.trim() ||
    editAttributionNamesCsv.trim() !== defaults.attributionNames.trim() ||
    editAttributionEmailsCsv.trim() !== defaults.attributionEmails.trim();

  const resetEdit = useCallback(() => {
    const nextDefaults = labelsToCsv(quote);
    setEditBody(quote.body);
    setEditVisibility(quote.visibility);
    setEditDateOfQuote(quote.date_of_quote ?? "");
    setEditTagsCsv(nextDefaults.tags);
    setEditAttributionNamesCsv(nextDefaults.attributionNames);
    setEditAttributionEmailsCsv(nextDefaults.attributionEmails);
    setEditError(null);
  }, [quote]);

  const cancelEditing = useCallback(() => {
    resetEdit();
    onEndEditing();
    setConfirmDelete(false);
    setDeleteError(null);
  }, [onEndEditing, resetEdit]);

  const onSaveEdit = async () => {
    if (!canEdit) {
      setEditError("Only the owner can edit this quote.");
      return;
    }
    const trimmedBody = editBody.trim();
    if (!trimmedBody) {
      setEditError("Quote body cannot be empty.");
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    setCardSuccess(null);
    try {
      const tags = parseCsv(editTagsCsv);
      const attributionNames = parseCsv(editAttributionNamesCsv);
      const attributionEmailsOrLinkedNames = parseCsv(editAttributionEmailsCsv);
      const labelsPayload: NonNullable<QuotePatchPayload["labels"]> = [
        ...tags.map((name) => ({ kind: "tag" as const, name })),
        ...attributionNames.map((name) => ({ kind: "attribution" as const, name })),
        ...attributionEmailsOrLinkedNames.map((v) => attributionInputFromValue(v, friendLookup)),
      ];

      const payload: QuotePatchPayload = {
        body: trimmedBody,
        visibility: editVisibility,
        date_of_quote: editDateOfQuote || null,
        labels: labelsPayload,
      };
      const token = await getApiAccessToken();
      const updated = await patchQuote(quote.id, payload, token);
      onQuoteUpdated(updated);
      await onSuggestionsChanged();
      await onSessionMayNeedRefresh?.();
      setCardSuccess("Saved.");
      onEndEditing();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Failed to update quote");
    } finally {
      setSavingEdit(false);
    }
  };

  const onDelete = async () => {
    if (!canEdit) {
      setDeleteError("Only the owner can delete this quote.");
      return;
    }
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const token = await getApiAccessToken();
      await deleteQuote(quote.id, token);
      onQuoteDeleted(quote.id);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete quote");
    } finally {
      setDeleteBusy(false);
    }
  };

  useEffect(() => {
    if (!cardSuccess) return;
    const timer = window.setTimeout(() => setCardSuccess(null), 3000);
    return () => window.clearTimeout(timer);
  }, [cardSuccess]);

  useEffect(() => {
    if (!isEditing) return;
    resetEdit();
  }, [isEditing, resetEdit]);

  useEffect(() => {
    if (!isEditing || prefersCoarsePointer) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (editorContainerRef.current?.contains(target)) return;
      cancelEditing();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [cancelEditing, isEditing, prefersCoarsePointer]);

  return (
    <QuoteCardBase
      quote={quote}
      ownerText={quoteOwnerDisplayLabel(quote.owner)}
      ownerProfileUserId={quote.owner.id}
      showOwnerAvatar={!canEdit}
      suppressReadOnlyQuote={isEditing}
      isClickable={canEdit}
      onClick={() => {
        if (!canEdit || isEditing) return;
        onBeginEditing();
      }}
      rightMetaSlot={
        canEdit && !isEditing ? (
          <PondButton
            size="sm"
            colorPalette="lilypad"
            disabled={deleteBusy}
            onClick={(e) => {
              e.stopPropagation();
              if (deleteBusy) return;
              onBeginEditing();
            }}
          >
            Edit
          </PondButton>
        ) : null
      }
      footerSlot={
        canEdit ? (
          <>
            {cardSuccess ? <Text>{cardSuccess}</Text> : null}
            {isEditing ? (
              <Box
                ref={editorContainerRef}
                borderWidth="1px"
                borderColor="border"
                borderRadius="md"
                p="3"
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
                <Stack gap="3">
                  <HStack align="center">
                    <Text fontSize={APP_TEXT_SIZES.label} fontWeight="semibold">
                      Quote Editor
                    </Text>
                    <Text
                      fontSize={APP_TEXT_SIZES.helper}
                      fontWeight="bold"
                      color={isDirty ? "red.500" : "transparent"}
                    >
                      Unsaved changes
                    </Text>
                  </HStack>
                  {deleteError ? (
                    <Text role="alert" color="red.600" fontWeight="medium">
                      {deleteError}
                    </Text>
                  ) : null}
                  <Stack>
                    <Text fontSize={APP_TEXT_SIZES.label}>Body</Text>
                    <Textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      minH="100px"
                      placeholder={PLACEHOLDER_QUICK_BODY}
                      {...FIELD_PLACEHOLDER_PROPS}
                    />
                  </Stack>
                  <HStack align="start">
                    <Stack flex="1">
                      <Text fontSize={APP_TEXT_SIZES.label}>Date of quotation</Text>
                      <Input
                        type="date"
                        value={editDateOfQuote}
                        onChange={(e) => setEditDateOfQuote(e.target.value)}
                      />
                    </Stack>
                    <Stack flex="1">
                      <Text fontSize={APP_TEXT_SIZES.label}>Visibility</Text>
                      <NativeSelectRoot>
                        <NativeSelectField
                          value={editVisibility}
                          onChange={(e) =>
                            setEditVisibility(
                              (e.target.value as "private" | "published") || "private",
                            )
                          }
                        >
                          <option value="private">Private</option>
                          <option value="published">Published</option>
                        </NativeSelectField>
                      </NativeSelectRoot>
                    </Stack>
                  </HStack>
                  <Stack>
                    <Text fontSize={APP_TEXT_SIZES.label}>Tags (comma-separated)</Text>
                    <HStack flexWrap="wrap">
                      {tagSuggestions.map((label) => (
                        (() => {
                          const isActive = csvHasValue(editTagsCsv, label.name);
                          return (
                        <Tag.Root
                          key={`edit-tag-${quote.id}-${label.id}`}
                          size="sm"
                          colorPalette="lilypad"
                          variant={isActive ? "solid" : "outline"}
                          bg={isActive ? undefined : "bg"}
                          cursor="pointer"
                          onClick={() =>
                            setEditTagsCsv((prev) => toggleCsvValue(prev, label.name))
                          }
                        >
                          <Tag.Label>{label.name}</Tag.Label>
                        </Tag.Root>
                          );
                        })()
                      ))}
                    </HStack>
                    <Input
                      value={editTagsCsv}
                      onChange={(e) => setEditTagsCsv(e.target.value)}
                      placeholder={PLACEHOLDER_TAGS}
                      {...FIELD_PLACEHOLDER_PROPS}
                    />
                  </Stack>
                  <Stack>
                    <Text fontSize={APP_TEXT_SIZES.label}>Attributions by name (comma-separated)</Text>
                    <HStack flexWrap="wrap">
                      {attributionSuggestions
                        .filter((l) => !l.linked_user_id)
                        .map((label) => (
                          (() => {
                            const isActive = csvHasValue(
                              editAttributionNamesCsv,
                              label.name,
                            );
                            return (
                          <Tag.Root
                            key={`edit-attrib-name-${quote.id}-${label.id}`}
                            size="sm"
                            colorPalette="lilypad"
                            variant={isActive ? "solid" : "outline"}
                            bg={isActive ? undefined : "bg"}
                            cursor="pointer"
                            onClick={() =>
                              setEditAttributionNamesCsv((prev) =>
                                toggleCsvValue(prev, label.name),
                              )
                            }
                          >
                            <Tag.Label>{label.name}</Tag.Label>
                          </Tag.Root>
                            );
                          })()
                        ))}
                    </HStack>
                    <Input
                      value={editAttributionNamesCsv}
                      onChange={(e) => setEditAttributionNamesCsv(e.target.value)}
                      placeholder={PLACEHOLDER_ATTRIBUTION_NAMES}
                      {...FIELD_PLACEHOLDER_PROPS}
                    />
                  </Stack>
                  <Stack>
                    <Text fontSize={APP_TEXT_SIZES.label}>Tag a friend (comma-separated)</Text>
                    <HStack flexWrap="wrap">
                      {attributionSuggestions
                        .filter((l) => !!l.linked_user_id)
                        .map((label) => (
                          (() => {
                            const isActive = csvHasValue(
                              editAttributionEmailsCsv,
                              label.name,
                            );
                            return (
                          <Tag.Root
                            key={`edit-attrib-email-${quote.id}-${label.id}`}
                            size="sm"
                            colorPalette="lilypad"
                            variant={isActive ? "solid" : "outline"}
                            bg={isActive ? undefined : "bg"}
                            cursor="pointer"
                            onClick={() =>
                              setEditAttributionEmailsCsv((prev) =>
                                toggleCsvValue(prev, label.name),
                              )
                            }
                          >
                            <Tag.Label>{label.name}</Tag.Label>
                          </Tag.Root>
                            );
                          })()
                        ))}
                    </HStack>
                    <Input
                      value={editAttributionEmailsCsv}
                      onChange={(e) => setEditAttributionEmailsCsv(e.target.value)}
                      placeholder={PLACEHOLDER_ATTRIBUTION_EMAILS}
                      {...FIELD_PLACEHOLDER_PROPS}
                    />
                  </Stack>
                  <HStack>
                    <PondButton
                      size="sm"
                      colorPalette="lilypad"
                      loading={savingEdit}
                      disabled={savingEdit || deleteBusy}
                      onClick={(e) => {
                        e.stopPropagation();
                        void onSaveEdit();
                      }}
                    >
                      Save
                    </PondButton>
                    <PondButton
                      size="sm"
                      colorPalette="sky"
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelEditing();
                      }}
                    >
                      Cancel
                    </PondButton>
                    <Box flex="1" />
                    <PondButton
                      ref={confirmDeleteButtonRef}
                      size="sm"
                      colorPalette="nautical"
                      loading={deleteBusy}
                      disabled={savingEdit || deleteBusy}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!confirmDelete) {
                          setConfirmDelete(true);
                          setDeleteError(null);
                          return;
                        }
                        void onDelete();
                      }}
                    >
                      {confirmDelete ? "Confirm Delete" : "Delete"}
                    </PondButton>
                  </HStack>
                  {editError ? (
                    <Text role="alert" color="red.600" fontWeight="medium">
                      {editError}
                    </Text>
                  ) : null}
                </Stack>
              </Box>
            ) : null}
          </>
        ) : null
      }
    />
  );
}

export default function QuotesFeedPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    isAuthenticated,
    isLoading,
    sessionUser,
    getApiAccessToken,
    refreshSession,
    error: sessionError,
  } = useAppSession();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"private" | "published">("private");
  const [dateOfQuote, setDateOfQuote] = useState("");
  const [tagsCsv, setTagsCsv] = useState("");
  const [attributionNamesCsv, setAttributionNamesCsv] = useState("");
  const [attributionEmailsCsv, setAttributionEmailsCsv] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<QuoteLabel[]>([]);
  const [attributionSuggestions, setAttributionSuggestions] = useState<QuoteLabel[]>([]);
  const [approvedFriends, setApprovedFriends] = useState<FriendUser[]>([]);
  const [friendTagSuggestions, setFriendTagSuggestions] = useState<FriendUser[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [authBlocked, setAuthBlocked] = useState(false);
  const [feedReady, setFeedReady] = useState(false);
  const [isMoreDetailsOpen, setIsMoreDetailsOpen] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<number | null>(null);
  const isApprovedUser = !!sessionUser?.user?.is_approved;
  const activeTab = parseQuoteTab(searchParams.get("tab"), isApprovedUser);

  const friendLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const friend of approvedFriends) {
      map.set(friend.email.toLowerCase(), friend.id);
      map.set(friend.nickname.toLowerCase(), friend.id);
    }
    return map;
  }, [approvedFriends]);

  const setActiveTab = (tab: QuoteTab) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (searchParams.get("tab") === "public") {
      const next = new URLSearchParams(searchParams);
      next.set("tab", "published");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const loadSuggestions = useCallback(async () => {
    if (!sessionUser?.user?.is_approved) {
      setApprovedFriends([]);
      return;
    }
    if (authBlocked) return;
    try {
      const token = await getApiAccessToken();
      const [tags, attributions] = await Promise.all([
        fetchQuoteLabels(token, "tag"),
        fetchQuoteLabels(token, "attribution"),
      ]);
      setTagSuggestions(tags);
      setAttributionSuggestions(attributions);
      const friendsPayload = await fetchFriendsList(token);
      setApprovedFriends(friendsPayload.approved_friends);
    } catch (err: unknown) {
      if (isAuthFailure(err)) {
        setAuthBlocked(true);
        setError("Your session has expired. Please log out and log back in.");
        return;
      }
      throw err;
    }
  }, [authBlocked, getApiAccessToken, sessionUser?.user?.is_approved]);

  const loadFeed = useCallback(async () => {
    if (authBlocked) return;
    setLoadingFeed(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      const data = await fetchMyQuoteFeed(token);
      const sorted = [...data].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setQuotes(sorted);
      setFeedReady(true);
    } catch (err: unknown) {
      if (isAuthFailure(err)) {
        setAuthBlocked(true);
        setFeedReady(false);
        setError("Your session has expired. Please log out and log back in.");
        return;
      }
      setFeedReady(false);
      setError(err instanceof Error ? err.message : "Failed to load quote feed");
    } finally {
      setLoadingFeed(false);
    }
  }, [authBlocked, getApiAccessToken]);

  useEffect(() => {
    if (!isAuthenticated || !sessionUser || authBlocked) return;
    void loadFeed();
  }, [isAuthenticated, sessionUser, authBlocked, loadFeed]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 3000);
    return () => window.clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!isAuthenticated || !sessionUser || authBlocked || !feedReady) return;
    const run = async () => {
      try {
        await loadSuggestions();
      } catch {
        // Suggestions are optional; keep capture flow uninterrupted.
      }
    };
    void run();
  }, [isAuthenticated, sessionUser, authBlocked, feedReady, loadSuggestions]);

  useEffect(() => {
    if (!isAuthenticated || !sessionUser || authBlocked || !feedReady) {
      setFriendTagSuggestions([]);
      return;
    }
    const terms = parseCsv(attributionEmailsCsv);
    const query = terms.length > 0 ? (terms[terms.length - 1] ?? "").trim() : attributionEmailsCsv.trim();
    if (query.length < 2) {
      setFriendTagSuggestions([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const token = await getApiAccessToken();
          const rows = await searchFriends(token, query);
          setFriendTagSuggestions(rows);
        } catch {
          setFriendTagSuggestions([]);
        }
      })();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    attributionEmailsCsv,
    isAuthenticated,
    sessionUser,
    authBlocked,
    feedReady,
    getApiAccessToken,
  ]);

  const onSaveQuote = async () => {
    const trimmed = body.trim();
    if (!trimmed) {
      setError("Quote body cannot be empty.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const tags = parseCsv(tagsCsv);
      const attributionNames = parseCsv(attributionNamesCsv);
      const attributionEmailsOrLinkedNames = parseCsv(attributionEmailsCsv);

      const payload: QuoteCreatePayload = {
        body: trimmed,
        visibility,
      };

      if (dateOfQuote) {
        payload.date_of_quote = dateOfQuote;
      }

      const labels: QuoteCreatePayload["labels"] = [
        ...tags.map((name) => ({ kind: "tag" as const, name })),
        ...attributionNames.map((name) => ({
          kind: "attribution" as const,
          name,
        })),
        ...attributionEmailsOrLinkedNames.map((v) => attributionInputFromValue(v, friendLookup)),
      ];
      if (labels.length > 0) {
        payload.labels = labels;
      }

      const token = await getApiAccessToken();
      const newQuote = await createQuote(payload, token);
      setQuotes((prev) =>
        [newQuote, ...prev].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      );
      void refreshSession();
      setCurrentPage(0);
      // Avoid immediate protected follow-up fetches after save; use returned quote labels
      // to update suggestion chips optimistically.
      setTagSuggestions((prev) => mergeSuggestionLabels(prev, newQuote.labels, "tag"));
      setAttributionSuggestions((prev) =>
        mergeSuggestionLabels(prev, newQuote.labels, "attribution"),
      );
      setBody("");
      setDateOfQuote("");
      setTagsCsv("");
      setAttributionNamesCsv("");
      setAttributionEmailsCsv("");
      setIsMoreDetailsOpen(false);
      setSuccess("Saved.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save quote");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <Text>Loading…</Text>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
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

  const total = quotes.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages - 1);
  const startIndex = safePage * PAGE_SIZE;
  const endIndex = Math.min(total, startIndex + PAGE_SIZE);
  const visibleQuotes = quotes.slice(startIndex, endIndex);
  const visibleQuotesForRender =
    editingQuoteId == null
      ? visibleQuotes
      : visibleQuotes.filter((quote) => quote.id === editingQuoteId);

  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Tabs.Root
        value={activeTab}
        display="flex"
        flexDirection="column"
        flex="1"
        minH="full"
        onValueChange={(details) => setActiveTab(parseQuoteTab(details.value, isApprovedUser))}
        variant="plain"
      >
        <Box flex="1" bg="sky.solid" px={{ base: "4", md: "6" }} py={{ base: "5", md: "6" }}>
          <Box
            maxW="3xl"
            w="100%"
            mx="auto"
            bg="bg"
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
                value="add"
                bg={activeTab === "add" ? "lilypad.solid" : undefined}
                color={activeTab === "add" ? "black" : undefined}
                borderTopRadius="md"
                borderBottomRadius="0"
                px="4"
                py="2"
                fontWeight="medium"
                _hover={{ bg: activeTab === "add" ? "lilypad.solid" : "transparent" }}
                _selected={{ bg: "lilypad.solid", color: "black" }}
              >
                Add Quote
              </Tabs.Trigger>
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
                My Quotes
              </Tabs.Trigger>
              <Tabs.Trigger
                value="published"
                display={isApprovedUser ? undefined : "none"}
                bg={activeTab === "published" ? "lilypad.solid" : undefined}
                color={activeTab === "published" ? "black" : undefined}
                borderTopRadius="md"
                borderBottomRadius="0"
                px="4"
                py="2"
                fontWeight="medium"
                _hover={{ bg: activeTab === "published" ? "lilypad.solid" : "transparent" }}
                _selected={{ bg: "lilypad.solid", color: "black" }}
              >
                Published Quotes
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="add" p={{ base: "4", md: "6" }}>
              <Stack gap="3" pt="0">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={PLACEHOLDER_QUICK_BODY}
                minH="120px"
                {...FIELD_PLACEHOLDER_PROPS}
              />
              <Collapsible.Root
                open={isMoreDetailsOpen}
                onOpenChange={(details) => setIsMoreDetailsOpen(details.open)}
              >
                <HStack justify="space-between" align="center">
                  <Collapsible.Trigger asChild>
                    <button
                      type="button"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontSize: "0.875rem",
                        fontWeight: 500,
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
                        transform={isMoreDetailsOpen ? "rotate(90deg)" : "rotate(0deg)"}
                        transition="transform 0.15s ease"
                        lineHeight="1"
                      >
                        ›
                      </Text>
                      <Text as="span">
                        Optional Details
                      </Text>
                    </button>
                  </Collapsible.Trigger>
                  <PondButton
                    type="button"
                    colorPalette="lilypad"
                    loading={saving}
                    disabled={saving || body.trim().length === 0}
                    onClick={() => void onSaveQuote()}
                  >
                    Create quote
                  </PondButton>
                </HStack>
                <Collapsible.Content>
                  <Stack mt="3" gap="3">
                  <HStack align="start">
                    <Stack flex="1">
                      <Text fontSize={APP_TEXT_SIZES.label}>Date of quotation</Text>
                      <Input
                        type="date"
                        value={dateOfQuote}
                        onChange={(e) => setDateOfQuote(e.target.value)}
                      />
                    </Stack>
                    <Stack flex="1">
                      <Text fontSize={APP_TEXT_SIZES.label}>Visibility</Text>
                      <NativeSelectRoot>
                        <NativeSelectField
                          value={visibility}
                          onChange={(e) =>
                            setVisibility((e.target.value as "private" | "published") || "private")
                          }
                        >
                          <option value="private">Private</option>
                          <option value="published">Published</option>
                        </NativeSelectField>
                      </NativeSelectRoot>
                    </Stack>
                  </HStack>
                  <Stack>
                    <Text fontSize={APP_TEXT_SIZES.label}>Tags (comma-separated)</Text>
                    <HStack flexWrap="wrap">
                      {tagSuggestions.map((label) => (
                        (() => {
                          const isActive = csvHasValue(tagsCsv, label.name);
                          return (
                        <Tag.Root
                          key={`new-tag-${label.id}`}
                          size="sm"
                          colorPalette="lilypad"
                          variant={isActive ? "solid" : "outline"}
                          bg={isActive ? undefined : "bg"}
                          cursor="pointer"
                          onClick={() => setTagsCsv((prev) => toggleCsvValue(prev, label.name))}
                        >
                          <Tag.Label>{label.name}</Tag.Label>
                        </Tag.Root>
                          );
                        })()
                      ))}
                    </HStack>
                    <Input
                      value={tagsCsv}
                      onChange={(e) => setTagsCsv(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        setTagsCsv((prev) => normalizeCsv(prev));
                      }}
                      placeholder={PLACEHOLDER_TAGS}
                      {...FIELD_PLACEHOLDER_PROPS}
                    />
                  </Stack>
                  <Stack>
                    <Text fontSize={APP_TEXT_SIZES.label}>Attributions by name (comma-separated)</Text>
                    <HStack flexWrap="wrap">
                      {attributionSuggestions
                        .filter((l) => !l.linked_user_id)
                        .map((label) => (
                          (() => {
                            const isActive = csvHasValue(attributionNamesCsv, label.name);
                            return (
                          <Tag.Root
                            key={`new-attrib-name-${label.id}`}
                            size="sm"
                            colorPalette="lilypad"
                            variant={isActive ? "solid" : "outline"}
                            bg={isActive ? undefined : "bg"}
                            cursor="pointer"
                            onClick={() =>
                              setAttributionNamesCsv((prev) => toggleCsvValue(prev, label.name))
                            }
                          >
                            <Tag.Label>{label.name}</Tag.Label>
                          </Tag.Root>
                            );
                          })()
                        ))}
                    </HStack>
                    <Input
                      value={attributionNamesCsv}
                      onChange={(e) => setAttributionNamesCsv(e.target.value)}
                      placeholder={PLACEHOLDER_ATTRIBUTION_NAMES}
                      {...FIELD_PLACEHOLDER_PROPS}
                    />
                  </Stack>
                  <Stack>
                    <Text fontSize={APP_TEXT_SIZES.label}>
                      Tag a friend (comma-separated)
                    </Text>
                    <HStack flexWrap="wrap">
                      {attributionSuggestions
                        .filter((l) => !!l.linked_user_id)
                        .map((label) => (
                          (() => {
                            const isActive = csvHasValue(attributionEmailsCsv, label.name);
                            return (
                          <Tag.Root
                            key={`new-attrib-email-${label.id}`}
                            size="sm"
                            colorPalette="lilypad"
                            variant={isActive ? "solid" : "outline"}
                            bg={isActive ? undefined : "bg"}
                            cursor="pointer"
                            onClick={() =>
                              setAttributionEmailsCsv((prev) =>
                                toggleCsvValue(prev, label.name),
                              )
                            }
                          >
                            <Tag.Label>{label.name}</Tag.Label>
                          </Tag.Root>
                            );
                          })()
                        ))}
                    </HStack>
                    <Input
                      value={attributionEmailsCsv}
                      onChange={(e) => setAttributionEmailsCsv(e.target.value)}
                      placeholder={PLACEHOLDER_ATTRIBUTION_EMAILS}
                      {...FIELD_PLACEHOLDER_PROPS}
                    />
                    {friendTagSuggestions.length > 0 ? (
                      <HStack flexWrap="wrap">
                        {friendTagSuggestions.map((friend) => (
                          <Tag.Root
                            key={`friend-tag-suggest-${friend.id}`}
                            size="sm"
                            colorPalette="lilypad"
                            variant="outline"
                            bg="bg"
                            cursor="pointer"
                            onClick={() =>
                              setAttributionEmailsCsv((prev) => appendCsvValue(prev, friend.email))
                            }
                          >
                            <Tag.Label>{friend.nickname} ({friend.email})</Tag.Label>
                          </Tag.Root>
                        ))}
                      </HStack>
                    ) : null}
                  </Stack>
                  </Stack>
                </Collapsible.Content>
              </Collapsible.Root>
              {error ? (
                <Text role="alert" color="red.600" fontWeight="medium">
                  {error}
                </Text>
              ) : null}
              {success ? <Text>{success}</Text> : null}
              </Stack>
            </Tabs.Content>

            <Tabs.Content value="my" p={{ base: "4", md: "6" }}>
            <Stack gap="3" pt="0">
              {loadingFeed ? <Text fontSize={APP_TEXT_SIZES.helper}>Loading…</Text> : null}
              {quotes.length === 0 ? <Text>No quotes yet.</Text> : null}
              {editingQuoteId == null &&
              total > PAGE_SIZE &&
              visibleQuotes.length === PAGE_SIZE ? (
                <Box
                  bg="bg"
                  borderWidth="1px"
                  borderColor="border"
                  borderRadius="xl"
                  p={{ base: "4", md: "4" }}
                >
                  <HStack justify="space-between" flexWrap="wrap" gap="3">
                    <Text fontSize={APP_TEXT_SIZES.helper}>
                      Showing {startIndex + 1}-{endIndex} of {total}
                    </Text>
                    <HStack>
                      <PondButton
                        type="button"
                        size="sm"
                        colorPalette="nautical"
                        onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                        disabled={safePage === 0}
                      >
                        ←
                      </PondButton>
                      <Text fontSize={APP_TEXT_SIZES.helper}>
                        Page {safePage + 1} / {totalPages}
                      </Text>
                      <PondButton
                        type="button"
                        size="sm"
                        colorPalette="nautical"
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
                        }
                        disabled={safePage >= totalPages - 1}
                      >
                        →
                      </PondButton>
                    </HStack>
                  </HStack>
                </Box>
              ) : null}
              {visibleQuotesForRender.map((quote) => (
                <QuoteCard
                  key={quote.id}
                  quote={quote}
                  getApiAccessToken={getApiAccessToken}
                  viewerUserId={sessionUser?.user.id ?? null}
                  onSessionMayNeedRefresh={refreshSession}
                  onSuggestionsChanged={loadSuggestions}
                  tagSuggestions={tagSuggestions}
                  attributionSuggestions={attributionSuggestions}
                  friendLookup={friendLookup}
                  onQuoteUpdated={(next) =>
                    setQuotes((prev) => prev.map((q) => (q.id === next.id ? next : q)))
                  }
                  onQuoteDeleted={(quoteId) =>
                    setQuotes((prev) => {
                      setEditingQuoteId((current) => (current === quoteId ? null : current));
                      return prev.filter((q) => q.id !== quoteId);
                    })
                  }
                  isEditing={editingQuoteId === quote.id}
                  onBeginEditing={() => setEditingQuoteId(quote.id)}
                  onEndEditing={() =>
                    setEditingQuoteId((current) => (current === quote.id ? null : current))
                  }
                />
              ))}
              {editingQuoteId == null && total > PAGE_SIZE ? (
                <Box
                  bg="bg"
                  borderWidth="1px"
                  borderColor="border"
                  borderRadius="xl"
                  p={{ base: "4", md: "4" }}
                >
                  <HStack justify="space-between" flexWrap="wrap" gap="3">
                    <Text fontSize={APP_TEXT_SIZES.helper}>
                      Showing {startIndex + 1}-{endIndex} of {total}
                    </Text>
                    <HStack>
                      <PondButton
                        type="button"
                        size="sm"
                        colorPalette="nautical"
                        onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                        disabled={safePage === 0}
                      >
                        ←
                      </PondButton>
                      <Text fontSize={APP_TEXT_SIZES.helper}>
                        Page {safePage + 1} / {totalPages}
                      </Text>
                      <PondButton
                        type="button"
                        size="sm"
                        colorPalette="nautical"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={safePage >= totalPages - 1}
                      >
                        →
                      </PondButton>
                    </HStack>
                  </HStack>
                </Box>
              ) : null}
            </Stack>
            </Tabs.Content>

            <Tabs.Content value="published" p={{ base: "4", md: "6" }}>
              <Stack pt="0">
                {sessionUser?.user?.is_approved ? (
                  <PublicQuotesPage />
                ) : (
                  <Text color="orange.solid" fontWeight="medium">
                    Published quotes are available after your account is approved.
                  </Text>
                )}
              </Stack>
            </Tabs.Content>
          </Box>
        </Box>
      </Tabs.Root>
    </Stack>
  );
}

