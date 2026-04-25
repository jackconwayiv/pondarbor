import { Avatar, Box, Heading, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router";

import PondButton from "../PondButton";
import { useAppSession } from "../auth/AppSessionContext";
import { PanelListRowSkeleton, PanelMessageSlot } from "../components/panelStatus";
import {
  APP_TEXT_SIZES,
  FIELD_PLACEHOLDER_PROPS,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { ApprovedFriendsListBlock } from "./ApprovedFriendsListBlock";
import {
  acceptFriend,
  fetchFriendsList,
  ignoreFriend,
  requestFriendByEmail,
  searchApprovedUsers,
  type FriendUser,
} from "./api";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FriendsListPanelProps = {
  /** When true, omit the large Friends heading block (e.g. Profile tab). */
  compact?: boolean;
};

export function FriendsListPanel({ compact = true }: FriendsListPanelProps) {
  const { isAuthenticated, sessionUser, getApiAccessToken } = useAppSession();
  const [incoming, setIncoming] = useState<FriendUser[]>([]);
  const [outgoing, setOutgoing] = useState<FriendUser[]>([]);
  const [approved, setApproved] = useState<FriendUser[]>([]);
  const [requestEmail, setRequestEmail] = useState("");
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [actionUserId, setActionUserId] = useState<number | null>(null);
  const listId = useId();

  async function loadList() {
    setLoading(true);
    setPageError(null);
    try {
      const token = await getApiAccessToken();
      const payload = await fetchFriendsList(token);
      setIncoming(payload.incoming_pending);
      setOutgoing(payload.outgoing_pending);
      setApproved(payload.approved_friends);
    } catch (err: unknown) {
      setPageError(
        err instanceof Error ? err.message : "Failed to load friends list.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !sessionUser?.user?.is_approved) return;
    void loadList();
  }, [isAuthenticated, sessionUser?.user?.is_approved]);

  useEffect(() => {
    if (!requestSuccess) return;
    const timer = window.setTimeout(() => setRequestSuccess(null), 3000);
    return () => window.clearTimeout(timer);
  }, [requestSuccess]);

  useEffect(() => {
    const query = requestEmail.trim();
    if (
      query.length < 2 ||
      !isAuthenticated ||
      !sessionUser?.user?.is_approved
    ) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const token = await getApiAccessToken();
          const rows = await searchApprovedUsers(token, query);
          setSearchResults(rows);
        } catch {
          setSearchResults([]);
        }
      })();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    requestEmail,
    isAuthenticated,
    sessionUser?.user?.is_approved,
    getApiAccessToken,
  ]);

  const canSubmitRequest = useMemo(
    () => EMAIL_SHAPE.test(requestEmail.trim()),
    [requestEmail],
  );

  if (!isAuthenticated || !sessionUser?.user?.is_approved) {
    return null;
  }

  return (
    <Stack gap={{ base: "4", md: "4" }} w="100%" align="stretch">
      {!compact ? (
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <Heading
            as="h1"
            size={{ base: "lg", md: "xl" }}
            fontWeight="bold"
            mb="2"
          >
            <HStack
              as="span"
              display="inline-flex"
              gap="2"
              alignItems="center"
            >
              <Text as="span" aria-hidden="true">
                👥
              </Text>
              <Text as="span">Friends</Text>
            </HStack>
          </Heading>
          <Text
            fontSize={APP_TEXT_SIZES.body}
            lineHeight="tall"
            color="fg"
            mb="3"
          >
            Send requests, manage pending connections, and browse friends
            you&apos;re connected with.
          </Text>
        </Box>
      ) : null}
      <Box {...PANEL_ENTRY_CARD_PROPS}>
        <Stack gap="2">
          <Text fontWeight="semibold">Request Friend</Text>
          <HStack align="start">
            <Stack flex="1">
              <Input
                value={requestEmail}
                onChange={(e) => setRequestEmail(e.target.value)}
                placeholder="friend@example.com"
                list={`${listId}-friend-suggestions`}
                {...FIELD_PLACEHOLDER_PROPS}
              />
              <datalist id={`${listId}-friend-suggestions`}>
                {searchResults.map((row) => (
                  <option key={`request-suggest-${row.id}`} value={row.email}>
                    {row.nickname}
                  </option>
                ))}
              </datalist>
            </Stack>
            <PondButton
              colorPalette="teal"
              disabled={!canSubmitRequest || loading}
              onClick={() => {
                void (async () => {
                  setRequestError(null);
                  setRequestSuccess(null);
                  try {
                    const token = await getApiAccessToken();
                    await requestFriendByEmail(
                      token,
                      requestEmail.trim().toLowerCase(),
                    );
                    setRequestEmail("");
                    setRequestSuccess("Friend request sent.");
                    await loadList();
                  } catch (err: unknown) {
                    setRequestError(
                      err instanceof Error
                        ? err.message
                        : "Friend request failed.",
                    );
                  }
                })();
              }}
            >
              Request Friend
            </PondButton>
          </HStack>
          <PanelMessageSlot
            error={requestError}
            success={requestSuccess}
            reserve={Boolean(requestError || requestSuccess)}
          />
        </Stack>
      </Box>

      <PanelMessageSlot error={pageError} />
      {loading ? (
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <PanelListRowSkeleton rows={2} />
        </Box>
      ) : null}

      <ApprovedFriendsListBlock friends={approved} showCountInTitle />

      {incoming.length > 0 || outgoing.length > 0 ? (
        <Box
          bg="bg.panel"
          borderRadius="xl"
          borderWidth="1px"
          borderStyle="dashed"
          borderColor="border"
          p="4"
        >
          <Stack gap="3">
            <Text fontWeight="bold" color="orange.solid">
              Pending Requests
            </Text>
            {incoming.map((row) => (
              <HStack key={`incoming-${row.id}`} justify="space-between">
                <Link
                  to={`/friend/${row.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <HStack>
                    <Avatar.Root size="sm">
                      <Avatar.Fallback name={row.nickname} />
                      <Avatar.Image src={row.avatar_url || undefined} />
                    </Avatar.Root>
                    <Stack gap="0">
                      <Text>{row.nickname}</Text>
                      <Text
                        fontSize={APP_TEXT_SIZES.helper}
                        color="fg.muted"
                      >
                        {row.email}
                      </Text>
                    </Stack>
                  </HStack>
                </Link>
                <HStack>
                  <PondButton
                    size="sm"
                    colorPalette="teal"
                    loading={actionUserId === row.id}
                    onClick={() => {
                      void (async () => {
                        setActionUserId(row.id);
                        setPageError(null);
                        try {
                          const token = await getApiAccessToken();
                          await acceptFriend(token, row.id);
                          await loadList();
                        } catch (err: unknown) {
                          setPageError(
                            err instanceof Error
                              ? err.message
                              : "Could not accept.",
                          );
                        } finally {
                          setActionUserId(null);
                        }
                      })();
                    }}
                  >
                    Accept
                  </PondButton>
                  <PondButton
                    size="sm"
                    colorPalette="nautical"
                    loading={actionUserId === row.id}
                    onClick={() => {
                      void (async () => {
                        setActionUserId(row.id);
                        setPageError(null);
                        try {
                          const token = await getApiAccessToken();
                          await ignoreFriend(token, row.id);
                          await loadList();
                        } catch (err: unknown) {
                          setPageError(
                            err instanceof Error
                              ? err.message
                              : "Could not ignore.",
                          );
                        } finally {
                          setActionUserId(null);
                        }
                      })();
                    }}
                  >
                    Ignore
                  </PondButton>
                </HStack>
              </HStack>
            ))}
            {outgoing.map((row) => (
              <Link
                key={`outgoing-${row.id}`}
                to={`/friend/${row.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <HStack>
                  <Avatar.Root size="sm">
                    <Avatar.Fallback name={row.nickname} />
                    <Avatar.Image src={row.avatar_url || undefined} />
                  </Avatar.Root>
                  <Stack gap="0">
                    <Text color="gray.400" fontStyle="italic">
                      {row.nickname}
                    </Text>
                    <Text
                      fontSize={APP_TEXT_SIZES.helper}
                      color="gray.400"
                      fontStyle="italic"
                    >
                      {row.email}
                    </Text>
                  </Stack>
                </HStack>
              </Link>
            ))}
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}
