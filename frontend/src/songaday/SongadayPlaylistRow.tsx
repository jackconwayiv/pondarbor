import { Box, HStack, Stack, Text } from "@chakra-ui/react";

import { APP_TEXT_SIZES, PANEL_NESTED_BLOCK_PROPS } from "../theme/typography";
import { songadayEntryTitleLine } from "./cleanSongLabel";
import SongadayMediaBlock from "./SongadayMediaBlock";
import type { SongadayResponse } from "./types";

type Props = {
  entry: SongadayResponse;
  dayLabel: string;
};

/** Month playlist grid card: day header + inline player (no navigation required to listen). */
export default function SongadayPlaylistRow({ entry, dayLabel }: Props) {
  const title = songadayEntryTitleLine(entry);

  return (
    <Box
      w="full"
      h="full"
      minW={0}
      display="flex"
      flexDirection="column"
      bg="bg.panel"
      overflow="hidden"
      {...PANEL_NESTED_BLOCK_PROPS}
    >
      <Stack gap="2" w="full" flex="1" minH={0}>
        <HStack gap="2" align="flex-start" w="full" flexShrink={0}>
          <Text
            fontSize={APP_TEXT_SIZES.meta}
            color="fg.muted"
            fontWeight="semibold"
            flexShrink={0}
            w="2.25rem"
            textAlign="right"
            lineHeight="1.3"
          >
            {dayLabel}
          </Text>
          <Text
            fontSize={APP_TEXT_SIZES.helper}
            fontWeight="medium"
            flex="1"
            minW={0}
            lineClamp={2}
            lineHeight="1.3"
            title={entry.prompt_snapshot}
          >
            {entry.prompt_snapshot.trim() || "—"}
          </Text>
        </HStack>
        <Text
          fontSize={APP_TEXT_SIZES.helper}
          fontWeight="semibold"
          w="full"
          minW={0}
          lineClamp={2}
          lineHeight="1.3"
          title={title}
        >
          {title}
        </Text>
        <SongadayMediaBlock
          entry={entry}
          compact
          showTitle={false}
          embedLoading="lazy"
          uniformEmbedSlot
        />
      </Stack>
    </Box>
  );
}
