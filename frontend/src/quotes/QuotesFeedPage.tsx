import {
  Box,
  Heading,
  HStack,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Separator,
  Stack,
  Tag,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import PondButton from "../PondButton";
import { useAppSession } from "../auth/AppSessionContext";
import {
  createQuote,
  deleteQuote,
  fetchMyQuoteFeed,
  fetchQuoteLabels,
  patchQuote,
} from "./api";
import type { Quote, QuoteCreatePayload, QuoteLabel, QuotePatchPayload } from "./types";

const PAGE_SIZE = 10;

function parseCsv(raw: string): string[] {
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
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

function QuoteCard({
  quote,
  getApiAccessToken,
  viewerUserId,
  onQuoteUpdated,
  onQuoteDeleted,
  onSuggestionsChanged,
  tagSuggestions,
  attributionSuggestions,
}: {
  quote: Quote;
  getApiAccessToken: () => Promise<string>;
  viewerUserId: number | null;
  onQuoteUpdated: (next: Quote) => void;
  onQuoteDeleted: (quoteId: number) => void;
  onSuggestionsChanged: () => Promise<void>;
  tagSuggestions: QuoteLabel[];
  attributionSuggestions: QuoteLabel[];
}) {
  const labels = useMemo(
    () => quote.labels.map((l) => `${l.kind}: ${l.name}`).join(" • "),
    [quote.labels],
  );
  const canEdit = viewerUserId != null && quote.owner.id === viewerUserId;
  const defaults = useMemo(() => labelsToCsv(quote), [quote]);
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(quote.body);
  const [editVisibility, setEditVisibility] = useState<"private" | "public">(quote.visibility);
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
  const isDirty =
    editBody.trim() !== quote.body.trim() ||
    editVisibility !== quote.visibility ||
    (editDateOfQuote || "") !== (quote.date_of_quote || "") ||
    editTagsCsv.trim() !== defaults.tags.trim() ||
    editAttributionNamesCsv.trim() !== defaults.attributionNames.trim() ||
    editAttributionEmailsCsv.trim() !== defaults.attributionEmails.trim();

  const resetEdit = () => {
    const nextDefaults = labelsToCsv(quote);
    setEditBody(quote.body);
    setEditVisibility(quote.visibility);
    setEditDateOfQuote(quote.date_of_quote ?? "");
    setEditTagsCsv(nextDefaults.tags);
    setEditAttributionNamesCsv(nextDefaults.attributionNames);
    setEditAttributionEmailsCsv(nextDefaults.attributionEmails);
    setEditError(null);
  };

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
      const attributionEmails = parseCsv(editAttributionEmailsCsv);
      const labelsPayload: NonNullable<QuotePatchPayload["labels"]> = [
        ...tags.map((name) => ({ kind: "tag" as const, name })),
        ...attributionNames.map((name) => ({ kind: "attribution" as const, name })),
        ...attributionEmails.map((email) => ({ kind: "attribution" as const, email })),
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
      setCardSuccess("Saved.");
      setIsEditing(false);
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

  return (
    <Box borderWidth="1px" borderColor="border" p="4" borderRadius="md">
      <Stack gap="2">
        <Text whiteSpace="pre-wrap">{quote.body}</Text>
        <Text textStyle="sm">
          Owner: {quote.owner.email} • Visibility: {quote.visibility} • Relationship:{" "}
          {quote.relationship_to_viewer}
        </Text>
        <Text textStyle="sm">
          Captured: {new Date(quote.created_at).toLocaleString()}{" "}
          {quote.date_of_quote ? `• Date quoted: ${quote.date_of_quote}` : ""}
        </Text>
        {labels ? <Text textStyle="sm">Labels: {labels}</Text> : null}
        {canEdit ? (
          <>
            <HStack>
              <PondButton
                size="sm"
                colorPalette="lilypad"
                onClick={() => {
                  if (!isEditing) resetEdit();
                  setIsEditing((v) => !v);
                }}
              >
                {isEditing ? "Close editor" : "Edit metadata"}
              </PondButton>
              {!confirmDelete ? (
                <PondButton
                  size="sm"
                  colorPalette="nautical"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </PondButton>
              ) : (
                <>
                  <PondButton
                    size="sm"
                    colorPalette="nautical"
                    loading={deleteBusy}
                    disabled={deleteBusy}
                    onClick={() => void onDelete()}
                  >
                    Confirm delete
                  </PondButton>
                  <PondButton
                    size="sm"
                    colorPalette="sky"
                    onClick={() => {
                      setConfirmDelete(false);
                      setDeleteError(null);
                    }}
                  >
                    Cancel
                  </PondButton>
                </>
              )}
            </HStack>
            {cardSuccess ? <Text>{cardSuccess}</Text> : null}
            {deleteError ? <Text role="alert">{deleteError}</Text> : null}
            {isEditing ? (
              <Box borderWidth="1px" borderColor="border" borderRadius="md" p="3">
                <Stack gap="3">
                  <HStack align="center">
                    <Text textStyle="sm" fontWeight="semibold">
                      Edit quote metadata
                    </Text>
                    <Text
                      textStyle="sm"
                      fontWeight="bold"
                      color={isDirty ? "red.500" : "transparent"}
                    >
                      Unsaved changes
                    </Text>
                  </HStack>
                  <Stack>
                    <Text textStyle="sm">Body</Text>
                    <Textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      minH="100px"
                    />
                  </Stack>
                  <HStack align="start">
                    <Stack flex="1">
                      <Text textStyle="sm">Visibility</Text>
                      <NativeSelectRoot>
                        <NativeSelectField
                          value={editVisibility}
                          onChange={(e) =>
                            setEditVisibility(
                              (e.target.value as "private" | "public") || "private",
                            )
                          }
                        >
                          <option value="private">Private</option>
                          <option value="public">Public</option>
                        </NativeSelectField>
                      </NativeSelectRoot>
                    </Stack>
                    <Stack flex="1">
                      <Text textStyle="sm">Date of quotation</Text>
                      <Input
                        type="date"
                        value={editDateOfQuote}
                        onChange={(e) => setEditDateOfQuote(e.target.value)}
                      />
                    </Stack>
                  </HStack>
                  <Stack>
                    <Text textStyle="sm">Tags (comma-separated)</Text>
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
                    />
                  </Stack>
                  <Stack>
                    <Text textStyle="sm">Attributions by name (comma-separated)</Text>
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
                    />
                  </Stack>
                  <Stack>
                    <Text textStyle="sm">Attributions by email (comma-separated)</Text>
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
                    />
                  </Stack>
                  <HStack>
                    <PondButton
                      size="sm"
                      colorPalette="sky"
                      loading={savingEdit}
                      disabled={savingEdit}
                      onClick={() => void onSaveEdit()}
                    >
                      Save changes
                    </PondButton>
                    <PondButton
                      size="sm"
                      colorPalette="nautical"
                      onClick={() => {
                        resetEdit();
                        setIsEditing(false);
                      }}
                    >
                      Cancel
                    </PondButton>
                  </HStack>
                  {editError ? <Text role="alert">{editError}</Text> : null}
                </Stack>
              </Box>
            ) : null}
          </>
        ) : null}
      </Stack>
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
    error: sessionError,
  } = useAppSession();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [dateOfQuote, setDateOfQuote] = useState("");
  const [tagsCsv, setTagsCsv] = useState("");
  const [attributionNamesCsv, setAttributionNamesCsv] = useState("");
  const [attributionEmailsCsv, setAttributionEmailsCsv] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<QuoteLabel[]>([]);
  const [attributionSuggestions, setAttributionSuggestions] = useState<QuoteLabel[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [authBlocked, setAuthBlocked] = useState(false);
  const [feedReady, setFeedReady] = useState(false);

  const loadSuggestions = async () => {
    if (authBlocked) return;
    try {
      const token = await getApiAccessToken();
      const [tags, attributions] = await Promise.all([
        fetchQuoteLabels(token, "tag"),
        fetchQuoteLabels(token, "attribution"),
      ]);
      setTagSuggestions(tags);
      setAttributionSuggestions(attributions);
    } catch (err: unknown) {
      if (isAuthFailure(err)) {
        setAuthBlocked(true);
        setError("Your session has expired. Please log out and log back in.");
        return;
      }
      throw err;
    }
  };

  const isAuthFailure = (err: unknown): boolean =>
    err instanceof Error && (err.message.includes("(401)") || err.message.includes("(403)"));

  const loadFeed = async () => {
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
  };

  useEffect(() => {
    if (!isAuthenticated || !sessionUser || authBlocked) return;
    void loadFeed();
  }, [isAuthenticated, sessionUser, authBlocked]);

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
  }, [isAuthenticated, sessionUser, authBlocked, feedReady]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
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
      const attributionEmails = parseCsv(attributionEmailsCsv);

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
        ...attributionEmails.map((email) => ({
          kind: "attribution" as const,
          email,
        })),
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
      <Stack gap="4" maxW="lg">
        <Text fontWeight="semibold">Reconnecting your API session…</Text>
        <Text textStyle="sm">
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

  return (
    <Stack gap="6" maxW="3xl">
      <Heading size="lg">Quotes</Heading>
      <Box as="form" onSubmit={onSubmit} borderWidth="1px" borderColor="border" p="4" borderRadius="md">
        <Stack gap="3">
          <Text fontWeight="semibold">Quick capture</Text>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Paste or type a quote..."
            minH="120px"
          />
          <details>
            <summary>More details (optional)</summary>
            <Stack mt="3" gap="3">
              <HStack align="start">
                <Stack flex="1">
                  <Text textStyle="sm">Visibility</Text>
                  <NativeSelectRoot>
                    <NativeSelectField
                      value={visibility}
                      onChange={(e) =>
                        setVisibility((e.target.value as "private" | "public") || "private")
                      }
                    >
                      <option value="private">Private</option>
                      <option value="public">Public</option>
                    </NativeSelectField>
                  </NativeSelectRoot>
                </Stack>
                <Stack flex="1">
                  <Text textStyle="sm">Date of quotation</Text>
                  <Input
                    type="date"
                    value={dateOfQuote}
                    onChange={(e) => setDateOfQuote(e.target.value)}
                  />
                </Stack>
              </HStack>
              <Stack>
                <Text textStyle="sm">Tags (comma-separated)</Text>
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
                  placeholder="poetry, grief, writing"
                />
              </Stack>
              <Stack>
                <Text textStyle="sm">Attributions by name (comma-separated)</Text>
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
                  placeholder="Mary Oliver, Toni Morrison"
                />
              </Stack>
              <Stack>
                <Text textStyle="sm">Attributions by user email (comma-separated)</Text>
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
                  placeholder="friend@example.com, editor@example.com"
                />
              </Stack>
            </Stack>
          </details>
          <HStack>
            <PondButton type="submit" colorPalette="sky" loading={saving} disabled={saving}>
              Save quote
            </PondButton>
            <PondButton type="button" colorPalette="nautical" onClick={() => void loadFeed()}>
              Refresh
            </PondButton>
          </HStack>
          {error ? <Text role="alert">{error}</Text> : null}
          {success ? <Text>{success}</Text> : null}
        </Stack>
      </Box>

      <Separator />
      <Stack gap="3">
        <Text fontWeight="semibold">
          Your feed {loadingFeed ? "(loading...)" : `(${quotes.length})`}
        </Text>
        {quotes.length === 0 ? <Text>No quotes yet.</Text> : null}
        {visibleQuotes.map((quote) => (
          <QuoteCard
            key={quote.id}
            quote={quote}
            getApiAccessToken={getApiAccessToken}
            viewerUserId={sessionUser?.user.id ?? null}
            onSuggestionsChanged={loadSuggestions}
            tagSuggestions={tagSuggestions}
            attributionSuggestions={attributionSuggestions}
            onQuoteUpdated={(next) =>
              setQuotes((prev) => prev.map((q) => (q.id === next.id ? next : q)))
            }
            onQuoteDeleted={(quoteId) =>
              setQuotes((prev) => prev.filter((q) => q.id !== quoteId))
            }
          />
        ))}
        {total > PAGE_SIZE ? (
          <HStack justify="space-between">
            <Text textStyle="sm">
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
              <Text textStyle="sm">
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
        ) : null}
      </Stack>
    </Stack>
  );
}

