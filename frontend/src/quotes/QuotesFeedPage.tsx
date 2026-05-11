import {
  Box,
  Collapsible,
  Grid,
  GridItem,
  HStack,
  Heading,
  Input,
  Stack,
  Tag,
  Text,
  Textarea,
} from "@chakra-ui/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Navigate } from "react-router";
import PondButton from "../PondButton";
import {
  resolveAvatarUrlForUser,
  useAppSession,
} from "../auth/AppSessionContext";
import {
  PanelEmptyState,
  PanelListRowSkeleton,
  PanelSessionReconnect,
  SessionLoadingCard,
} from "../components/panelStatus";
import { validateQuoteBody, validateQuoteLabelNames } from "../forms/validation";
import { fullBleedStackProps } from "../responsive";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  MAPPED_LIST_CARD_OUTER_PROPS,
  MAPPED_LIST_STACK_GAP,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FIELD_PROPS,
} from "../theme/typography";
import {
  bulkImportQuotes,
  createQuote,
  deleteQuote,
  fetchMyQuoteFeed,
  fetchQuoteLabels,
  patchQuote,
} from "./api";
import { quoteOwnerDisplayLabel } from "./ownerDisplay";
import QuoteOwnerCheckboxList from "./QuoteOwnerCheckboxList";
import QuoteCardBase from "./QuoteCardBase";
import type {
  Quote,
  QuoteBulkImportPayload,
  QuoteCreatePayload,
  QuoteLabel,
  QuotePatchPayload,
} from "./types";

const PLACEHOLDER_QUICK_BODY = "Paste or type a quote...";
const PLACEHOLDER_TAGS = "poetry, lyrics, musings";
const PLACEHOLDER_BULK_IMPORT =
  "Paste quote text here...\n\nOne or more blank lines separate quotes.";

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

function labelsToTagsCsv(quote: Quote): string {
  return quote.labels
    .filter((l) => l.kind === "tag")
    .map((l) => l.name)
    .join(", ");
}

function csvHasValue(existing: string, value: string): boolean {
  const needle = value.trim().toLowerCase();
  return parseCsv(existing).some((x) => x.toLowerCase() === needle);
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

function quoteHasCalendarDate(q: Quote): boolean {
  return Boolean(q.date_of_quote?.trim());
}

function compareQuotesByUpdatedThenCreatedDesc(a: Quote, b: Quote): number {
  const u = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  if (u !== 0) return u;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

/** Dated quotes first (newest quote date first); undated quotes last (most recently updated first). */
function sortQuotesForFeed(quotes: Quote[]): Quote[] {
  return [...quotes].sort((a, b) => {
    const aDated = quoteHasCalendarDate(a);
    const bDated = quoteHasCalendarDate(b);
    if (aDated !== bDated) return aDated ? -1 : 1;

    if (aDated && bDated) {
      const da = a.date_of_quote!.trim();
      const db = b.date_of_quote!.trim();
      const byDate = db.localeCompare(da);
      if (byDate !== 0) return byDate;
      return compareQuotesByUpdatedThenCreatedDesc(a, b);
    }

    return compareQuotesByUpdatedThenCreatedDesc(a, b);
  });
}

function isAuthFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  if (msg.includes("pending approval")) return false;
  return msg.includes("(401)") || msg.includes("(403)");
}

type QuoteCardProps = {
  quote: Quote;
  viewerUserId: number | null;
  isEditing: boolean;
  onBeginEditing: () => void;
  onEndEditing: () => void;
  getApiAccessToken: () => Promise<string>;
  tagSuggestions: QuoteLabel[];
  onRefreshQuotes: () => Promise<void>;
  onAfterQuoteMutation: () => void;
};

function QuoteCard({
  quote,
  viewerUserId,
  isEditing,
  onBeginEditing,
  onEndEditing,
  getApiAccessToken,
  tagSuggestions,
  onRefreshQuotes,
  onAfterQuoteMutation,
}: QuoteCardProps) {
  const { sessionUser, auth0User } = useAppSession();
  const canEdit = viewerUserId != null && quote.owner.id === viewerUserId;
  const ownerAvatarUrl = resolveAvatarUrlForUser(
    quote.owner.avatar_url,
    quote.owner.id,
    sessionUser,
    auth0User,
  );
  const [editBody, setEditBody] = useState(quote.body);
  const [editDateOfQuote, setEditDateOfQuote] = useState(quote.date_of_quote ?? "");
  const [editTagsCsv, setEditTagsCsv] = useState(labelsToTagsCsv(quote));
  const [saveAsDraft, setSaveAsDraft] = useState(quote.visibility === "private");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cardSuccess, setCardSuccess] = useState<string | null>(null);

  useEffect(() => {
    setEditBody(quote.body);
    setEditDateOfQuote(quote.date_of_quote ?? "");
    setEditTagsCsv(labelsToTagsCsv(quote));
    setSaveAsDraft(quote.visibility === "private");
    setError(null);
    setConfirmDelete(false);
  }, [quote, isEditing]);

  const isDirty = useMemo(() => {
    return (
      editBody.trim() !== quote.body.trim() ||
      (editDateOfQuote || "") !== (quote.date_of_quote || "") ||
      editTagsCsv.trim() !== labelsToTagsCsv(quote).trim() ||
      saveAsDraft !== (quote.visibility === "private")
    );
  }, [editBody, editDateOfQuote, editTagsCsv, saveAsDraft, quote]);

  const flushEdits = useCallback(async (): Promise<boolean> => {
    if (!canEdit || !isDirty || saving || deleteBusy) return true;
    const trimmedBody = editBody.trim();
    const bodyErr = validateQuoteBody(trimmedBody);
    if (bodyErr) {
      setError(bodyErr);
      return false;
    }
    const tags = parseCsv(editTagsCsv);
    const labelErr = validateQuoteLabelNames(tags);
    if (labelErr) {
      setError(labelErr);
      return false;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: QuotePatchPayload = {
        body: trimmedBody,
        date_of_quote: editDateOfQuote || null,
        visibility: saveAsDraft ? "private" : "published",
        labels: tags.map((name) => ({ kind: "tag", name })),
      };
      const token = await getApiAccessToken();
      await patchQuote(quote.id, payload, token);
      await onRefreshQuotes();
      onAfterQuoteMutation();
      setCardSuccess("Saved.");
      onEndEditing();
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update quote");
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    canEdit,
    isDirty,
    saving,
    deleteBusy,
    editBody,
    editDateOfQuote,
    editTagsCsv,
    saveAsDraft,
    getApiAccessToken,
    onRefreshQuotes,
    onAfterQuoteMutation,
    onEndEditing,
    quote.id,
  ]);

  const closeDiscarding = useCallback(() => {
    setEditBody(quote.body);
    setEditDateOfQuote(quote.date_of_quote ?? "");
    setEditTagsCsv(labelsToTagsCsv(quote));
    setSaveAsDraft(quote.visibility === "private");
    setError(null);
    setConfirmDelete(false);
    setCardSuccess(null);
    onEndEditing();
  }, [quote, onEndEditing]);

  useEffect(() => {
    if (!cardSuccess) return;
    const timer = window.setTimeout(() => setCardSuccess(null), 5000);
    return () => window.clearTimeout(timer);
  }, [cardSuccess]);

  const onDelete = useCallback(async () => {
    if (!canEdit) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleteBusy(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      await deleteQuote(quote.id, token);
      await onRefreshQuotes();
      onAfterQuoteMutation();
      onEndEditing();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete quote");
    } finally {
      setDeleteBusy(false);
    }
  }, [
    canEdit,
    confirmDelete,
    getApiAccessToken,
    onEndEditing,
    onRefreshQuotes,
    onAfterQuoteMutation,
    quote.id,
  ]);

  return (
    <Box
      bg="bg.panel"
      borderWidth="1px"
      borderStyle={quote.visibility === "private" ? "dashed" : "solid"}
      borderColor="border"
      borderRadius="xl"
      {...MAPPED_LIST_CARD_OUTER_PROPS}
    >
      <QuoteCardBase
        quote={quote}
        ownerText={quoteOwnerDisplayLabel(quote.owner)}
        ownerProfileUserId={quote.owner.id}
        ownerAvatarUrl={ownerAvatarUrl}
        showOwnerAvatar
        isClickable={canEdit}
        onClick={() => {
          if (!canEdit || isEditing) return;
          onBeginEditing();
        }}
        suppressReadOnlyQuote={isEditing}
        footerSlot={
          canEdit ? (
            <>
              {cardSuccess ? (
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="lilypad.solid"
                  fontWeight="medium"
                >
                  {cardSuccess}
                </Text>
              ) : null}
              {isEditing ? (
                <Box
                  borderWidth="1px"
                  borderColor="border"
                  borderRadius="md"
                  p="2"
                >
                  <Stack gap="3">
                    <Stack>
                      <Text fontSize={APP_TEXT_SIZES.label}>Body</Text>
                      <Textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        minH="100px"
                        placeholder={PLACEHOLDER_QUICK_BODY}
                        {...PANEL_FIELD_PROPS}
                      />
                    </Stack>
                    <Stack>
                      <Text fontSize={APP_TEXT_SIZES.label}>Date of quotation</Text>
                      <Input
                        type="date"
                        value={editDateOfQuote}
                        onChange={(e) => setEditDateOfQuote(e.target.value)}
                        {...PANEL_FIELD_PROPS}
                      />
                    </Stack>
                    <Stack>
                      <Text fontSize={APP_TEXT_SIZES.label}>Tags (comma-separated)</Text>
                      <HStack flexWrap="wrap">
                        {tagSuggestions.map((label) => {
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
                        })}
                      </HStack>
                      <Input
                        value={editTagsCsv}
                        onChange={(e) => setEditTagsCsv(e.target.value)}
                        placeholder={PLACEHOLDER_TAGS}
                        {...PANEL_FIELD_PROPS}
                      />
                    </Stack>
                    <label
                      style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
                    >
                      <input
                          type="checkbox"
                          checked={saveAsDraft}
                          onChange={(e) => setSaveAsDraft(e.target.checked)}
                        />
                      <Text fontSize={APP_TEXT_SIZES.body}>Save as draft</Text>
                    </label>
                    <HStack>
                      <PondButton
                        size="sm"
                        colorPalette="lilypad"
                        loading={saving}
                        disabled={saving || deleteBusy}
                        onClick={(e) => {
                          e.stopPropagation();
                          void flushEdits();
                        }}
                      >
                        Save
                      </PondButton>
                      <PondButton
                        size="sm"
                        colorPalette="sky"
                        disabled={saving || deleteBusy}
                        onClick={(e) => {
                          e.stopPropagation();
                          closeDiscarding();
                        }}
                      >
                        Close
                      </PondButton>
                      <Box flex="1" />
                      <PondButton
                        size="sm"
                        colorPalette="nautical"
                        loading={deleteBusy}
                        disabled={saving || deleteBusy}
                        onClick={(e) => {
                          e.stopPropagation();
                          void onDelete();
                        }}
                      >
                        {confirmDelete ? "Confirm Delete" : "Delete"}
                      </PondButton>
                    </HStack>
                    {error ? (
                      <Text role="alert" color="nautical.solid" fontWeight="medium">
                        {error}
                      </Text>
                    ) : null}
                  </Stack>
                </Box>
              ) : null}
            </>
          ) : null
        }
      />
    </Box>
  );
}

export default function QuotesFeedPage() {
  const {
    isAuthenticated,
    isLoading,
    sessionUser,
    getApiAccessToken,
    refreshSession,
    resyncSessionSilently,
    error: sessionError,
  } = useAppSession();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<QuoteLabel[]>([]);
  /** Start true so the first paint shows loading skeleton instead of an empty-state flash. */
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [authBlocked, setAuthBlocked] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [filterPeopleOpen, setFilterPeopleOpen] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<number | null>(null);
  const [orderedCheckedOwnerIds, setOrderedCheckedOwnerIds] = useState<number[]>([]);
  const prevOwnerIdsRef = useRef<number[]>([]);
  const hasLoadedQuoteFeedOnceRef = useRef(false);

  const [body, setBody] = useState("");
  const [dateOfQuote, setDateOfQuote] = useState("");
  const [tagsCsv, setTagsCsv] = useState("");
  const [saveAsDraft, setSaveAsDraft] = useState(false);
  const [bulkImportText, setBulkImportText] = useState("");

  const isApprovedUser = !!sessionUser?.user?.is_approved;
  const onAfterQuoteMutation = useCallback(() => {
    // Non-blocking session sync so achievement unlocks surface without full-page refresh.
    void resyncSessionSilently().catch(() => {});
  }, [resyncSessionSilently]);

  const refreshQuotes = useCallback(async () => {
    if (authBlocked) return;
    setLoadingQuotes(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      const data = await fetchMyQuoteFeed(token);
      setQuotes(sortQuotesForFeed(data));
    } catch (err: unknown) {
      if (isAuthFailure(err)) {
        setAuthBlocked(true);
        setError("Your session has expired. Please log out and log back in.");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load quote feed");
    } finally {
      hasLoadedQuoteFeedOnceRef.current = true;
      setLoadingQuotes(false);
    }
  }, [authBlocked, getApiAccessToken]);

  const loadBootstrap = useCallback(async () => {
    if (authBlocked) return;
    setLoadingQuotes(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      const [feed, tags] = await Promise.all([
        fetchMyQuoteFeed(token),
        fetchQuoteLabels(token, "tag"),
      ]);
      setQuotes(sortQuotesForFeed(feed));
      setTagSuggestions(tags);
    } catch (err: unknown) {
      if (isAuthFailure(err)) {
        setAuthBlocked(true);
        setError("Your session has expired. Please log out and log back in.");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load quotes.");
    } finally {
      hasLoadedQuoteFeedOnceRef.current = true;
      setLoadingQuotes(false);
    }
  }, [authBlocked, getApiAccessToken]);

  useEffect(() => {
    if (!isAuthenticated || !sessionUser || authBlocked) return;
    void loadBootstrap();
  }, [isAuthenticated, sessionUser, authBlocked, loadBootstrap]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 7000);
    return () => window.clearTimeout(timer);
  }, [success]);

  const owners = useMemo(() => {
    const map = new Map<number, { id: number; label: string }>();
    for (const quote of quotes) {
      if (map.has(quote.owner.id)) continue;
      map.set(quote.owner.id, {
        id: quote.owner.id,
        label: quoteOwnerDisplayLabel(quote.owner),
      });
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [quotes]);

  // Sync checkbox IDs before paint so `visibleQuotes` never briefly treats "no ids yet"
  // as "filter everything out" (blank-looking feed on mobile).
  useLayoutEffect(() => {
    const currentIds = owners.map((o) => o.id);
    const prevIds = prevOwnerIdsRef.current;
    const idSet = new Set(currentIds);
    prevOwnerIdsRef.current = currentIds;

    setOrderedCheckedOwnerIds((selected) => {
      const next = selected.filter((id) => idSet.has(id));
      if (currentIds.length === 0) return [];
      if (selected.length === 0 && prevIds.length === 0) {
        return currentIds;
      }
      const hadAllOld =
        prevIds.length > 0 && prevIds.every((id) => selected.includes(id));
      if (hadAllOld && currentIds.length > prevIds.length) {
        return currentIds;
      }
      return next;
    });
  }, [owners]);

  const visibleQuotes = useMemo(() => {
    if (owners.length === 0) return quotes;
    const allChecked =
      owners.length > 0 && owners.every((o) => orderedCheckedOwnerIds.includes(o.id));
    if (allChecked) return quotes;
    if (orderedCheckedOwnerIds.length === 0) return [];
    const allowed = new Set(orderedCheckedOwnerIds);
    return quotes.filter((quote) => allowed.has(quote.owner.id));
  }, [quotes, owners, orderedCheckedOwnerIds]);

  const onSaveQuote = useCallback(async () => {
    const trimmed = body.trim();
    const bodyErr = validateQuoteBody(trimmed);
    if (bodyErr) {
      setError(bodyErr);
      return;
    }
    const tags = parseCsv(tagsCsv);
    const labelErr = validateQuoteLabelNames(tags);
    if (labelErr) {
      setError(labelErr);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: QuoteCreatePayload = {
        body: trimmed,
        visibility: saveAsDraft ? "private" : "published",
        labels: tags.map((name) => ({ kind: "tag", name })),
      };
      if (dateOfQuote) payload.date_of_quote = dateOfQuote;
      const token = await getApiAccessToken();
      await createQuote(payload, token);
      await refreshQuotes();
      onAfterQuoteMutation();
      setBody("");
      setDateOfQuote("");
      setTagsCsv("");
      setSaveAsDraft(false);
      setIsAddOpen(false);
      setSuccess("Saved.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save quote");
    } finally {
      setSaving(false);
    }
  }, [
    body,
    tagsCsv,
    saveAsDraft,
    dateOfQuote,
    getApiAccessToken,
    refreshQuotes,
    onAfterQuoteMutation,
  ]);

  const onBulkImport = useCallback(async () => {
    if (!isApprovedUser) {
      setError("Bulk import is available for approved users.");
      return;
    }
    if (!bulkImportText.trim()) {
      setError("Paste at least one quote to import.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await getApiAccessToken();
      const payload: QuoteBulkImportPayload = { text: bulkImportText };
      const result = await bulkImportQuotes(payload, token);
      await refreshQuotes();
      onAfterQuoteMutation();
      setBulkImportText("");
      setSuccess(
        `Imported ${result.created_count} quote${result.created_count === 1 ? "" : "s"}.`,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to import quotes");
    } finally {
      setSaving(false);
    }
  }, [
    isApprovedUser,
    bulkImportText,
    getApiAccessToken,
    refreshQuotes,
    onAfterQuoteMutation,
  ]);

  if (isLoading) {
    return <SessionLoadingCard />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!sessionUser) {
    return (
      <PanelSessionReconnect
        sessionError={sessionError}
        onRetry={() => void refreshSession()}
      />
    );
  }

  return (
    <Stack
      flex="1"
      minH={{ base: "min(100dvh, 100%)", md: "full" }}
      gap="0"
      {...fullBleedStackProps}
    >
      <Box flex="1" bg="bg" px={0} py={{ base: "2", md: "2" }}>
        <Box {...APP_SHELL_TRAY_PROPS}>
          <Stack
            gap={{ base: "3", md: "3" }}
            px={{ base: "2", md: "2" }}
            pt={{ base: "2", md: "2" }}
            pb="2"
          >
            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Heading as="h1" size={{ base: "lg", md: "xl" }} mb="2">
                <HStack as="span" display="inline-flex" gap="2" alignItems="center" flexWrap="wrap">
                  <Text as="span" aria-hidden="true">
                    📜
                  </Text>
                  <Text as="span">Quotes Archive</Text>
                  {loadingQuotes && !hasLoadedQuoteFeedOnceRef.current ? (
                    <Text
                      as="span"
                      fontSize={APP_TEXT_SIZES.helper}
                      color="fg.muted"
                      fontWeight="medium"
                      aria-live="polite"
                    >
                      Loading…
                    </Text>
                  ) : null}
                </HStack>
              </Heading>
              <Text fontSize={APP_TEXT_SIZES.body} lineHeight="tall" color="fg">
                Add and edit quotes. 'Save as draft' keeps a quote private.
              </Text>
            </Box>

            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Stack gap="0" align="stretch" w="100%">
                <Grid
                  w="100%"
                  templateColumns={{ base: "1fr 1fr", md: "repeat(3, 1fr)" }}
                  gap="3"
                >
                  <GridItem
                    minW="0"
                    gridColumn={{ base: "1", md: "1" }}
                    gridRow={{ base: "1", md: "1" }}
                  >
                    <PondButton
                      type="button"
                      colorPalette="lilypad"
                      w="100%"
                      aria-expanded={isAddOpen}
                      onClick={() => setIsAddOpen((o) => !o)}
                    >
                      {isAddOpen ? "Close Add a Quote" : "Add a Quote"}
                    </PondButton>
                  </GridItem>
                  <GridItem
                    minW="0"
                    gridColumn={{ base: "1 / -1", md: "2" }}
                    gridRow={{ base: "2", md: "1" }}
                  >
                    <PondButton
                      type="button"
                      uiClass="filter"
                      uiActive={filterPeopleOpen}
                      w="100%"
                      justifyContent="center"
                      aria-expanded={filterPeopleOpen}
                      onClick={() => setFilterPeopleOpen((o) => !o)}
                    >
                      Filter People
                    </PondButton>
                  </GridItem>
                  <GridItem
                    minW="0"
                    gridColumn={{ base: "2", md: "3" }}
                    gridRow={{ base: "1", md: "1" }}
                  >
                    <PondButton
                      type="button"
                      colorPalette="sky"
                      w="100%"
                      aria-expanded={isBulkOpen}
                      onClick={() => setIsBulkOpen((o) => !o)}
                    >
                      {isBulkOpen ? "Close Bulk Import" : "Bulk Import"}
                    </PondButton>
                  </GridItem>
                </Grid>

                <Collapsible.Root open={isAddOpen} onOpenChange={(d) => setIsAddOpen(d.open)}>
                  <Collapsible.Content mt="2.5" p="0">
                    <Stack gap="3" w="100%">
                      <Textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder={PLACEHOLDER_QUICK_BODY}
                        minH="120px"
                        {...PANEL_FIELD_PROPS}
                      />
                      <Stack>
                        <Text fontSize={APP_TEXT_SIZES.label}>Date of quotation</Text>
                        <Input
                          type="date"
                          value={dateOfQuote}
                          onChange={(e) => setDateOfQuote(e.target.value)}
                          {...PANEL_FIELD_PROPS}
                        />
                      </Stack>
                      <Stack>
                        <Text fontSize={APP_TEXT_SIZES.label}>Tags (comma-separated)</Text>
                        <HStack flexWrap="wrap">
                          {tagSuggestions.map((label) => {
                            const isActive = csvHasValue(tagsCsv, label.name);
                            return (
                              <Tag.Root
                                key={`new-tag-${label.id}`}
                                size="sm"
                                colorPalette="lilypad"
                                variant={isActive ? "solid" : "outline"}
                                bg={isActive ? undefined : "bg"}
                                cursor="pointer"
                                onClick={() =>
                                  setTagsCsv((prev) => toggleCsvValue(prev, label.name))
                                }
                              >
                                <Tag.Label>{label.name}</Tag.Label>
                              </Tag.Root>
                            );
                          })}
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
                          {...PANEL_FIELD_PROPS}
                        />
                      </Stack>
                      <label
                        style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
                      >
                        <input
                          type="checkbox"
                          checked={saveAsDraft}
                          onChange={(e) => setSaveAsDraft(e.target.checked)}
                        />
                        <Text fontSize={APP_TEXT_SIZES.body}>Save as draft</Text>
                      </label>
                      <HStack justify="flex-end">
                        <PondButton
                          type="button"
                          colorPalette="lilypad"
                          loading={saving}
                          disabled={saving || body.trim().length === 0}
                          onClick={() => void onSaveQuote()}
                        >
                          Save quote
                        </PondButton>
                      </HStack>
                    </Stack>
                  </Collapsible.Content>
                </Collapsible.Root>

                <Collapsible.Root
                  open={filterPeopleOpen}
                  onOpenChange={(d) => setFilterPeopleOpen(d.open)}
                >
                  <Collapsible.Content mt="2.5" p="0">
                    <QuoteOwnerCheckboxList
                      owners={owners}
                      orderedCheckedOwnerIds={orderedCheckedOwnerIds}
                      onChange={setOrderedCheckedOwnerIds}
                      wide
                    />
                  </Collapsible.Content>
                </Collapsible.Root>

                <Collapsible.Root open={isBulkOpen} onOpenChange={(d) => setIsBulkOpen(d.open)}>
                  <Collapsible.Content mt="2.5" p="0">
                    <Stack gap="2" w="100%">
                      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" lineHeight="short">
                        Continuous non-empty lines are treated as one quote. One or more blank
                        lines split quotes.
                      </Text>
                      <Textarea
                        value={bulkImportText}
                        onChange={(e) => setBulkImportText(e.target.value)}
                        placeholder={PLACEHOLDER_BULK_IMPORT}
                        minH="220px"
                        {...PANEL_FIELD_PROPS}
                      />
                      <HStack justify="flex-end">
                        <PondButton
                          type="button"
                          colorPalette="lilypad"
                          loading={saving}
                          disabled={
                            saving || !isApprovedUser || bulkImportText.trim().length === 0
                          }
                          onClick={() => void onBulkImport()}
                        >
                          Import quotes
                        </PondButton>
                      </HStack>
                    </Stack>
                  </Collapsible.Content>
                </Collapsible.Root>
              </Stack>
            </Box>

            {error ? (
              <Text role="alert" color="nautical.solid" fontWeight="medium">
                {error}
              </Text>
            ) : null}
            {success ? (
              <Text fontSize={APP_TEXT_SIZES.helper} color="lilypad.solid" fontWeight="medium">
                {success}
              </Text>
            ) : null}

            <Stack gap={MAPPED_LIST_STACK_GAP} pt="0">
              {loadingQuotes && quotes.length === 0 ? <PanelListRowSkeleton rows={4} /> : null}
              {!loadingQuotes && visibleQuotes.length === 0 ? (
                quotes.length === 0 ? (
                  <PanelEmptyState
                    title="No quotes yet."
                    description="Add one with Add a Quote above."
                    actionLabel="Open Add a Quote"
                    onAction={() => setIsAddOpen(true)}
                  />
                ) : (
                  <PanelEmptyState
                    title="No quotes match this filter."
                    description="Open Filter People and include at least one person, or use Check all."
                    actionLabel="Open Filter People"
                    onAction={() => setFilterPeopleOpen(true)}
                  />
                )
              ) : null}
              {visibleQuotes.map((quote) => (
                <QuoteCard
                  key={quote.id}
                  quote={quote}
                  viewerUserId={sessionUser?.user.id ?? null}
                  isEditing={editingQuoteId === quote.id}
                  onBeginEditing={() => setEditingQuoteId(quote.id)}
                  onEndEditing={() =>
                    setEditingQuoteId((current) => (current === quote.id ? null : current))
                  }
                  getApiAccessToken={getApiAccessToken}
                  tagSuggestions={tagSuggestions}
                  onRefreshQuotes={refreshQuotes}
                  onAfterQuoteMutation={onAfterQuoteMutation}
                />
              ))}
            </Stack>
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}
