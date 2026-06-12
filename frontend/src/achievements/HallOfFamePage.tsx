import { Box, Heading, HStack, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { fetchAchievementTrophyCase } from "./api";
import { groupHallOfFameLockedByCategory } from "./groupHallOfFameByCategory";
import { HallOfFameRow } from "./HallOfFameRow";
import { sortHallOfFameRows } from "./sortTrophyCase";
import type { HallOfFameCategoryGroup, HallOfFameRow as HallOfFameRowType } from "./types";
import { useAppSession } from "../auth/AppSessionContext";
import { PanelEmptyState, SessionLoadingCard } from "../components/panelStatus";
import { APP_PANEL_PAGE_MIN_HEIGHT_PROPS, fullBleedStackProps } from "../responsive";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  MAPPED_LIST_STACK_GAP,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";

const CATEGORY_SECTION_GAP = "4";

const HALL_OF_FAME_CARD_GRID_PROPS = {
  columns: { base: 1, md: 2 },
  gap: MAPPED_LIST_STACK_GAP,
  w: "100%",
  alignItems: "stretch",
} as const;

function HallOfFameCardGrid({ children }: { children: ReactNode }) {
  return <SimpleGrid {...HALL_OF_FAME_CARD_GRID_PROPS}>{children}</SimpleGrid>;
}

function parseHighlightSlug(params: URLSearchParams): string | null {
  const raw = params.get("slug")?.trim();
  return raw ? raw : null;
}

function LockedCategorySection({
  groups,
  viewerId,
  highlightSlug,
}: {
  groups: HallOfFameCategoryGroup[];
  viewerId: number | null;
  highlightSlug: string | null;
}) {
  return (
    <Stack gap={CATEGORY_SECTION_GAP}>
      {groups.map((group) => {
        if (group.lockedRows.length === 0) return null;
        return (
          <Stack key={group.category} gap={MAPPED_LIST_STACK_GAP}>
            <Heading as="h2" size={{ base: "md", md: "lg" }} px="1">
              {group.label}
            </Heading>
            <HallOfFameCardGrid>
              {group.lockedRows.map((row) => (
                <HallOfFameRow
                  key={`locked-${row.slug}`}
                  row={row}
                  viewerId={viewerId}
                  highlighted={highlightSlug === row.slug}
                />
              ))}
            </HallOfFameCardGrid>
          </Stack>
        );
      })}
    </Stack>
  );
}

export default function HallOfFamePage() {
  const { getApiAccessToken, sessionUser } = useAppSession();
  const [searchParams] = useSearchParams();
  const highlightSlug = useMemo(
    () => parseHighlightSlug(searchParams),
    [searchParams],
  );
  const viewerId = sessionUser?.user?.id ?? null;

  const [rows, setRows] = useState<HallOfFameRowType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const didScrollRef = useRef(false);

  const earnedRows = useMemo(() => {
    const earned = rows.filter((r) => r.is_earned);
    if (viewerId == null) return sortHallOfFameRows(earned, -1);
    return sortHallOfFameRows(earned, viewerId);
  }, [rows, viewerId]);

  const lockedGroups = useMemo(
    () => groupHallOfFameLockedByCategory(rows),
    [rows],
  );

  const hasEarned = earnedRows.length > 0;
  const hasLocked = lockedGroups.some((g) => g.lockedRows.length > 0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getApiAccessToken();
        const data = await fetchAchievementTrophyCase(token);
        if (cancelled) return;
        setRows(data.rows);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load Hall of Fame");
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [getApiAccessToken]);

  useEffect(() => {
    if (!highlightSlug || loading || didScrollRef.current) return;
    const el = document.getElementById(`hall-of-fame-${highlightSlug}`);
    if (!el) return;
    didScrollRef.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightSlug, loading, rows]);

  const hasAnyRows = rows.length > 0;

  return (
    <Stack flex="1" gap="0" {...fullBleedStackProps} {...APP_PANEL_PAGE_MIN_HEIGHT_PROPS}>
      <Box flex="1" bg="bg" px={0} py={{ base: "2", md: "2" }}>
        <Box {...APP_SHELL_TRAY_PROPS}>
          <Stack
            gap={{ base: "4", md: "4" }}
            px={{ base: "2", md: "2" }}
            pt={{ base: "2", md: "2" }}
            pb="2"
          >
            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Heading as="h1" size={{ base: "lg", md: "xl" }} mb="0">
                <HStack
                  as="span"
                  display="inline-flex"
                  gap="2"
                  alignItems="center"
                  flexWrap="wrap"
                >
                  <Text as="span" aria-hidden="true">
                    🏆
                  </Text>
                  <Text as="span">Hall of Fame</Text>
                  {loading ? (
                    <Text
                      as="span"
                      fontSize={APP_TEXT_SIZES.helper}
                      color="fg.muted"
                      fontWeight="medium"
                      aria-live="polite"
                    >
                      Loading…
                    </Text>
                  ) : null}
                </HStack>
              </Heading>
              <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" mt="1">
                A real "who's who" of Pond Arbor!
              </Text>
            </Box>

            {loading && !hasAnyRows ? <SessionLoadingCard /> : null}

            {error ? (
              <Text color="red.600" fontSize={APP_TEXT_SIZES.body} role="alert">
                {error}
              </Text>
            ) : null}

            {!loading && !error && !hasEarned && !hasLocked ? (
              <PanelEmptyState title="No achievements in the catalog yet" />
            ) : null}

            {!loading && hasEarned ? (
              <HallOfFameCardGrid>
                {earnedRows.map((row) => (
                  <HallOfFameRow
                    key={`earned-${row.slug}`}
                    row={row}
                    viewerId={viewerId}
                    highlighted={highlightSlug === row.slug}
                  />
                ))}
              </HallOfFameCardGrid>
            ) : null}

            {!loading && hasLocked ? (
              <Stack gap={CATEGORY_SECTION_GAP} pt={hasEarned ? "2" : undefined}>
                <LockedCategorySection
                  groups={lockedGroups}
                  viewerId={viewerId}
                  highlightSlug={highlightSlug}
                />
              </Stack>
            ) : null}
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}
