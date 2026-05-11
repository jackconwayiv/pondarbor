import { Avatar, Box, Heading, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router";

import PondButton from "../PondButton";
import {
  resolveAvatarUrlForUser,
  useAppSession,
} from "../auth/AppSessionContext";
import { PanelListRowSkeleton, PanelMessageSlot } from "../components/panelStatus";
import {
  APP_TEXT_SIZES,
  FIELD_PLACEHOLDER_PROPS,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { ApprovedFriendsListBlock } from "./ApprovedFriendsListBlock";
import {
  acceptFriend,
  fetchApprovedUsersList,
  fetchFriendsList,
  ignoreFriend,
  requestFriendByUserId,
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
  const { isAuthenticated, sessionUser, auth0User, getApiAccessToken } =
    useAppSession();
  const [incoming, setIncoming] = useState<FriendUser[]>([]);
  const [outgoing, setOutgoing] = useState<FriendUser[]>([]);
  const [approved, setApproved] = useState<FriendUser[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<FriendUser[]>([]);
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
      const [payload, approvedUsersRows] = await Promise.all([
        fetchFriendsList(token),
        fetchApprovedUsersList(token),
      ]);
      setIncoming(payload.incoming_pending);
      setOutgoing(payload.outgoing_pending);
      setApproved(payload.approved_friends);
      setApprovedUsers(approvedUsersRows);
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
  const moveToOutgoingPendingLocally = (target: FriendUser) => {
    setOutgoing((prev) => {
      if (prev.some((x) => x.id === target.id)) return prev;
      return [...prev, target];
    });
    setApprovedUsers((prev) => prev.filter((x) => x.id !== target.id));
    setSearchResults((prev) => prev.filter((x) => x.id !== target.id));
  };

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
              colorPalette="lilypad"
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
                    const targetEmail = requestEmail.trim().toLowerCase();
                    const target = approvedUsers.find(
                      (row) => row.email.toLowerCase() === targetEmail,
                    );
                    if (target) {
                      moveToOutgoingPendingLocally(target);
                    }
                    setRequestEmail("");
                    setRequestSuccess("Friend request sent.");
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
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" mb="2">
            Loading...
          </Text>
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
                      <Avatar.Image
                        src={
                          resolveAvatarUrlForUser(
                            row.avatar_url,
                            row.id,
                            sessionUser,
                            auth0User,
                          ) || undefined
                        }
                      />
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
                          setIncoming((prev) =>
                            prev.filter((x) => x.id !== row.id),
                          );
                          setApproved((prev) => {
                            const next = [...prev, row];
                            next.sort((a, b) =>
                              a.nickname.localeCompare(b.nickname, undefined, {
                                sensitivity: "base",
                              }),
                            );
                            return next;
                          });
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
                          setIncoming((prev) =>
                            prev.filter((x) => x.id !== row.id),
                          );
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
                    <Avatar.Image
                      src={
                        resolveAvatarUrlForUser(
                          row.avatar_url,
                          row.id,
                          sessionUser,
                          auth0User,
                        ) || undefined
                      }
                    />
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

      {approvedUsers.length > 0 ? (
        <ApprovedFriendsListBlock
          title="Approved Users"
          friends={approvedUsers}
          showRequestFriendActions
          viewerId={sessionUser.user.id}
          viewerApprovedFriendIds={new Set(approved.map((row) => row.id))}
          viewerOutgoingPendingIds={new Set(outgoing.map((row) => row.id))}
          viewerIncomingPendingIds={new Set(incoming.map((row) => row.id))}
          onRequestFriend={async (userId) => {
            setPageError(null);
            try {
              const token = await getApiAccessToken();
              await requestFriendByUserId(token, userId);
              const target = approvedUsers.find((row) => row.id === userId);
              if (target) {
                moveToOutgoingPendingLocally(target);
              }
              setRequestSuccess("Friend request sent.");
            } catch (err: unknown) {
              setPageError(
                err instanceof Error
                  ? err.message
                  : "Could not send friend request.",
              );
            }
          }}
        />
      ) : null}
    </Stack>
  );
}
