import { Box, Link, Stack, Text } from "@chakra-ui/react";

import { APP_TEXT_SIZES, PANEL_NESTED_BLOCK_PROPS } from "../theme/typography";
import { songadayEntryTitleLine } from "./cleanSongLabel";
import { spotifyEmbedSrc } from "./embedUtils";
import type { SongadayResponse } from "./types";

type Props = {
  entry: SongadayResponse;
  /** Tighter embeds and typography for response list cards. */
  compact?: boolean;
  /** Request autoplay when the embed mounts (YouTube: muted; Spotify: best-effort). */
  autoplayOnMount?: boolean;
};

export default function SongadayMediaBlock({ entry, compact, autoplayOnMount }: Props) {
  const yt = entry.youtube_video_id.trim();
  const sp = entry.spotify_url.trim();
  const am = entry.apple_music_url.trim();
  const spBase = sp ? spotifyEmbedSrc(sp) : null;
  const spEmbed = (() => {
    if (!spBase) return null;
    if (!autoplayOnMount) return spBase;
    try {
      const u = new URL(spBase);
      u.searchParams.set("autoplay", "true");
      return u.toString();
    } catch {
      return spBase;
    }
  })();

  const titleFont = compact ? APP_TEXT_SIZES.helper : APP_TEXT_SIZES.label;
  const stackGap = compact ? "2" : "3";
  const ytMinH = compact
    ? { base: "112px", md: "120px" }
    : { base: "200px", md: "220px" };
  const ytMaxH = compact ? "200px" : "320px";
  const ytIframeH = compact ? 168 : 240;
  const spIframeH = compact ? 104 : 152;

  return (
    <Stack gap={stackGap} w="full">
      <Text fontWeight="semibold" fontSize={titleFont} lineClamp={compact ? 2 : undefined}>
        {songadayEntryTitleLine(entry)}
      </Text>
      {yt ? (
        <Box
          w="full"
          minH={ytMinH}
          maxH={ytMaxH}
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
            height={ytIframeH}
            src={
              autoplayOnMount
                ? `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&mute=1`
                : `https://www.youtube-nocookie.com/embed/${yt}`
            }
            referrerPolicy="strict-origin-when-cross-origin"
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
            height={spIframeH}
            src={spEmbed}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading={autoplayOnMount ? "eager" : "lazy"}
            style={{ border: "none", display: "block" }}
          />
        </Box>
      ) : null}
      {am ? (
        <Link
          href={am}
          target="_blank"
          rel="noopener noreferrer"
          color="teal.solid"
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
