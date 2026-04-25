import {
  Box,
  Button,
  HStack,
  NativeSelectField,
  NativeSelectRoot,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { PanelEmptyState } from "../components/panelStatus";
import type { Profile } from "../auth/AppSessionContext";
import { fetchFriendsList } from "../friends/api";
import PondButton from "../PondButton";
import { fullBleedStackProps } from "../responsive";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
} from "../theme/typography";
import { fetchArchiveEligibleFriendIds, fetchResponsesArchive } from "./api";
import { songadayEntryTitleLine } from "./cleanSongLabel";
import type { SongadayResponse } from "./types";

const ARCHIVE_PAGE_SIZE = 10;

/** Tight widths so visibility + submissions rows stay on one line on small screens. */
const SUBJECT_SELECT_PROPS = {
  size: "sm" as const,
  flexShrink: 1,
  minW: 0,
  maxW: { base: "7rem", sm: "9rem" },
};
const VISIBILITY_SELECT_PROPS = {
  size: "sm" as const,
  flexShrink: 1,
  minW: 0,
  maxW: { base: "9.5rem", sm: "12rem" },
};

function formatEntryMd(entryDate: string): string {
  const parts = entryDate.split("-");
  if (parts.length !== 3) return entryDate;
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(m) || !Number.isFinite(d)) return entryDate;
  return `${m}/${d}`;
}

export type SongadayArchivePanelProps = {
  variant: "page" | "embedded";
  /**
   * When set, clicking a row jumps to the main Song-a-Day prompt for that entry date
   * (no inline editing or heart/comment actions here).
   */
  onSelectArchiveEntryDate?: (entryDateIso: string) => void;
};

export default function SongadayArchivePanel({
  variant,
  onSelectArchiveEntryDate,
}: SongadayArchivePanelProps) {
  const { sessionUser, getApiAccessToken, patchMyProfile, updateProfileLocally } =
    useAppSession();

  const [friends, setFriends] = useState<Array<{ id: number; label: string }>>([]);
  const [subjectUserId, setSubjectUserId] = useState<number | null>(null);
  const [archivePage, setArchivePage] = useState(1);
  const [archiveTotal, setArchiveTotal] = useState(0);
  const [entries, setEntries] = useState<SongadayResponse[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFriends = useCallback(async () => {
    const token = await getApiAccessToken();
    const data = await fetchFriendsList(token);
    let eligible: Set<number> | null = null;
    try {
      const { user_ids } = await fetchArchiveEligibleFriendIds(token);
      eligible = new Set(user_ids);
    } catch {
      /* If eligibility fails, show all friends (legacy behavior). */
    }
    setFriends(
      data.approved_friends
        .filter((f) => eligible === null || eligible.has(f.id))
        .map((f) => ({
          id: f.id,
          label: f.nickname || f.email.split("@")[0] || f.email,
        })),
    );
  }, [getApiAccessToken]);

  const loadArchive = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const token = await getApiAccessToken();
      const payload = await fetchResponsesArchive(
        token,
        subjectUserId,
        archivePage,
        ARCHIVE_PAGE_SIZE,
      );
      setEntries(payload.results);
      setArchiveTotal(payload.total);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load archive.");
      setEntries([]);
      setArchiveTotal(0);
    } finally {
      setLoading(false);
    }
  }, [getApiAccessToken, subjectUserId, archivePage]);

  useEffect(() => {
    if (!sessionUser?.user.is_approved) return;
    void loadFriends().catch(() => {
      /* ignore */
    });
  }, [sessionUser?.user.is_approved, loadFriends]);

  useEffect(() => {
    void loadArchive();
  }, [loadArchive]);

  useEffect(() => {
    setArchivePage(1);
  }, [subjectUserId]);

  const totalArchivePages = Math.max(1, Math.ceil(archiveTotal / ARCHIVE_PAGE_SIZE));

  useEffect(() => {
    if (archivePage > totalArchivePages) {
      setArchivePage(totalArchivePages);
    }
  }, [archivePage, totalArchivePages]);

  useEffect(() => {
    if (subjectUserId == null) return;
    if (!friends.some((f) => f.id === subjectUserId)) {
      setSubjectUserId(null);
    }
  }, [friends, subjectUserId]);

  const submissionsRow = (
    <HStack flexWrap="wrap" gap="2" align="center" w="full">
      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" flexShrink={0}>
        Submissions for:
      </Text>
      <NativeSelectRoot {...SUBJECT_SELECT_PROPS}>
        <NativeSelectField
          title="Whose submissions to show"
          value={subjectUserId == null ? "" : String(subjectUserId)}
          onChange={(e) => {
            const v = e.currentTarget.value;
            setSubjectUserId(v === "" ? null : Number(v));
          }}
        >
          <option value="">Me</option>
          {friends.map((f) => (
            <option key={f.id} value={String(f.id)}>
              {f.label}
            </option>
          ))}
        </NativeSelectField>
      </NativeSelectRoot>
    </HStack>
  );

  const settingsRow =
    sessionUser?.user.is_approved ? (
      <HStack flexWrap="wrap" gap="2" align="center" w="full">
        <Text
          fontSize={APP_TEXT_SIZES.helper}
          fontWeight="semibold"
          flexShrink={0}
        >
          Song-a-Day
        </Text>
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" flexShrink={0}>
          Who can see my posts:
        </Text>
        <NativeSelectRoot {...VISIBILITY_SELECT_PROPS}>
          <NativeSelectField
            title="Who can see my Song-a-Day posts"
            value={sessionUser.profile.songaday_visibility ?? "friends_only"}
            onChange={(e) => {
              const v = e.currentTarget.value as Profile["songaday_visibility"];
              void (async () => {
                try {
                  await patchMyProfile({ songaday_visibility: v });
                  updateProfileLocally({ songaday_visibility: v });
                } catch {
                  /* ignore */
                }
              })();
            }}
          >
            <option value="private">Only me</option>
            <option value="friends_only">Friends only</option>
            <option value="all_approved">All approved users</option>
          </NativeSelectField>
        </NativeSelectRoot>
      </HStack>
    ) : null;

  const body = (
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="full">
      {variant === "page" ? (
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
      ) : null}

      {settingsRow}
      {submissionsRow}

      {loadError ? (
        <Text fontSize={APP_TEXT_SIZES.helper} color="nautical.solid" role="alert">
          {loadError}
        </Text>
      ) : null}

      {loading ? (
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
          Loading…
        </Text>
      ) : loadError ? null : (
        <Stack gap="4" w="100%">
          {archiveTotal === 0 ? (
            <PanelEmptyState
              title="No submissions yet."
              description="Your past Song-a-Day entries will appear here once you’ve posted."
              actionLabel="Go to today"
              onAction={undefined}
            />
          ) : (
            <Stack gap="2" w="100%">
              {entries.map((entry) => (
                <Box
                  key={entry.id}
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor="border"
                  bg="bg.panel"
                  overflow="hidden"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    display="flex"
                    flexDirection="column"
                    alignItems="stretch"
                    gap="1"
                    w="full"
                    px="2"
                    py="2"
                    minH="auto"
                    h="auto"
                    rounded="none"
                    fontWeight="normal"
                    textAlign="left"
                    justifyContent="flex-start"
                    bg="bg.panel"
                    _hover={{ bg: "bg.subtle" }}
                    cursor={onSelectArchiveEntryDate ? "pointer" : "default"}
                    onClick={() => {
                      onSelectArchiveEntryDate?.(entry.entry_date);
                    }}
                    disabled={!onSelectArchiveEntryDate}
                  >
                    <HStack gap="2" align="flex-start" w="full" justify="space-between">
                      <HStack gap="2" align="flex-start" minW={0} flex="1">
                        <Text
                          fontSize={APP_TEXT_SIZES.meta}
                          color="fg.muted"
                          flexShrink={0}
                          w="2.5rem"
                        >
                          {formatEntryMd(entry.entry_date)}
                        </Text>
                        <Text
                          fontSize={APP_TEXT_SIZES.helper}
                          fontWeight="medium"
                          flex="1"
                          minW={0}
                          lineClamp={2}
                          title={entry.prompt_snapshot}
                        >
                          {entry.prompt_snapshot}
                        </Text>
                      </HStack>
                      <HStack
                        gap="3"
                        flexShrink={0}
                        fontSize={APP_TEXT_SIZES.meta}
                        color="fg.muted"
                        aria-label={`${entry.heart_count} hearts, ${entry.comment_count ?? 0} comments`}
                      >
                        <Text as="span" whiteSpace="nowrap">
                          ❤️ {entry.heart_count}
                        </Text>
                        <Text as="span" whiteSpace="nowrap">
                          💬 {entry.comment_count ?? 0}
                        </Text>
                      </HStack>
                    </HStack>
                    <Text
                      fontSize={APP_TEXT_SIZES.helper}
                      fontWeight="semibold"
                      w="full"
                      minW={0}
                      lineClamp={2}
                      title={songadayEntryTitleLine(entry)}
                    >
                      {songadayEntryTitleLine(entry)}
                    </Text>
                    {entry.notes.trim() ? (
                      <Text
                        fontSize={APP_TEXT_SIZES.helper}
                        color="fg.muted"
                        w="full"
                        whiteSpace="pre-wrap"
                        lineClamp={4}
                        title={entry.notes}
                      >
                        {entry.notes.trim()}
                      </Text>
                    ) : null}
                  </Button>
                </Box>
              ))}
            </Stack>
          )}
          <HStack justify="space-between">
            <Text fontSize={APP_TEXT_SIZES.helper}>
              Page {archivePage} / {totalArchivePages}
            </Text>
            <HStack>
              <PondButton
                type="button"
                size="sm"
                colorPalette="nautical"
                disabled={archivePage <= 1}
                onClick={() => setArchivePage((p) => Math.max(1, p - 1))}
              >
                ←
              </PondButton>
              <PondButton
                type="button"
                size="sm"
                colorPalette="nautical"
                disabled={archivePage >= totalArchivePages}
                onClick={() =>
                  setArchivePage((p) => Math.min(totalArchivePages, p + 1))
                }
              >
                →
              </PondButton>
            </HStack>
          </HStack>
        </Stack>
      )}
    </Stack>
  );

  if (variant === "page") {
    return (
      <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
        <Box
          flex="1"
          bg="bg"
          px={0}
          py={{ base: "2", md: "2" }}
        >
          <Box {...APP_SHELL_TRAY_PROPS}>
            <Stack gap={{ base: "4", md: "4" }} px={{ base: "2", md: "2" }} pt={{ base: "2", md: "2" }} pb="2">
              {body}
            </Stack>
          </Box>
        </Box>
      </Stack>
    );
  }

  return body;
}
