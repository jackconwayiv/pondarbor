import { Avatar, Box, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router";

import PondButton from "../PondButton";
import { useAppSession } from "../auth/AppSessionContext";
import { fullBleedStackProps } from "../responsive";
import { APP_TEXT_SIZES, FIELD_PLACEHOLDER_PROPS } from "../theme/typography";
import {
  acceptFriend,
  fetchFriendsList,
  ignoreFriend,
  requestFriendByEmail,
  searchApprovedUsers,
  type FriendUser,
} from "./api";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ENTRY_CARD_PROPS = {
  bg: "white",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "xl",
  p: { base: "2", md: "2" },
} as const;

export default function FriendsPage() {
  const { isAuthenticated, isLoading, sessionUser, getApiAccessToken } =
    useAppSession();
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

  if (isLoading) {
    return (
      <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
        <Box
          flex="1"
          bg="sky.solid"
          px={{ base: "2", md: "2" }}
          py={{ base: "2", md: "2" }}
        >
          <Box
            maxW="4xl"
            w="100%"
            mx="auto"
            bg="gray.100"
            borderWidth="1px"
            borderColor="border"
            borderRadius="xl"
            overflow="hidden"
          >
            <Stack gap={{ base: "4", md: "4" }} p={{ base: "2", md: "2" }}>
              <Box {...ENTRY_CARD_PROPS}>
                <Text fontSize={APP_TEXT_SIZES.body} color="fg">
                  Loading…
                </Text>
              </Box>
            </Stack>
          </Box>
        </Box>
      </Stack>
    );
  }
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser?.user?.is_approved) return <Navigate to="/" replace />;

  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box
        flex="1"
        bg="sky.solid"
        px={{ base: "2", md: "2" }}
        py={{ base: "2", md: "2" }}
      >
        <Box
          maxW="4xl"
          w="100%"
          mx="auto"
          bg="gray.100"
          borderWidth="1px"
          borderColor="border"
          borderRadius="xl"
          overflow="hidden"
        >
          <Stack gap={{ base: "4", md: "4" }} p={{ base: "2", md: "2" }}>
            <Box {...ENTRY_CARD_PROPS}>
              <Stack gap="2">
                <Text fontWeight="semibold">Request Friend</Text>
                <HStack align="start">
                  <Stack flex="1">
                    <Input
                      value={requestEmail}
                      onChange={(e) => setRequestEmail(e.target.value)}
                      placeholder="friend@example.com"
                      list="friend-request-email-suggestions"
                      {...FIELD_PLACEHOLDER_PROPS}
                    />
                    <datalist id="friend-request-email-suggestions">
                      {searchResults.map((row) => (
                        <option
                          key={`request-suggest-${row.id}`}
                          value={row.email}
                        >
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
                {requestError ? (
                  <Text role="alert" color="nautical.solid" fontWeight="medium">
                    {requestError}
                  </Text>
                ) : null}
                {requestSuccess ? (
                  <Text
                    role="status"
                    color="lilypad.solid"
                    fontSize={APP_TEXT_SIZES.helper}
                    fontWeight="medium"
                  >
                    {requestSuccess}
                  </Text>
                ) : null}
              </Stack>
            </Box>

            {pageError ? (
              <Text role="alert" color="nautical.solid" fontWeight="medium">
                {pageError}
              </Text>
            ) : null}
            {loading ? (
              <Text fontSize={APP_TEXT_SIZES.body} fontWeight="medium">
                Loading…
              </Text>
            ) : null}

            {incoming.length > 0 || outgoing.length > 0 ? (
              <Box
                bg="white"
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
                          colorPalette="lilypad"
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

            <Box {...ENTRY_CARD_PROPS}>
              <Stack gap="3">
                <Text fontWeight="bold">Friends</Text>
                {approved.length === 0 ? (
                  <Text>No approved friends yet.</Text>
                ) : null}
                {approved.map((row) => (
                  <Link
                    key={`friend-${row.id}`}
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
                        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                          {row.email}
                        </Text>
                      </Stack>
                    </HStack>
                  </Link>
                ))}
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}
