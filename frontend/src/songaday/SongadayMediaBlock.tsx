import { Box, Link, Stack, Text } from "@chakra-ui/react";

import { APP_TEXT_SIZES, PANEL_NESTED_BLOCK_PROPS } from "../theme/typography";
import { songadayEntryTitleLine } from "./cleanSongLabel";
import { spotifyEmbedSrc } from "./embedUtils";
import type { SongadayResponse } from "./types";

export default function SongadayMediaBlock({ entry }: { entry: SongadayResponse }) {
  const yt = entry.youtube_video_id.trim();
  const sp = entry.spotify_url.trim();
  const am = entry.apple_music_url.trim();
  const spEmbed = sp ? spotifyEmbedSrc(sp) : null;

  return (
    <Stack gap="3" w="full">
      <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.label}>
        {songadayEntryTitleLine(entry)}
      </Text>
      {yt ? (
        <Box
          w="full"
          minH={{ base: "200px", md: "220px" }}
          maxH="320px"
          bg="gray.100"
          overflow="hidden"
          display="flex"
          alignItems="center"
          justifyContent="center"
          {...PANEL_NESTED_BLOCK_PROPS}
        >
          <iframe
            title="YouTube"
            width="100%"
            height={240}
            src={`https://www.youtube.com/embed/${yt}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{ border: "none", display: "block", maxHeight: "100%" }}
          />
        </Box>
      ) : null}
      {spEmbed ? (
        <Box
          w="full"
          bg="gray.100"
          overflow="hidden"
          display="flex"
          alignItems="center"
          justifyContent="center"
          {...PANEL_NESTED_BLOCK_PROPS}
        >
          <iframe
            title="Spotify"
            width="100%"
            height={152}
            src={spEmbed}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            style={{ border: "none", display: "block" }}
          />
        </Box>
      ) : null}
      {am ? (
        <Link
          href={am}
          target="_blank"
          rel="noopener noreferrer"
          color="lilypad.solid"
          fontWeight="bold"
          fontSize={APP_TEXT_SIZES.helper}
        >
          Open in Apple Music
        </Link>
      ) : null}
      {!yt && !spEmbed && !am ? (
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
          No playable link — add a YouTube, Spotify, or Apple Music URL when editing.
        </Text>
      ) : null}
    </Stack>
  );
}
