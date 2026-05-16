import { Box, Heading, Input, Link, Stack, Text } from "@chakra-ui/react";
import PondNativeSelect from "../components/PondNativeSelect";
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
  PANEL_FIELD_PROPS,
  PANEL_FORM_PLACEHOLDER_PROPS,
} from "../theme/typography";

const FIELD = { ...PANEL_FIELD_PROPS, ...PANEL_FORM_PLACEHOLDER_PROPS };
import {
  createPondsteadCampaign,
  fetchPondsteadCampaignsMine,
  type PondsteadLobbyRow,
} from "./pondsteadApi";
import { PondsteadFactionColorPicker } from "./pondsteadFactionPicker";

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
  const [newName, setNewName] = useState("");
  const [newFaction, setNewFaction] = useState("blue");
  const [newMaxPlayers, setNewMaxPlayers] = useState(2);

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
    const name = newName.trim();
    if (!name) {
      setErr("Enter a campaign name.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const token = await getApiAccessToken();
      const g = await createPondsteadCampaign(token, {
        name,
        faction_color: newFaction,
        max_players: newMaxPlayers,
      });
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
        <Stack gap="4" align="stretch" maxW="md">
          <Box>
            <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.label} mb="2">
              Campaign name
            </Text>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Weekend skirmish"
              maxLength={120}
              {...FIELD}
            />
          </Box>
          <Box>
            <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.label} mb="2">
              Your faction color
            </Text>
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" mb="3" lineHeight="tall">
              Tap a square to select. Joining players will pick from the remaining colors.
            </Text>
            <PondsteadFactionColorPicker value={newFaction} onChange={setNewFaction} />
          </Box>
          <Box>
            <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.label} mb="2">
              Seats (2–6)
            </Text>
            <PondNativeSelect
              rootProps={{ size: "md", maxW: "220px" }}
              fieldProps={{
                value: String(newMaxPlayers),
                onChange: (e) => setNewMaxPlayers(Number(e.currentTarget.value)),
              }}
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} players
                </option>
              ))}
            </PondNativeSelect>
          </Box>
          <PondButton
            type="button"
            colorPalette="teal"
            size="md"
            alignSelf="flex-start"
            onClick={() => void onCreate()}
            loading={busy}
          >
            Create campaign
          </PondButton>
        </Stack>
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
                        {(r.name ?? "").trim() || `Campaign #${r.id}`}
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
