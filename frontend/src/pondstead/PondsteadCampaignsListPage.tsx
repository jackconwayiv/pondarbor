import { Box, Heading, Link, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import {
  PanelBlockSkeleton,
  PanelListRowSkeleton,
  PanelMessageSlot,
} from "../components/panelStatus";
import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { createPondsteadCampaign, fetchPondsteadCampaignsMine, type PondsteadLobbyRow } from "./pondsteadApi";

export default function PondsteadCampaignsListPage() {
  const navigate = useNavigate();
  const {
    isAuthenticated,
    isLoading,
    sessionUser,
    getApiAccessToken,
    error: sessionError,
    refreshSession,
  } = useAppSession();
  const [rows, setRows] = useState<PondsteadLobbyRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    setErr(null);
    try {
      const token = await getApiAccessToken();
      setRows(await fetchPondsteadCampaignsMine(token));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    }
  }, [isAuthenticated, getApiAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async () => {
    setBusy(true);
    setErr(null);
    try {
      const token = await getApiAccessToken();
      const g = await createPondsteadCampaign(token, 2);
      navigate(`/pondstead/campaign/${g.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  if (isLoading) {
    return (
      <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <PanelBlockSkeleton lines={4} showTitleLine />
        </Box>
      </Stack>
    );
  }
  if (!sessionUser) {
    return (
      <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.body} mb="2">
            Reconnecting your API session…
          </Text>
          <Text fontSize={APP_TEXT_SIZES.helper} mb="3">
            {sessionError ||
              "You are authenticated, but the API session is not ready yet."}
          </Text>
          <PondButton colorPalette="sky" onClick={() => void refreshSession()}>
            Retry session sync
          </PondButton>
        </Box>
      </Stack>
    );
  }

  return (
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
      <Box {...PANEL_ENTRY_CARD_PROPS}>
        <Heading
          as="h1"
          size={{ base: "lg", md: "xl" }}
          fontWeight="bold"
          mb="2"
        >
          My Pondstead campaigns
        </Heading>
        <Text
          fontSize={APP_TEXT_SIZES.body}
          lineHeight="tall"
          color="fg"
          mb="4"
        >
          Open a lobby to invite players, or jump into an active game from the map.
        </Text>
        <PondButton
          type="button"
          colorPalette="teal"
          size="md"
          onClick={() => void onCreate()}
          loading={busy}
        >
          New campaign
        </PondButton>
      </Box>

      <PanelMessageSlot error={err} />

      <Box {...PANEL_ENTRY_CARD_PROPS}>
        <Text
          fontWeight="semibold"
          fontSize={APP_TEXT_SIZES.label}
          color="fg"
          mb="3"
        >
          Your games
        </Text>
        {rows === null ? (
          <PanelListRowSkeleton rows={4} />
        ) : rows.length === 0 ? (
          <Stack gap="3" align="flex-start">
            <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.body} color="fg">
              No campaigns yet
            </Text>
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" lineHeight="tall">
              Create a campaign to get a private lobby and invite a friend by search.
            </Text>
            <PondButton
              type="button"
              colorPalette="teal"
              size="sm"
              onClick={() => void onCreate()}
              loading={busy}
            >
              New campaign
            </PondButton>
          </Stack>
        ) : (
          <Stack gap="2">
            {rows.map((r) => {
              const href =
                r.status === "active"
                  ? `/pondstead/play/${r.id}`
                  : `/pondstead/campaign/${r.id}`;
              return (
                <Link key={r.id} asChild display="block">
                  <RouterLink to={href}>
                    <Box
                      borderWidth="1px"
                      borderColor="border"
                      borderRadius="md"
                      bg="bg"
                      px={{ base: "3", md: "4" }}
                      py={{ base: "2", md: "3" }}
                      transition="box-shadow 0.15s ease"
                      _hover={{ boxShadow: "md" }}
                    >
                      <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.body}>
                        Campaign #{r.id}
                      </Text>
                      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" mt="1">
                        {r.status} · day {r.current_day} · seats {r.players.length}/
                        {r.max_players}
                      </Text>
                    </Box>
                  </RouterLink>
                </Link>
              );
            })}
          </Stack>
        )}
      </Box>

      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
        <Link asChild variant="underline" color="fg.muted">
          <RouterLink to="/pondstead">← About Pondstead</RouterLink>
        </Link>
      </Text>
    </Stack>
  );
}
