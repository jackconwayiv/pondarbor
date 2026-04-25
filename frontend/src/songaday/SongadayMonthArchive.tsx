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
  getApiAccessToken: () => Promise<string>;
  onSelectEntryDate: (entryDateIso: string) => void;
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

function monthKeyFromIso(iso: string): string | null {
  const [y, m] = iso.split("-");
  if (!y || !m) return null;
  if (!/^\d{4}$/.test(y)) return null;
  if (!/^\d{2}$/.test(m)) return null;
  return `${y}-${m}`;
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function SongadayMonthArchive({
  open,
  getApiAccessToken,
  onSelectEntryDate,
  seed,
  maxRows = 200,
}: Props) {
  const [rows, setRows] = useState<SongadayResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const inflight = useRef<Promise<void> | null>(null);
  const PAGE_SIZE = 50;

  const hasMore = rows.length < total && rows.length < maxRows;

  const months = useMemo(() => {
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const k = monthKeyFromIso(r.entry_date);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      keys.push(k);
    }
    return keys;
  }, [rows]);

  const [activeMonthKey, setActiveMonthKey] = useState<string | null>(null);

  // Seed rows (once) when opening, if provided.
  useEffect(() => {
    if (!open) return;
    if (!seed) return;
    if (rows.length > 0) return;
    setRows(seed.rows);
    setTotal(seed.total);
    setPage(seed.nextPage);
  }, [open, seed, rows.length]);

  useEffect(() => {
    if (!open) return;
    if (activeMonthKey != null) return;
    const first = months[0] ?? null;
    if (first) setActiveMonthKey(first);
  }, [open, months, activeMonthKey]);

  const visibleRows = useMemo(() => {
    if (!activeMonthKey) return [] as SongadayResponse[];
    return rows.filter((r) => monthKeyFromIso(r.entry_date) === activeMonthKey);
  }, [rows, activeMonthKey]);

  const loadNext = useCallback(async () => {
    if (!open) return;
    if (loading) return;
    if (!hasMore && total !== 0) return;
    if (inflight.current) return;

    const run = (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const token = await getApiAccessToken();
        const payload = await fetchResponsesArchive(token, null, page, PAGE_SIZE);
        setTotal(payload.total);
        setRows((prev) => {
          const merged = [...prev, ...payload.results];
          return merged.slice(0, maxRows);
        });
        setPage((p) => p + 1);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Failed to load archive.");
      } finally {
        setLoading(false);
      }
    })();

    inflight.current = run;
    try {
      await run;
    } finally {
      inflight.current = null;
    }
  }, [open, loading, hasMore, total, getApiAccessToken, page, maxRows]);

  // Initial load when opened.
  useEffect(() => {
    if (!open) return;
    if (rows.length > 0 || loading) return;
    void loadNext();
  }, [open, rows.length, loading, loadNext]);

  const activeIdx = activeMonthKey ? months.indexOf(activeMonthKey) : -1;
  const canPrevMonth = activeIdx > 0;
  const canNextMonth = activeIdx >= 0 && activeIdx < months.length - 1;

  const goPrevMonth = () => {
    if (!canPrevMonth) return;
    setActiveMonthKey(months[activeIdx - 1] ?? null);
  };

  const goNextMonth = async () => {
    if (canNextMonth) {
      setActiveMonthKey(months[activeIdx + 1] ?? null);
      return;
    }
    if (hasMore) {
      await loadNext();
      // After loading more, if a new month appeared, select it.
      const nextKey = months[activeIdx + 1];
      if (nextKey) setActiveMonthKey(nextKey);
    }
  };

  if (!open) return null;

  return (
    <Stack gap="3">
      <HStack justify="space-between" align="center" flexWrap="wrap" gap="2">
        <Text fontWeight="bold" fontSize={APP_TEXT_SIZES.label}>
          Archive
        </Text>
        <HStack gap="2">
          <Box w="2.25rem" display="flex" justifyContent="flex-start">
            <PondButton
              type="button"
              size="sm"
              variant="ghost"
              colorPalette="navy"
              color="navy.solid"
              onClick={goPrevMonth}
              _hover={{ color: "navy.solid" }}
              visibility={canPrevMonth ? "visible" : "hidden"}
              pointerEvents={canPrevMonth ? "auto" : "none"}
              aria-hidden={!canPrevMonth}
            >
              ←
            </PondButton>
          </Box>
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" minW="10rem" textAlign="center">
            {activeMonthKey ? monthLabel(activeMonthKey) : "—"}
          </Text>
          <Box w="2.25rem" display="flex" justifyContent="flex-end">
            <PondButton
              type="button"
              size="sm"
              variant="ghost"
              colorPalette="navy"
              color="navy.solid"
              onClick={() => void goNextMonth()}
              _hover={{ color: "navy.solid" }}
              visibility={canNextMonth || hasMore ? "visible" : "hidden"}
              pointerEvents={canNextMonth || hasMore ? "auto" : "none"}
              aria-hidden={!(canNextMonth || hasMore)}
            >
              →
            </PondButton>
          </Box>
        </HStack>
      </HStack>

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
      ) : visibleRows.length === 0 ? (
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

