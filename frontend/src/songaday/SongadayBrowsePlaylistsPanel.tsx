import { Avatar, Box, Button, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { resolveAvatarUrlForUser, useAppSession } from "../auth/AppSessionContext";
import { PanelEmptyState, PanelListRowSkeleton } from "../components/panelStatus";
import { APP_TEXT_SIZES, PANEL_ENTRY_CARD_PROPS } from "../theme/typography";
import { fetchPlaylistsBrowse } from "./api";
import SongadayMonthNavRow from "./SongadayMonthNavRow";
import { formatMonthTabLabel, monthKey, parseMonthKey } from "./playlistBrowseLabel";
import type { SongadayPlaylistBrowseRow } from "./types";

type Props = {
  /** When false, skip fetch (e.g. archive collapsible closed on main page). */
  active: boolean;
  getApiAccessToken: () => Promise<string>;
  /** Route for month player Back navigation. */
  returnPath: string;
  activeMonthKey: string | null;
  onActiveMonthKeyChange: (key: string | null) => void;
};

type MonthOption = {
  key: string;
  year: number;
  month: number;
  label: string;
};

function monthOptionsFromRows(rows: SongadayPlaylistBrowseRow[]): MonthOption[] {
  const seen = new Set<string>();
  const options: MonthOption[] = [];
  for (const row of rows) {
    const key = monthKey(row.year, row.month);
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({
      key,
      year: row.year,
      month: row.month,
      label: formatMonthTabLabel(row.year, row.month),
    });
  }
  options.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
  return options;
}

export default function SongadayBrowsePlaylistsPanel({
  active,
  getApiAccessToken,
  returnPath,
  activeMonthKey,
  onActiveMonthKeyChange,
}: Props) {
  const navigate = useNavigate();
  const { sessionUser, auth0User } = useAppSession();
  const [rows, setRows] = useState<SongadayPlaylistBrowseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRows([]);
    onActiveMonthKeyChange(null);
    try {
      const token = await getApiAccessToken();
      const data = await fetchPlaylistsBrowse(token);
      setRows(Array.isArray(data.results) ? data.results : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load playlists.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [getApiAccessToken, onActiveMonthKeyChange]);

  useEffect(() => {
    if (!active) return;
    void load();
  }, [active, load]);

  const monthOptions = useMemo(() => monthOptionsFromRows(rows), [rows]);

  useEffect(() => {
    if (!active) return;
    if (monthOptions.length === 0) {
      onActiveMonthKeyChange(null);
      return;
    }
    if (activeMonthKey == null || !monthOptions.some((t) => t.key === activeMonthKey)) {
      onActiveMonthKeyChange(monthOptions[0]?.key ?? null);
    }
  }, [active, monthOptions, activeMonthKey, onActiveMonthKeyChange]);

  const activeIdx = useMemo(() => {
    if (!activeMonthKey) return -1;
    return monthOptions.findIndex((m) => m.key === activeMonthKey);
  }, [monthOptions, activeMonthKey]);

  const activeMonthLabel = useMemo(() => {
    if (activeIdx < 0) return "—";
    return monthOptions[activeIdx]?.label ?? "—";
  }, [monthOptions, activeIdx]);

  const canGoNewer = activeIdx > 0;
  const canGoOlder = activeIdx >= 0 && activeIdx < monthOptions.length - 1;

  const goNewerMonth = () => {
    if (!canGoNewer) return;
    onActiveMonthKeyChange(monthOptions[activeIdx - 1]?.key ?? null);
  };

  const goOlderMonth = () => {
    if (!canGoOlder) return;
    onActiveMonthKeyChange(monthOptions[activeIdx + 1]?.key ?? null);
  };

  const visibleRows = useMemo(() => {
    const parsed = activeMonthKey ? parseMonthKey(activeMonthKey) : null;
    if (!parsed) return [];
    return rows
      .filter((r) => r.year === parsed.year && r.month === parsed.month)
      .slice()
      .sort((a, b) => a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" }));
  }, [rows, activeMonthKey]);

  const goToMonth = (row: SongadayPlaylistBrowseRow) => {
    const q = new URLSearchParams({ user_id: String(row.user_id) });
    navigate(`/songaday/month/${row.year}/${row.month}?${q.toString()}`, {
      state: { returnPath, openSongadayArchive: true },
    });
  };

  const showMonthNav = monthOptions.length > 0;
  const showList = !loading && !error && rows.length > 0 && showMonthNav;

  if (!active) return null;

  return (
    <Stack gap="3" w="full">
      {showMonthNav ? (
        <SongadayMonthNavRow
          label={activeMonthLabel}
          canGoOlder={canGoOlder}
          canGoNewer={canGoNewer}
          onGoOlder={goOlderMonth}
          onGoNewer={goNewerMonth}
        />
      ) : null}
      <Text fontWeight="bold" fontSize={APP_TEXT_SIZES.label}>
        Friends&apos; Playlists
      </Text>
      {error ? (
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <Text fontSize={APP_TEXT_SIZES.helper} color="nautical.solid" fontWeight="medium" role="alert">
            {error}
          </Text>
        </Box>
      ) : null}
      {loading && rows.length === 0 ? (
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <PanelListRowSkeleton rows={4} />
        </Box>
      ) : null}
      {!loading && !error && rows.length === 0 ? (
        <PanelEmptyState
          title="No playlists yet."
          description="When you or people you can see post Song-a-Day entries, months will appear here."
        />
      ) : null}
      {showList ? (
        <Box
          maxH={{ base: "min(50vh, 24rem)", md: "min(55vh, 28rem)" }}
          overflowY="auto"
          w="full"
        >
          {visibleRows.length === 0 ? (
            <PanelEmptyState title="No playlists for this month." />
          ) : (
            <SimpleGrid columns={{ base: 3, md: 6 }} gap="2" w="full">
              {visibleRows.map((row) => {
                const avatarSrc =
                  resolveAvatarUrlForUser(
                    row.avatar_url,
                    row.user_id,
                    sessionUser,
                    auth0User,
                  ) || undefined;
                return (
                  <Box
                    key={`${row.user_id}-${row.year}-${row.month}`}
                    aspectRatio={1}
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor="border"
                    bg="bg.panel"
                    overflow="hidden"
                    minW={0}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      display="flex"
                      flexDirection="column"
                      alignItems="center"
                      justifyContent="center"
                      gap="1"
                      w="full"
                      h="full"
                      minH="full"
                      p="1.5"
                      rounded="none"
                      fontWeight="medium"
                      textAlign="center"
                      color="fg"
                      bg="bg.panel"
                      _hover={{ bg: "bg.subtle" }}
                      onClick={() => goToMonth(row)}
                    >
                      <Avatar.Root size="sm" flexShrink={0}>
                        <Avatar.Fallback name={row.display_name} />
                        {avatarSrc ? <Avatar.Image src={avatarSrc} /> : null}
                      </Avatar.Root>
                      <Text
                        fontSize={APP_TEXT_SIZES.meta}
                        color="fg"
                        lineClamp={2}
                        textAlign="center"
                        wordBreak="break-word"
                        w="full"
                      >
                        {row.display_name}
                      </Text>
                      <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" lineHeight="1.2">
                        ({row.submission_count})
                      </Text>
                    </Button>
                  </Box>
                );
              })}
            </SimpleGrid>
          )}
        </Box>
      ) : null}
    </Stack>
  );
}
