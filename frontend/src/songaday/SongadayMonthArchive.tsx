import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PondButton from "../PondButton";
import { PanelEmptyState, PanelListRowSkeleton } from "../components/panelStatus";
import { APP_TEXT_SIZES, PANEL_ENTRY_CARD_PROPS } from "../theme/typography";
import { fetchResponsesArchive } from "./api";
import { songadayEntryTitleLine } from "./cleanSongLabel";
import type { SongadayResponse } from "./types";

type Props = {
  open: boolean;
  /** `YYYY-MM`, synced with Friends' Playlists month navigation. */
  activeMonthKey: string | null;
  getApiAccessToken: () => Promise<string>;
  onSelectEntryDate: (entryDateIso: string) => void;
  /** Omit or null = logged-in user’s archive; set to a friend id for their archive. */
  archiveUserId?: number | null;
  /** Optional: seed initial rows (e.g. current month preload). */
  seed?: {
    rows: SongadayResponse[];
    /** Next page to fetch when paging the archive endpoint. */
    nextPage: number;
    total: number;
  } | null;
  /** Limit total rows fetched to keep it snappy. */
  maxRows?: number;
};

function formatEntryMd(entryDate: string): string {
  const parts = entryDate.split("-");
  if (parts.length !== 3) return entryDate;
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(m) || !Number.isFinite(d)) return entryDate;
  return `${m}/${d}`;
}

/**
 * Normalize entry_date to `YYYY-MM` for grouping. Accepts `YYYY-MM-DD` and ISO datetimes;
 * month/day may be unpadded (API / serializers sometimes emit `2026-5-3`).
 */
function monthKeyFromIso(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (!m) return null;
  const y = m[1];
  const mo = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(mo) || mo < 1 || mo > 12) return null;
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}`;
}

export default function SongadayMonthArchive({
  open,
  activeMonthKey,
  getApiAccessToken,
  onSelectEntryDate,
  archiveUserId = null,
  seed,
  maxRows = 200,
}: Props) {
  const [rows, setRows] = useState<SongadayResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const inflight = useRef<Promise<SongadayResponse[] | null> | null>(null);
  const PAGE_SIZE = 50;

  const hasMore = rows.length < total && rows.length < maxRows;

  // Seed rows (once) when opening, if provided.
  useEffect(() => {
    if (!open) return;
    if (!seed) return;
    if (rows.length > 0) return;
    setRows(seed.rows);
    setTotal(seed.total);
    setPage(seed.nextPage);
  }, [open, seed, rows.length]);

  const visibleRows = useMemo(() => {
    if (!activeMonthKey) return [] as SongadayResponse[];
    const filtered = rows.filter(
      (r) => monthKeyFromIso(r.entry_date) === activeMonthKey,
    );
    const seen = new Set<number>();
    const deduped: SongadayResponse[] = [];
    for (const r of filtered) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      deduped.push(r);
    }
    return deduped.sort((a, b) =>
      String(b.entry_date).localeCompare(String(a.entry_date)),
    );
  }, [rows, activeMonthKey]);

  const loadNext = useCallback(async (): Promise<SongadayResponse[] | null> => {
    if (!open) return null;
    if (loading) return null;
    if (!hasMore && total !== 0) return null;
    if (inflight.current) return null;

    const run = (async (): Promise<SongadayResponse[] | null> => {
      setLoading(true);
      setLoadError(null);
      try {
        const token = await getApiAccessToken();
        const payload = await fetchResponsesArchive(
          token,
          archiveUserId,
          page,
          PAGE_SIZE,
        );
        let merged: SongadayResponse[] = [];
        setTotal(payload.total);
        setRows((prev) => {
          merged = [...prev, ...payload.results].slice(0, maxRows);
          return merged;
        });
        setPage((p) => p + 1);
        return merged;
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Failed to load archive.");
        return null;
      } finally {
        setLoading(false);
      }
    })();

    inflight.current = run;
    try {
      return await run;
    } finally {
      inflight.current = null;
    }
  }, [
    open,
    loading,
    hasMore,
    total,
    getApiAccessToken,
    page,
    maxRows,
    archiveUserId,
  ]);

  // Initial load when opened (skip if seed will populate rows in the effect above).
  useEffect(() => {
    if (!open) return;
    if (rows.length > 0 || loading) return;
    if (seed && seed.rows.length > 0) return;
    void loadNext();
  }, [open, rows.length, loading, loadNext, seed]);

  const hasEntriesForActiveMonth = useMemo(() => {
    if (!activeMonthKey) return false;
    return rows.some((r) => monthKeyFromIso(r.entry_date) === activeMonthKey);
  }, [rows, activeMonthKey]);

  useEffect(() => {
    if (!open || !activeMonthKey) return;
    if (hasEntriesForActiveMonth) return;
    if (!hasMore || loading) return;
    void loadNext();
  }, [
    open,
    activeMonthKey,
    hasEntriesForActiveMonth,
    hasMore,
    loading,
    loadNext,
  ]);

  if (!open) return null;

  return (
    <Stack gap="3">
      <Text fontWeight="bold" fontSize={APP_TEXT_SIZES.label}>
        Your Archive
      </Text>

      {loadError ? (
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <Text fontSize={APP_TEXT_SIZES.helper} color="nautical.solid" fontWeight="medium" role="alert">
            {loadError}
          </Text>
        </Box>
      ) : loading && rows.length === 0 ? (
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <PanelListRowSkeleton rows={3} />
        </Box>
      ) : total === 0 ? (
        <PanelEmptyState
          title="No submissions yet."
          description="Your past Song-a-Day entries will appear here once you’ve posted."
        />
      ) : !activeMonthKey ? null : visibleRows.length === 0 ? (
        <PanelEmptyState title="No entries for this month." />
      ) : (
        <Stack gap="2">
          {visibleRows.map((entry) => (
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
                cursor="pointer"
                onClick={() => onSelectEntryDate(entry.entry_date)}
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

      {hasMore ? (
        <HStack justify="flex-end">
          <PondButton
            type="button"
            size="sm"
            variant="outline"
            colorPalette="sky"
            loading={loading}
            onClick={() => void loadNext()}
          >
            Load more
          </PondButton>
        </HStack>
      ) : null}
    </Stack>
  );
}

