import { Avatar, Box, Heading, HStack, Stack, Tabs, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useParams } from "react-router";
import NotFoundPage from "../NotFoundPage";
import { useAppSession } from "../auth/AppSessionContext";
import { fetchPublicAchievementsByUser, fetchPublicAchievementsByUserId } from "../achievements/api";
import type { AchievementSummary } from "../achievements/types";
import {
  fetchPublicUserSummaryByEmail,
  fetchPublicUserSummaryById,
  friendProfileHeading,
  type PublicUserSummary,
} from "./publicUser";
import PondButton from "../PondButton";
import { fullBleedStackProps } from "../responsive";
import { APP_TEXT_SIZES } from "../theme/typography";
import { fetchPublicQuotesByUser, fetchPublicQuotesByUserId } from "../quotes/api";
import { quoteOwnerDisplayLabel } from "../quotes/ownerDisplay";
import QuoteCardBase from "../quotes/QuoteCardBase";
import type { Quote } from "../quotes/types";
import { acceptFriend, ignoreFriend, requestFriendByUserId, unfriend } from "../friends/api";

const PAGE_SIZE = 10;

function FriendProfileQuoteCard({ quote }: { quote: Quote }) {
  return (
    <QuoteCardBase
      quote={quote}
      ownerText={quoteOwnerDisplayLabel(quote.owner)}
      ownerProfileUserId={quote.owner.id}
    />
  );
}

export default function FriendProfilePage() {
  const { userId, email } = useParams<{ userId?: string; email?: string }>();
  const { isAuthenticated, sessionUser, getApiAccessToken } = useAppSession();

  const lookup = useMemo(() => {
    if (userId !== undefined && userId !== "") {
      const id = Number.parseInt(userId, 10);
      if (!Number.isFinite(id) || id < 1) {
        return { kind: "invalid" as const };
      }
      return { kind: "id" as const, id };
    }
    if (email) {
      return { kind: "email" as const, email: decodeURIComponent(email) };
    }
    return { kind: "invalid" as const };
  }, [userId, email]);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [achievements, setAchievements] = useState<AchievementSummary[]>([]);
  const [summary, setSummary] = useState<PublicUserSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmUnfriend, setConfirmUnfriend] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [profileTab, setProfileTab] = useState<"achievements" | "quotes">("quotes");
  const [reloadKey, setReloadKey] = useState(0);
  const unfriendBoxRef = useRef<HTMLDivElement | null>(null);
  const ownUserId = sessionUser?.user?.id ?? null;

  useEffect(() => {
    if (lookup.kind === "invalid") {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    const run = async () => {
      setIsLoading(true);
      setError(null);
      setNotFound(false);
      try {
        let accessToken: string | null = null;
        if (isAuthenticated) {
          try {
            accessToken = await getApiAccessToken();
          } catch {
            accessToken = null;
          }
        }
        const [quoteData, achData, summaryData] = await Promise.all([
          lookup.kind === "id"
            ? fetchPublicQuotesByUserId(lookup.id, accessToken)
            : fetchPublicQuotesByUser(lookup.email, accessToken),
          (lookup.kind === "id"
            ? fetchPublicAchievementsByUserId(lookup.id, accessToken)
            : fetchPublicAchievementsByUser(lookup.email, accessToken)
          ).catch(() => [] as AchievementSummary[]),
          lookup.kind === "id"
            ? fetchPublicUserSummaryById(lookup.id, accessToken)
            : fetchPublicUserSummaryByEmail(lookup.email, accessToken),
        ]);
        const sorted = [...quoteData].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setQuotes(sorted);
        setAchievements(achData);
        setSummary(summaryData);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load friend profile";
        if (message.includes("(404)")) {
          setNotFound(true);
          setError(null);
        } else {
          setError(message);
        }
      } finally {
        setIsLoading(false);
      }
    };
    void run();
  }, [lookup, isAuthenticated, getApiAccessToken, reloadKey]);

  useEffect(() => {
    if (!actionSuccess) return;
    const timer = window.setTimeout(() => setActionSuccess(null), 3000);
    return () => window.clearTimeout(timer);
  }, [actionSuccess]);

  useEffect(() => {
    if (!confirmUnfriend) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (unfriendBoxRef.current?.contains(target)) return;
      setConfirmUnfriend(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [confirmUnfriend]);

  const total = quotes.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages - 1);
  const startIndex = safePage * PAGE_SIZE;
  const endIndex = Math.min(total, startIndex + PAGE_SIZE);
  const visibleQuotes = quotes.slice(startIndex, endIndex);
  const hasAchievements = achievements.length > 0;
  const hasQuotes = quotes.length > 0;

  useEffect(() => {
    if (profileTab === "achievements" && !hasAchievements) {
      setProfileTab("quotes");
    }
    if (profileTab === "quotes" && !hasQuotes && hasAchievements) {
      setProfileTab("achievements");
    }
  }, [profileTab, hasAchievements, hasQuotes]);

  if (
    (lookup.kind === "id" && ownUserId !== null && lookup.id === ownUserId) ||
    summary?.friendship_status === "self"
  ) {
    return <Navigate to="/profile" replace />;
  }
  if (notFound) {
    return <NotFoundPage />;
  }

  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box bg="bg" px={{ base: "4", md: "6" }} py={{ base: "6", md: "6" }}>
        <Stack gap="2" w="100%">
          {!summary?.can_view_full_profile ? (
            <>
              <Heading size="lg">{summary ? friendProfileHeading(summary) : "Friend profile"}</Heading>
              {summary?.email ? (
                <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                  {summary.email}
                </Text>
              ) : null}
            </>
          ) : (
            <HStack justify="space-between" align="start" w="100%">
              <HStack>
                <Avatar.Root size="md">
                  <Avatar.Fallback name={summary.nickname} />
                  <Avatar.Image src={summary.avatar_url || undefined} />
                </Avatar.Root>
                <Stack gap="0">
                  <Text fontWeight="semibold">{summary.nickname}</Text>
                  {summary.email ? (
                    <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                      {summary.email}
                    </Text>
                  ) : null}
                </Stack>
              </HStack>
              {lookup.kind === "id" ? (
                <Box ref={unfriendBoxRef}>
                  <PondButton
                    colorPalette="nautical"
                    onClick={() => {
                      if (!confirmUnfriend) {
                        setConfirmUnfriend(true);
                        return;
                      }
                      void (async () => {
                        setActionBusy(true);
                        setActionError(null);
                        try {
                          const token = await getApiAccessToken();
                          await unfriend(token, lookup.id);
                          setActionSuccess(null);
                          setConfirmUnfriend(false);
                          setReloadKey((value) => value + 1);
                        } catch (err: unknown) {
                          setActionError(err instanceof Error ? err.message : "Failed to unfriend.");
                        } finally {
                          setActionBusy(false);
                        }
                      })();
                    }}
                    loading={actionBusy}
                  >
                    {confirmUnfriend ? `Confirm Unfriend ${summary.nickname}` : `Unfriend ${summary.nickname}`}
                  </PondButton>
                </Box>
              ) : null}
            </HStack>
          )}
        </Stack>
      </Box>

      <Box flex="1" bg="sky.solid" px={{ base: "4", md: "6" }} py={{ base: "5", md: "6" }}>
        <Stack gap="3" maxW="3xl">
          {isLoading ? <Text>Loading…</Text> : null}
          {error ? <Text role="alert">{error}</Text> : null}
          {!isLoading && !error && summary && !summary.can_view_full_profile ? (
            <Box bg="bg" borderWidth="1px" borderColor="border" borderRadius="xl" p="4">
              <Stack gap="3" align="start">
                <HStack>
                  <Avatar.Root size="lg">
                    <Avatar.Fallback name={summary.nickname} />
                    <Avatar.Image src={summary.avatar_url || undefined} />
                  </Avatar.Root>
                  <Text fontWeight="semibold">{summary.nickname}</Text>
                </HStack>
                {summary.friendship_status === "incoming_pending" ? (
                  <HStack>
                    <PondButton
                      colorPalette="lilypad"
                      loading={actionBusy}
                      disabled={actionBusy || lookup.kind !== "id"}
                      onClick={() => {
                        if (lookup.kind !== "id") return;
                        void (async () => {
                          setActionBusy(true);
                          setActionError(null);
                          try {
                            const token = await getApiAccessToken();
                            await acceptFriend(token, lookup.id);
                            setActionSuccess(null);
                            setReloadKey((value) => value + 1);
                          } catch (err: unknown) {
                            setActionError(
                              err instanceof Error ? err.message : "Failed to accept friend request.",
                            );
                          } finally {
                            setActionBusy(false);
                          }
                        })();
                      }}
                    >
                      Accept Friend Request
                    </PondButton>
                    <PondButton
                      colorPalette="nautical"
                      loading={actionBusy}
                      disabled={actionBusy || lookup.kind !== "id"}
                      onClick={() => {
                        if (lookup.kind !== "id") return;
                        void (async () => {
                          setActionBusy(true);
                          setActionError(null);
                          try {
                            const token = await getApiAccessToken();
                            await ignoreFriend(token, lookup.id);
                            setActionSuccess(null);
                            setReloadKey((value) => value + 1);
                          } catch (err: unknown) {
                            setActionError(
                              err instanceof Error ? err.message : "Failed to reject friend request.",
                            );
                          } finally {
                            setActionBusy(false);
                          }
                        })();
                      }}
                    >
                      Reject Friend Request
                    </PondButton>
                  </HStack>
                ) : summary.friendship_status === "outgoing_pending" ? (
                  <Text fontWeight="medium">Friend request pending.</Text>
                ) : (
                  <PondButton
                    colorPalette="lilypad"
                    loading={actionBusy}
                    disabled={actionBusy || lookup.kind !== "id"}
                    onClick={() => {
                      if (lookup.kind !== "id") return;
                      void (async () => {
                        setActionBusy(true);
                        setActionError(null);
                        try {
                          const token = await getApiAccessToken();
                          await requestFriendByUserId(token, lookup.id);
                          setActionSuccess("Friend request sent.");
                          setSummary((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  friendship_status: "outgoing_pending",
                                }
                              : prev,
                          );
                        } catch (err: unknown) {
                          setActionError(
                            err instanceof Error ? err.message : "Failed to send friend request.",
                          );
                        } finally {
                          setActionBusy(false);
                        }
                      })();
                    }}
                  >
                    Request Friend
                  </PondButton>
                )}
                {actionError ? (
                  <Text role="alert" color="red.600" fontWeight="medium">
                    {actionError}
                  </Text>
                ) : null}
                {actionSuccess ? <Text>{actionSuccess}</Text> : null}
              </Stack>
            </Box>
          ) : null}
          {!isLoading && !error && summary?.can_view_full_profile && (hasAchievements || hasQuotes) ? (
            <Box bg="bg" borderWidth="1px" borderColor="border" borderRadius="xl" p={{ base: "4", md: "4" }}>
              {actionError ? (
                <Text role="alert" color="red.600" fontWeight="medium" mb="2">
                  {actionError}
                </Text>
              ) : null}
              <Tabs.Root
                value={profileTab}
                onValueChange={(details) =>
                  setProfileTab(details.value as "achievements" | "quotes")
                }
                variant="plain"
              >
                <Tabs.List
                  borderBottomWidth="1px"
                  borderColor="border"
                  gap="1"
                  w="100%"
                >
                  {hasAchievements ? (
                    <Tabs.Trigger
                      value="achievements"
                      bg={profileTab === "achievements" ? "lilypad.solid" : undefined}
                      color={profileTab === "achievements" ? "black" : undefined}
                      borderTopRadius="md"
                      borderBottomRadius="0"
                      px="4"
                      py="2"
                      fontWeight="medium"
                      _hover={{
                        bg: profileTab === "achievements" ? "lilypad.solid" : "transparent",
                      }}
                      _selected={{ bg: "lilypad.solid", color: "black" }}
                    >
                      Achievements
                    </Tabs.Trigger>
                  ) : null}
                  {hasQuotes ? (
                    <Tabs.Trigger
                      value="quotes"
                      bg={profileTab === "quotes" ? "lilypad.solid" : undefined}
                      color={profileTab === "quotes" ? "black" : undefined}
                      borderTopRadius="md"
                      borderBottomRadius="0"
                      px="4"
                      py="2"
                      fontWeight="medium"
                      _hover={{
                        bg: profileTab === "quotes" ? "lilypad.solid" : "transparent",
                      }}
                      _selected={{ bg: "lilypad.solid", color: "black" }}
                    >
                      Quotes
                    </Tabs.Trigger>
                  ) : null}
                </Tabs.List>
                {hasAchievements ? (
                  <Tabs.Content value="achievements" pt="3">
                    <Box
                      bg="bg"
                      borderWidth="1px"
                      borderColor="border"
                      borderRadius="xl"
                      p={{ base: "4", md: "4" }}
                    >
                      <Stack gap="3">
                        {achievements.map((a) => (
                          <Stack key={a.slug} gap="0">
                            <Text fontSize={APP_TEXT_SIZES.body} fontWeight="medium">
                              {a.title}
                            </Text>
                            {a.description ? (
                              <Text fontSize={APP_TEXT_SIZES.helper}>{a.description}</Text>
                            ) : null}
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  </Tabs.Content>
                ) : null}
                {hasQuotes ? (
                  <Tabs.Content value="quotes" pt="3">
                    <Stack gap="3">
                      {total > PAGE_SIZE && visibleQuotes.length === PAGE_SIZE ? (
                        <Box
                          bg="bg"
                          borderWidth="1px"
                          borderColor="border"
                          borderRadius="xl"
                          p={{ base: "4", md: "4" }}
                        >
                          <Stack gap="2">
                            <Text fontSize={APP_TEXT_SIZES.helper}>
                              Showing {startIndex + 1}-{endIndex} of {total}
                            </Text>
                            <Stack direction="row" align="center" flexWrap="wrap" gap="3">
                              <PondButton
                                type="button"
                                size="sm"
                                colorPalette="nautical"
                                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                                disabled={safePage === 0}
                              >
                                ←
                              </PondButton>
                              <Text fontSize={APP_TEXT_SIZES.helper}>
                                Page {safePage + 1} / {totalPages}
                              </Text>
                              <PondButton
                                type="button"
                                size="sm"
                                colorPalette="nautical"
                                onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                                disabled={safePage >= totalPages - 1}
                              >
                                →
                              </PondButton>
                            </Stack>
                          </Stack>
                        </Box>
                      ) : null}
                      {visibleQuotes.map((quote) => (
                        <FriendProfileQuoteCard key={quote.id} quote={quote} />
                      ))}
                      {total > PAGE_SIZE ? (
                        <Box
                          bg="bg"
                          borderWidth="1px"
                          borderColor="border"
                          borderRadius="xl"
                          p={{ base: "4", md: "4" }}
                        >
                          <Stack gap="2">
                            <Text fontSize={APP_TEXT_SIZES.helper}>
                              Showing {startIndex + 1}-{endIndex} of {total}
                            </Text>
                            <Stack direction="row" align="center" flexWrap="wrap" gap="3">
                              <PondButton
                                type="button"
                                size="sm"
                                colorPalette="nautical"
                                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                                disabled={safePage === 0}
                              >
                                ←
                              </PondButton>
                              <Text fontSize={APP_TEXT_SIZES.helper}>
                                Page {safePage + 1} / {totalPages}
                              </Text>
                              <PondButton
                                type="button"
                                size="sm"
                                colorPalette="nautical"
                                onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                                disabled={safePage >= totalPages - 1}
                              >
                                →
                              </PondButton>
                            </Stack>
                          </Stack>
                        </Box>
                      ) : null}
                    </Stack>
                  </Tabs.Content>
                ) : null}
              </Tabs.Root>
            </Box>
          ) : null}
          {!isLoading && !error && summary?.can_view_full_profile && !hasAchievements && !hasQuotes ? (
            <Text>No visible profile content.</Text>
          ) : null}
        </Stack>
      </Box>
    </Stack>
  );
}
