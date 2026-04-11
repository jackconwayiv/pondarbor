import {
  Box,
  Card,
  HStack,
  Heading,
  Image,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Spinner,
  Stack,
  Tabs,
  SimpleGrid,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import {
  validateClosetCategory,
  validateClosetFreeText,
  validateClosetItemName,
} from "../forms/validation";
import PondButton from "../PondButton";
import { fullBleedStackProps } from "../responsive";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_FORM_PLACEHOLDER_PROPS,
} from "../theme/typography";
import {
  acceptCustody,
  createItem,
  deleteBorrowRequest,
  deleteMyImage,
  fetchFriendsItems,
  fetchMyImageInventory,
  fetchMyItems,
  rejectPendingCustody,
  type FriendsItemsSort,
} from "./api";
import {
  CLOSET_CATEGORY_PRESETS,
  CLOSET_FRIENDS_CATEGORY_OTHER,
  isAllowedClosetCategory,
} from "./categories";
import { ClosetCategoryFields } from "./ClosetCategoryFields";
import { uploadClosetImageViaPresign } from "./imageUpload";
import type {
  ClosetImageInventoryRow,
  ClosetItem,
} from "./types";
import { ClosetItemLinkCard } from "./ClosetItemLinkCard";
import { FriendClosetListCard } from "./FriendClosetListCard";
import {
  closetPendingCount,
  coerceClosetUserId,
  displayName,
  sameClosetUserId,
} from "./closetUtils";

type ClosetTab = "my" | "friends" | "images";
const FRIENDS_PAGE_SIZE = 10;
const MY_ITEMS_PAGE_SIZE = 10;
const CLOSET_PLACEHOLDER_PROPS = PANEL_FORM_PLACEHOLDER_PROPS;

const ENTRY_CARD_PROPS = {
  bg: "white",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "xl",
  p: { base: "2", md: "2" },
} as const;

function parseTab(value: string | null): ClosetTab {
  if (value === "friends") return "friends";
  if (value === "images") return "images";
  return "my";
}

export default function ClosetPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));
  const {
    isAuthenticated,
    isLoading,
    sessionUser,
    getApiAccessToken,
    refreshSession,
    error: sessionError,
  } = useAppSession();
  const [myItems, setMyItems] = useState<{
    declined_by_me: ClosetItem[];
    borrowed_by_me: ClosetItem[];
    custody_offered_to_me: ClosetItem[];
    requested_by_me: ClosetItem[];
    owned_by_me: ClosetItem[];
  }>({
    declined_by_me: [],
    borrowed_by_me: [],
    custody_offered_to_me: [],
    requested_by_me: [],
    owned_by_me: [],
  });
  const [friendsItems, setFriendsItems] = useState<ClosetItem[]>([]);
  const [friendsPage, setFriendsPage] = useState(1);
  const [friendsCategoryFilter, setFriendsCategoryFilter] = useState("");
  const [friendsTagInput, setFriendsTagInput] = useState("");
  const [friendsTagFilter, setFriendsTagFilter] = useState("");
  const [friendsSort, setFriendsSort] =
    useState<FriendsItemsSort>("updated_desc");
  const [friendsFilterToolsOpen, setFriendsFilterToolsOpen] = useState(false);
  const [declinedPage, setDeclinedPage] = useState(1);
  const [borrowedPage, setBorrowedPage] = useState(1);
  const [custodyOfferedPage, setCustodyOfferedPage] = useState(1);
  const [requestedPage, setRequestedPage] = useState(1);
  const [ownedPage, setOwnedPage] = useState(1);
  const [loanedPage, setLoanedPage] = useState(1);
  const [friendsTotal, setFriendsTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [newItemImageBusy, setNewItemImageBusy] = useState(false);
  const newItemPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [
    confirmDeleteDeclinedRequestItemId,
    setConfirmDeleteDeclinedRequestItemId,
  ] = useState<number | null>(null);
  const confirmDeleteDeclinedRequestButtonRef =
    useRef<HTMLButtonElement | null>(null);
  const [ownedNotice, setOwnedNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [friendsNotice, setFriendsNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [imageRows, setImageRows] = useState<ClosetImageInventoryRow[]>([]);
  const [imagesNotice, setImagesNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [deletingImageKey, setDeletingImageKey] = useState<string | null>(null);
  const [confirmDeleteImageKey, setConfirmDeleteImageKey] = useState<
    string | null
  >(null);
  const confirmDeleteImageButtonRefs = useRef<
    Record<string, HTMLButtonElement | null>
  >({});
  const [imagesFilter, setImagesFilter] = useState<"unused" | "all">("unused");

  const meId = coerceClosetUserId(sessionUser?.user.id);
  const totalFriendsPages = Math.max(
    1,
    Math.ceil(friendsTotal / FRIENDS_PAGE_SIZE),
  );
  const totalDeclinedPages = Math.max(
    1,
    Math.ceil(myItems.declined_by_me.length / MY_ITEMS_PAGE_SIZE),
  );
  const totalBorrowedPages = Math.max(
    1,
    Math.ceil(myItems.borrowed_by_me.length / MY_ITEMS_PAGE_SIZE),
  );
  const totalCustodyOfferedPages = Math.max(
    1,
    Math.ceil(myItems.custody_offered_to_me.length / MY_ITEMS_PAGE_SIZE),
  );
  const totalRequestedPages = Math.max(
    1,
    Math.ceil(myItems.requested_by_me.length / MY_ITEMS_PAGE_SIZE),
  );
  const loanedItems = useMemo(
    () =>
      myItems.owned_by_me.filter(
        (item) => !sameClosetUserId(item.current_holder_user.id, meId),
      ),
    [myItems.owned_by_me, meId],
  );
  const ownedWithPendingRequests = useMemo(
    () =>
      myItems.owned_by_me.filter(
        (item) =>
          closetPendingCount(item) > 0 &&
          sameClosetUserId(item.current_holder_user.id, meId),
      ),
    [myItems.owned_by_me, meId],
  );
  const ownedWithoutPendingRequests = useMemo(
    () =>
      myItems.owned_by_me.filter(
        (item) =>
          closetPendingCount(item) === 0 &&
          sameClosetUserId(item.current_holder_user.id, meId),
      ),
    [myItems.owned_by_me, meId],
  );
  const totalLoanedPages = Math.max(
    1,
    Math.ceil(loanedItems.length / MY_ITEMS_PAGE_SIZE),
  );
  const totalOwnedPages = Math.max(
    1,
    Math.ceil(ownedWithoutPendingRequests.length / MY_ITEMS_PAGE_SIZE),
  );
  const safeDeclinedPage = Math.min(declinedPage, totalDeclinedPages);
  const safeBorrowedPage = Math.min(borrowedPage, totalBorrowedPages);
  const safeCustodyOfferedPage = Math.min(
    custodyOfferedPage,
    totalCustodyOfferedPages,
  );
  const safeRequestedPage = Math.min(requestedPage, totalRequestedPages);
  const safeOwnedPage = Math.min(ownedPage, totalOwnedPages);
  const safeLoanedPage = Math.min(loanedPage, totalLoanedPages);
  const declinedStart = (safeDeclinedPage - 1) * MY_ITEMS_PAGE_SIZE;
  const borrowedStart = (safeBorrowedPage - 1) * MY_ITEMS_PAGE_SIZE;
  const custodyOfferedStart = (safeCustodyOfferedPage - 1) * MY_ITEMS_PAGE_SIZE;
  const requestedStart = (safeRequestedPage - 1) * MY_ITEMS_PAGE_SIZE;
  const ownedStart = (safeOwnedPage - 1) * MY_ITEMS_PAGE_SIZE;
  const loanedStart = (safeLoanedPage - 1) * MY_ITEMS_PAGE_SIZE;
  const visibleDeclined = myItems.declined_by_me.slice(
    declinedStart,
    declinedStart + MY_ITEMS_PAGE_SIZE,
  );
  const visibleBorrowed = myItems.borrowed_by_me.slice(
    borrowedStart,
    borrowedStart + MY_ITEMS_PAGE_SIZE,
  );
  const visibleCustodyOffered = myItems.custody_offered_to_me.slice(
    custodyOfferedStart,
    custodyOfferedStart + MY_ITEMS_PAGE_SIZE,
  );
  const visibleRequested = myItems.requested_by_me.slice(
    requestedStart,
    requestedStart + MY_ITEMS_PAGE_SIZE,
  );
  const visibleOwned = ownedWithoutPendingRequests.slice(
    ownedStart,
    ownedStart + MY_ITEMS_PAGE_SIZE,
  );
  const visibleLoaned = loanedItems.slice(
    loanedStart,
    loanedStart + MY_ITEMS_PAGE_SIZE,
  );

  const setActiveTab = (tab: ClosetTab) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  const loadMine = useCallback(async () => {
    const token = await getApiAccessToken();
    const payload = await fetchMyItems(token);
    setMyItems(payload);
  }, [getApiAccessToken]);

  const loadFriends = useCallback(async () => {
    const token = await getApiAccessToken();
    const payload = await fetchFriendsItems(
      token,
      friendsPage,
      FRIENDS_PAGE_SIZE,
      {
        category: friendsCategoryFilter.trim(),
        tag: friendsTagFilter,
        sort: friendsSort,
      },
    );
    setFriendsItems(payload.results);
    setFriendsTotal(payload.total);
  }, [
    friendsCategoryFilter,
    friendsPage,
    friendsSort,
    friendsTagFilter,
    getApiAccessToken,
  ]);

  const loadImages = useCallback(async () => {
    const token = await getApiAccessToken();
    const payload = await fetchMyImageInventory(token);
    setImageRows(payload.results);
  }, [getApiAccessToken]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const parts = await Promise.allSettled([loadMine(), loadFriends(), loadImages()]);
    const failures: string[] = [];
    const labels = ["your items", "friends' items", "image library"] as const;
    parts.forEach((result, i) => {
      if (result.status === "rejected") {
        const msg =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        failures.push(`${labels[i]}: ${msg}`);
      }
    });
    if (failures.length > 0) {
      setError(failures.join(" · "));
    }
    setLoading(false);
  }, [loadFriends, loadImages, loadMine]);

  useEffect(() => {
    if (!isAuthenticated || !sessionUser) return;
    void refreshAll();
  }, [
    friendsCategoryFilter,
    friendsPage,
    friendsSort,
    friendsTagFilter,
    isAuthenticated,
    refreshAll,
    sessionUser,
  ]);

  useEffect(() => {
    if (!confirmDeleteImageKey) return;
    const onPointerDown = (event: MouseEvent) => {
      const button =
        confirmDeleteImageButtonRefs.current[confirmDeleteImageKey];
      const target = event.target as Node | null;
      if (button && target && button.contains(target)) return;
      setConfirmDeleteImageKey(null);
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [confirmDeleteImageKey]);

  useEffect(() => {
    if (declinedPage > totalDeclinedPages) setDeclinedPage(totalDeclinedPages);
  }, [declinedPage, totalDeclinedPages]);

  useEffect(() => {
    if (borrowedPage > totalBorrowedPages) setBorrowedPage(totalBorrowedPages);
  }, [borrowedPage, totalBorrowedPages]);

  useEffect(() => {
    if (custodyOfferedPage > totalCustodyOfferedPages)
      setCustodyOfferedPage(totalCustodyOfferedPages);
  }, [custodyOfferedPage, totalCustodyOfferedPages]);

  useEffect(() => {
    if (requestedPage > totalRequestedPages)
      setRequestedPage(totalRequestedPages);
  }, [requestedPage, totalRequestedPages]);

  useEffect(() => {
    if (ownedPage > totalOwnedPages) setOwnedPage(totalOwnedPages);
  }, [ownedPage, totalOwnedPages]);

  useEffect(() => {
    if (loanedPage > totalLoanedPages) setLoanedPage(totalLoanedPages);
  }, [loanedPage, totalLoanedPages]);

  useEffect(() => {
    if (!ownedNotice) return;
    const timer = window.setTimeout(() => setOwnedNotice(null), 7000);
    return () => window.clearTimeout(timer);
  }, [ownedNotice]);

  useEffect(() => {
    if (!friendsNotice) return;
    const timer = window.setTimeout(() => setFriendsNotice(null), 7000);
    return () => window.clearTimeout(timer);
  }, [friendsNotice]);

  useEffect(() => {
    if (confirmDeleteDeclinedRequestItemId == null) return;
    let onPointerDown: ((event: PointerEvent) => void) | undefined;
    const attachId = window.setTimeout(() => {
      onPointerDown = (event: PointerEvent) => {
        const target = event.target as Node | null;
        if (!target) return;
        if (confirmDeleteDeclinedRequestButtonRef.current?.contains(target))
          return;
        setConfirmDeleteDeclinedRequestItemId(null);
      };
      document.addEventListener("pointerdown", onPointerDown);
    }, 0);
    return () => {
      window.clearTimeout(attachId);
      if (onPointerDown)
        document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [confirmDeleteDeclinedRequestItemId]);

  const friendsTagFilterPrevRef = useRef("");
  useEffect(() => {
    const id = window.setTimeout(() => {
      const next = friendsTagInput.trim();
      if (friendsTagFilterPrevRef.current === next) return;
      friendsTagFilterPrevRef.current = next;
      setFriendsTagFilter(next);
      setFriendsPage(1);
    }, 350);
    return () => window.clearTimeout(id);
  }, [friendsTagInput]);

  if (isLoading) return <Text>Loading…</Text>;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser) {
    return (
      <Stack gap="4" maxW="3xl">
        <Text fontWeight="semibold">Reconnecting your API session…</Text>
        <Text fontSize={APP_TEXT_SIZES.helper}>
          {sessionError ||
            "You are authenticated, but the API session is not ready yet."}
        </Text>
        <HStack>
          <PondButton colorPalette="sky" onClick={() => void refreshSession()}>
            Retry session sync
          </PondButton>
        </HStack>
      </Stack>
    );
  }

  if (!sessionUser.user.is_approved) {
    return (
      <Stack
        flex="1"
        minH="full"
        gap="4"
        px={{ base: "2", md: "2" }}
        py={{ base: "2", md: "2" }}
        {...fullBleedStackProps}
      >
        <Text fontSize={{ base: "sm", md: "md" }}>Approval required.</Text>
      </Stack>
    );
  }

  const visibleDeclinedFiltered = visibleDeclined;
  const visibleBorrowedFiltered = visibleBorrowed;
  const visibleCustodyOfferedFiltered = visibleCustodyOffered;
  const visibleOwnedFiltered = visibleOwned;
  const visibleRequestedOwnedFiltered = ownedWithPendingRequests;
  const visibleLoanedFiltered = visibleLoaned;
  const visibleImageRows =
    imagesFilter === "unused"
      ? imageRows.filter((row) => row.status === "stranded")
      : imageRows;

  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Tabs.Root
        value={activeTab}
        display="flex"
        flexDirection="column"
        flex="1"
        minH="full"
        lazyMount
        unmountOnExit
        onValueChange={(details) => setActiveTab(parseTab(details.value))}
        variant="plain"
      >
        <Box
          flex="1"
          bg="sky.solid"
          px={{ base: "2", md: "2" }}
          py={{ base: "2", md: "2" }}
        >
          {loading ? (
            <Box maxW="4xl" w="100%" mx="auto" pb="2">
              <Text fontSize={APP_TEXT_SIZES.body} fontWeight="medium">
                Loading closet…
              </Text>
            </Box>
          ) : null}
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
            <Stack
              gap={{ base: "4", md: "4" }}
              px={{ base: "2", md: "2" }}
              pt={{ base: "2", md: "2" }}
              pb="2"
            >
              <Box {...ENTRY_CARD_PROPS}>
                <Heading
                  as="h1"
                  size={{ base: "lg", md: "xl" }}
                  fontWeight="bold"
                  mb="2"
                >
                  Community Closet
                </Heading>
                <Text
                  fontSize={APP_TEXT_SIZES.body}
                  lineHeight="tall"
                  color="fg"
                >
                  Share items you're willing to lend, browse your friends'
                  listings, and manage borrow requests and returns.
                </Text>
              </Box>
            </Stack>
            <Tabs.List
              px={{ base: "2", md: "2" }}
              pt="0"
              pb="0"
              borderBottomWidth="1px"
              borderColor="border"
              gap="1"
              w="100%"
            >
              <Tabs.Trigger
                value="my"
                bg={activeTab === "my" ? "lilypad.solid" : undefined}
                color={activeTab === "my" ? "black" : undefined}
                borderTopRadius="md"
                borderBottomRadius="0"
                px="2"
                py="2"
                fontWeight="medium"
                _hover={{
                  bg: activeTab === "my" ? "lilypad.solid" : "transparent",
                }}
                _selected={{ bg: "lilypad.solid", color: "black" }}
              >
                My Items
              </Tabs.Trigger>
              <Tabs.Trigger
                value="friends"
                bg={activeTab === "friends" ? "lilypad.solid" : undefined}
                color={activeTab === "friends" ? "black" : undefined}
                borderTopRadius="md"
                borderBottomRadius="0"
                px="2"
                py="2"
                fontWeight="medium"
                _hover={{
                  bg: activeTab === "friends" ? "lilypad.solid" : "transparent",
                }}
                _selected={{ bg: "lilypad.solid", color: "black" }}
              >
                Friends&apos; Items
              </Tabs.Trigger>
              <Tabs.Trigger
                value="images"
                bg={activeTab === "images" ? "lilypad.solid" : undefined}
                color={activeTab === "images" ? "black" : undefined}
                borderTopRadius="md"
                borderBottomRadius="0"
                px="2"
                py="2"
                fontWeight="medium"
                _hover={{
                  bg: activeTab === "images" ? "lilypad.solid" : "transparent",
                }}
                _selected={{ bg: "lilypad.solid", color: "black" }}
              >
                My Images
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="my" p={{ base: "2", md: "2" }}>
              <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
                <Text>Manage your own inventory.</Text>

                {ownedNotice ? (
                  <HStack justify="flex-end">
                    <Text
                      fontSize={APP_TEXT_SIZES.helper}
                      color={
                        ownedNotice.kind === "success"
                          ? "lilypad.solid"
                          : "nautical.solid"
                      }
                      fontWeight="medium"
                      textAlign="right"
                    >
                      {ownedNotice.message}
                    </Text>
                  </HStack>
                ) : null}

                {!isAddItemOpen &&
                    myItems.declined_by_me.length > 0 &&
                  visibleDeclinedFiltered.map((item) => (
                    <Box
                      key={`declined-${item.id}`}
                      bg="white"
                      borderWidth="1px"
                      borderStyle="dashed"
                      borderColor="border"
                      borderRadius="xl"
                      p="2"
                    >
                      <Stack gap="2">
                        <HStack gap="1">
                          <Text fontWeight="bold" color="orange.solid">
                            DECLINED REQUEST:
                          </Text>
                          <Text fontWeight="bold">{item.name}</Text>
                        </HStack>
                        <Text fontSize={APP_TEXT_SIZES.helper}>
                          Owner: {displayName(item.owner_user)} | Need by:{" "}
                          {item.my_declined_request?.date_needed_by ?? "—"}
                        </Text>
                        {item.my_declined_request?.message ? (
                          <Text fontSize={APP_TEXT_SIZES.helper}>
                            Your request: {item.my_declined_request.message}
                          </Text>
                        ) : null}
                        {item.my_declined_request?.decline_message ? (
                          <Text fontSize={APP_TEXT_SIZES.helper}>
                            Decline message:{" "}
                            {item.my_declined_request.decline_message}
                          </Text>
                        ) : null}
                        {item.my_declined_request ? (
                          <HStack>
                            <PondButton
                              ref={
                                confirmDeleteDeclinedRequestItemId === item.id
                                  ? confirmDeleteDeclinedRequestButtonRef
                                  : undefined
                              }
                              size="sm"
                              colorPalette="nautical"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const declinedRequest =
                                  item.my_declined_request;
                                if (!declinedRequest) return;
                                if (
                                  confirmDeleteDeclinedRequestItemId !== item.id
                                ) {
                                  setConfirmDeleteDeclinedRequestItemId(
                                    item.id,
                                  );
                                  return;
                                }
                                try {
                                  const token = await getApiAccessToken();
                                  await deleteBorrowRequest(
                                    token,
                                    declinedRequest.id,
                                  );
                                  setConfirmDeleteDeclinedRequestItemId(null);
                                  await refreshAll();
                                } catch (err: unknown) {
                                  setError(
                                    err instanceof Error
                                      ? err.message
                                      : "Failed to delete request",
                                  );
                                }
                              }}
                            >
                              {confirmDeleteDeclinedRequestItemId === item.id
                                ? "Confirm delete"
                                : "Delete request"}
                            </PondButton>
                          </HStack>
                        ) : null}
                      </Stack>
                    </Box>
                  ))}
                {!isAddItemOpen &&
                myItems.declined_by_me.length > MY_ITEMS_PAGE_SIZE ? (
                  <HStack justify="space-between">
                    <Text fontSize={APP_TEXT_SIZES.helper}>
                      Page {safeDeclinedPage} / {totalDeclinedPages}
                    </Text>
                    <HStack>
                      <PondButton
                        size="sm"
                        colorPalette="nautical"
                        disabled={safeDeclinedPage <= 1}
                        onClick={() =>
                          setDeclinedPage((p) => Math.max(1, p - 1))
                        }
                      >
                        ←
                      </PondButton>
                      <PondButton
                        size="sm"
                        colorPalette="nautical"
                        disabled={safeDeclinedPage >= totalDeclinedPages}
                        onClick={() =>
                          setDeclinedPage((p) =>
                            Math.min(totalDeclinedPages, p + 1),
                          )
                        }
                      >
                        →
                      </PondButton>
                    </HStack>
                  </HStack>
                ) : null}

                {!isAddItemOpen &&
                    myItems.custody_offered_to_me.length > 0 &&
                  visibleCustodyOfferedFiltered.map((item) => (
                    <Box
                      key={`custody-offer-${item.id}`}
                      bg="white"
                      borderWidth="1px"
                      borderStyle="dashed"
                      borderColor="border"
                      borderRadius="xl"
                      p="2"
                    >
                      <Stack gap="2">
                        <HStack gap="1">
                          <Text fontWeight="bold" color="sky.solid">
                            CUSTODY OFFERED:
                          </Text>
                          <Text fontWeight="bold">{item.name}</Text>
                        </HStack>
                        <Text fontSize={APP_TEXT_SIZES.helper}>
                          Owner: {displayName(item.owner_user)} wants you to
                          hold this item.
                        </Text>
                        {item.description ? (
                          <Text fontSize={APP_TEXT_SIZES.helper}>
                            {item.description}
                          </Text>
                        ) : null}
                        <HStack flexWrap="wrap">
                          <PondButton
                            size="sm"
                            colorPalette="lilypad"
                            onClick={async () => {
                              try {
                                const token = await getApiAccessToken();
                                await acceptCustody(token, item.id);
                                setOwnedNotice({
                                  kind: "success",
                                  message: "Custody accepted.",
                                });
                                await refreshAll();
                              } catch (err: unknown) {
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "Failed to accept custody",
                                );
                              }
                            }}
                          >
                            Accept custody
                          </PondButton>
                          <PondButton
                            size="sm"
                            colorPalette="nautical"
                            onClick={async () => {
                              try {
                                const token = await getApiAccessToken();
                                await rejectPendingCustody(token, item.id);
                                setOwnedNotice({
                                  kind: "success",
                                  message: "Custody offer declined.",
                                });
                                await refreshAll();
                              } catch (err: unknown) {
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "Failed to decline custody",
                                );
                              }
                            }}
                          >
                            Decline
                          </PondButton>
                        </HStack>
                      </Stack>
                    </Box>
                  ))}
                {!isAddItemOpen &&
                myItems.custody_offered_to_me.length > MY_ITEMS_PAGE_SIZE ? (
                  <HStack justify="space-between">
                    <Text fontSize={APP_TEXT_SIZES.helper}>
                      Page {safeCustodyOfferedPage} / {totalCustodyOfferedPages}
                    </Text>
                    <HStack>
                      <PondButton
                        size="sm"
                        colorPalette="nautical"
                        disabled={safeCustodyOfferedPage <= 1}
                        onClick={() =>
                          setCustodyOfferedPage((p) => Math.max(1, p - 1))
                        }
                      >
                        ←
                      </PondButton>
                      <PondButton
                        size="sm"
                        colorPalette="nautical"
                        disabled={
                          safeCustodyOfferedPage >= totalCustodyOfferedPages
                        }
                        onClick={() =>
                          setCustodyOfferedPage((p) =>
                            Math.min(totalCustodyOfferedPages, p + 1),
                          )
                        }
                      >
                        →
                      </PondButton>
                    </HStack>
                  </HStack>
                ) : null}

                {!isAddItemOpen && ownedWithPendingRequests.length > 0
                  ? visibleRequestedOwnedFiltered.map((item) => (
                      <ClosetItemLinkCard
                        key={`requested-owned-${item.id}`}
                        item={item}
                        closetReturnTo="/closet?tab=my"
                        dashedBorder
                        titlePrefix={
                          <Text fontWeight="bold" color="orange.solid">
                            {`${item.pending_request_count} ${
                              item.pending_request_count === 1
                                ? "REQUEST"
                                : "REQUESTS"
                            }:`}
                          </Text>
                        }
                      />
                    ))
                  : null}

                {!isAddItemOpen && myItems.borrowed_by_me.length > 0 ? (
                  <>
                    {visibleBorrowedFiltered.map((item) => (
                      <ClosetItemLinkCard
                        key={`borrowed-${item.id}`}
                        item={item}
                        closetReturnTo="/closet?tab=my"
                        dashedBorder
                        titlePrefix={
                          <Text fontWeight="bold" color="orange.solid">
                            {`BORROWED FROM ${displayName(item.owner_user).toUpperCase()}:`}
                          </Text>
                        }
                      />
                    ))}
                    {myItems.borrowed_by_me.length > MY_ITEMS_PAGE_SIZE ? (
                      <HStack justify="space-between">
                        <Text fontSize={APP_TEXT_SIZES.helper}>
                          Page {safeBorrowedPage} / {totalBorrowedPages}
                        </Text>
                        <HStack>
                          <PondButton
                            size="sm"
                            colorPalette="nautical"
                            disabled={safeBorrowedPage <= 1}
                            onClick={() =>
                              setBorrowedPage((p) => Math.max(1, p - 1))
                            }
                          >
                            ←
                          </PondButton>
                          <PondButton
                            size="sm"
                            colorPalette="nautical"
                            disabled={safeBorrowedPage >= totalBorrowedPages}
                            onClick={() =>
                              setBorrowedPage((p) =>
                                Math.min(totalBorrowedPages, p + 1),
                              )
                            }
                          >
                            →
                          </PondButton>
                        </HStack>
                      </HStack>
                    ) : null}
                  </>
                ) : null}

                {!isAddItemOpen && myItems.requested_by_me.length > 0
                  ? visibleRequested.map((item) => (
                      <ClosetItemLinkCard
                        key={`requested-${item.id}`}
                        item={item}
                        closetReturnTo="/closet?tab=my"
                        dashedBorder
                        titlePrefix={
                          <Text fontWeight="bold" color="lilypad.solid">
                            PENDING APPROVAL:
                          </Text>
                        }
                        subtitle={`Owner: ${displayName(item.owner_user)} | Need by: ${item.my_pending_request?.date_needed_by ?? "—"}`}
                      />
                    ))
                  : null}
                {!isAddItemOpen &&
                myItems.requested_by_me.length > MY_ITEMS_PAGE_SIZE ? (
                  <HStack justify="space-between">
                    <Text fontSize={APP_TEXT_SIZES.helper}>
                      Page {safeRequestedPage} / {totalRequestedPages}
                    </Text>
                    <HStack>
                      <PondButton
                        size="sm"
                        colorPalette="nautical"
                        disabled={safeRequestedPage <= 1}
                        onClick={() =>
                          setRequestedPage((p) => Math.max(1, p - 1))
                        }
                      >
                        ←
                      </PondButton>
                      <PondButton
                        size="sm"
                        colorPalette="nautical"
                        disabled={safeRequestedPage >= totalRequestedPages}
                        onClick={() =>
                          setRequestedPage((p) =>
                            Math.min(totalRequestedPages, p + 1),
                          )
                        }
                      >
                        →
                      </PondButton>
                    </HStack>
                  </HStack>
                ) : null}

                {!isAddItemOpen && loanedItems.length > 0 ? (
                  <>
                    {visibleLoanedFiltered.map((item) => (
                      <ClosetItemLinkCard
                        key={`loaned-${item.id}`}
                        item={item}
                        closetReturnTo="/closet?tab=my"
                        titlePrefix={
                          <Text fontWeight="bold" color="lilypad.solid">
                            {`LOANED TO ${displayName(item.current_holder_user).toUpperCase()}:`}
                          </Text>
                        }
                      />
                    ))}
                    {loanedItems.length > MY_ITEMS_PAGE_SIZE ? (
                      <HStack justify="space-between">
                        <Text fontSize={APP_TEXT_SIZES.helper}>
                          Page {safeLoanedPage} / {totalLoanedPages}
                        </Text>
                        <HStack>
                          <PondButton
                            size="sm"
                            colorPalette="nautical"
                            disabled={safeLoanedPage <= 1}
                            onClick={() =>
                              setLoanedPage((p) => Math.max(1, p - 1))
                            }
                          >
                            ←
                          </PondButton>
                          <PondButton
                            size="sm"
                            colorPalette="nautical"
                            disabled={safeLoanedPage >= totalLoanedPages}
                            onClick={() =>
                              setLoanedPage((p) =>
                                Math.min(totalLoanedPages, p + 1),
                              )
                            }
                          >
                            →
                          </PondButton>
                        </HStack>
                      </HStack>
                    ) : null}
                  </>
                ) : null}

                <>
                  {isAddItemOpen ? (
                      <Box
                        bg="white"
                        borderWidth="1px"
                        borderColor="border"
                        borderRadius="xl"
                        p="2"
                      >
                        <Stack gap="3">
                          <Text fontWeight="semibold">Add Item</Text>
                          <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Item name"
                            {...CLOSET_PLACEHOLDER_PROPS}
                          />
                          <Textarea
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            placeholder="Description"
                            {...CLOSET_PLACEHOLDER_PROPS}
                          />
                          <ClosetCategoryFields
                            category={newCategory}
                            onCategoryChange={setNewCategory}
                          />
                          <Stack gap="1" align="stretch">
                            <Text
                              fontSize={APP_TEXT_SIZES.helper}
                              fontWeight="medium"
                            >
                              Photo (optional):
                            </Text>
                            <input
                              ref={newItemPhotoInputRef}
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              style={{ display: "none" }}
                            />
                            <PondButton
                              type="button"
                              size="sm"
                              colorPalette="sky"
                              alignSelf="flex-start"
                              disabled={newItemImageBusy}
                              onClick={() =>
                                newItemPhotoInputRef.current?.click()
                              }
                            >
                              Choose photo
                            </PondButton>
                            <Text
                              fontSize={APP_TEXT_SIZES.helper}
                              color="gray.600"
                            >
                              JPEG, PNG, or WebP. Resized in the browser before
                              upload.
                            </Text>
                            {newItemImageBusy ? (
                              <HStack gap="2" align="center" color="gray.700">
                                <Spinner size="sm" colorPalette="lilypad" />
                                <Text fontSize={APP_TEXT_SIZES.helper}>
                                  Uploading photo and saving item…
                                </Text>
                              </HStack>
                            ) : null}
                          </Stack>
                          <HStack>
                            <PondButton
                              colorPalette="lilypad"
                              loading={newItemImageBusy}
                              onClick={async () => {
                                setError(null);
                                if (!isAllowedClosetCategory(newCategory)) {
                                  setOwnedNotice({
                                    kind: "error",
                                    message:
                                      "Category must use only letters and /, or pick a suggested option.",
                                  });
                                  return;
                                }
                                const nn = newName.trim();
                                const nameErr = validateClosetItemName(nn);
                                if (nameErr) {
                                  setOwnedNotice({
                                    kind: "error",
                                    message: nameErr,
                                  });
                                  return;
                                }
                                const descErr = validateClosetFreeText(
                                  newDescription,
                                  "Description",
                                );
                                if (descErr) {
                                  setOwnedNotice({
                                    kind: "error",
                                    message: descErr,
                                  });
                                  return;
                                }
                                const cat = newCategory.trim();
                                const catErr = validateClosetCategory(cat);
                                if (catErr) {
                                  setOwnedNotice({
                                    kind: "error",
                                    message: catErr,
                                  });
                                  return;
                                }
                                try {
                                  setNewItemImageBusy(true);
                                  const token = await getApiAccessToken();
                                  const file =
                                    newItemPhotoInputRef.current?.files?.[0];
                                  let imageKey: string | undefined;
                                  if (file) {
                                    imageKey =
                                      await uploadClosetImageViaPresign(
                                        getApiAccessToken,
                                        file,
                                      );
                                  }
                                  await createItem(token, {
                                    name: nn,
                                    description: newDescription,
                                    ...(cat ? { category: cat } : {}),
                                    ...(imageKey
                                      ? { image_key: imageKey }
                                      : {}),
                                  });
                                  setNewName("");
                                  setNewDescription("");
                                  setNewCategory("");
                                  if (newItemPhotoInputRef.current) {
                                    newItemPhotoInputRef.current.value = "";
                                  }
                                  setIsAddItemOpen(false);
                                  setOwnedPage(1);
                                  await refreshAll();
                                  setOwnedNotice({
                                    kind: "success",
                                    message: "Item added.",
                                  });
                                } catch (err: unknown) {
                                  const message =
                                    err instanceof Error
                                      ? err.message
                                      : "Failed to create item";
                                  setOwnedNotice({ kind: "error", message });
                                } finally {
                                  setNewItemImageBusy(false);
                                }
                              }}
                              disabled={!newName.trim()}
                            >
                              Save Item
                            </PondButton>
                            <PondButton
                              colorPalette="sky"
                              disabled={newItemImageBusy}
                              onClick={() => {
                                setNewName("");
                                setNewDescription("");
                                setNewCategory("");
                                if (newItemPhotoInputRef.current) {
                                  newItemPhotoInputRef.current.value = "";
                                }
                                setIsAddItemOpen(false);
                              }}
                            >
                              Cancel
                            </PondButton>
                          </HStack>
                        </Stack>
                      </Box>
                    ) : (
                      <HStack justify="flex-start">
                        <PondButton
                          colorPalette="lilypad"
                          onClick={() => setIsAddItemOpen(true)}
                        >
                          Add Item
                        </PondButton>
                      </HStack>
                    )}
                  <HStack align="center" gap="3" justify="space-between">
                    <Text fontWeight="semibold">Owned by me</Text>
                  </HStack>
                  {ownedWithoutPendingRequests.length === 0 ? (
                    <Text fontSize={APP_TEXT_SIZES.helper}>None.</Text>
                  ) : null}
                  {visibleOwnedFiltered.map((item) => (
                    <ClosetItemLinkCard
                      key={`owned-wrap-${item.id}`}
                      item={item}
                      closetReturnTo="/closet?tab=my"
                    />
                  ))}
                  {ownedWithoutPendingRequests.length > MY_ITEMS_PAGE_SIZE ? (
                    <HStack justify="space-between">
                      <Text fontSize={APP_TEXT_SIZES.helper}>
                        Page {safeOwnedPage} / {totalOwnedPages}
                      </Text>
                      <HStack>
                        <PondButton
                          size="sm"
                          colorPalette="nautical"
                          disabled={safeOwnedPage <= 1}
                          onClick={() =>
                            setOwnedPage((p) => Math.max(1, p - 1))
                          }
                        >
                          ←
                        </PondButton>
                        <PondButton
                          size="sm"
                          colorPalette="nautical"
                          disabled={safeOwnedPage >= totalOwnedPages}
                          onClick={() =>
                            setOwnedPage((p) =>
                              Math.min(totalOwnedPages, p + 1),
                            )
                          }
                        >
                          →
                        </PondButton>
                      </HStack>
                    </HStack>
                  ) : null}
                </>
              </Stack>
            </Tabs.Content>

            <Tabs.Content value="friends" p={{ base: "2", md: "2" }}>
              <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
                <HStack
                  justify="space-between"
                  align="center"
                  gap="3"
                  flexWrap="wrap"
                >
                  <Text>
                    Open an item for details, borrowing, and returns.
                  </Text>
                  {friendsNotice ? (
                    <Text
                      color={
                        friendsNotice.kind === "success"
                          ? "lilypad.solid"
                          : "nautical.solid"
                      }
                      fontSize={APP_TEXT_SIZES.helper}
                      fontWeight="medium"
                      textAlign="right"
                    >
                      {friendsNotice.message}
                    </Text>
                  ) : null}
                </HStack>
                <Stack gap="2">
                  <PondButton
                    type="button"
                    alignSelf="flex-start"
                    colorPalette="lilypad"
                    variant={friendsFilterToolsOpen ? "solid" : "outline"}
                    color="black"
                    bg={friendsFilterToolsOpen ? undefined : "white"}
                    _hover={
                      friendsFilterToolsOpen
                        ? { color: "black" }
                        : {
                            bg: "white",
                            color: "black",
                            borderColor: "lilypad.solid",
                            borderWidth: "1px",
                          }
                    }
                    onClick={() => setFriendsFilterToolsOpen((o) => !o)}
                    aria-expanded={friendsFilterToolsOpen}
                  >
                    Filter & sort
                  </PondButton>
                  {friendsFilterToolsOpen ? (
                    <HStack align="end" gap="3" flexWrap="wrap">
                      <Stack gap="1" minW="160px" flex="1">
                        <Text fontSize={APP_TEXT_SIZES.helper}>Category</Text>
                        <NativeSelectRoot maxW="280px">
                          <NativeSelectField
                            value={friendsCategoryFilter}
                            onChange={(e) => {
                              setFriendsCategoryFilter(e.target.value);
                              setFriendsPage(1);
                            }}
                          >
                            <option value="">Any category</option>
                            {CLOSET_CATEGORY_PRESETS.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                            <option value={CLOSET_FRIENDS_CATEGORY_OTHER}>
                              Other
                            </option>
                          </NativeSelectField>
                        </NativeSelectRoot>
                      </Stack>
                      <Stack gap="1" minW="140px" flex="1">
                        <Text fontSize={APP_TEXT_SIZES.helper}>Tag</Text>
                        <Input
                          value={friendsTagInput}
                          onChange={(e) => setFriendsTagInput(e.target.value)}
                          placeholder="Substring match"
                          maxW="240px"
                          {...CLOSET_PLACEHOLDER_PROPS}
                        />
                      </Stack>
                      <Stack gap="1" minW="200px">
                        <Text fontSize={APP_TEXT_SIZES.helper}>Sort</Text>
                        <NativeSelectRoot maxW="280px">
                          <NativeSelectField
                            value={friendsSort}
                            onChange={(e) => {
                              setFriendsSort(
                                e.target.value as FriendsItemsSort,
                              );
                              setFriendsPage(1);
                            }}
                          >
                            <option value="updated_desc">
                              Recently updated
                            </option>
                            <option value="updated_asc">
                              Least recently updated
                            </option>
                            <option value="created_desc">Newest listed</option>
                            <option value="created_asc">Oldest listed</option>
                            <option value="name_asc">Name (A–Z)</option>
                            <option value="name_desc">Name (Z–A)</option>
                          </NativeSelectField>
                        </NativeSelectRoot>
                      </Stack>
                    </HStack>
                  ) : null}
                </Stack>
                {friendsItems.length === 0 ? (
                  <Text>
                    {friendsCategoryFilter.trim() || friendsTagFilter
                      ? "No items match your filters."
                      : "No items from friends yet."}
                  </Text>
                ) : null}
                <SimpleGrid columns={{ base: 1, md: 3 }} gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
                  {friendsItems.map((item) => (
                    <FriendClosetListCard
                      key={`friend-${item.id}`}
                      item={item}
                      closetReturnTo="/closet?tab=friends"
                    />
                  ))}
                </SimpleGrid>
                <HStack justify="space-between">
                  <Text fontSize={APP_TEXT_SIZES.helper}>
                    Page {friendsPage} / {totalFriendsPages}
                  </Text>
                  <HStack>
                    <PondButton
                      size="sm"
                      colorPalette="nautical"
                      disabled={friendsPage <= 1}
                      onClick={() => setFriendsPage((p) => Math.max(1, p - 1))}
                    >
                      ←
                    </PondButton>
                    <PondButton
                      size="sm"
                      colorPalette="nautical"
                      disabled={friendsPage >= totalFriendsPages}
                      onClick={() =>
                        setFriendsPage((p) =>
                          Math.min(totalFriendsPages, p + 1),
                        )
                      }
                    >
                      →
                    </PondButton>
                  </HStack>
                </HStack>
              </Stack>
            </Tabs.Content>
            <Tabs.Content value="images" p={{ base: "2", md: "2" }}>
              <Stack gap="4">
                <HStack
                  justify="space-between"
                  align="center"
                  gap="3"
                  flexWrap="wrap"
                >
                  <Text>
                    Browse your uploaded images and delete your unneeded files.
                  </Text>
                  {imagesNotice ? (
                    <Text
                      color={
                        imagesNotice.kind === "success"
                          ? "lilypad.solid"
                          : "nautical.solid"
                      }
                      fontSize={APP_TEXT_SIZES.helper}
                      fontWeight="medium"
                      textAlign="right"
                    >
                      {imagesNotice.message}
                    </Text>
                  ) : null}
                </HStack>
                <HStack align="end" gap="3" flexWrap="wrap">
                  <Stack gap="1" minW="200px">
                    <Text fontSize={APP_TEXT_SIZES.helper}>Show</Text>
                    <NativeSelectRoot maxW="280px">
                      <NativeSelectField
                        value={imagesFilter}
                        onChange={(e) =>
                          setImagesFilter(
                            e.target.value === "all" ? "all" : "unused",
                          )
                        }
                      >
                        <option value="unused">Unused Images</option>
                        <option value="all">All Images</option>
                      </NativeSelectField>
                    </NativeSelectRoot>
                  </Stack>
                </HStack>
                {visibleImageRows.length === 0 ? (
                  <Text>
                    {imagesFilter === "unused"
                      ? "No unused images found."
                      : "No uploaded images found."}
                  </Text>
                ) : null}
                {visibleImageRows.map((row) => (
                  <Card.Root
                    key={row.image_key}
                    bg="white"
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="xl"
                  >
                    <Card.Body>
                      <Stack gap="3">
                        <HStack
                          justify="space-between"
                          align="start"
                          gap="3"
                          flexWrap="wrap"
                        >
                          <Stack gap="1">
                            <Text fontWeight="bold">
                              {row.status === "attached"
                                ? "Attached"
                                : "Stranded"}
                            </Text>
                            <Text
                              fontSize={APP_TEXT_SIZES.helper}
                              color="fg.muted"
                            >
                              {(() => {
                                const nItems = row.attached_live_item_count;
                                const nMeals = row.attached_meal_count ?? 0;
                                const parts: string[] = [];
                                if (nItems > 0) {
                                  parts.push(
                                    `${nItems} live item${nItems === 1 ? "" : "s"}`,
                                  );
                                }
                                if (nMeals > 0) {
                                  parts.push(
                                    `${nMeals} recipe${nMeals === 1 ? "" : "s"}`,
                                  );
                                }
                                if (row.attached_as_avatar) {
                                  parts.push("your avatar");
                                }
                                if (parts.length === 0) {
                                  return "Not used by items, recipes, or avatar";
                                }
                                return `Used by: ${parts.join(", ")}`;
                              })()}
                            </Text>
                            {!row.present_in_bucket ? (
                              <Text
                                fontSize={APP_TEXT_SIZES.helper}
                                color="orange.solid"
                              >
                                Missing from bucket
                              </Text>
                            ) : null}
                          </Stack>
                          <PondButton
                            ref={(node: HTMLButtonElement | null) => {
                              confirmDeleteImageButtonRefs.current[
                                row.image_key
                              ] = node;
                            }}
                            size="sm"
                            colorPalette="nautical"
                            loading={deletingImageKey === row.image_key}
                            disabled={deletingImageKey !== null}
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirmDeleteImageKey !== row.image_key) {
                                setConfirmDeleteImageKey(row.image_key);
                                return;
                              }
                              try {
                                setDeletingImageKey(row.image_key);
                                setConfirmDeleteImageKey(null);
                                const token = await getApiAccessToken();
                                await deleteMyImage(token, row.image_key);
                                setImagesNotice({
                                  kind: "success",
                                  message:
                                    "Image deleted from storage and detached from items, recipes, or avatar.",
                                });
                                await refreshAll();
                              } catch (err: unknown) {
                                setImagesNotice({
                                  kind: "error",
                                  message:
                                    err instanceof Error
                                      ? err.message
                                      : "Failed to delete image",
                                });
                              } finally {
                                setDeletingImageKey(null);
                              }
                            }}
                          >
                            {confirmDeleteImageKey === row.image_key
                              ? "Confirm delete"
                              : "Delete image"}
                          </PondButton>
                        </HStack>
                        {row.image_url ? (
                          <Image
                            src={row.image_url}
                            alt=""
                            aria-hidden
                            maxH="180px"
                            objectFit="cover"
                            borderRadius="md"
                          />
                        ) : null}
                        <Text
                          fontSize={APP_TEXT_SIZES.helper}
                          color="fg.muted"
                          wordBreak="break-all"
                        >
                          {row.image_key}
                        </Text>
                        {row.attached_live_item_names.length > 0 ? (
                          <Text fontSize={APP_TEXT_SIZES.helper}>
                            Closet items: {row.attached_live_item_names.join(", ")}
                          </Text>
                        ) : null}
                        {(row.attached_meal_titles?.length ?? 0) > 0 ? (
                          <Text fontSize={APP_TEXT_SIZES.helper}>
                            Recipes: {(row.attached_meal_titles ?? []).join(", ")}
                          </Text>
                        ) : null}
                      </Stack>
                    </Card.Body>
                  </Card.Root>
                ))}
              </Stack>
            </Tabs.Content>
          </Box>
        </Box>
      </Tabs.Root>
      {error ? (
        <Text px="2" pb="2" color="nautical.solid" role="alert">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}
