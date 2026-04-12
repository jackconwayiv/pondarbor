import {
  Box,
  Card,
  Heading,
  HStack,
  Input,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink, Navigate, useLocation, useNavigate, useParams } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FIELD_PROPS,
  PANEL_FORM_PLACEHOLDER_PROPS,
  PANEL_NESTED_BLOCK_PROPS,
} from "../theme/typography";
import { deleteResponse, fetchResponse, patchResponse, toggleHeart } from "./api";
import { cleanStreamingTitleLine } from "./cleanSongLabel";
import { MealEditorBackdropDismiss } from "../meal/MealEditorBackdropDismiss";
import SongadayHeartButton from "./SongadayHeartButton";
import SongadayHeartReadOnly from "./SongadayHeartReadOnly";
import SongadayMediaBlock from "./SongadayMediaBlock";
import type { SongadayResponse } from "./types";

const FIELD = { ...PANEL_FIELD_PROPS, ...PANEL_FORM_PLACEHOLDER_PROPS };

type LocationState = { songadayReturnTo?: string } | null;

export default function SongadayEntryDetailPage() {
  const { entryId: entryIdParam } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;
  const returnTo = (state?.songadayReturnTo ?? "/songaday").trim() || "/songaday";

  const {
    isAuthenticated,
    isLoading,
    sessionUser,
    getApiAccessToken,
    refreshSession,
    error: sessionError,
  } = useAppSession();

  const entryId = entryIdParam ? Number.parseInt(entryIdParam, 10) : Number.NaN;
  const [entry, setEntry] = useState<SongadayResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [notes, setNotes] = useState("");
  const [artist, setArtist] = useState("");
  const [title, setTitle] = useState("");
  const [rawLabel, setRawLabel] = useState("");
  const [youtubeVideoId, setYoutubeVideoId] = useState("");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [appleMusicUrl, setAppleMusicUrl] = useState("");

  const serverRef = useRef<SongadayResponse | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmDeleteButtonRef = useRef<HTMLButtonElement | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const myUserId = sessionUser?.user.id ?? 0;
  const isMine = entry ? entry.user.id === myUserId : false;

  const load = useCallback(async () => {
    if (!Number.isFinite(entryId)) {
      setLoadError("Invalid entry.");
      return;
    }
    setLoadError(null);
    try {
      const token = await getApiAccessToken();
      const row = await fetchResponse(token, entryId);
      setEntry(row);
      serverRef.current = row;
      setNotes(row.notes);
      setArtist(row.artist);
      setTitle(row.title);
      setRawLabel(row.raw_label);
      setYoutubeVideoId(row.youtube_video_id);
      setSpotifyUrl(row.spotify_url);
      setAppleMusicUrl(row.apple_music_url);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load.");
      setEntry(null);
    }
  }, [entryId, getApiAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 7000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const flush = useCallback(async () => {
    if (!entry || !isMine || !serverRef.current) return;
    const s = serverRef.current;
    const patch: Parameters<typeof patchResponse>[2] = {};
    if (notes.trim() !== (s.notes ?? "")) patch.notes = notes;
    if (artist.trim() !== (s.artist ?? "")) patch.artist = artist;
    if (title.trim() !== (s.title ?? "")) patch.title = title;
    if (rawLabel.trim() !== (s.raw_label ?? "")) patch.raw_label = rawLabel;
    if (youtubeVideoId.trim() !== (s.youtube_video_id ?? "")) patch.youtube_video_id = youtubeVideoId;
    if (spotifyUrl.trim() !== (s.spotify_url ?? "")) patch.spotify_url = spotifyUrl;
    if (appleMusicUrl.trim() !== (s.apple_music_url ?? "")) patch.apple_music_url = appleMusicUrl;
    if (Object.keys(patch).length === 0) return;
    try {
      const token = await getApiAccessToken();
      const updated = await patchResponse(token, entry.id, patch);
      setEntry(updated);
      serverRef.current = updated;
      await refreshSession();
    } catch (e) {
      setNotice({
        kind: "error",
        message: e instanceof Error ? e.message : "Could not save changes.",
      });
    }
  }, [
    appleMusicUrl,
    artist,
    entry,
    getApiAccessToken,
    isMine,
    notes,
    rawLabel,
    refreshSession,
    spotifyUrl,
    title,
    youtubeVideoId,
  ]);

  const onDismissEditor = useCallback(async () => {
    if (confirmDelete) {
      setConfirmDelete(false);
      return;
    }
    await flush();
    navigate(returnTo);
  }, [confirmDelete, flush, navigate, returnTo]);

  const onDelete = useCallback(async () => {
    if (!entry) return;
    try {
      const token = await getApiAccessToken();
      await deleteResponse(token, entry.id);
      await refreshSession();
      navigate(returnTo);
    } catch (e) {
      setNotice({
        kind: "error",
        message: e instanceof Error ? e.message : "Could not delete entry.",
      });
    }
  }, [entry, getApiAccessToken, navigate, refreshSession, returnTo]);

  const heartToggle = useCallback(async () => {
    if (!entry || isMine) return;
    try {
      const token = await getApiAccessToken();
      const r = await toggleHeart(token, entry.id);
      setEntry((prev) => (prev ? { ...prev, heart_count: r.heart_count, viewer_has_hearted: r.viewer_has_hearted } : prev));
      await refreshSession();
    } catch {
      /* ignore */
    }
  }, [entry, getApiAccessToken, isMine, refreshSession]);

  const dateLabel = useMemo(() => {
    if (!entry?.entry_date) return "";
    const [y, m, d] = entry.entry_date.split("-").map(Number);
    if (!y || !m || !d) return entry.entry_date;
    return new Date(y, m - 1, d).toLocaleDateString();
  }, [entry?.entry_date]);

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  if (isLoading || !sessionUser) {
    return (
      <Stack gap="2" maxW="4xl">
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

  if (!sessionUser.user.is_approved) {
    return (
      <Text fontSize={APP_TEXT_SIZES.helper}>Your account is not approved yet.</Text>
    );
  }

  if (!Number.isFinite(entryId) || loadError) {
    return (
      <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} px={{ base: "2", md: "2" }} pb={{ base: "2", md: "2" }}>
        <Text
          fontSize={APP_TEXT_SIZES.helper}
          color="nautical.solid"
          fontWeight="medium"
          role="alert"
        >
          {loadError ?? "Not found."}
        </Text>
        <PondButton asChild colorPalette="lilypad">
          <RouterLink to="/songaday">Return to Song a Day</RouterLink>
        </PondButton>
      </Stack>
    );
  }

  if (!entry) {
    return (
      <Stack gap="2" px={{ base: "2", md: "2" }} pb={{ base: "2", md: "2" }}>
        <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
          Loading entry…
        </Text>
      </Stack>
    );
  }

  const entryCard = (
    <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
      <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
        <Stack gap="4" w="100%">
          <HStack justify="space-between" align="flex-start" gap="3" w="100%">
            <Heading
              size={{ base: "md", md: "lg" }}
              fontWeight="bold"
              flex="1"
              minW={0}
            >
              {entry.user.nickname}&apos;s song — {dateLabel}
            </Heading>
            <Box flexShrink={0}>
              {isMine ? (
                <SongadayHeartReadOnly heartCount={entry.heart_count} />
              ) : (
                <SongadayHeartButton
                  heartCount={entry.heart_count}
                  viewerHasHearted={entry.viewer_has_hearted}
                  onToggle={() => void heartToggle()}
                />
              )}
            </Box>
          </HStack>

          <Box bg="gray.100" w="100%" {...PANEL_NESTED_BLOCK_PROPS}>
            <Text fontSize={APP_TEXT_SIZES.meta} fontWeight="bold" mb="1">
              Prompt (snapshot)
            </Text>
            <Text whiteSpace="pre-wrap" fontSize={APP_TEXT_SIZES.body} lineHeight="tall">
              {entry.prompt_snapshot}
            </Text>
          </Box>

            <SongadayMediaBlock entry={entry} />

            {isMine ? (
              <Stack gap="3">
                <Text fontWeight="bold" fontSize={APP_TEXT_SIZES.label}>
                  Edit your submission
                </Text>
                <HStack gap="2" align="flex-end" w="100%" flexWrap="nowrap">
                  <Stack flex="1" minW="0" gap="1">
                    <Text fontSize={APP_TEXT_SIZES.meta}>Artist</Text>
                    <Input
                      value={artist}
                      onChange={(e) => setArtist(e.target.value)}
                      onBlur={() => void flush()}
                      {...FIELD}
                    />
                  </Stack>
                  <Stack flex="1" minW="0" gap="1">
                    <Text fontSize={APP_TEXT_SIZES.meta}>Title</Text>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={() => void flush()}
                      {...FIELD}
                    />
                  </Stack>
                </HStack>
                <Stack gap="1">
                  <Text fontSize={APP_TEXT_SIZES.meta}>Notes</Text>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={() => void flush()}
                    rows={3}
                    {...FIELD}
                  />
                </Stack>
                <Stack gap="1">
                  <Text fontSize={APP_TEXT_SIZES.meta}>Label / free text</Text>
                  <Input
                    value={rawLabel}
                    onChange={(e) => setRawLabel(e.target.value)}
                    onBlur={() => void flush()}
                    {...FIELD}
                  />
                </Stack>
                <Stack gap="1">
                  <Text fontSize={APP_TEXT_SIZES.meta}>YouTube video id</Text>
                  <Input
                    value={youtubeVideoId}
                    onChange={(e) => setYoutubeVideoId(e.target.value)}
                    onBlur={() => void flush()}
                    {...FIELD}
                  />
                </Stack>
                <Stack gap="1">
                  <Text fontSize={APP_TEXT_SIZES.meta}>Spotify URL</Text>
                  <Input
                    value={spotifyUrl}
                    onChange={(e) => setSpotifyUrl(e.target.value)}
                    onBlur={() => void flush()}
                    {...FIELD}
                  />
                </Stack>
                <Stack gap="1">
                  <Text fontSize={APP_TEXT_SIZES.meta}>Apple Music URL</Text>
                  <Input
                    value={appleMusicUrl}
                    onChange={(e) => setAppleMusicUrl(e.target.value)}
                    onBlur={() => void flush()}
                    {...FIELD}
                  />
                </Stack>
                {entry.edited ? (
                  <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
                    Edited
                  </Text>
                ) : null}

                <HStack gap="2" flexWrap="wrap">
                  {confirmDelete ? (
                    <PondButton
                      ref={confirmDeleteButtonRef}
                      type="button"
                      colorPalette="nautical"
                      onClick={() => {
                        void onDelete();
                        setConfirmDelete(false);
                      }}
                    >
                      Confirm Delete
                    </PondButton>
                  ) : (
                    <PondButton
                      type="button"
                      variant="outline"
                      colorPalette="nautical"
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete
                    </PondButton>
                  )}
                </HStack>
              </Stack>
            ) : (
              <Stack gap="3">
                {entry.edited ? (
                  <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                    Edited
                  </Text>
                ) : null}
                {entry.artist || entry.title ? (
                  <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.body}>
                    {[entry.artist, entry.title]
                      .filter(Boolean)
                      .map((x) => cleanStreamingTitleLine(x))
                      .join(" — ")}
                  </Text>
                ) : null}
                {entry.raw_label.trim() ? (
                  <Text fontSize={APP_TEXT_SIZES.body}>
                    {cleanStreamingTitleLine(entry.raw_label)}
                  </Text>
                ) : null}
                {entry.notes.trim() ? (
                  <Box>
                    <Text fontWeight="bold" fontSize={APP_TEXT_SIZES.label}>
                      Notes
                    </Text>
                    <Text whiteSpace="pre-wrap" fontSize={APP_TEXT_SIZES.body} lineHeight="tall">
                      {entry.notes}
                    </Text>
                  </Box>
                ) : null}
              </Stack>
            )}
          </Stack>
        </Card.Body>
      </Card.Root>
  );

  return (
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%" px={{ base: "2", md: "2" }} pb={{ base: "2", md: "2" }}>
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
      {isMine ? (
        <MealEditorBackdropDismiss onDismiss={onDismissEditor}>{entryCard}</MealEditorBackdropDismiss>
      ) : (
        entryCard
      )}
    </Stack>
  );
}
