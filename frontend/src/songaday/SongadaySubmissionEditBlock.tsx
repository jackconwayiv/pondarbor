import { HStack, Input, Stack, Text, Textarea } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";

import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  PANEL_FIELD_PROPS,
  PANEL_FORM_PLACEHOLDER_PROPS,
} from "../theme/typography";
import { patchResponse } from "./api";
import type { SongadayResponse } from "./types";

const FIELD = { ...PANEL_FIELD_PROPS, ...PANEL_FORM_PLACEHOLDER_PROPS };

type Props = {
  entry: SongadayResponse;
  getAccessToken: () => Promise<string>;
  onSaved: (row: SongadayResponse) => void;
  onClose: () => void;
};

export default function SongadaySubmissionEditBlock({
  entry,
  getAccessToken,
  onSaved,
  onClose,
}: Props) {
  const [notes, setNotes] = useState(entry.notes);
  const [artist, setArtist] = useState(entry.artist);
  const [title, setTitle] = useState(entry.title);
  const [rawLabel, setRawLabel] = useState(entry.raw_label);
  const [youtubeVideoId, setYoutubeVideoId] = useState(entry.youtube_video_id);
  const [spotifyUrl, setSpotifyUrl] = useState(entry.spotify_url);
  const [appleMusicUrl, setAppleMusicUrl] = useState(entry.apple_music_url);
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
  }, [entry]);

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

  return (
    <Stack gap="3" w="full" pt="2" borderTopWidth="1px" borderColor="border">
      <Text fontWeight="bold" fontSize={APP_TEXT_SIZES.label}>
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
          <Input value={artist} onChange={(e) => setArtist(e.target.value)} {...FIELD} />
        </Stack>
        <Stack flex="1" minW="0" gap="1">
          <Text fontSize={APP_TEXT_SIZES.meta}>Title</Text>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} {...FIELD} />
        </Stack>
      </HStack>
      <Stack gap="1">
        <Text fontSize={APP_TEXT_SIZES.meta}>Notes</Text>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} {...FIELD} />
      </Stack>
      <Stack gap="1">
        <Text fontSize={APP_TEXT_SIZES.meta}>Label / free text</Text>
        <Input value={rawLabel} onChange={(e) => setRawLabel(e.target.value)} {...FIELD} />
      </Stack>
      <Stack gap="1">
        <Text fontSize={APP_TEXT_SIZES.meta}>YouTube video id</Text>
        <Input value={youtubeVideoId} onChange={(e) => setYoutubeVideoId(e.target.value)} {...FIELD} />
      </Stack>
      <Stack gap="1">
        <Text fontSize={APP_TEXT_SIZES.meta}>Spotify URL</Text>
        <Input value={spotifyUrl} onChange={(e) => setSpotifyUrl(e.target.value)} {...FIELD} />
      </Stack>
      <Stack gap="1">
        <Text fontSize={APP_TEXT_SIZES.meta}>Apple Music URL</Text>
        <Input value={appleMusicUrl} onChange={(e) => setAppleMusicUrl(e.target.value)} {...FIELD} />
      </Stack>
      <HStack gap="2" flexWrap="wrap">
        <PondButton
          type="button"
          colorPalette="teal"
          loading={busy}
          disabled={busy}
          onClick={() => void onSave()}
        >
          Save
        </PondButton>
        <PondButton type="button" variant="outline" colorPalette="nautical" disabled={busy} onClick={onClose}>
          Cancel
        </PondButton>
      </HStack>
    </Stack>
  );
}
