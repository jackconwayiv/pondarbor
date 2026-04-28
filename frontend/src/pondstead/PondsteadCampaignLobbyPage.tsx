import {
  Box,
  Grid,
  Heading,
  HStack,
  Input,
  Link,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate, useParams } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { PanelBlockSkeleton, PanelErrorState, PanelMessageSlot } from "../components/panelStatus";
import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FIELD_PROPS,
  PANEL_FORM_PLACEHOLDER_PROPS,
} from "../theme/typography";
import {
  acceptCampaignInvite,
  declineCampaignInvite,
  fetchPondsteadCampaignDetail,
  inviteUserToCampaign,
  revokeCampaignAcceptance,
  searchCampaignInvitees,
  startCampaign,
  type FriendSearchRow,
  type PondsteadLobbyRow,
} from "./pondsteadApi";

const FIELD = { ...PANEL_FIELD_PROPS, ...PANEL_FORM_PLACEHOLDER_PROPS };

const FACTIONS = ["blue", "red", "green", "yellow", "purple", "orange"] as const;

export default function PondsteadCampaignLobbyPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const id = Number(campaignId);
  const navigate = useNavigate();
  const {
    sessionUser,
    isAuthenticated,
    isLoading,
    getApiAccessToken,
  } = useAppSession();
  const [row, setRow] = useState<PondsteadLobbyRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<FriendSearchRow[]>([]);
  const [faction, setFaction] = useState<string>("blue");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) return;
    setErr(null);
    try {
      const token = await getApiAccessToken();
      setRow(await fetchPondsteadCampaignDetail(token, id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
    }
  }, [id, getApiAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!Number.isFinite(id) || search.trim().length < 2 || row?.owner_id !== sessionUser?.user.id) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        try {
          const token = await getApiAccessToken();
          setHits(await searchCampaignInvitees(token, id, search.trim()));
        } catch {
          setHits([]);
        }
      })();
    }, 250);
    return () => clearTimeout(t);
  }, [search, id, row?.owner_id, sessionUser?.user.id, getApiAccessToken]);

  const isOwner = row?.owner_id === sessionUser?.user.id;
  const myInvite = useMemo(
    () => row?.invites.find((i) => i.invitee_id === sessionUser?.user.id),
    [row?.invites, sessionUser?.user.id],
  );
  const amPlayer = useMemo(
    () => row?.players.some((p) => p.user_id === sessionUser?.user.id),
    [row?.players, sessionUser?.user.id],
  );

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  if (isLoading) {
    return (
      <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <PanelBlockSkeleton lines={5} showTitleLine />
        </Box>
      </Stack>
    );
  }

  if (!Number.isFinite(id)) {
    return (
      <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
        <PanelErrorState
          title="Invalid campaign"
          description="That campaign link is not valid."
          actionLabel="All campaigns"
          onAction={() => navigate("/pondstead/campaigns")}
        />
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
          Campaign #{id}
        </Heading>
        {!row ? (
          <PanelBlockSkeleton lines={2} showTitleLine={false} />
        ) : (
          <Text fontSize={APP_TEXT_SIZES.body} color="fg" lineHeight="tall">
            <Text as="span" fontWeight="semibold" color="fg.muted">
              Status:
            </Text>{" "}
            {row.status}
            {" · "}
            <Text as="span" fontWeight="semibold" color="fg.muted">
              Owner:
            </Text>{" "}
            user #{row.owner_id}
            {" · "}
            <Text as="span" fontWeight="semibold" color="fg.muted">
              Seats:
            </Text>{" "}
            {row.players.length}/{row.max_players}
          </Text>
        )}
      </Box>

      <PanelMessageSlot error={err} />

      {row ? (
        <>
          <Box {...PANEL_ENTRY_CARD_PROPS}>
            <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.label} mb="3">
              Players
            </Text>
            <Stack gap="2">
              {row.players.map((p) => (
                <HStack
                  key={p.seat_index}
                  justify="space-between"
                  borderWidth="1px"
                  borderColor="border"
                  borderRadius="md"
                  px={{ base: "3", md: "4" }}
                  py={{ base: "2", md: "3" }}
                  bg="bg"
                >
                  <Text fontSize={APP_TEXT_SIZES.body}>
                    Seat {p.seat_index}: {p.display_name || "—"}
                    {p.faction_color ? ` · ${p.faction_color}` : ""}
                  </Text>
                  <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" fontWeight="medium">
                    {p.user_id ? `User ${p.user_id}` : "Open"}
                  </Text>
                </HStack>
              ))}
            </Stack>
          </Box>

          <Box {...PANEL_ENTRY_CARD_PROPS}>
            <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.label} mb="3">
              Invites
            </Text>
            {row.invites.length === 0 ? (
              <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                None yet.
              </Text>
            ) : (
              <Stack gap="2">
                {row.invites.map((i) => (
                  <HStack
                    key={i.id}
                    justify="space-between"
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="md"
                    px={{ base: "3", md: "4" }}
                    py={{ base: "2", md: "3" }}
                    bg="bg"
                  >
                    <Text fontSize={APP_TEXT_SIZES.body}>
                      {i.invitee_nickname}
                    </Text>
                    <Text
                      fontSize={APP_TEXT_SIZES.helper}
                      color="fg.muted"
                      fontWeight="medium"
                      textTransform="capitalize"
                    >
                      {i.status}
                    </Text>
                  </HStack>
                ))}
              </Stack>
            )}
          </Box>

          {isOwner && row.status === "lobby" ? (
            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.label} mb="2">
                Invite a player
              </Text>
              <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" mb="3">
                Search by nickname (at least two characters). Only approved users you can invite
                appear here.
              </Text>
              <Input
                size="sm"
                placeholder="Type to search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                mb="3"
                {...FIELD}
              />
              <Stack gap="2">
                {hits.map((h) => (
                  <PondButton
                    key={h.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    colorPalette="nautical"
                    justifyContent="flex-start"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const token = await getApiAccessToken();
                        await inviteUserToCampaign(token, id, h.id);
                        await load();
                      } catch (e) {
                        setErr(e instanceof Error ? e.message : "Invite failed");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Invite {h.nickname}
                  </PondButton>
                ))}
              </Stack>
              <PondButton
                type="button"
                mt="4"
                colorPalette="teal"
                size="md"
                loading={busy}
                disabled={row.players.length < row.max_players}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const token = await getApiAccessToken();
                    await startCampaign(token, id);
                    navigate(`/pondstead/play/${id}`);
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : "Start failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Start campaign
              </PondButton>
              {row.players.length < row.max_players ? (
                <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" mt="2">
                  Fill all seats before starting.
                </Text>
              ) : null}
            </Box>
          ) : null}

          {myInvite?.status === "pending" ? (
            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.label} mb="2">
                You are invited — pick a faction color
              </Text>
              <Grid templateColumns="repeat(3, 1fr)" gap="2" mb="4">
                {FACTIONS.map((c) => (
                  <PondButton
                    key={c}
                    type="button"
                    size="sm"
                    variant={faction === c ? "solid" : "outline"}
                    colorPalette={faction === c ? "teal" : "nautical"}
                    onClick={() => setFaction(c)}
                  >
                    {c}
                  </PondButton>
                ))}
              </Grid>
              <HStack gap="2" flexWrap="wrap">
                <PondButton
                  type="button"
                  colorPalette="teal"
                  size="md"
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const token = await getApiAccessToken();
                      await acceptCampaignInvite(token, id, faction);
                      await load();
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : "Accept failed");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Accept
                </PondButton>
                <PondButton
                  type="button"
                  variant="outline"
                  colorPalette="nautical"
                  size="md"
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const token = await getApiAccessToken();
                      await declineCampaignInvite(token, id);
                      await load();
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : "Decline failed");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Decline
                </PondButton>
              </HStack>
            </Box>
          ) : null}

          {myInvite?.status === "accepted" && amPlayer && !isOwner && row.status === "lobby" ? (
            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Text fontSize={APP_TEXT_SIZES.body} color="fg" mb="3">
                You have joined this lobby. You can leave before the owner starts.
              </Text>
              <PondButton
                type="button"
                variant="outline"
                colorPalette="nautical"
                size="md"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const token = await getApiAccessToken();
                    await revokeCampaignAcceptance(token, id);
                    await load();
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : "Revoke failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Revoke my acceptance
              </PondButton>
            </Box>
          ) : null}

          {row.status === "active" ? (
            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Text fontSize={APP_TEXT_SIZES.body} color="fg" mb="3">
                This campaign is in progress. Open the map to take your turn.
              </Text>
              <PondButton asChild colorPalette="teal" size="md">
                <RouterLink to={`/pondstead/play/${id}`}>Open map</RouterLink>
              </PondButton>
            </Box>
          ) : null}
        </>
      ) : null}

      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
        <Link asChild variant="underline" color="fg.muted">
          <RouterLink to="/pondstead/campaigns">← All campaigns</RouterLink>
        </Link>
      </Text>
    </Stack>
  );
}
