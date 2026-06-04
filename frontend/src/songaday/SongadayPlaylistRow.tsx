import { Box, HStack, Link, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router";

import { APP_TEXT_SIZES, PANEL_NESTED_BLOCK_PROPS } from "../theme/typography";
import { songadayEntryTitleLine } from "./cleanSongLabel";
import { spotifyEmbedSrc } from "./embedUtils";
import type { SongadayResponse } from "./types";

const EMBED_W = "6.5rem";
const EMBED_H = 52;

type Props = {
  entry: SongadayResponse;
  dayLabel: string;
};

/** Low-height row for month playlist grid (one primary embed on the right). */
export default function SongadayPlaylistRow({ entry, dayLabel }: Props) {
  const yt = entry.youtube_video_id.trim();
  const sp = entry.spotify_url.trim();
  const am = entry.apple_music_url.trim();
  const spEmbed = sp ? spotifyEmbedSrc(sp) : null;
  const title = songadayEntryTitleLine(entry);

  let embed: ReactNode = null;
  if (yt) {
    embed = (
      <Box
        w={EMBED_W}
        h={`${EMBED_H}px`}
        flexShrink={0}
        bg="gray.100"
        overflow="hidden"
        {...PANEL_NESTED_BLOCK_PROPS}
      >
        <iframe
          title="YouTube"
          width="100%"
          height={EMBED_H}
          src={`https://www.youtube-nocookie.com/embed/${yt}`}
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          style={{ border: "none", display: "block" }}
        />
      </Box>
    );
  } else if (spEmbed) {
    embed = (
      <Box
        w={EMBED_W}
        h={`${EMBED_H}px`}
        flexShrink={0}
        bg="gray.100"
        overflow="hidden"
        {...PANEL_NESTED_BLOCK_PROPS}
      >
        <iframe
          title="Spotify"
          width="100%"
          height={EMBED_H}
          src={spEmbed}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          style={{ border: "none", display: "block" }}
        />
      </Box>
    );
  } else if (am) {
    embed = (
      <Link
        href={am}
        target="_blank"
        rel="noopener noreferrer"
        flexShrink={0}
        w={EMBED_W}
        h={`${EMBED_H}px`}
        display="flex"
        alignItems="center"
        justifyContent="center"
        fontSize={APP_TEXT_SIZES.meta}
        color="teal.solid"
        fontWeight="semibold"
        textAlign="center"
        px="1"
        {...PANEL_NESTED_BLOCK_PROPS}
      >
        Apple
      </Link>
    );
  }

  return (
    <HStack gap="2" align="center" w="full" minH={`${EMBED_H}px`}>
      <Text
        fontSize={APP_TEXT_SIZES.meta}
        color="fg.muted"
        fontWeight="semibold"
        flexShrink={0}
        w="2.25rem"
        textAlign="right"
      >
        {dayLabel}
      </Text>
      <Stack gap="0" flex="1" minW={0} justify="center" py="0.5">
        <Link
          asChild
          fontSize={APP_TEXT_SIZES.helper}
          fontWeight="semibold"
          color="fg"
          lineClamp={2}
          _hover={{ color: "teal.solid" }}
        >
          <RouterLink to={`/songaday/entries/${entry.id}`}>{title}</RouterLink>
        </Link>
        {!embed ? (
          <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" lineClamp={1}>
            No link
          </Text>
        ) : null}
      </Stack>
      {embed}
    </HStack>
  );
}
