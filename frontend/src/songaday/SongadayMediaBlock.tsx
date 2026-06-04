import { Box, Link, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { APP_TEXT_SIZES, PANEL_NESTED_BLOCK_PROPS } from "../theme/typography";
import { songadayEntryTitleLine } from "./cleanSongLabel";
import {
  SongadayEmbedIframe,
  SPOTIFY_EMBED_ALLOW,
  YOUTUBE_EMBED_ALLOW,
  youtubeEmbedSrc,
} from "./SongadayEmbedIframe";
import { spotifyEmbedSrc } from "./embedUtils";
import type { SongadayResponse } from "./types";

type Props = {
  entry: SongadayResponse;
  /** Tighter embeds and typography for response list cards. */
  compact?: boolean;
  /** Request autoplay when the embed mounts (YouTube: muted; Spotify: best-effort). */
  autoplayOnMount?: boolean;
  /** Hide the title line when the parent card already shows it. */
  showTitle?: boolean;
  /** iframe loading attribute; default lazy unless autoplayOnMount. */
  embedLoading?: "lazy" | "eager";
  /** Month playlist grid: fixed-height player area so every card matches. */
  uniformEmbedSlot?: boolean;
};

/** Compact YouTube iframe height; used as the uniform slot in playlist grids. */
export const SONGADAY_COMPACT_EMBED_SLOT_PX = 168;

export default function SongadayMediaBlock({
  entry,
  compact,
  autoplayOnMount,
  showTitle = true,
  embedLoading,
  uniformEmbedSlot,
}: Props) {
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

  const iframeLoading = embedLoading ?? (autoplayOnMount ? "eager" : "lazy");
  const uniformSlot = Boolean(uniformEmbedSlot && compact);

  const titleFont = compact ? APP_TEXT_SIZES.helper : APP_TEXT_SIZES.label;
  const stackGap = compact ? "2" : "3";
  const ytMinH = compact
    ? { base: "112px", md: "120px" }
    : { base: "200px", md: "220px" };
  const ytMaxH = compact ? "200px" : "320px";
  const ytIframeH = compact ? SONGADAY_COMPACT_EMBED_SLOT_PX : 240;
  const spIframeH = compact ? 104 : 152;

  const playerShell = (content: ReactNode, youtubeSized?: boolean) => (
    <Box
      w="full"
      bg="gray.100"
      overflow="hidden"
      display="flex"
      alignItems="center"
      justifyContent="center"
      {...(uniformSlot
        ? {
            borderRadius: "md",
            h: `${SONGADAY_COMPACT_EMBED_SLOT_PX}px`,
            minH: `${SONGADAY_COMPACT_EMBED_SLOT_PX}px`,
            maxH: `${SONGADAY_COMPACT_EMBED_SLOT_PX}px`,
          }
        : { ...PANEL_NESTED_BLOCK_PROPS, ...(youtubeSized ? { minH: ytMinH, maxH: ytMaxH } : {}) })}
    >
      {content}
    </Box>
  );

  let player: ReactNode = null;
  if (yt) {
    player = playerShell(
      <SongadayEmbedIframe
        title="YouTube"
        height={ytIframeH}
        src={youtubeEmbedSrc(yt, autoplayOnMount)}
        allow={YOUTUBE_EMBED_ALLOW}
        loading={iframeLoading}
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        style={{ maxHeight: "100%" }}
      />,
      !uniformSlot,
    );
  } else if (spEmbed) {
    player = playerShell(
      <SongadayEmbedIframe
        title="Spotify"
        height={spIframeH}
        src={spEmbed}
        allow={SPOTIFY_EMBED_ALLOW}
        loading={iframeLoading}
      />,
    );
  } else if (am) {
    const link = (
      <Link
        href={am}
        target="_blank"
        rel="noopener noreferrer"
        color="teal.solid"
        fontWeight="bold"
        fontSize={APP_TEXT_SIZES.helper}
        textAlign={uniformSlot ? "center" : undefined}
        px={uniformSlot ? "2" : undefined}
      >
        Open in Apple Music
      </Link>
    );
    player = uniformSlot ? playerShell(link) : link;
  } else {
    const empty = (
      <Text
        fontSize={APP_TEXT_SIZES.helper}
        color="fg.muted"
        textAlign={uniformSlot ? "center" : undefined}
        px={uniformSlot ? "2" : undefined}
      >
        {uniformSlot
          ? "No playable link"
          : "No playable link — add a YouTube, Spotify, or Apple Music URL when editing."}
      </Text>
    );
    player = uniformSlot ? playerShell(empty) : empty;
  }

  return (
    <Stack gap={stackGap} w="full" flex={uniformSlot ? "1" : undefined} minH={0}>
      {showTitle ? (
        <Text fontWeight="semibold" fontSize={titleFont} lineClamp={compact ? 2 : undefined}>
          {songadayEntryTitleLine(entry)}
        </Text>
      ) : null}
      {player}
    </Stack>
  );
}
