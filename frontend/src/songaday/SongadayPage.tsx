import {
  Box,
  Collapsible,
  Flex,
  HStack,
  Input,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Link as RouterLink, useLocation, useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import {
  PanelBlockSkeleton,
  PanelErrorState,
  PanelListRowSkeleton,
  PanelSessionReconnect,
  SessionLoadingCard,
} from "../components/panelStatus";
import { MealEditorBackdropDismiss } from "../meal/MealEditorBackdropDismiss";
import PondButton from "../PondButton";
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
  fetchResponsesArchive,
  fetchResponsesForDate,
  fetchSongadayDayWindow,
  resolveSongLinkMetadata,
  songadaySlackDailyPromptSync,
  toggleHeart,
} from "./api";
import { parseSongPasteInput } from "./parseSongInput";
import SongadayCommentChatButton from "./SongadayCommentChatButton";
import SongadayCommentsPanel from "./SongadayCommentsPanel";
import SongadayListCard from "./SongadayListCard";
import SongadayMonthArchive from "./SongadayMonthArchive";
import SongadaySubmissionEditBlock from "./SongadaySubmissionEditBlock";
import type {
  ParsedSongFields,
  SongadayPromptPayload,
  SongadayResponse,
  SongPromptCatalogRow,
} from "./types";

const FIELD = { ...PANEL_FIELD_PROPS, ...PANEL_FORM_PLACEHOLDER_PROPS };

const NO_PROMPT_CARD_PROPS = {
  ...PANEL_ENTRY_CARD_PROPS,
  bg: "nautical.solid",
  borderColor: "nautical.border",
  color: "nautical.contrast",
};

const PROMPT_CARD_MIN_H = "5.25rem" as const;

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

function isoDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateFromIsoKey(iso: string): Date | null {
  const parts = iso.split("-").map(Number);
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return startOfDay(new Date(y, m - 1, d));
}

function dateRangeKeysForInitialLoad(): string[] {
  const out: string[] = [];
  const t = getTodayStart();
  for (let i = 0; i <= MAX_DAYS_BACK; i++) {
    const d = new Date(t);
    d.setDate(d.getDate() - i);
    out.push(isoDateKey(startOfDay(d)));
  }
  return out;
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
    resyncSessionSilently,
    error: sessionError,
  } = useAppSession();

  const [selectedDate, setSelectedDate] = useState(() =>
    startOfDay(new Date()),
  );
  const [bulkOpen, setBulkOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveSeed, setArchiveSeed] = useState<{
    rows: SongadayResponse[];
    nextPage: number;
    total: number;
  } | null>(null);
  const archiveSeedFetched = useRef(false);
  const [songadayReady, setSongadayReady] = useState(false);

  const [promptPayload, setPromptPayload] =
    useState<SongadayPromptPayload | null>(null);
  const [promptLoadError, setPromptLoadError] = useState<string | null>(null);
  const [promptLoading, setPromptLoading] = useState(true);

  const [responses, setResponses] = useState<SongadayResponse[]>([]);
  const [responsesLoadError, setResponsesLoadError] = useState<string | null>(
    null,
  );
  const [responsesLoading, setResponsesLoading] = useState(true);

  const [promptByDay, setPromptByDay] = useState<Record<string, SongadayPromptPayload | null>>({});
  const [promptErrorByDay, setPromptErrorByDay] = useState<Record<string, string | null>>({});
  const [responsesByDay, setResponsesByDay] = useState<Record<string, SongadayResponse[]>>({});
  const [responsesErrorByDay, setResponsesErrorByDay] = useState<Record<string, string | null>>({});

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
    if (!bulkNotice) return;
    const t = window.setTimeout(() => setBulkNotice(null), 7000);
    return () => window.clearTimeout(t);
  }, [bulkNotice]);

  useEffect(() => {
    if (!bulkOpen || !isStaff) return;
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
  }, [bulkOpen, isStaff, getApiAccessToken]);

  const prefetchDay = useCallback(
    async (iso: string) => {
      const d = dateFromIsoKey(iso);
      if (!d) return;
      const token = await getApiAccessToken();
      const [pRes, rRes] = await Promise.allSettled([
        fetchPromptForDate(token, d),
        fetchResponsesForDate(token, d),
      ]);
      if (pRes.status === "fulfilled") {
        setPromptByDay((prev) => ({ ...prev, [iso]: pRes.value }));
        setPromptErrorByDay((prev) => ({ ...prev, [iso]: null }));
      } else {
        setPromptByDay((prev) => ({ ...prev, [iso]: null }));
        setPromptErrorByDay((prev) => ({
          ...prev,
          [iso]:
            pRes.reason instanceof Error ? pRes.reason.message : "Failed to load prompt.",
        }));
      }
      if (rRes.status === "fulfilled") {
        setResponsesByDay((prev) => ({ ...prev, [iso]: rRes.value }));
        setResponsesErrorByDay((prev) => ({ ...prev, [iso]: null }));
      } else {
        setResponsesByDay((prev) => ({ ...prev, [iso]: [] }));
        setResponsesErrorByDay((prev) => ({
          ...prev,
          [iso]:
            rRes.reason instanceof Error ? rRes.reason.message : "Failed to load responses.",
        }));
      }
    },
    [getApiAccessToken],
  );

  useEffect(() => {
    if (!isAuthenticated || !sessionUser) return;
    if (!sessionUser.user.is_approved) {
      setSongadayReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const token = await getApiAccessToken();
        const keys = dateRangeKeysForInitialLoad();
        const sorted = [...keys].sort();
        const startIso = sorted[0];
        const endIso = sorted[sorted.length - 1];
        if (!startIso || !endIso) {
          setSongadayReady(true);
          return;
        }
        const payload = await fetchSongadayDayWindow(token, startIso, endIso);
        if (cancelled) return;
        setPromptByDay((prev) => ({ ...prev, ...payload.prompts }));
        setResponsesByDay((prev) => ({ ...prev, ...payload.responses }));
        const cleared: Record<string, null> = {};
        for (const k of keys) {
          cleared[k] = null;
        }
        setPromptErrorByDay((prev) => ({ ...prev, ...cleared }));
        setResponsesErrorByDay((prev) => ({ ...prev, ...cleared }));
        archiveSeedFetched.current = true;
        setArchiveSeed({
          rows: payload.archive_seed.results,
          nextPage: 2,
          total: payload.archive_seed.total,
        });
      } catch {
        const keys = dateRangeKeysForInitialLoad();
        await Promise.all(keys.map((k) => prefetchDay(k)));
        try {
          const token = await getApiAccessToken();
          const payload = await fetchResponsesArchive(token, null, 1, 50);
          if (!cancelled) {
            setArchiveSeed({
              rows: payload.results,
              nextPage: 2,
              total: payload.total,
            });
          }
        } catch {
          /* ignore */
        }
        archiveSeedFetched.current = true;
      } finally {
        if (!cancelled) setSongadayReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, sessionUser, getApiAccessToken, prefetchDay]);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    if (!isAuthenticated || !sessionUser?.user?.is_approved) return;
    void (async () => {
      try {
        const token = await getApiAccessToken();
        await songadaySlackDailyPromptSync(token);
      } catch {
        /* Slack prompt sync is optional */
      }
    })();
  }, [isAuthenticated, sessionUser?.user?.is_approved, getApiAccessToken]);

  // Keep selected day view in sync with cache (instant when prefetched).
  useEffect(() => {
    const iso = isoDateKey(startOfDay(selectedDate));
    const p = Object.prototype.hasOwnProperty.call(promptByDay, iso)
      ? (promptByDay[iso] ?? null)
      : undefined;
    const r = Object.prototype.hasOwnProperty.call(responsesByDay, iso)
      ? responsesByDay[iso]
      : undefined;

    if (p !== undefined) {
      setPromptPayload(p);
      setPromptLoadError(promptErrorByDay[iso] ?? null);
      setPromptLoading(false);
    } else {
      setPromptPayload(null);
      setPromptLoadError(null);
      setPromptLoading(true);
      void prefetchDay(iso);
    }

    if (r !== undefined) {
      setResponses(r);
      setResponsesLoadError(responsesErrorByDay[iso] ?? null);
      setResponsesLoading(false);
    } else {
      setResponses([]);
      setResponsesLoadError(null);
      setResponsesLoading(true);
      void prefetchDay(iso);
    }
  }, [
    selectedDate,
    prefetchDay,
    promptByDay,
    promptErrorByDay,
    responsesByDay,
    responsesErrorByDay,
  ]);

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
      await prefetchDay(isoDateKey(startOfDay(selectedDate)));
      await resyncSessionSilently();
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
    pasteBlob,
    promptPayload?.prompt,
    prefetchDay,
    resyncSessionSilently,
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
      await prefetchDay(isoDateKey(startOfDay(selectedDate)));
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
  }, [bulkText, getApiAccessToken, prefetchDay, selectedDate]);

  const onHeartToggle = useCallback(
    async (entryId: number) => {
      setHeartBusyId(entryId);
      try {
        const token = await getApiAccessToken();
        const r = await toggleHeart(token, entryId);
        const iso = isoDateKey(startOfDay(selectedDate));
        const apply = (prev: SongadayResponse[]) =>
          prev.map((row) =>
            row.id === entryId
              ? {
                  ...row,
                  heart_count: r.heart_count,
                  viewer_has_hearted: r.viewer_has_hearted,
                }
              : row,
          );
        setResponses(apply);
        setResponsesByDay((prev) => {
          const existing = prev[iso];
          if (!existing) return prev;
          return { ...prev, [iso]: apply(existing) };
        });
        void resyncSessionSilently();
      } catch {
        /* ignore */
      } finally {
        setHeartBusyId(null);
      }
    },
    [getApiAccessToken, resyncSessionSilently, selectedDate],
  );

  const goPrev = useCallback(() => {
    if (!canGoToPrevDay(selectedDate)) return;
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setArchiveOpen(false);
    setSelectedDate(startOfDay(d));
  }, [selectedDate]);

  const goNext = useCallback(() => {
    if (!canGoToNextDay(selectedDate)) return;
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setArchiveOpen(false);
    setSelectedDate(startOfDay(d));
  }, [selectedDate]);

  const goToToday = useCallback(() => {
    setArchiveOpen(false);
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
  if (isLoading) {
    return <SessionLoadingCard />;
  }
  if (!sessionUser) {
    return (
      <PanelSessionReconnect
        sessionError={sessionError}
        onRetry={() => void refreshSession()}
      />
    );
  }

  const formDisabled = !hasPrompt || !isApproved;

  const showFullSongFieldForm =
    expandAllSongFields || applicableFieldGroups.showAll;

  const isViewingToday =
    startOfDay(selectedDate).getTime() === getTodayStart().getTime();

  const showArchiveToggle = Boolean(myEntry);

  const promptCard = promptLoading ? (
    <Box
      {...PANEL_ENTRY_CARD_PROPS}
      minH={PROMPT_CARD_MIN_H}
      display="flex"
      alignItems="center"
    >
      <PanelBlockSkeleton lines={1} showTitleLine />
    </Box>
  ) : promptLoadError ? (
    <Box
      {...PANEL_ENTRY_CARD_PROPS}
      minH={PROMPT_CARD_MIN_H}
      display="flex"
      alignItems="center"
    >
      <PanelErrorState
        title="Could not load prompt."
        description={promptLoadError}
        actionLabel="Refresh"
        onAction={() =>
          void prefetchDay(isoDateKey(startOfDay(selectedDate)))
        }
      />
    </Box>
  ) : !hasPrompt ? (
    <Box
      {...NO_PROMPT_CARD_PROPS}
      minH={PROMPT_CARD_MIN_H}
      display="flex"
      alignItems="center"
    >
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
  ) : (
    <Box
      bg="#AFDEE4"
      color="navy.solid"
      borderRadius="xl"
      p={{ base: "2.5", md: "2.5" }}
      boxShadow="sm"
      minH={PROMPT_CARD_MIN_H}
      display="flex"
      justifyContent="center"
    >
      <Stack gap="0" alignItems="center" justifyContent="space-evenly">
        <Text fontSize={APP_TEXT_SIZES.helper} opacity={0.88}>
          {formatDateLabel(selectedDate)}
        </Text>
        <Text fontWeight="bold" fontSize={APP_TEXT_SIZES.label}>
          Today’s Prompt: “{promptPayload?.prompt ?? ""}”
        </Text>
      </Stack>
    </Box>
  );

  return (
    <Stack
      gap={{ base: "4", md: "4" }}
      px={{ base: "2", md: "2" }}
      pt={{ base: "2", md: "2" }}
      pb="2"
    >
      <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
        {isApproved && !songadayReady ? (
          <Text
            fontSize={APP_TEXT_SIZES.helper}
            color="fg.muted"
            fontWeight="medium"
            aria-live="polite"
          >
            Loading…
          </Text>
        ) : null}
        {/* Day nav: prompt card centered; stacked controls left/right */}
        <HStack w="100%" gap="0" align="stretch">
          <Stack gap="0" align="stretch" flexShrink={0} w={{ base: "3.25rem", md: "3.5rem" }}>
            {canGoToPrevDay(selectedDate) ? (
              <PondButton
                type="button"
                size="sm"
                p={0}
                variant="ghost"
                color="navy"
                colorPalette="navy"
                w="full"
                onClick={goPrev}
                aria-label="Previous day"
                _hover={{ color: "navy" }}
              >
                ←
              </PondButton>
            ) : null}
            <PondButton
              type="button"
              size="sm"
              p={0}
              variant="ghost"
              colorPalette="navy"
              color="navy"
              w="full"
              aria-label="Song archive"
              visibility={showArchiveToggle ? "visible" : "hidden"}
              pointerEvents={showArchiveToggle ? "auto" : "none"}
              _hover={{ color: "navy" }}
              onClick={() => setArchiveOpen((o) => !o)}
            >
              ☰
            </PondButton>
          </Stack>

          <Box flex="1" minW={0} display="flex" alignItems="stretch">
            <Box w="full">{promptCard}</Box>
          </Box>

          <Stack gap="0" align="stretch" flexShrink={0} w={{ base: "3.25rem", md: "3.5rem" }}>
            {canGoToNextDay(selectedDate) ? (
              <PondButton
                type="button"
                size="sm"
                p={0}
                variant="ghost"
                colorPalette="navy"
                color="navy"
                w="full"
                onClick={goNext}
                aria-label="Next day"
                _hover={{ color: "navy" }}
              >
                →
              </PondButton>
            ) : null}
            <PondButton
              type="button"
              size="sm"
              p={0}
              variant="ghost"
              colorPalette="navy"
              color="navy"
              w="full"
              onClick={goToToday}
              aria-label="Fast forward to today"
              visibility={!isViewingToday ? "visible" : "hidden"}
              pointerEvents={!isViewingToday ? "auto" : "none"}
              _hover={{ color: "navy" }}
            >
              {`>>`}
            </PondButton>
          </Stack>
        </HStack>

        {showArchiveToggle ? (
          <Collapsible.Root open={archiveOpen} onOpenChange={(d) => setArchiveOpen(d.open)}>
            <Collapsible.Content>
              <Box mt="3">
                <SongadayMonthArchive
                  open={archiveOpen}
                  getApiAccessToken={getApiAccessToken}
                  archiveUserId={null}
                  seed={archiveSeed}
                  onSelectEntryDate={(iso) => {
                    const dt = dateFromIsoKey(iso);
                    if (dt) {
                      const max = getTodayStart();
                      setSelectedDate(
                        dt.getTime() > max.getTime() ? max : startOfDay(dt),
                      );
                    }
                    setArchiveOpen(false);
                  }}
                />
              </Box>
            </Collapsible.Content>
          </Collapsible.Root>
        ) : null}

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
                  <Stack gap="2">
                    <Text fontWeight="bold" fontSize={APP_TEXT_SIZES.label}>
                      Your Response:
                    </Text>
                    <Flex
                      gap="2"
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
                        placeholder="Enter a song title or YouTube/Spotify URL, then submit."
                        {...FIELD}
                      />
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

                    <PondButton
                      type="button"
                      size="md"
                      colorPalette="teal"
                      onClick={() => void onSubmit()}
                      loading={submitBusy}
                      disabled={formDisabled}
                      alignSelf={{ base: "stretch", md: "flex-start" }}
                      w={{ base: "100%", md: "auto" }}
                    >
                      Submit
                    </PondButton>

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
              <Box {...PANEL_ENTRY_CARD_PROPS}>
                <PanelListRowSkeleton rows={2} />
              </Box>
            ) : responsesLoadError ? (
              <Text
                fontSize={APP_TEXT_SIZES.helper}
                color="nautical.solid"
                fontWeight="medium"
                role="alert"
              >
                {responsesLoadError}
              </Text>
            ) : archiveOpen ? null : !myEntry &&
              friendsResponsesOrdered.length === 0 ? null : (
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
                    inCardAfterBody={
                      submissionEditOpen ? (
                        <Box
                          cursor="default"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <SongadaySubmissionEditBlock
                            entry={myEntry}
                            getAccessToken={getApiAccessToken}
                            onSaved={(row) => {
                              setResponses((prev) => prev.map((r) => (r.id === row.id ? row : r)));
                              void resyncSessionSilently();
                            }}
                            onDeleted={(entryId) => {
                              const iso = isoDateKey(startOfDay(selectedDate));
                              const remove = (rows: SongadayResponse[]) =>
                                rows.filter((r) => r.id !== entryId);
                              setResponses((prev) => remove(prev));
                              setResponsesByDay((prev) => {
                                const existing = prev[iso];
                                if (!existing) return prev;
                                return { ...prev, [iso]: remove(existing) };
                              });
                              setSubmissionEditOpen(false);
                              void resyncSessionSilently();
                            }}
                            onClose={() => setSubmissionEditOpen(false)}
                          />
                        </Box>
                      ) : null
                    }
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
          </Stack>

      {/* Staff-only bulk importer (collapsed, bottom) */}
      {isStaff ? (
        <Collapsible.Root open={bulkOpen} onOpenChange={(d) => setBulkOpen(d.open)}>
          <Collapsible.Trigger asChild>
            <PondButton
              type="button"
              variant={bulkOpen ? "solid" : "outline"}
              colorPalette="nautical"
              w="100%"
            >
              {bulkOpen ? "Hide bulk importer" : "Staff: Bulk importer"}
            </PondButton>
          </Collapsible.Trigger>
          <Collapsible.Content>
            <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} mt="3">
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
                <Box bg="bg.subtle" {...PANEL_NESTED_BLOCK_PROPS}>
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
                <Box
                  maxH="240px"
                  overflow="hidden"
                  borderWidth="1px"
                  borderColor="border"
                  borderRadius="md"
                  bg="bg"
                  p="2"
                >
                  <PanelListRowSkeleton rows={4} />
                </Box>
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
          </Collapsible.Content>
        </Collapsible.Root>
      ) : null}
    </Stack>
  );
}
