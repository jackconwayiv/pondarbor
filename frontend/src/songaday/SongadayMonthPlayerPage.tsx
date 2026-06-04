import { Avatar, Box, HStack, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router";

import { resolveAvatarUrlForUser, useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import {
  PanelBlockSkeleton,
  PanelEmptyState,
  PanelSessionReconnect,
  SessionLoadingCard,
} from "../components/panelStatus";
import { fullBleedStackProps } from "../responsive";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { fetchPlaylistsMonth } from "./api";
import { formatEntryDayLabel, monthPlayerTitle } from "./playlistBrowseLabel";
import SongadayPlaylistRow from "./SongadayPlaylistRow";
import type { SongadayBrowseNavState } from "./useSongadayBrowseReturn";
import type { SongadayResponse } from "./types";

function parseRouteInt(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export default function SongadayMonthPlayerPage() {
  const { year: yearParam, month: monthParam } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const browseNav = (location.state ?? null) as SongadayBrowseNavState | null;
  const returnPath = browseNav?.returnPath ?? "/songaday";
  const {
    isAuthenticated,
    isLoading: sessionLoading,
    sessionUser,
    error: sessionError,
    refreshSession,
    getApiAccessToken,
    auth0User,
  } = useAppSession();

  const year = parseRouteInt(yearParam);
  const month = parseRouteInt(monthParam);
  const userIdFromQuery = parseRouteInt(searchParams.get("user_id") ?? undefined);

  const [entries, setEntries] = useState<SongadayResponse[]>([]);
  const [ownerName, setOwnerName] = useState("");
  const [ownerAvatarUrl, setOwnerAvatarUrl] = useState("");
  const [ownerUserId, setOwnerUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = useMemo(() => {
    if (userIdFromQuery != null) return userIdFromQuery;
    return sessionUser?.user.id ?? null;
  }, [userIdFromQuery, sessionUser?.user.id]);

  const load = useCallback(async () => {
    if (year == null || month == null || targetUserId == null) return;
    if (month < 1 || month > 12) {
      setError("Invalid month.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      const data = await fetchPlaylistsMonth(token, {
        userId: targetUserId,
        year,
        month,
      });
      setEntries(data.results);
      setOwnerName(data.user.nickname || data.user.email);
      setOwnerAvatarUrl(data.user.avatar_url || "");
      setOwnerUserId(data.user.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load this month.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [getApiAccessToken, year, month, targetUserId]);

  useEffect(() => {
    if (!isAuthenticated || sessionLoading) return;
    void load();
  }, [isAuthenticated, sessionLoading, load]);

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  if (sessionLoading) {
    return (
      <SessionLoadingCard>
        <PanelBlockSkeleton lines={3} showTitleLine />
      </SessionLoadingCard>
    );
  }
  if (!sessionUser) {
    return (
      <PanelSessionReconnect
        sessionError={sessionError}
        onRetry={() => void refreshSession()}
      />
    );
  }

  const invalidRoute = year == null || month == null || targetUserId == null;
  const title =
    year != null && month != null && ownerName
      ? monthPlayerTitle(year, month, ownerName)
      : "Month player";

  const ownerAvatarSrc =
    ownerUserId != null
      ? resolveAvatarUrlForUser(
          ownerAvatarUrl,
          ownerUserId,
          sessionUser,
          auth0User,
        ) || undefined
      : undefined;

  const goBackToBrowse = () => {
    navigate(returnPath, { state: { returnPath, openSongadayArchive: returnPath === "/songaday" } });
  };

  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box flex="1" bg="bg" px={0} py={{ base: "2", md: "2" }}>
        <Box {...APP_SHELL_TRAY_PROPS}>
          <Stack
            gap={MAPPED_CLOSET_TAB_STACK_GAP}
            px={{ base: "2", md: "2" }}
            pt={{ base: "2", md: "2" }}
            pb="4"
          >
            <HStack flexWrap="wrap" gap="3" justify="space-between" align="center" w="full">
              <HStack gap="2" align="center" flex="1" minW={0}>
                {ownerName ? (
                  <Avatar.Root size="md" flexShrink={0}>
                    <Avatar.Fallback name={ownerName} />
                    {ownerAvatarSrc ? <Avatar.Image src={ownerAvatarSrc} /> : null}
                  </Avatar.Root>
                ) : null}
                <Text fontSize={APP_TEXT_SIZES.label} fontWeight="bold" lineClamp={2} minW={0}>
                  {title}
                </Text>
              </HStack>
              <PondButton
                type="button"
                size="sm"
                variant="ghost"
                colorPalette="navy"
                color="teal.solid"
                flexShrink={0}
                onClick={goBackToBrowse}
              >
                ← Back
              </PondButton>
            </HStack>

            {invalidRoute ? (
              <PanelEmptyState title="Invalid month link." description="Use Browse playlists to open a month." />
            ) : null}

            {error ? (
              <Box {...PANEL_ENTRY_CARD_PROPS}>
                <Text fontSize={APP_TEXT_SIZES.helper} color="nautical.solid" fontWeight="medium" role="alert">
                  {error}
                </Text>
              </Box>
            ) : null}

            {loading && !error && !invalidRoute ? (
              <PanelBlockSkeleton lines={4} showTitleLine />
            ) : null}

            {!loading && !error && !invalidRoute && entries.length === 0 ? (
              <PanelEmptyState title="No entries this month." />
            ) : null}

            {!loading && !error && entries.length > 0 ? (
              <SimpleGrid
                columns={{ base: 1, md: 3 }}
                gap={{ base: 1.5, md: 2 }}
                w="full"
                alignItems="stretch"
              >
                {entries.map((entry) => (
                  <SongadayPlaylistRow
                    key={entry.id}
                    entry={entry}
                    dayLabel={formatEntryDayLabel(entry.entry_date)}
                  />
                ))}
              </SimpleGrid>
            ) : null}
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}
