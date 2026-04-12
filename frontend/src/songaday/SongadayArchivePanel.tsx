import {
  Box,
  Button,
  Card,
  HStack,
  NativeSelectField,
  NativeSelectRoot,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link as RouterLink } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { fetchFriendsList } from "../friends/api";
import PondButton from "../PondButton";
import { fullBleedStackProps } from "../responsive";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { fetchArchiveEligibleFriendIds, fetchResponsesArchive, toggleHeart } from "./api";
import { songadayEntryTitleLine } from "./cleanSongLabel";
import SongadayHeartButton from "./SongadayHeartButton";
import SongadayHeartReadOnly from "./SongadayHeartReadOnly";
import SongadayMediaBlock from "./SongadayMediaBlock";
import type { SongadayResponse } from "./types";

const ARCHIVE_PAGE_SIZE = 10;

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
  /** `location.state.songadayReturnTo` when opening an entry from this list */
  entryDetailReturnTo: string;
};

export default function SongadayArchivePanel({
  variant,
  entryDetailReturnTo,
}: SongadayArchivePanelProps) {
  const { sessionUser, getApiAccessToken, refreshSession } = useAppSession();

  const myUserId = sessionUser?.user.id ?? 0;
  const [friends, setFriends] = useState<Array<{ id: number; label: string }>>([]);
  const [subjectUserId, setSubjectUserId] = useState<number | null>(null);
  const [archivePage, setArchivePage] = useState(1);
  const [archiveTotal, setArchiveTotal] = useState(0);
  const [entries, setEntries] = useState<SongadayResponse[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [heartBusyId, setHeartBusyId] = useState<number | null>(null);
  const expandedRef = useRef<HTMLDivElement | null>(null);

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
    setExpandedId(null);
    setArchivePage(1);
  }, [subjectUserId]);

  useEffect(() => {
    setExpandedId(null);
  }, [archivePage]);

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

  useEffect(() => {
    if (expandedId == null) return;
    const onDown = (e: MouseEvent) => {
      const el = expandedRef.current;
      if (el && !el.contains(e.target as Node)) {
        setExpandedId(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [expandedId]);

  const onHeartToggle = useCallback(
    async (entryId: number) => {
      setHeartBusyId(entryId);
      try {
        const token = await getApiAccessToken();
        const r = await toggleHeart(token, entryId);
        setEntries((prev) =>
          prev.map((row) =>
            row.id === entryId
              ? { ...row, heart_count: r.heart_count, viewer_has_hearted: r.viewer_has_hearted }
              : row,
          ),
        );
        await refreshSession();
      } catch {
        /* ignore */
      } finally {
        setHeartBusyId(null);
      }
    },
    [getApiAccessToken, refreshSession],
  );

  const body = (
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="full">
      {variant === "page" ? (
        <HStack flexWrap="wrap" gap="3" justify="space-between" align="flex-start">
          <Stack gap="3" w={{ base: "full", md: "auto" }} flex="1" minW={0}>
            <Text fontSize={APP_TEXT_SIZES.label} fontWeight="bold">
              Song archive
            </Text>
            <HStack flexWrap="wrap" gap="2" align="center" w="full">
              <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" flexShrink={0}>
                Submissions for
              </Text>
              <NativeSelectRoot size="sm" maxW={{ base: "full", sm: "220px" }} flexShrink={0}>
                <NativeSelectField
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
              <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" flexShrink={0}>
                , newest first.
              </Text>
            </HStack>
          </Stack>
          <RouterLink to="/songaday">
            <Text fontSize={APP_TEXT_SIZES.helper} color="lilypad.solid" fontWeight="semibold">
              ← Song a Day
            </Text>
          </RouterLink>
        </HStack>
      ) : (
        <HStack flexWrap="wrap" gap="2" align="center" w="full">
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" flexShrink={0}>
            Submissions for
          </Text>
          <NativeSelectRoot size="sm" maxW={{ base: "full", sm: "220px" }} flexShrink={0}>
            <NativeSelectField
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
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" flexShrink={0}>
            , newest first.
          </Text>
        </HStack>
      )}

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
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
              No submissions yet.
            </Text>
          ) : (
            <Stack gap="2" w="100%">
              {entries.map((entry) => {
                const isOpen = expandedId === entry.id;
                const isMine = entry.user.id === myUserId;
                return (
                  <Box
                    key={entry.id}
                    ref={isOpen ? expandedRef : undefined}
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor="border"
                    bg="white"
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
                      bg="white"
                      _hover={{ bg: "gray.50" }}
                      onClick={() => setExpandedId((cur) => (cur === entry.id ? null : entry.id))}
                    >
                      <HStack gap="2" align="flex-start" w="full">
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
                    {isOpen ? (
                      <Box px="2" pb="3" pt="1" bg="gray.50" borderTopWidth="1px" borderColor="border">
                        <Card.Root {...PANEL_ENTRY_CARD_PROPS} flexDirection="column">
                          <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
                            <SongadayMediaBlock entry={entry} />
                            <HStack
                              justify="flex-end"
                              align="center"
                              flexWrap="wrap"
                              gap="2"
                              mt="3"
                            >
                              {isMine ? (
                                <SongadayHeartReadOnly heartCount={entry.heart_count} />
                              ) : (
                                <SongadayHeartButton
                                  heartCount={entry.heart_count}
                                  viewerHasHearted={entry.viewer_has_hearted}
                                  busy={heartBusyId === entry.id}
                                  onToggle={() => onHeartToggle(entry.id)}
                                />
                              )}
                            </HStack>
                            <Box pt="2">
                              <RouterLink
                                to={`/songaday/entries/${entry.id}`}
                                state={{ songadayReturnTo: entryDetailReturnTo }}
                              >
                                <Text
                                  fontSize={APP_TEXT_SIZES.helper}
                                  color="lilypad.solid"
                                  fontWeight="semibold"
                                >
                                  Open full entry
                                </Text>
                              </RouterLink>
                            </Box>
                          </Card.Body>
                        </Card.Root>
                      </Box>
                    ) : null}
                  </Box>
                );
              })}
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
        <Box flex="1" bg="sky.solid" px={{ base: "2", md: "2" }} py={{ base: "2", md: "2" }}>
          <Box
            maxW="4xl"
            w="100%"
            mx="auto"
            bg="gray.100"
            borderWidth="1px"
            borderColor="border"
            borderRadius="xl"
            overflow="hidden"
          >
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
