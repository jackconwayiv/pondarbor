import {
  Avatar,
  Box,
  Card,
  Heading,
  HStack,
  Image,
  Input,
  Stack,
  Tabs,
  Tag,
  Text,
} from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useParams } from "react-router";
import { AchievementSummaryCard } from "../achievements/AchievementSummaryCard";
import {
  fetchPublicAchievementsByUser,
  fetchPublicAchievementsByUserId,
} from "../achievements/api";
import type { AchievementSummary } from "../achievements/types";
import { useAppSession } from "../auth/AppSessionContext";
import {
  cancelBorrowRequest,
  createBorrowRequest,
  fetchFriendItemsByOwner,
  markCustodyReturnedByHolder,
  markReturnedByBorrower,
} from "../closet/api";
import type { ClosetItem } from "../closet/types";
import {
  validateClosetFreeText,
  validateIsoDateRequired,
} from "../forms/validation";
import {
  acceptFriend,
  ignoreFriend,
  requestFriendByUserId,
  unfriend,
} from "../friends/api";
import NotFoundPage from "../NotFoundPage";
import PondButton from "../PondButton";
import {
  fetchPublicQuotesByUser,
  fetchPublicQuotesByUserId,
} from "../quotes/api";
import { quoteOwnerDisplayLabel } from "../quotes/ownerDisplay";
import QuoteCardBase from "../quotes/QuoteCardBase";
import type { Quote } from "../quotes/types";
import { fullBleedStackProps } from "../responsive";
import {
  APP_TEXT_SIZES,
  MAPPED_CARD_PADDING_PROPS,
  MAPPED_LIST_CARD_OUTER_PROPS,
  MAPPED_LIST_STACK_GAP,
} from "../theme/typography";
import {
  fetchPublicUserSummaryByEmail,
  fetchPublicUserSummaryById,
  friendProfileHeading,
  type PublicUserSummary,
} from "./publicUser";

const PAGE_SIZE = 10;

const ENTRY_CARD_SHELL_PROPS = {
  bg: "white",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "xl",
} as const;

const ENTRY_CARD_PROPS = {
  ...ENTRY_CARD_SHELL_PROPS,
  p: { base: "2", md: "2" },
} as const;

/** Same shell as [`PublicQuotesPage`](../quotes/PublicQuotesPage.tsx) / editable quote rows in Quotes. */
function FriendProfileQuoteCard({ quote }: { quote: Quote }) {
  return (
    <Box {...ENTRY_CARD_SHELL_PROPS} {...MAPPED_LIST_CARD_OUTER_PROPS}>
      <QuoteCardBase
        quote={quote}
        ownerText={quoteOwnerDisplayLabel(quote.owner)}
        ownerProfileUserId={quote.owner.id}
      />
    </Box>
  );
}

function FriendProfileClosetItemCard({
  item,
  isExpanded,
  onToggleExpanded,
  requestingItemId,
  editingRequestItemId,
  confirmCancelRequestItemId,
  newNeedBy,
  newRequestMessage,
  onStartEditRequest,
  onNeedByChange,
  onRequestMessageChange,
  onSubmitRequest,
  onCancelRequest,
  onMarkReturned,
  returnBusyForItemId,
}: {
  item: ClosetItem;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  requestingItemId: number | null;
  editingRequestItemId: number | null;
  confirmCancelRequestItemId: number | null;
  newNeedBy: string;
  newRequestMessage: string;
  onStartEditRequest: (item: ClosetItem) => void;
  onNeedByChange: (itemId: number, value: string) => void;
  onRequestMessageChange: (itemId: number, value: string) => void;
  onSubmitRequest: (item: ClosetItem) => void;
  onCancelRequest: (item: ClosetItem) => void;
  onMarkReturned: (item: ClosetItem) => void;
  returnBusyForItemId: number | null;
}) {
  const imageUrl = (item.image_url ?? "").trim();
  const isCurrentlyBorrowedByMe =
    item.current_holder_user.id !== item.owner_user.id;
  const displayName = (
    user: ClosetItem["owner_user"] | ClosetItem["current_holder_user"],
  ) => (user.display_name || "").trim() || user.email;
  const categoryTrimmed = (item.category ?? "").trim();
  const tagParts = (item.tags ?? [])
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  const tagsInline = (
    <>
      {tagParts.map((tag) => (
        <Tag.Root
          key={`friend-profile-meta-${item.id}-${tag}`}
          size="sm"
          bg="gray.100"
          color="gray.600"
          borderWidth="0"
        >
          <Tag.Label>{tag}</Tag.Label>
        </Tag.Root>
      ))}
    </>
  );
  const openToggle = () => onToggleExpanded();
  const requestInputNeedBy = requestingItemId === item.id ? newNeedBy : "";
  const requestInputMessage =
    requestingItemId === item.id ? newRequestMessage : "";
  const canSubmitRequest =
    validateIsoDateRequired(requestInputNeedBy, "Need-by date") === null;
  const requestEditorVisible =
    !isCurrentlyBorrowedByMe &&
    (!item.my_pending_request || editingRequestItemId === item.id);
  const requestActions = (
    <Tabs.Root
      defaultValue="details"
      variant="plain"
      onClick={(e) => e.stopPropagation()}
    >
      <Tabs.List
        borderBottomWidth="1px"
        borderColor="border"
        gap="1"
        w="100%"
        pt="0"
        pb="0"
      >
        <Tabs.Trigger
          value="details"
          borderTopRadius="md"
          borderBottomRadius="0"
          px="2"
          py="2"
          fontWeight="medium"
          _selected={{ bg: "lilypad.solid", color: "black" }}
        >
          Details
        </Tabs.Trigger>
        <Tabs.Trigger
          value="request"
          borderTopRadius="md"
          borderBottomRadius="0"
          px="2"
          py="2"
          fontWeight="medium"
          _selected={{ bg: "lilypad.solid", color: "black" }}
        >
          Request
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="details" pt="2">
        <Stack gap="3">
          {categoryTrimmed ? (
            <Text
              fontWeight="bold"
              color="sky.solid"
              fontSize={APP_TEXT_SIZES.body}
            >
              {categoryTrimmed}
            </Text>
          ) : null}
          {tagParts.length > 0 && (
            <HStack
              flexWrap="wrap"
              gap="2"
              justify="flex-start"
              alignItems="flex-start"
              w="100%"
            >
              {tagsInline}
            </HStack>
          )}
          {item.current_holder_user.id !== item.owner_user.id ? (
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
              Holding: {displayName(item.current_holder_user)}
            </Text>
          ) : null}
        </Stack>
      </Tabs.Content>
      <Tabs.Content value="request" pt="2">
        <Stack gap="2" onClick={(e) => e.stopPropagation()}>
          {isCurrentlyBorrowedByMe ? (
            <Stack gap="2" align="flex-start">
              <Text fontSize={APP_TEXT_SIZES.helper} color="orange.solid">
                You are already borrowing this item.
              </Text>
              {item.active_loan_marked_returned_by_borrower ||
              item.custody_marked_returned_by_holder ? (
                <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                  You marked this item as returned. Waiting for owner
                  confirmation.
                </Text>
              ) : (
                <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                  Use I returned this after you hand the item back.
                </Text>
              )}
              <PondButton
                size="sm"
                colorPalette="lilypad"
                loading={returnBusyForItemId === item.id}
                disabled={
                  returnBusyForItemId !== null ||
                  item.active_loan_marked_returned_by_borrower ||
                  item.custody_marked_returned_by_holder
                }
                onClick={() => onMarkReturned(item)}
              >
                I returned this
              </PondButton>
            </Stack>
          ) : null}
          {item.my_pending_request && editingRequestItemId !== item.id ? (
            <HStack>
              <PondButton
                size="sm"
                colorPalette="lilypad"
                onClick={() => onStartEditRequest(item)}
              >
                Edit request
              </PondButton>
            </HStack>
          ) : null}
          {requestEditorVisible ? (
            <HStack flexWrap="wrap" align="flex-start">
              <Input
                type="date"
                value={requestInputNeedBy}
                onChange={(e) => onNeedByChange(item.id, e.target.value)}
                maxW="200px"
              />
              <Input
                value={requestInputMessage}
                onChange={(e) =>
                  onRequestMessageChange(item.id, e.target.value)
                }
                placeholder="Optional message"
              />
              <PondButton
                size="sm"
                colorPalette="lilypad"
                disabled={!canSubmitRequest}
                onClick={() => onSubmitRequest(item)}
              >
                {item.my_pending_request ? "Update request" : "Request borrow"}
              </PondButton>
              {item.my_pending_request ? (
                <PondButton
                  size="sm"
                  colorPalette="nautical"
                  onClick={() => onCancelRequest(item)}
                >
                  {confirmCancelRequestItemId === item.id
                    ? "Confirm cancel"
                    : "Cancel request"}
                </PondButton>
              ) : null}
            </HStack>
          ) : null}
        </Stack>
      </Tabs.Content>
    </Tabs.Root>
  );

  if (imageUrl) {
    return (
      <Card.Root
        flexDirection="row"
        overflow="hidden"
        alignItems="stretch"
        {...ENTRY_CARD_SHELL_PROPS}
        cursor="pointer"
        onClick={openToggle}
      >
        <Image
          src={imageUrl}
          alt=""
          aria-hidden
          flex="0 0 40%"
          maxW="40%"
          w="40%"
          objectFit="cover"
          alignSelf="stretch"
          minH="140px"
          draggable={false}
        />
        <Box flex="1" minW={0} {...MAPPED_CARD_PADDING_PROPS}>
          <Stack gap="2">
            <HStack gap="1" flexWrap="wrap" align="flex-start">
              {item.my_pending_request ? (
                <Text fontWeight="bold" color="lilypad.solid">
                  REQUESTED:
                </Text>
              ) : null}
              <Text fontWeight="bold">{item.name}</Text>
            </HStack>
            {item.my_pending_request ? null : item.pending_request_count > 0 ? (
              <Text fontSize={APP_TEXT_SIZES.helper}>
                {item.pending_request_count} outstanding{" "}
                {item.pending_request_count === 1 ? "request" : "requests"}
              </Text>
            ) : null}
            {item.current_holder_user.id !== item.owner_user.id ? (
              <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                Holding: {displayName(item.current_holder_user)}
              </Text>
            ) : null}
            {item.description ? <Text>{item.description}</Text> : null}
            {isExpanded ? requestActions : null}
          </Stack>
        </Box>
      </Card.Root>
    );
  }
  return (
    <Box
      {...ENTRY_CARD_SHELL_PROPS}
      {...MAPPED_LIST_CARD_OUTER_PROPS}
      cursor="pointer"
      onClick={openToggle}
    >
      <Stack gap="2">
        <HStack gap="1" flexWrap="wrap" align="flex-start">
          {item.my_pending_request ? (
            <Text fontWeight="bold" color="lilypad.solid">
              REQUESTED:
            </Text>
          ) : null}
          <Text fontWeight="bold">{item.name}</Text>
        </HStack>
        {item.my_pending_request ? null : item.pending_request_count > 0 ? (
          <Text fontSize={APP_TEXT_SIZES.helper}>
            {item.pending_request_count} outstanding{" "}
            {item.pending_request_count === 1 ? "request" : "requests"}
          </Text>
        ) : null}
        {item.current_holder_user.id !== item.owner_user.id ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
            Holding: {displayName(item.current_holder_user)}
          </Text>
        ) : null}
        {item.description ? <Text>{item.description}</Text> : null}
        {isExpanded ? requestActions : null}
      </Stack>
    </Box>
  );
}

export default function FriendProfilePage() {
  const { userId, email } = useParams<{ userId?: string; email?: string }>();
  const {
    isAuthenticated,
    isLoading: sessionLoading,
    sessionUser,
    getApiAccessToken,
  } = useAppSession();

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
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [summary, setSummary] = useState<PublicUserSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmUnfriend, setConfirmUnfriend] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [profileTab, setProfileTab] = useState<
    "achievements" | "quotes" | "closet"
  >("achievements");
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedFriendItemId, setExpandedFriendItemId] = useState<
    number | null
  >(null);
  const [requestingItemId, setRequestingItemId] = useState<number | null>(null);
  const [editingRequestItemId, setEditingRequestItemId] = useState<
    number | null
  >(null);
  const [confirmCancelRequestItemId, setConfirmCancelRequestItemId] = useState<
    number | null
  >(null);
  const [newNeedBy, setNewNeedBy] = useState("");
  const [newRequestMessage, setNewRequestMessage] = useState("");
  const [returnBusyForItemId, setReturnBusyForItemId] = useState<number | null>(
    null,
  );
  const unfriendBoxRef = useRef<HTMLDivElement | null>(null);
  const ownUserId = sessionUser?.user?.id ?? null;

  useEffect(() => {
    if (lookup.kind === "invalid") {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    const run = async () => {
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      setNotFound(false);
      try {
        let accessToken: string | null = null;
        try {
          accessToken = await getApiAccessToken();
        } catch {
          accessToken = null;
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
        const closetOwnerId =
          lookup.kind === "id" ? lookup.id : (summaryData.id ?? null);
        const closetRows =
          summaryData.can_view_full_profile && closetOwnerId !== null
            ? await fetchFriendItemsByOwner(accessToken, closetOwnerId).catch(
                () => [] as ClosetItem[],
              )
            : [];
        const sorted = [...quoteData].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setQuotes(sorted);
        setAchievements(achData);
        setClosetItems(closetRows);
        setSummary(summaryData);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to load friend profile";
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
  const hasClosetTab =
    Boolean(summary?.can_view_full_profile) && closetItems.length > 0;
  const leftmostVisibleTab = useMemo<
    "achievements" | "quotes" | "closet" | null
  >(() => {
    if (hasAchievements) return "achievements";
    if (hasQuotes) return "quotes";
    if (hasClosetTab) return "closet";
    return null;
  }, [hasAchievements, hasQuotes, hasClosetTab]);

  useEffect(() => {
    if (!leftmostVisibleTab) return;
    const tabVisible =
      (profileTab === "achievements" && hasAchievements) ||
      (profileTab === "quotes" && hasQuotes) ||
      (profileTab === "closet" && hasClosetTab);
    if (!tabVisible) {
      setProfileTab(leftmostVisibleTab);
    }
  }, [
    profileTab,
    hasAchievements,
    hasQuotes,
    hasClosetTab,
    leftmostVisibleTab,
  ]);

  if (sessionLoading) {
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

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (
    (lookup.kind === "id" && ownUserId !== null && lookup.id === ownUserId) ||
    summary?.friendship_status === "self"
  ) {
    return <Navigate to="/profile" replace />;
  }
  if (notFound) {
    return <NotFoundPage />;
  }

  const quotePaginationToolbar =
    total > PAGE_SIZE ? (
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
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
              }
              disabled={safePage >= totalPages - 1}
            >
              →
            </PondButton>
          </Stack>
        </Stack>
      </Box>
    ) : null;

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
              {!summary?.can_view_full_profile ? (
                <>
                  <Heading
                    as="h1"
                    size={{ base: "lg", md: "xl" }}
                    fontWeight="bold"
                    mb="2"
                  >
                    {summary ? friendProfileHeading(summary) : "Friend profile"}
                  </Heading>
                  <Text
                    fontSize={APP_TEXT_SIZES.body}
                    lineHeight="tall"
                    color="fg"
                  >
                    Connect as friends to see this user's profile, or respond to
                    their friend request below.
                  </Text>
                  {summary?.email ? (
                    <Text
                      fontSize={APP_TEXT_SIZES.helper}
                      color="gray.600"
                      mt="2"
                    >
                      {summary.email}
                    </Text>
                  ) : null}
                </>
              ) : summary ? (
                <>
                  <HStack
                    justify="space-between"
                    align="flex-start"
                    w="100%"
                    flexWrap="wrap"
                    gap="3"
                    mb="4"
                  >
                    <Stack gap="2" flex="1" minW="0">
                      <Heading
                        as="h1"
                        size={{ base: "lg", md: "xl" }}
                        fontWeight="bold"
                      >
                        Friend Profile
                      </Heading>
                    </Stack>
                    {lookup.kind === "id" ? (
                      <Box ref={unfriendBoxRef} flexShrink={0}>
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
                                setActionError(
                                  err instanceof Error
                                    ? err.message
                                    : "Failed to unfriend.",
                                );
                              } finally {
                                setActionBusy(false);
                              }
                            })();
                          }}
                          loading={actionBusy}
                        >
                          {confirmUnfriend ? "Confirm" : "Unfriend"}
                        </PondButton>
                      </Box>
                    ) : null}
                  </HStack>
                  <HStack gap="4" align="flex-start">
                    <Avatar.Root size="md">
                      <Avatar.Fallback name={summary.nickname} />
                      <Avatar.Image src={summary.avatar_url || undefined} />
                    </Avatar.Root>
                    <Stack gap="0">
                      <Text
                        fontWeight="semibold"
                        fontSize={APP_TEXT_SIZES.body}
                      >
                        {summary.nickname}
                      </Text>
                      {summary.email ? (
                        <Text fontSize={APP_TEXT_SIZES.helper} color="gray.600">
                          {summary.email}
                        </Text>
                      ) : null}
                    </Stack>
                  </HStack>
                </>
              ) : null}
            </Box>

            {isLoading ? (
              <Text fontSize={APP_TEXT_SIZES.body} color="fg">
                Loading…
              </Text>
            ) : null}

            {error ? (
              <Text
                role="alert"
                color="nautical.solid"
                fontWeight="medium"
                fontSize={APP_TEXT_SIZES.helper}
              >
                {error}
              </Text>
            ) : null}

            {!isLoading &&
            !error &&
            summary &&
            !summary.can_view_full_profile ? (
              <Box {...ENTRY_CARD_PROPS}>
                <Stack gap="3" align="flex-start">
                  <HStack gap="4" align="flex-start">
                    <Avatar.Root size="lg">
                      <Avatar.Fallback name={summary.nickname} />
                      <Avatar.Image src={summary.avatar_url || undefined} />
                    </Avatar.Root>
                    <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.body}>
                      {summary.nickname}
                    </Text>
                  </HStack>
                  {summary.friendship_status === "incoming_pending" ? (
                    <HStack flexWrap="wrap" gap="2">
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
                                err instanceof Error
                                  ? err.message
                                  : "Failed to accept friend request.",
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
                                err instanceof Error
                                  ? err.message
                                  : "Failed to reject friend request.",
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
                    <Text
                      fontSize={APP_TEXT_SIZES.body}
                      fontWeight="medium"
                      color="fg"
                    >
                      Friend request pending.
                    </Text>
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
                              err instanceof Error
                                ? err.message
                                : "Failed to send friend request.",
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
                    <Text
                      role="alert"
                      color="nautical.solid"
                      fontWeight="medium"
                      fontSize={APP_TEXT_SIZES.helper}
                    >
                      {actionError}
                    </Text>
                  ) : null}
                  {actionSuccess ? (
                    <Text
                      role="status"
                      fontSize={APP_TEXT_SIZES.helper}
                      color="lilypad.solid"
                      fontWeight="medium"
                    >
                      {actionSuccess}
                    </Text>
                  ) : null}
                </Stack>
              </Box>
            ) : null}

            {!isLoading &&
            !error &&
            summary?.can_view_full_profile &&
            (hasAchievements || hasQuotes || hasClosetTab) ? (
              <Box {...ENTRY_CARD_PROPS}>
                {actionError ? (
                  <Text
                    role="alert"
                    color="nautical.solid"
                    fontWeight="medium"
                    fontSize={APP_TEXT_SIZES.helper}
                    mb="2"
                  >
                    {actionError}
                  </Text>
                ) : null}
                <Tabs.Root
                  value={profileTab}
                  onValueChange={(details) =>
                    setProfileTab(
                      details.value as "achievements" | "quotes" | "closet",
                    )
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
                        bg={
                          profileTab === "achievements"
                            ? "lilypad.solid"
                            : undefined
                        }
                        color={
                          profileTab === "achievements" ? "black" : undefined
                        }
                        borderTopRadius="md"
                        borderBottomRadius="0"
                        px="2"
                        py="2"
                        fontWeight="medium"
                        _hover={{
                          bg:
                            profileTab === "achievements"
                              ? "lilypad.solid"
                              : "transparent",
                        }}
                        _selected={{ bg: "lilypad.solid", color: "black" }}
                      >
                        Achievements
                      </Tabs.Trigger>
                    ) : null}
                    {hasQuotes ? (
                      <Tabs.Trigger
                        value="quotes"
                        bg={
                          profileTab === "quotes" ? "lilypad.solid" : undefined
                        }
                        color={profileTab === "quotes" ? "black" : undefined}
                        borderTopRadius="md"
                        borderBottomRadius="0"
                        px="2"
                        py="2"
                        fontWeight="medium"
                        _hover={{
                          bg:
                            profileTab === "quotes"
                              ? "lilypad.solid"
                              : "transparent",
                        }}
                        _selected={{ bg: "lilypad.solid", color: "black" }}
                      >
                        Quotes
                      </Tabs.Trigger>
                    ) : null}
                    {hasClosetTab ? (
                      <Tabs.Trigger
                        value="closet"
                        bg={
                          profileTab === "closet" ? "lilypad.solid" : undefined
                        }
                        color={profileTab === "closet" ? "black" : undefined}
                        borderTopRadius="md"
                        borderBottomRadius="0"
                        px="2"
                        py="2"
                        fontWeight="medium"
                        _hover={{
                          bg:
                            profileTab === "closet"
                              ? "lilypad.solid"
                              : "transparent",
                        }}
                        _selected={{ bg: "lilypad.solid", color: "black" }}
                      >
                        Closet Items
                      </Tabs.Trigger>
                    ) : null}
                  </Tabs.List>
                  {hasAchievements ? (
                    <Tabs.Content value="achievements" pt="2">
                      <Stack gap={MAPPED_LIST_STACK_GAP}>
                        {achievements.map((a) => (
                          <AchievementSummaryCard
                            key={a.slug}
                            achievement={a}
                          />
                        ))}
                      </Stack>
                    </Tabs.Content>
                  ) : null}
                  {hasQuotes ? (
                    <Tabs.Content value="quotes" pt="2">
                      <Stack gap={MAPPED_LIST_STACK_GAP}>
                        {total > PAGE_SIZE && visibleQuotes.length === PAGE_SIZE
                          ? quotePaginationToolbar
                          : null}
                        {visibleQuotes.map((quote) => (
                          <FriendProfileQuoteCard
                            key={quote.id}
                            quote={quote}
                          />
                        ))}
                        {total > PAGE_SIZE ? quotePaginationToolbar : null}
                      </Stack>
                    </Tabs.Content>
                  ) : null}
                  {hasClosetTab ? (
                    <Tabs.Content value="closet" pt="2">
                      <Stack gap={MAPPED_LIST_STACK_GAP}>
                        {closetItems.length === 0 ? (
                          <Text fontSize={APP_TEXT_SIZES.helper}>
                            No closet items listed yet.
                          </Text>
                        ) : null}
                        {closetItems.map((item) => (
                          <FriendProfileClosetItemCard
                            key={`friend-closet-${item.id}`}
                            item={item}
                            isExpanded={expandedFriendItemId === item.id}
                            onToggleExpanded={() =>
                              setExpandedFriendItemId((prev) =>
                                prev === item.id ? null : item.id,
                              )
                            }
                            requestingItemId={requestingItemId}
                            editingRequestItemId={editingRequestItemId}
                            confirmCancelRequestItemId={
                              confirmCancelRequestItemId
                            }
                            newNeedBy={newNeedBy}
                            newRequestMessage={newRequestMessage}
                            onStartEditRequest={(row) => {
                              setEditingRequestItemId(row.id);
                              setRequestingItemId(row.id);
                              setNewNeedBy(
                                row.my_pending_request?.date_needed_by ?? "",
                              );
                              setNewRequestMessage(
                                row.my_pending_request?.message ?? "",
                              );
                            }}
                            onNeedByChange={(itemId, value) => {
                              setRequestingItemId(itemId);
                              setNewNeedBy(value);
                            }}
                            onRequestMessageChange={(itemId, value) => {
                              setRequestingItemId(itemId);
                              setNewRequestMessage(value);
                            }}
                            onSubmitRequest={(row) => {
                              void (async () => {
                                const dateErr = validateIsoDateRequired(
                                  newNeedBy,
                                  "Need-by date",
                                );
                                if (dateErr) {
                                  setActionError(dateErr);
                                  return;
                                }
                                const msgErr = validateClosetFreeText(
                                  newRequestMessage,
                                  "Message",
                                );
                                if (msgErr) {
                                  setActionError(msgErr);
                                  return;
                                }
                                setActionError(null);
                                setActionBusy(true);
                                try {
                                  const token = await getApiAccessToken();
                                  await createBorrowRequest(token, row.id, {
                                    date_needed_by: newNeedBy.trim(),
                                    message: newRequestMessage.trim(),
                                  });
                                  setActionSuccess(
                                    row.my_pending_request
                                      ? "Borrow request updated."
                                      : "Borrow request sent.",
                                  );
                                  setRequestingItemId(null);
                                  setEditingRequestItemId(null);
                                  setConfirmCancelRequestItemId(null);
                                  setNewNeedBy("");
                                  setNewRequestMessage("");
                                  setExpandedFriendItemId(null);
                                  setReloadKey((value) => value + 1);
                                } catch (err: unknown) {
                                  setActionError(
                                    err instanceof Error
                                      ? err.message
                                      : "Failed to request borrow",
                                  );
                                } finally {
                                  setActionBusy(false);
                                }
                              })();
                            }}
                            onCancelRequest={(row) => {
                              void (async () => {
                                if (confirmCancelRequestItemId !== row.id) {
                                  setConfirmCancelRequestItemId(row.id);
                                  return;
                                }
                                if (!row.my_pending_request) return;
                                setActionError(null);
                                setActionBusy(true);
                                try {
                                  const token = await getApiAccessToken();
                                  await cancelBorrowRequest(
                                    token,
                                    row.my_pending_request.id,
                                  );
                                  setActionSuccess("Borrow request canceled.");
                                  setRequestingItemId(null);
                                  setEditingRequestItemId(null);
                                  setConfirmCancelRequestItemId(null);
                                  setNewNeedBy("");
                                  setNewRequestMessage("");
                                  setExpandedFriendItemId(null);
                                  setReloadKey((value) => value + 1);
                                } catch (err: unknown) {
                                  setActionError(
                                    err instanceof Error
                                      ? err.message
                                      : "Failed to cancel request",
                                  );
                                } finally {
                                  setActionBusy(false);
                                }
                              })();
                            }}
                            onMarkReturned={(row) => {
                              void (async () => {
                                setActionError(null);
                                setReturnBusyForItemId(row.id);
                                try {
                                  const token = await getApiAccessToken();
                                  if (row.active_loan_id) {
                                    await markReturnedByBorrower(
                                      token,
                                      row.active_loan_id,
                                    );
                                  } else {
                                    await markCustodyReturnedByHolder(
                                      token,
                                      row.id,
                                    );
                                  }
                                  setActionSuccess(
                                    "Return noted. Waiting for owner confirmation.",
                                  );
                                  setReloadKey((value) => value + 1);
                                } catch (err: unknown) {
                                  setActionError(
                                    err instanceof Error
                                      ? err.message
                                      : "Failed to mark returned",
                                  );
                                } finally {
                                  setReturnBusyForItemId(null);
                                }
                              })();
                            }}
                            returnBusyForItemId={returnBusyForItemId}
                          />
                        ))}
                      </Stack>
                    </Tabs.Content>
                  ) : null}
                </Tabs.Root>
              </Box>
            ) : null}
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}
