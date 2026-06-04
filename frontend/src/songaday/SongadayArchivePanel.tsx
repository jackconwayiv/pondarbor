import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { Link as RouterLink } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { fullBleedStackProps } from "../responsive";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
} from "../theme/typography";
import SongadayBrowsePlaylistsPanel from "./SongadayBrowsePlaylistsPanel";
import SongadayMonthArchive from "./SongadayMonthArchive";

export type SongadayArchivePanelProps = {
  /**
   * When set, clicking a row jumps to the main Song-a-Day prompt for that entry date
   * (no inline editing or heart/comment actions here).
   */
  onSelectArchiveEntryDate?: (entryDateIso: string) => void;
};

export default function SongadayArchivePanel({
  onSelectArchiveEntryDate,
}: SongadayArchivePanelProps) {
  const { getApiAccessToken } = useAppSession();
  const [archiveMonthKey, setArchiveMonthKey] = useState<string | null>(null);

  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box flex="1" bg="bg" px={0} py={{ base: "2", md: "2" }}>
        <Box {...APP_SHELL_TRAY_PROPS}>
          <Stack
            gap={MAPPED_CLOSET_TAB_STACK_GAP}
            px={{ base: "2", md: "2" }}
            pt={{ base: "2", md: "2" }}
            pb="2"
          >
            <HStack flexWrap="wrap" gap="3" justify="space-between" align="center" w="full">
              <Text fontSize={APP_TEXT_SIZES.label} fontWeight="bold">
                Song archive
              </Text>
              <RouterLink to="/songaday">
                <Text fontSize={APP_TEXT_SIZES.helper} color="teal.solid" fontWeight="semibold">
                  ← Song a Day
                </Text>
              </RouterLink>
            </HStack>

            <SongadayBrowsePlaylistsPanel
              active
              getApiAccessToken={getApiAccessToken}
              returnPath="/songaday/archive"
              activeMonthKey={archiveMonthKey}
              onActiveMonthKeyChange={setArchiveMonthKey}
            />

            <SongadayMonthArchive
              open
              activeMonthKey={archiveMonthKey}
              getApiAccessToken={getApiAccessToken}
              archiveUserId={null}
              onSelectEntryDate={(iso) => onSelectArchiveEntryDate?.(iso)}
            />
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}
