import {
  Box,
  Flex,
  HStack,
  Input,
  SimpleGrid,
  Spinner,
  Stack,
  Tabs,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, Link as RouterLink, useLocation, useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { MealEditorBackdropDismiss } from "../meal/MealEditorBackdropDismiss";
import PondButton from "../PondButton";
import {
  APP_SHELL_TAB_LIST_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FIELD_PROPS,
  PANEL_FORM_PLACEHOLDER_PROPS,
  PANEL_NESTED_BLOCK_PROPS,
} from "../theme/typography";
import {
  buildResolveRequestBody,
  bulkImportPrompts,
  createResponse,
  fetchAllSongPrompts,
  fetchPromptForDate,
  fetchResponsesForDate,
  resolveSongLinkMetadata,
  toggleHeart,
} from "./api";
import { parseSongPasteInput } from "./parseSongInput";
import SongadayArchivePanel from "./SongadayArchivePanel";
import SongadayCommentChatButton from "./SongadayCommentChatButton";
import SongadayCommentsPanel from "./SongadayCommentsPanel";
import SongadayListCard from "./SongadayListCard";
import SongadaySubmissionEditBlock from "./SongadaySubmissionEditBlock";
import type {
  ParsedSongFields,
  SongadayPromptPayload,
  SongadayResponse,
  SongPromptCatalogRow,
} from "./types";

const FIELD = { ...PANEL_FIELD_PROPS, ...PANEL_FORM_PLACEHOLDER_PROPS };

const PROMPT_CARD_TEXT_ALIGN = { textAlign: "center" as const };

const PROMPT_BODY_STYLE = {
  whiteSpace: "pre-wrap" as const,
  fontSize: "xl",
  fontWeight: "normal" as const,
  lineHeight: "short" as const,
  fontFamily: '"Arial Black", "Arial Black", Arial, sans-serif',
};

const NO_PROMPT_CARD_PROPS = {
  ...PANEL_ENTRY_CARD_PROPS,
  bg: "nautical.solid",
  borderColor: "nautical.border",
  color: "nautical.contrast",
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Earliest day the user can pick: today minus this many calendar days (inclusive). */
const MAX_DAYS_BACK = 7;

function getTodayStart(): Date {
  return startOfDay(new Date());
}

function getMinSelectableDate(): Date {
  const t = getTodayStart();
  const d = new Date(t);
  d.setDate(d.getDate() - MAX_DAYS_BACK);
  return startOfDay(d);
}

function canGoToNextDay(selected: Date): boolean {
  return startOfDay(selected) < getTodayStart();
}

function canGoToPrevDay(selected: Date): boolean {
  return startOfDay(selected) > getMinSelectableDate();
}

/** Prev / prompt / Next + Today (right column). */
function PromptDayNavChrome({
  selectedDate,
  onPrev,
  onNext,
  onJumpToToday,
  children,
}: {
  selectedDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onJumpToToday: () => void;
  children: ReactNode;
}) {
  const isViewingToday =
    startOfDay(selectedDate).getTime() === getTodayStart().getTime();
  return (
    <Box
      display="grid"
      w="100%"
      columnGap="3"
      rowGap="0"
      alignItems="stretch"
      gridTemplateColumns="minmax(0, 1fr) minmax(0, 2.5fr) minmax(0, 1fr)"
    >
      <Box
        display="flex"
        flexDirection="column"
        alignItems="flex-end"
        justifyContent="flex-start"
        minW={0}
      >
        <PondButton
          type="button"
          size="sm"
          variant="outline"
          colorPalette="nautical"
          disabled={!canGoToPrevDay(selectedDate)}
          onClick={onPrev}
        >
          ← Prev
        </PondButton>
      </Box>
      <Box minW={0} w="100%">
        {children}
      </Box>
      <Stack
        h="100%"
        minH={0}
        minW={0}
        w="100%"
        alignItems="flex-start"
        justify="space-between"
        gap="0"
        py="0.5"
      >
        <PondButton
          type="button"
          size="sm"
          variant="outline"
          colorPalette="nautical"
          disabled={!canGoToNextDay(selectedDate)}
          onClick={onNext}
        >
          Next →
        </PondButton>
        <PondButton
          type="button"
          size="sm"
          variant="ghost"
          colorPalette="nautical"
          disabled={isViewingToday}
          onClick={onJumpToToday}
        >
          Today
        </PondButton>
      </Stack>
    </Box>
  );
}

const emptyFields = (): ParsedSongFields & { notes: string } => ({
  artist: "",
  title: "",
  raw_label: "",
  youtube_video_id: "",
  spotify_url: "",
  apple_music_url: "",
  notes: "",
});

function mergeParsedIntoFields(
  pasteBlob: string,
  base: ParsedSongFields & { notes: string },
): ParsedSongFields & { notes: string } {
  const parsed = parseSongPasteInput(pasteBlob);
  return {
    notes: base.notes,
    artist: parsed.artist || base.artist,
    title: parsed.title || base.title,
    raw_label: parsed.raw_label || base.raw_label,
    youtube_video_id: parsed.youtube_video_id || base.youtube_video_id,
    spotify_url: parsed.spotify_url || base.spotify_url,
    apple_music_url: parsed.apple_music_url || base.apple_music_url,
  };
}

function hasMinimumSongFields(
  f: ParsedSongFields & { notes: string },
): boolean {
  return !!(
    f.youtube_video_id.trim() ||
    f.spotify_url.trim() ||
    f.apple_music_url.trim() ||
    f.raw_label.trim() ||
    f.artist.trim() ||
    f.title.trim()
  );
}

type SongadayMainTab = "prompt" | "archive" | "bulk";

export default function SongadayPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const songadayEntryDateFromNav = (
    location.state as { songadayEntryDate?: string } | null
  )?.songadayEntryDate;
  const {
    isAuthenticated,
    isLoading,
    sessionUser,
    getApiAccessToken,
    refreshSession,
    error: sessionError,
  } = useAppSession();

  const [selectedDate, setSelectedDate] = useState(() =>
    startOfDay(new Date()),
  );
  const [tab, setTab] = useState<SongadayMainTab>("prompt");

  const [promptPayload, setPromptPayload] =
    useState<SongadayPromptPayload | null>(null);
  const [promptLoadError, setPromptLoadError] = useState<string | null>(null);
  const [promptLoading, setPromptLoading] = useState(true);

  const [responses, setResponses] = useState<SongadayResponse[]>([]);
  const [responsesLoadError, setResponsesLoadError] = useState<string | null>(
    null,
  );
  const [responsesLoading, setResponsesLoading] = useState(true);

  const [pasteBlob, setPasteBlob] = useState("");
  const [fields, setFields] = useState(emptyFields);
  const [showResponseDetails, setShowResponseDetails] = useState(false);
  const [expandAllSongFields, setExpandAllSongFields] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);

  const [bulkText, setBulkText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [promptCatalog, setPromptCatalog] = useState<SongPromptCatalogRow[]>(
    [],
  );
  const [promptCatalogLoading, setPromptCatalogLoading] = useState(false);
  const [promptCatalogError, setPromptCatalogError] = useState<string | null>(
    null,
  );

  const [heartBusyId, setHeartBusyId] = useState<number | null>(null);
  /** Which friend entry has the inline comment panel open (toggle with 💬). */
  const [friendCommentPanelOpenId, setFriendCommentPanelOpenId] = useState<number | null>(null);
  const [ownCommentPanelOpen, setOwnCommentPanelOpen] = useState(false);
  const [submissionEditOpen, setSubmissionEditOpen] = useState(false);

  const myUserId = sessionUser?.user.id ?? 0;
  const isStaff = !!sessionUser?.user.is_staff;
  const isApproved = !!sessionUser?.user.is_approved;

  useEffect(() => {
    if (!isStaff && tab === "bulk") {
      setTab("prompt");
    }
  }, [isStaff, tab]);

  useEffect(() => {
    if (!bulkNotice) return;
    const t = window.setTimeout(() => setBulkNotice(null), 7000);
    return () => window.clearTimeout(t);
  }, [bulkNotice]);

  useEffect(() => {
    if (tab !== "bulk" || !isStaff) return;
    let cancelled = false;
    void (async () => {
      setPromptCatalogLoading(true);
      setPromptCatalogError(null);
      try {
        const token = await getApiAccessToken();
        const rows = await fetchAllSongPrompts(token);
        if (!cancelled) setPromptCatalog(rows);
      } catch (e) {
        if (!cancelled) {
          setPromptCatalogError(
            e instanceof Error ? e.message : "Could not load prompt list.",
          );
          setPromptCatalog([]);
        }
      } finally {
        if (!cancelled) setPromptCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, isStaff, getApiAccessToken]);

  const loadPrompt = useCallback(async () => {
    setPromptLoading(true);
    setPromptLoadError(null);
    try {
      const token = await getApiAccessToken();
      const p = await fetchPromptForDate(token, selectedDate);
      setPromptPayload(p);
    } catch (e) {
      setPromptLoadError(
        e instanceof Error ? e.message : "Failed to load prompt.",
      );
      setPromptPayload(null);
    } finally {
      setPromptLoading(false);
    }
  }, [getApiAccessToken, selectedDate]);

  const loadResponses = useCallback(async () => {
    setResponsesLoading(true);
    setResponsesLoadError(null);
    try {
      const token = await getApiAccessToken();
      const list = await fetchResponsesForDate(token, selectedDate);
      setResponses(list);
    } catch (e) {
      setResponsesLoadError(
        e instanceof Error ? e.message : "Failed to load responses.",
      );
      setResponses([]);
    } finally {
      setResponsesLoading(false);
    }
  }, [getApiAccessToken, selectedDate]);

  useEffect(() => {
    void loadPrompt();
    void loadResponses();
  }, [loadPrompt, loadResponses]);

  useEffect(() => {
    setShowResponseDetails(false);
    setExpandAllSongFields(false);
    setPasteBlob("");
    setFields(emptyFields());
    setSubmitError(null);
  }, [selectedDate]);

  /** Only clamp future dates; allow past dates (e.g. jump from archive). */
  useEffect(() => {
    const s = startOfDay(selectedDate);
    const max = getTodayStart();
    if (s.getTime() > max.getTime()) {
      setSelectedDate(max);
    }
  }, [selectedDate]);

  const myEntry = useMemo(
    () => responses.find((r) => r.user.id === myUserId) ?? null,
    [responses, myUserId],
  );

  useEffect(() => {
    setSubmissionEditOpen(false);
    setFriendCommentPanelOpenId(null);
    setOwnCommentPanelOpen(false);
  }, [selectedDate, myEntry?.id]);

  useEffect(() => {
    if ((myEntry?.comment_count ?? 0) === 0) {
      setOwnCommentPanelOpen(false);
    }
  }, [myEntry?.comment_count]);

  /** Other users only, newest activity first. */
  const friendsResponsesOrdered = useMemo(() => {
    const recentMs = (r: SongadayResponse) =>
      Math.max(Date.parse(r.updated_at), Date.parse(r.created_at));
    return responses
      .filter((r) => myUserId === 0 || r.user.id !== myUserId)
      .sort((a, b) => recentMs(b) - recentMs(a));
  }, [responses, myUserId]);

  const hasPrompt = !!(
    promptPayload?.prompt && String(promptPayload.prompt).trim()
  );

  const applicableFieldGroups = useMemo(() => {
    const f = fields;
    const yt = f.youtube_video_id.trim();
    const sp = f.spotify_url.trim();
    const am = f.apple_music_url.trim();
    const raw = f.raw_label.trim();
    const ar = f.artist.trim();
    const ti = f.title.trim();
    const any = !!(yt || sp || am || raw || ar || ti);
    if (!any) {
      return {
        showAll: true as const,
        artistTitle: true,
        raw_label: true,
        youtube: true,
        spotify: true,
        apple: true,
      };
    }
    return {
      showAll: false as const,
      artistTitle: !!(ar || ti),
      raw_label: !!raw,
      youtube: !!yt,
      spotify: !!sp,
      apple: !!am,
    };
  }, [fields]);

  const onSubmit = useCallback(async () => {
    if (!hasPrompt || !promptPayload?.prompt) return;
    setSubmitError(null);

    const working = mergeParsedIntoFields(pasteBlob, fields);
    setFields(working);

    setSubmitBusy(true);
    try {
      const token = await getApiAccessToken();

      let merged = working;
      const resolveBody = buildResolveRequestBody(merged);
      if (resolveBody && (!merged.artist.trim() || !merged.title.trim())) {
        try {
          const meta = await resolveSongLinkMetadata(token, resolveBody);
          merged = {
            ...merged,
            artist: merged.artist.trim() || meta.artist.trim() || "",
            title: merged.title.trim() || meta.title.trim() || "",
          };
          setFields(merged);
        } catch {
          /* keep merged as working if oEmbed / OG fails */
        }
      }

      if (!hasMinimumSongFields(merged)) {
        setShowResponseDetails(true);
        setSubmitError(
          "Add at least a YouTube id, a streaming link, artist/title, or a label.",
        );
        return;
      }

      await createResponse(token, selectedDate, promptPayload.prompt, merged);
      setPasteBlob("");
      setFields(emptyFields());
      setShowResponseDetails(false);
      setExpandAllSongFields(false);
      await loadResponses();
      await refreshSession();
    } catch (e) {
      setShowResponseDetails(true);
      setSubmitError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSubmitBusy(false);
    }
  }, [
    fields,
    getApiAccessToken,
    hasPrompt,
    loadResponses,
    pasteBlob,
    promptPayload?.prompt,
    refreshSession,
    selectedDate,
  ]);

  const onBulkImport = useCallback(async () => {
    setBulkNotice(null);
    setBulkBusy(true);
    try {
      const token = await getApiAccessToken();
      const r = await bulkImportPrompts(token, bulkText);
      setBulkNotice({
        kind: "success",
        message: `Imported ${r.total} line(s): ${r.created_count} new, ${r.updated_count} updated.`,
      });
      setBulkText("");
      await loadPrompt();
      const rows = await fetchAllSongPrompts(token);
      setPromptCatalog(rows);
    } catch (e) {
      setBulkNotice({
        kind: "error",
        message: e instanceof Error ? e.message : "Import failed.",
      });
    } finally {
      setBulkBusy(false);
    }
  }, [bulkText, getApiAccessToken, loadPrompt]);

  const onHeartToggle = useCallback(
    async (entryId: number) => {
      setHeartBusyId(entryId);
      try {
        const token = await getApiAccessToken();
        const r = await toggleHeart(token, entryId);
        setResponses((prev) =>
          prev.map((row) =>
            row.id === entryId
              ? {
                  ...row,
                  heart_count: r.heart_count,
                  viewer_has_hearted: r.viewer_has_hearted,
                }
              : row,
          ),
        );
        await refreshSession();
      } catch {
        /* ignore */
      } finally {
        setHeartBusyId(null);
      }
    },
    [getApiAccessToken, refreshSession],
  );

  const goPrev = useCallback(() => {
    if (!canGoToPrevDay(selectedDate)) return;
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(startOfDay(d));
  }, [selectedDate]);

  const goNext = useCallback(() => {
    if (!canGoToNextDay(selectedDate)) return;
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(startOfDay(d));
  }, [selectedDate]);

  const goToToday = useCallback(() => {
    setSelectedDate(getTodayStart());
  }, []);

  useEffect(() => {
    const raw = songadayEntryDateFromNav;
    if (!raw || typeof raw !== "string") return;
    const parts = raw.split("-");
    if (parts.length !== 3) return;
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d))
      return;
    const dt = startOfDay(new Date(y, m - 1, d));
    const max = getTodayStart();
    setSelectedDate(dt.getTime() > max.getTime() ? max : dt);
    setTab("prompt");
    navigate("/songaday", { replace: true, state: {} });
  }, [songadayEntryDateFromNav, navigate]);

  const onDismissNewSubmissionCard = useCallback(() => {
    setShowResponseDetails(false);
    setSubmitError(null);
    setExpandAllSongFields(false);
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  if (isLoading || !sessionUser) {
    return (
      <Stack gap="2" maxW="5xl">
        <Text fontWeight="semibold">Loading…</Text>
        {sessionError ? (
          <Text
            fontSize={APP_TEXT_SIZES.helper}
            color="nautical.solid"
            fontWeight="medium"
            role="alert"
          >
            {sessionError}
          </Text>
        ) : null}
      </Stack>
    );
  }

  const formDisabled = !hasPrompt || !isApproved;

  const showFullSongFieldForm =
    expandAllSongFields || applicableFieldGroups.showAll;

  return (
    <>
      {promptLoading || responsesLoading ? (
        <Box px={{ base: "2", md: "2" }} pb="2">
          <Text
            fontSize={APP_TEXT_SIZES.body}
            color="fg.muted"
            fontWeight="medium"
          >
            Loading…
          </Text>
        </Box>
      ) : null}
      <Tabs.Root
        value={tab}
        display="flex"
        flexDirection="column"
        flex="1"
        minH="full"
        lazyMount
        unmountOnExit
        variant="plain"
        data-pa-tabs="songaday"
        onValueChange={(details) => {
          const v = details.value;
          if (v === "prompt" || v === "archive" || v === "bulk") setTab(v);
        }}
      >
        <Tabs.List {...APP_SHELL_TAB_LIST_PROPS}>
          <Tabs.Trigger value="prompt" {...APP_SHELL_TAB_TRIGGER_PROPS}>
            Prompt
          </Tabs.Trigger>
          <Tabs.Trigger value="archive" {...APP_SHELL_TAB_TRIGGER_PROPS}>
            Archive
          </Tabs.Trigger>
          {isStaff ? (
            <Tabs.Trigger value="bulk" {...APP_SHELL_TAB_TRIGGER_PROPS}>
              Bulk import
            </Tabs.Trigger>
          ) : null}
        </Tabs.List>

        <Tabs.Content value="prompt" p={{ base: "2", md: "2" }}>
          <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
            {promptLoading ? (
              <PromptDayNavChrome
                selectedDate={selectedDate}
                onPrev={goPrev}
                onNext={goNext}
                onJumpToToday={goToToday}
              >
                <Box {...PANEL_ENTRY_CARD_PROPS} {...PROMPT_CARD_TEXT_ALIGN}>
                  <HStack justifyContent="center" gap="2">
                    <Spinner size="sm" colorPalette="teal" />
                    <Text fontSize={APP_TEXT_SIZES.body} fontWeight="medium">
                      Loading prompt…
                    </Text>
                  </HStack>
                </Box>
              </PromptDayNavChrome>
            ) : promptLoadError ? (
              <PromptDayNavChrome
                selectedDate={selectedDate}
                onPrev={goPrev}
                onNext={goNext}
                onJumpToToday={goToToday}
              >
                <Box {...PANEL_ENTRY_CARD_PROPS} {...PROMPT_CARD_TEXT_ALIGN}>
                  <Text
                    fontSize={APP_TEXT_SIZES.helper}
                    color="nautical.solid"
                    fontWeight="medium"
                    role="alert"
                  >
                    {promptLoadError}
                  </Text>
                </Box>
              </PromptDayNavChrome>
            ) : !hasPrompt ? (
              <PromptDayNavChrome
                selectedDate={selectedDate}
                onPrev={goPrev}
                onNext={goNext}
                onJumpToToday={goToToday}
              >
                <Box {...NO_PROMPT_CARD_PROPS} {...PROMPT_CARD_TEXT_ALIGN}>
                  <Text
                    fontSize={APP_TEXT_SIZES.label}
                    fontWeight="normal"
                    mb="2"
                  >
                    {formatDateLabel(selectedDate)}
                  </Text>
                  <Text fontSize={APP_TEXT_SIZES.body} fontWeight="medium">
                    There is no prompt for this day.{" "}
                    <RouterLink to="/about">
                      <Text
                        as="span"
                        color="nautical.contrast"
                        fontWeight="bold"
                        textDecoration="underline"
                      >
                        Please contact the site administrator.
                      </Text>
                    </RouterLink>
                  </Text>
                </Box>
              </PromptDayNavChrome>
            ) : (
              <PromptDayNavChrome
                selectedDate={selectedDate}
                onPrev={goPrev}
                onNext={goNext}
                onJumpToToday={goToToday}
              >
                <Box {...PANEL_ENTRY_CARD_PROPS} {...PROMPT_CARD_TEXT_ALIGN}>
                  <Text
                    fontSize={APP_TEXT_SIZES.label}
                    fontWeight="normal"
                    mb="2"
                  >
                    {formatDateLabel(selectedDate)}
                  </Text>
                  <Text {...PROMPT_BODY_STYLE}>{promptPayload?.prompt}</Text>
                </Box>
              </PromptDayNavChrome>
            )}

            {!myEntry && !isApproved ? (
              <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                Your account must be approved to submit.
              </Text>
            ) : null}

            {!myEntry ? (
              <Box
                {...PANEL_ENTRY_CARD_PROPS}
                opacity={formDisabled ? 0.6 : 1}
                pointerEvents={formDisabled ? "none" : "auto"}
              >
                <MealEditorBackdropDismiss
                  onDismiss={onDismissNewSubmissionCard}
                  disabled={submitBusy}
                  shouldDismiss={(target) =>
                    !target.closest('[role="tablist"]')
                  }
                >
                  <Stack gap="3">
                    <Text fontWeight="bold" fontSize={APP_TEXT_SIZES.label}>
                      Your response
                    </Text>
                    <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                      Enter a song title or YouTube/Spotify URL, then submit. If
                      anything needs fixing, we'll show the matching fields.
                    </Text>
                    <Flex
                      gap="3"
                      w="100%"
                      align="flex-start"
                      direction={{ base: "column", md: "row" }}
                    >
                      <Textarea
                        flex="1"
                        minW={0}
                        rows={3}
                        value={pasteBlob}
                        onChange={(e) => setPasteBlob(e.target.value)}
                        placeholder="Artist - Title or paste song URL"
                        {...FIELD}
                      />
                      <PondButton
                        type="button"
                        size="md"
                        colorPalette="teal"
                        onClick={() => void onSubmit()}
                        loading={submitBusy}
                        disabled={formDisabled}
                        flexShrink={0}
                        alignSelf={{ base: "stretch", md: "flex-start" }}
                        w={{ base: "100%", md: "auto" }}
                      >
                        Submit
                      </PondButton>
                    </Flex>

                    <Stack gap="1">
                      <Text fontSize={APP_TEXT_SIZES.meta} fontWeight="medium">
                        Notes (optional)
                      </Text>
                      <Textarea
                        rows={2}
                        value={fields.notes}
                        onChange={(e) =>
                          setFields((f) => ({ ...f, notes: e.target.value }))
                        }
                        {...FIELD}
                      />
                    </Stack>

                    {showResponseDetails ? (
                      <>
                        {(showFullSongFieldForm ||
                          applicableFieldGroups.artistTitle) && (
                          <HStack
                            gap="2"
                            align="flex-end"
                            w="100%"
                            flexWrap="nowrap"
                          >
                            <Stack flex="1" minW="0" gap="1">
                              <Text
                                fontSize={APP_TEXT_SIZES.meta}
                                fontWeight="medium"
                              >
                                Artist
                              </Text>
                              <Input
                                value={fields.artist}
                                onChange={(e) =>
                                  setFields((f) => ({
                                    ...f,
                                    artist: e.target.value,
                                  }))
                                }
                                {...FIELD}
                              />
                            </Stack>
                            <Stack flex="1" minW="0" gap="1">
                              <Text
                                fontSize={APP_TEXT_SIZES.meta}
                                fontWeight="medium"
                              >
                                Title
                              </Text>
                              <Input
                                value={fields.title}
                                onChange={(e) =>
                                  setFields((f) => ({
                                    ...f,
                                    title: e.target.value,
                                  }))
                                }
                                {...FIELD}
                              />
                            </Stack>
                          </HStack>
                        )}
                        {(showFullSongFieldForm ||
                          applicableFieldGroups.raw_label) && (
                          <Stack gap="1">
                            <Text
                              fontSize={APP_TEXT_SIZES.meta}
                              fontWeight="medium"
                            >
                              Label / free text
                            </Text>
                            <Input
                              value={fields.raw_label}
                              onChange={(e) =>
                                setFields((f) => ({
                                  ...f,
                                  raw_label: e.target.value,
                                }))
                              }
                              {...FIELD}
                            />
                          </Stack>
                        )}
                        {(showFullSongFieldForm ||
                          applicableFieldGroups.youtube) && (
                          <Stack gap="1">
                            <Text
                              fontSize={APP_TEXT_SIZES.meta}
                              fontWeight="medium"
                            >
                              YouTube video id
                            </Text>
                            <Input
                              value={fields.youtube_video_id}
                              onChange={(e) =>
                                setFields((f) => ({
                                  ...f,
                                  youtube_video_id: e.target.value,
                                }))
                              }
                              {...FIELD}
                            />
                          </Stack>
                        )}
                        {(showFullSongFieldForm ||
                          applicableFieldGroups.spotify) && (
                          <Stack gap="1">
                            <Text
                              fontSize={APP_TEXT_SIZES.meta}
                              fontWeight="medium"
                            >
                              Spotify URL
                            </Text>
                            <Input
                              value={fields.spotify_url}
                              onChange={(e) =>
                                setFields((f) => ({
                                  ...f,
                                  spotify_url: e.target.value,
                                }))
                              }
                              {...FIELD}
                            />
                          </Stack>
                        )}
                        {(showFullSongFieldForm ||
                          applicableFieldGroups.apple) && (
                          <Stack gap="1">
                            <Text
                              fontSize={APP_TEXT_SIZES.meta}
                              fontWeight="medium"
                            >
                              Apple Music URL
                            </Text>
                            <Input
                              value={fields.apple_music_url}
                              onChange={(e) =>
                                setFields((f) => ({
                                  ...f,
                                  apple_music_url: e.target.value,
                                }))
                              }
                              {...FIELD}
                            />
                          </Stack>
                        )}
                        {showResponseDetails && !showFullSongFieldForm ? (
                          <PondButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            colorPalette="sky"
                            onClick={() => setExpandAllSongFields(true)}
                          >
                            Show all fields
                          </PondButton>
                        ) : null}
                      </>
                    ) : null}

                    {submitError ? (
                      <Text
                        fontSize={APP_TEXT_SIZES.helper}
                        color="nautical.solid"
                        fontWeight="medium"
                        role="alert"
                      >
                        {submitError}
                      </Text>
                    ) : null}
                  </Stack>
                </MealEditorBackdropDismiss>
              </Box>
            ) : null}

            {responsesLoading ? (
              <HStack>
                <Spinner size="sm" colorPalette="teal" />
                <Text fontSize={APP_TEXT_SIZES.body} fontWeight="medium">
                  Loading responses…
                </Text>
              </HStack>
            ) : responsesLoadError ? (
              <Text
                fontSize={APP_TEXT_SIZES.helper}
                color="nautical.solid"
                fontWeight="medium"
                role="alert"
              >
                {responsesLoadError}
              </Text>
            ) : !myEntry && friendsResponsesOrdered.length === 0 ? (
              <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
                No other responses for this day yet.
              </Text>
            ) : (
              <SimpleGrid
                columns={{ base: 1, md: 2 }}
                gap="3"
                w="full"
                alignItems="start"
              >
                {myEntry ? (
                  <SongadayListCard
                    key={myEntry.id}
                    readOnly
                    entry={myEntry}
                    myUserId={myUserId}
                    submissionEditOpen={submissionEditOpen}
                    onMineCardClick={() => setSubmissionEditOpen((v) => !v)}
                    footer={
                      (myEntry.comment_count ?? 0) > 0 ? (
                        <SongadayCommentsPanel
                          getAccessToken={getApiAccessToken}
                          responseId={myEntry.id}
                          myUserId={myUserId}
                          ownerNotes={myEntry.notes}
                          showOwnerNotesBlock={false}
                          maxListHeight="220px"
                          hideComposeUntilCommentFromOther
                          composeExpanded={ownCommentPanelOpen}
                          middleSlot={
                            <Box alignSelf="flex-start">
                              <SongadayCommentChatButton
                                commentCount={myEntry.comment_count ?? 0}
                                hideCount
                                expanded={ownCommentPanelOpen}
                                onToggle={() => setOwnCommentPanelOpen((o) => !o)}
                              />
                            </Box>
                          }
                          onCommentCountChanged={(c) => {
                            setResponses((prev) =>
                              prev.map((r) => (r.id === myEntry.id ? { ...r, comment_count: c } : r)),
                            );
                          }}
                          onCommentPosted={() => setOwnCommentPanelOpen(false)}
                        />
                      ) : null
                    }
                  />
                ) : null}
                {friendsResponsesOrdered.map((entry) => (
                  <SongadayListCard
                    key={entry.id}
                    entry={entry}
                    myUserId={myUserId}
                    heartBusy={heartBusyId === entry.id}
                    onHeartToggle={() => void onHeartToggle(entry.id)}
                    footer={
                      <SongadayCommentsPanel
                        getAccessToken={getApiAccessToken}
                        responseId={entry.id}
                        myUserId={myUserId}
                        ownerNotes={entry.notes}
                        showOwnerNotesBlock={false}
                        maxListHeight="220px"
                        composeExpanded={friendCommentPanelOpenId === entry.id}
                        middleSlot={
                          <Box alignSelf="flex-start">
                            <SongadayCommentChatButton
                              commentCount={entry.comment_count ?? 0}
                              hideCount
                              expanded={friendCommentPanelOpenId === entry.id}
                              onToggle={() =>
                                setFriendCommentPanelOpenId((cur) =>
                                  cur === entry.id ? null : entry.id,
                                )
                              }
                            />
                          </Box>
                        }
                        onCommentCountChanged={(c) => {
                          setResponses((prev) =>
                            prev.map((r) => (r.id === entry.id ? { ...r, comment_count: c } : r)),
                          );
                        }}
                        onCommentPosted={() => setFriendCommentPanelOpenId(null)}
                      />
                    }
                  />
                ))}
              </SimpleGrid>
            )}

            {myEntry && submissionEditOpen ? (
              <SongadaySubmissionEditBlock
                entry={myEntry}
                getAccessToken={getApiAccessToken}
                onSaved={(row) => {
                  setResponses((prev) => prev.map((r) => (r.id === row.id ? row : r)));
                  void refreshSession();
                }}
                onClose={() => setSubmissionEditOpen(false)}
              />
            ) : null}
          </Stack>
        </Tabs.Content>

        <Tabs.Content value="archive" p={{ base: "2", md: "2" }}>
          <SongadayArchivePanel
            variant="embedded"
            onSelectArchiveEntryDate={(iso) => {
              const parts = iso.split("-");
              if (parts.length !== 3) return;
              const y = Number(parts[0]);
              const m = Number(parts[1]);
              const d = Number(parts[2]);
              if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d))
                return;
              const dt = startOfDay(new Date(y, m - 1, d));
              const max = getTodayStart();
              setSelectedDate(dt.getTime() > max.getTime() ? max : dt);
              setTab("prompt");
            }}
          />
        </Tabs.Content>

        {isStaff ? (
          <Tabs.Content value="bulk" p={{ base: "2", md: "2" }}>
            <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
              <Box {...PANEL_ENTRY_CARD_PROPS}>
                <Text fontWeight="bold" fontSize={APP_TEXT_SIZES.label} mb="2">
                  Bulk import prompts
                </Text>
                <Text
                  fontSize={APP_TEXT_SIZES.body}
                  lineHeight="tall"
                  color="fg"
                  mb="3"
                >
                  Paste one line per prompt. Each line must start with month and
                  day, then the prompt text.
                </Text>
                <Box bg="white" {...PANEL_NESTED_BLOCK_PROPS}>
                  <Stack gap="2">
                    <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                      Format: <code>MM DD Prompt text…</code>
                    </Text>
                    <Textarea
                      rows={10}
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      {...FIELD}
                    />
                    <PondButton
                      type="button"
                      colorPalette="teal"
                      onClick={() => void onBulkImport()}
                      loading={bulkBusy}
                    >
                      Import
                    </PondButton>
                    {bulkNotice ? (
                      <Text
                        fontSize={APP_TEXT_SIZES.helper}
                        fontWeight="medium"
                        color={
                          bulkNotice.kind === "error"
                            ? "nautical.solid"
                            : "teal.solid"
                        }
                        role={bulkNotice.kind === "error" ? "alert" : "status"}
                      >
                        {bulkNotice.message}
                      </Text>
                    ) : null}
                  </Stack>
                </Box>
              </Box>
              {promptCatalogLoading ? (
                <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                  Loading catalog…
                </Text>
              ) : promptCatalogError ? (
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="nautical.solid"
                  fontWeight="medium"
                  role="alert"
                >
                  {promptCatalogError}
                </Text>
              ) : promptCatalog.length === 0 ? (
                <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                  No prompts in the database yet. Import lines above to add
                  calendar prompts.
                </Text>
              ) : (
                <Box
                  maxH="240px"
                  overflowY="auto"
                  borderWidth="1px"
                  borderColor="border"
                  borderRadius="md"
                  bg="white"
                  p="2"
                >
                  <Stack gap="1">
                    {promptCatalog.map((row, idx) => (
                      <Text
                        key={`${row.month}-${row.day}-${idx}`}
                        fontSize={APP_TEXT_SIZES.helper}
                        lineHeight="tall"
                      >
                        <Text as="span" fontWeight="semibold" color="fg.muted">
                          {String(row.month).padStart(2, "0")}{" "}
                          {String(row.day).padStart(2, "0")}
                        </Text>{" "}
                        {row.prompt}
                      </Text>
                    ))}
                  </Stack>
                </Box>
              )}
            </Stack>
          </Tabs.Content>
        ) : null}
      </Tabs.Root>
    </>
  );
}
