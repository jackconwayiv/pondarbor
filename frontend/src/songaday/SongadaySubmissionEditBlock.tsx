import { HStack, Input, Stack, Text, Textarea } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";

import { MealEditorBackdropDismiss } from "../meal/MealEditorBackdropDismiss";
import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  PANEL_FIELD_PROPS,
  PANEL_FORM_PLACEHOLDER_PROPS,
} from "../theme/typography";
import { deleteResponse, patchResponse } from "./api";
import type { SongadayResponse } from "./types";

const FIELD = { ...PANEL_FIELD_PROPS, ...PANEL_FORM_PLACEHOLDER_PROPS };

type Props = {
  entry: SongadayResponse;
  getAccessToken: () => Promise<string>;
  onSaved: (row: SongadayResponse) => void;
  onClose: () => void;
  onDeleted: (entryId: number) => void;
};

export default function SongadaySubmissionEditBlock({
  entry,
  getAccessToken,
  onSaved,
  onClose,
  onDeleted,
}: Props) {
  const [notes, setNotes] = useState(entry.notes);
  const [artist, setArtist] = useState(entry.artist);
  const [title, setTitle] = useState(entry.title);
  const [rawLabel, setRawLabel] = useState(entry.raw_label);
  const [youtubeVideoId, setYoutubeVideoId] = useState(entry.youtube_video_id);
  const [spotifyUrl, setSpotifyUrl] = useState(entry.spotify_url);
  const [appleMusicUrl, setAppleMusicUrl] = useState(entry.apple_music_url);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNotes(entry.notes);
    setArtist(entry.artist);
    setTitle(entry.title);
    setRawLabel(entry.raw_label);
    setYoutubeVideoId(entry.youtube_video_id);
    setSpotifyUrl(entry.spotify_url);
    setAppleMusicUrl(entry.apple_music_url);
    setConfirmDelete(false);
  }, [entry]);

  const clearConfirmDelete = useCallback(() => {
    setConfirmDelete(false);
  }, []);

  const onSave = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const token = await getAccessToken();
      const updated = await patchResponse(token, entry.id, {
        notes: notes.trim(),
        artist: artist.trim(),
        title: title.trim(),
        raw_label: rawLabel.trim(),
        youtube_video_id: youtubeVideoId.trim(),
        spotify_url: spotifyUrl.trim(),
        apple_music_url: appleMusicUrl.trim(),
      });
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }, [
    appleMusicUrl,
    artist,
    entry.id,
    getAccessToken,
    notes,
    onClose,
    onSaved,
    rawLabel,
    spotifyUrl,
    title,
    youtubeVideoId,
  ]);

  const onDelete = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const token = await getAccessToken();
      await deleteResponse(token, entry.id);
      setConfirmDelete(false);
      onDeleted(entry.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }, [entry.id, getAccessToken, onDeleted]);

  return (
    <MealEditorBackdropDismiss onDismiss={clearConfirmDelete} disabled={busy || !confirmDelete}>
      <Stack gap="3" w="full" pt="2" borderTopWidth="1px" borderColor="border">
        <Text
          fontWeight="semibold"
          fontSize={APP_TEXT_SIZES.helper}
          color="sky.emphasized"
          textTransform="uppercase"
          letterSpacing="0.08em"
        >
          Edit your submission
        </Text>
        {error ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="nautical.solid" role="alert">
            {error}
          </Text>
        ) : null}
        <HStack gap="2" align="flex-end" w="100%" flexWrap="nowrap">
          <Stack flex="1" minW="0" gap="1">
            <Text fontSize={APP_TEXT_SIZES.meta}>Artist</Text>
            <Input
              value={artist}
              onChange={(e) => {
                clearConfirmDelete();
                setArtist(e.target.value);
              }}
              {...FIELD}
            />
          </Stack>
          <Stack flex="1" minW="0" gap="1">
            <Text fontSize={APP_TEXT_SIZES.meta}>Title</Text>
            <Input
              value={title}
              onChange={(e) => {
                clearConfirmDelete();
                setTitle(e.target.value);
              }}
              {...FIELD}
            />
          </Stack>
        </HStack>
        <Stack gap="1">
          <Text fontSize={APP_TEXT_SIZES.meta}>Notes</Text>
          <Textarea
            value={notes}
            onChange={(e) => {
              clearConfirmDelete();
              setNotes(e.target.value);
            }}
            rows={3}
            {...FIELD}
          />
        </Stack>
        <Stack gap="1">
          <Text fontSize={APP_TEXT_SIZES.meta}>Label / free text</Text>
          <Input
            value={rawLabel}
            onChange={(e) => {
              clearConfirmDelete();
              setRawLabel(e.target.value);
            }}
            {...FIELD}
          />
        </Stack>
        <Stack gap="1">
          <Text fontSize={APP_TEXT_SIZES.meta}>YouTube video id</Text>
          <Input
            value={youtubeVideoId}
            onChange={(e) => {
              clearConfirmDelete();
              setYoutubeVideoId(e.target.value);
            }}
            {...FIELD}
          />
        </Stack>
        <Stack gap="1">
          <Text fontSize={APP_TEXT_SIZES.meta}>Spotify URL</Text>
          <Input
            value={spotifyUrl}
            onChange={(e) => {
              clearConfirmDelete();
              setSpotifyUrl(e.target.value);
            }}
            {...FIELD}
          />
        </Stack>
        <Stack gap="1">
          <Text fontSize={APP_TEXT_SIZES.meta}>Apple Music URL</Text>
          <Input
            value={appleMusicUrl}
            onChange={(e) => {
              clearConfirmDelete();
              setAppleMusicUrl(e.target.value);
            }}
            {...FIELD}
          />
        </Stack>
        <HStack gap="2" flexWrap="wrap">
          <PondButton
            type="button"
            colorPalette="lilypad"
            loading={busy}
            disabled={busy}
            onClick={() => void onSave()}
          >
            Save
          </PondButton>
          {confirmDelete ? (
            <PondButton
              type="button"
              colorPalette="nautical"
              disabled={busy}
              onClick={() => {
                setConfirmDelete(false);
                void onDelete();
              }}
            >
              Confirm Delete
            </PondButton>
          ) : (
            <PondButton
              type="button"
              variant="outline"
              colorPalette="nautical"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </PondButton>
          )}
          <PondButton
            type="button"
            variant="outline"
            colorPalette="sky"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </PondButton>
        </HStack>
      </Stack>
    </MealEditorBackdropDismiss>
  );
}
