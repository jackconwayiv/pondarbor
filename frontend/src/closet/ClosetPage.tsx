import {
  Box,
  Checkbox,
  CloseButton,
  Collapsible,
  Dialog,
  HStack,
  Heading,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  SimpleGrid,
  Spinner,
  Stack,
  Tabs,
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
import { AppModal } from "../components/AppModal";
import {
  PanelBlockSkeleton,
  PanelListRowSkeleton,
  PanelEmptyState,
  PanelSessionReconnect,
  SessionLoadingCard,
} from "../components/panelStatus";
import { fetchFriendsList } from "../friends/api";
import PondButton from "../PondButton";
import { fullBleedStackProps, useIsMobile } from "../responsive";
import {
  APP_SHELL_TAB_LIST_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FORM_PLACEHOLDER_PROPS,
} from "../theme/typography";
import {
  acceptCustody,
  createItem,
  deleteBorrowRequest,
  deleteMyImage,
  fetchFriendsItems,
  fetchItem,
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
import { ClosetImageInventoryCard } from "./ClosetImageInventoryCard";
import { ClosetItemDetailContent } from "./ClosetItemDetailContent";
import type { ClosetItemModalNav } from "./ClosetItemModalFooter";
import { ClosetItemLinkCard } from "./ClosetItemLinkCard";
import { ClosetOwnerManagePanel } from "./ClosetOwnerManagePanel";
import {
  closetPendingCount,
  coerceClosetUserId,
  displayName,
  sameClosetUserId,
} from "./closetUtils";
import { FriendClosetListCard } from "./FriendClosetListCard";
import { uploadClosetImageViaPresign } from "./imageUpload";
import type {
  ClosetImageInventoryRow,
  ClosetItem,
  FriendsItemsResponse,
  MyItemsResponse,
} from "./types";

type ClosetTab = "items" | "images";
type PendingNeighborNav = "first" | "last" | null;
const ITEMS_PAGE_SIZE = 15;
const ACTIONS_PAGE_SIZE = 15;
const CLOSET_PLACEHOLDER_PROPS = PANEL_FORM_PLACEHOLDER_PROPS;
const ITEMS_RETURN_TO = "/closet?tab=items";

/** Resolve an item for the modal from data already loaded with the page (no extra GET). */
function findClosetItemInLoadedData(
  id: number,
  gridItems: ClosetItem[],
  myItems: MyItemsResponse,
): ClosetItem | undefined {
  const inGrid = gridItems.find((i) => i.id === id);
  if (inGrid) return inGrid;
  const buckets: ClosetItem[] = [
    ...myItems.declined_by_me,
    ...myItems.borrowed_by_me,
    ...myItems.custody_offered_to_me,
    ...myItems.requested_by_me,
    ...myItems.owned_by_me,
  ];
  return buckets.find((i) => i.id === id);
}

function parseTab(value: string | null): ClosetTab {
  if (value === "images") return "images";
  // Legacy ?tab=my and ?tab=friends both fold into the new merged Items tab.
  return "items";
}

export default function ClosetPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));
  const itemParam = searchParams.get("item");
  const selectedItemIdParsed =
    itemParam != null && itemParam !== ""
      ? Number.parseInt(itemParam, 10)
      : Number.NaN;
  const selectedItemIdValid =
    Number.isFinite(selectedItemIdParsed) && selectedItemIdParsed >= 1
      ? selectedItemIdParsed
      : null;
  const itemQueryInvalid =
    Boolean(itemParam && itemParam !== "") && selectedItemIdValid == null;
  const isMobile = useIsMobile();
  const {
    isAuthenticated,
    isLoading,
    sessionUser,
    getApiAccessToken,
    refreshSession,
    error: sessionError,
  } = useAppSession();
  const [myItems, setMyItems] = useState<MyItemsResponse>({
    declined_by_me: [],
    borrowed_by_me: [],
    custody_offered_to_me: [],
    requested_by_me: [],
    owned_by_me: [],
  });
  const [gridItems, setGridItems] = useState<ClosetItem[]>([]);
  const [gridPage, setGridPage] = useState(1);
  const [gridTotal, setGridTotal] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [sortKey, setSortKey] = useState<FriendsItemsSort>("updated_desc");
  const [showMyItems, setShowMyItems] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [filterToolsOpen, setFilterToolsOpen] = useState(false);
  const [actionsPage, setActionsPage] = useState({
    declined: 1,
    borrowed: 1,
    custodyOffered: 1,
    requested: 1,
    loaned: 1,
    pending: 1,
  });
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
  const [notice, setNotice] = useState<{
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
  /** Set when the open id is not in gridItems or myItems (e.g. another page, deep link). */
  const [itemFetchFallback, setItemFetchFallback] = useState<ClosetItem | null>(null);
  const [selectedItemError, setSelectedItemError] = useState<string | null>(null);
  const [expandedNotice, setExpandedNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [friendsForCustody, setFriendsForCustody] = useState<
    Array<{ id: number; label: string }>
  >([]);
  const [pendingNeighborNav, setPendingNeighborNav] =
    useState<PendingNeighborNav>(null);

  const meId = coerceClosetUserId(sessionUser?.user.id);
  const totalGridPages = Math.max(1, Math.ceil(gridTotal / ITEMS_PAGE_SIZE));
  const visibleGridItems = useMemo(
    () =>
      gridItems.filter((item) => {
        if (!showMyItems && sameClosetUserId(item.owner_user.id, meId)) {
          return false;
        }
        if (!showHidden && item.hidden_by_me) {
          return false;
        }
        return true;
      }),
    [gridItems, showMyItems, showHidden, meId],
  );
  const displayItem = useMemo(() => {
    if (selectedItemIdValid == null) return null;
    const fromLoaded = findClosetItemInLoadedData(
      selectedItemIdValid,
      gridItems,
      myItems,
    );
    return fromLoaded ?? itemFetchFallback;
  }, [selectedItemIdValid, gridItems, myItems, itemFetchFallback]);
  const currentIndex = useMemo(
    () =>
      selectedItemIdValid == null
        ? -1
        : visibleGridItems.findIndex((i) => i.id === selectedItemIdValid),
    [visibleGridItems, selectedItemIdValid],
  );
  const hasPrev = currentIndex > 0 || gridPage > 1;
  const hasNext =
    (currentIndex >= 0 && currentIndex < visibleGridItems.length - 1) ||
    gridPage < totalGridPages;
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

  const actionCounts = {
    declined: myItems.declined_by_me.length,
    custodyOffered: myItems.custody_offered_to_me.length,
    pending: ownedWithPendingRequests.length,
    borrowed: myItems.borrowed_by_me.length,
    requested: myItems.requested_by_me.length,
    loaned: loanedItems.length,
  };
  const totalActionItems =
    actionCounts.declined +
    actionCounts.custodyOffered +
    actionCounts.pending +
    actionCounts.borrowed +
    actionCounts.requested +
    actionCounts.loaned;
  const [actionsOpen, setActionsOpen] = useState(false);
  const lastActionsAutoOpenRef = useRef<boolean | null>(null);
  useEffect(() => {
    const shouldOpen = totalActionItems > 0;
    if (lastActionsAutoOpenRef.current === shouldOpen) return;
    lastActionsAutoOpenRef.current = shouldOpen;
    setActionsOpen(shouldOpen);
  }, [totalActionItems]);

  const totalPagesFor = (count: number) =>
    Math.max(1, Math.ceil(count / ACTIONS_PAGE_SIZE));
  const totalDeclinedPages = totalPagesFor(actionCounts.declined);
  const totalBorrowedPages = totalPagesFor(actionCounts.borrowed);
  const totalCustodyOfferedPages = totalPagesFor(actionCounts.custodyOffered);
  const totalRequestedPages = totalPagesFor(actionCounts.requested);
  const totalLoanedPages = totalPagesFor(actionCounts.loaned);
  const safe = (page: number, total: number) => Math.min(page, total);
  const safeDeclinedPage = safe(actionsPage.declined, totalDeclinedPages);
  const safeBorrowedPage = safe(actionsPage.borrowed, totalBorrowedPages);
  const safeCustodyOfferedPage = safe(
    actionsPage.custodyOffered,
    totalCustodyOfferedPages,
  );
  const safeRequestedPage = safe(actionsPage.requested, totalRequestedPages);
  const safeLoanedPage = safe(actionsPage.loaned, totalLoanedPages);
  const slice = (rows: ClosetItem[], page: number) => {
    const start = (page - 1) * ACTIONS_PAGE_SIZE;
    return rows.slice(start, start + ACTIONS_PAGE_SIZE);
  };
  const visibleDeclined = slice(myItems.declined_by_me, safeDeclinedPage);
  const visibleBorrowed = slice(myItems.borrowed_by_me, safeBorrowedPage);
  const visibleCustodyOffered = slice(
    myItems.custody_offered_to_me,
    safeCustodyOfferedPage,
  );
  const visibleRequested = slice(myItems.requested_by_me, safeRequestedPage);
  const visibleLoaned = slice(loanedItems, safeLoanedPage);

  const setActiveTab = (tab: ClosetTab) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  const loadMine = useCallback(async (): Promise<MyItemsResponse> => {
    const token = await getApiAccessToken();
    const payload = await fetchMyItems(token);
    setMyItems(payload);
    return payload;
  }, [getApiAccessToken]);

  const loadGrid = useCallback(async (): Promise<FriendsItemsResponse> => {
    const token = await getApiAccessToken();
    const payload = await fetchFriendsItems(token, gridPage, ITEMS_PAGE_SIZE, {
      category: categoryFilter.trim(),
      tag: tagFilter,
      sort: sortKey,
      includeSelf: true,
    });
    setGridItems(payload.results);
    setGridTotal(payload.total);
    return payload;
  }, [categoryFilter, gridPage, sortKey, tagFilter, getApiAccessToken]);

  const loadImages = useCallback(async () => {
    const token = await getApiAccessToken();
    const payload = await fetchMyImageInventory(token);
    setImageRows(payload.results);
  }, [getApiAccessToken]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const parts = await Promise.allSettled([
      loadMine(),
      loadGrid(),
      loadImages(),
    ]);
    const failures: string[] = [];
    const labels = ["your items", "items grid", "image library"] as const;
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
    const myItemsPayload =
      parts[0].status === "fulfilled" ? parts[0].value : null;
    const gridPayload =
      parts[1].status === "fulfilled" ? parts[1].value : null;
    return {
      myItems: myItemsPayload,
      gridResults: gridPayload?.results ?? null,
    };
  }, [loadGrid, loadImages, loadMine]);

  const reloadSelectedItem = useCallback(async () => {
    const { myItems: freshMy, gridResults } = await refreshAll();
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("item");
    const id = raw ? Number.parseInt(raw, 10) : Number.NaN;
    if (!Number.isFinite(id) || id < 1) {
      setItemFetchFallback(null);
      setSelectedItemError(null);
      return;
    }
    if (freshMy && gridResults) {
      const fromRefresh = findClosetItemInLoadedData(
        id,
        gridResults,
        freshMy,
      );
      if (fromRefresh) {
        setItemFetchFallback(null);
        setSelectedItemError(null);
        return;
      }
    }
    try {
      const t = await getApiAccessToken();
      const row = await fetchItem(t, id);
      setItemFetchFallback(row);
      setSelectedItemError(null);
    } catch (e) {
      setSelectedItemError(
        e instanceof Error ? e.message : "Failed to load item",
      );
    }
  }, [getApiAccessToken, refreshAll]);

  const closeExpanded = useCallback(() => {
    setPendingNeighborNav(null);
    const next = new URLSearchParams(searchParams);
    next.delete("item");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const setSelectedItemId = useCallback(
    (id: number) => {
      const next = new URLSearchParams(searchParams);
      next.set("item", String(id));
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setSelectedItemId(visibleGridItems[currentIndex - 1].id);
      return;
    }
    if (gridPage > 1) {
      setPendingNeighborNav("last");
      setGridPage((p) => Math.max(1, p - 1));
    }
  }, [currentIndex, visibleGridItems, gridPage, setSelectedItemId]);

  const goNext = useCallback(() => {
    if (
      currentIndex >= 0 &&
      currentIndex < visibleGridItems.length - 1
    ) {
      setSelectedItemId(visibleGridItems[currentIndex + 1].id);
      return;
    }
    if (gridPage < totalGridPages) {
      setPendingNeighborNav("first");
      setGridPage((p) => p + 1);
    }
  }, [
    currentIndex,
    visibleGridItems,
    gridPage,
    totalGridPages,
    setSelectedItemId,
  ]);

  const itemModalNav: ClosetItemModalNav = useMemo(
    () => ({
      hasPrev,
      hasNext,
      onPrev: goPrev,
      onNext: goNext,
    }),
    [hasPrev, hasNext, goPrev, goNext],
  );

  useEffect(() => {
    if (selectedItemIdValid == null && !itemQueryInvalid) return;
    if (activeTab !== "items") {
      const next = new URLSearchParams(searchParams);
      next.set("tab", "items");
      setSearchParams(next, { replace: true });
    }
  }, [
    selectedItemIdValid,
    itemQueryInvalid,
    activeTab,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!sessionUser?.user?.is_approved) return;
    void (async () => {
      try {
        const token = await getApiAccessToken();
        const payload = await fetchFriendsList(token);
        setFriendsForCustody(
          payload.approved_friends.map((f) => ({
            id: f.id,
            label: f.nickname || f.email,
          })),
        );
      } catch {
        // optional for custody dropdown
      }
    })();
  }, [sessionUser?.user?.is_approved, getApiAccessToken]);

  useEffect(() => {
    if (selectedItemIdValid == null) {
      setItemFetchFallback(null);
      setSelectedItemError(null);
      return;
    }
    const cached = findClosetItemInLoadedData(
      selectedItemIdValid,
      gridItems,
      myItems,
    );
    if (cached) {
      setItemFetchFallback(null);
      setSelectedItemError(null);
      return;
    }
    let cancelled = false;
    setSelectedItemError(null);
    void (async () => {
      try {
        const t = await getApiAccessToken();
        const row = await fetchItem(t, selectedItemIdValid);
        if (!cancelled) {
          setItemFetchFallback(row);
        }
      } catch (e) {
        if (!cancelled) {
          setSelectedItemError(
            e instanceof Error ? e.message : "Failed to load item",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedItemIdValid, gridItems, myItems, getApiAccessToken]);

  useEffect(() => {
    setExpandedNotice(null);
  }, [selectedItemIdValid]);

  useEffect(() => {
    if (selectedItemIdValid == null) {
      setPendingNeighborNav(null);
    }
  }, [selectedItemIdValid]);

  useEffect(() => {
    if (pendingNeighborNav == null) return;
    if (loading) return;
    if (visibleGridItems.length === 0) {
      setPendingNeighborNav(null);
      return;
    }
    const target =
      pendingNeighborNav === "first"
        ? visibleGridItems[0]
        : visibleGridItems[visibleGridItems.length - 1];
    setSelectedItemId(target.id);
    setPendingNeighborNav(null);
  }, [pendingNeighborNav, loading, visibleGridItems, setSelectedItemId]);

  useEffect(() => {
    if (!expandedNotice) return;
    const timer = window.setTimeout(() => setExpandedNotice(null), 7000);
    return () => window.clearTimeout(timer);
  }, [expandedNotice]);

  useEffect(() => {
    if (!isAuthenticated || !sessionUser) return;
    void refreshAll();
  }, [
    categoryFilter,
    gridPage,
    sortKey,
    tagFilter,
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
    setActionsPage((prev) => ({
      declined: Math.min(prev.declined, totalDeclinedPages),
      borrowed: Math.min(prev.borrowed, totalBorrowedPages),
      custodyOffered: Math.min(prev.custodyOffered, totalCustodyOfferedPages),
      requested: Math.min(prev.requested, totalRequestedPages),
      loaned: Math.min(prev.loaned, totalLoanedPages),
      pending: prev.pending,
    }));
  }, [
    totalDeclinedPages,
    totalBorrowedPages,
    totalCustodyOfferedPages,
    totalRequestedPages,
    totalLoanedPages,
  ]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 7000);
    return () => window.clearTimeout(timer);
  }, [notice]);

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

  const tagFilterPrevRef = useRef("");
  useEffect(() => {
    const id = window.setTimeout(() => {
      const next = tagInput.trim();
      if (tagFilterPrevRef.current === next) return;
      tagFilterPrevRef.current = next;
      setTagFilter(next);
      setGridPage(1);
    }, 350);
    return () => window.clearTimeout(id);
  }, [tagInput]);

  if (isLoading) {
    return <SessionLoadingCard />;
  }
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser) {
    return (
      <PanelSessionReconnect
        sessionError={sessionError}
        onRetry={() => void refreshSession()}
      />
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

  const visibleImageRows =
    imagesFilter === "unused"
      ? imageRows.filter((row) => row.status === "stranded")
      : imageRows;

  const filterControls = (
    <Stack
      align="stretch"
      gap="3"
      w="100%"
      flexDir={{ base: "column", md: "row" }}
      flexWrap="wrap"
    >
      <Stack gap="1" minW="160px" flex="1">
        <Text fontSize={APP_TEXT_SIZES.helper}>Category</Text>
        <NativeSelectRoot maxW="280px" w="100%">
          <NativeSelectField
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setGridPage(1);
            }}
          >
            <option value="">Any category</option>
            {CLOSET_CATEGORY_PRESETS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={CLOSET_FRIENDS_CATEGORY_OTHER}>Other</option>
          </NativeSelectField>
        </NativeSelectRoot>
      </Stack>
      <Stack gap="1" minW="140px" flex="1">
        <Text fontSize={APP_TEXT_SIZES.helper}>Tag</Text>
        <Input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="Substring match"
          maxW="100%"
          width="100%"
          {...CLOSET_PLACEHOLDER_PROPS}
        />
      </Stack>
      <Stack gap="1" minW="200px" flex="1">
        <Text fontSize={APP_TEXT_SIZES.helper}>Sort</Text>
        <NativeSelectRoot maxW="100%" w="100%">
          <NativeSelectField
            value={sortKey}
            onChange={(e) => {
              setSortKey(e.target.value as FriendsItemsSort);
              setGridPage(1);
            }}
          >
            <option value="updated_desc">Recently updated</option>
            <option value="updated_asc">Least recently updated</option>
            <option value="created_desc">Newest listed</option>
            <option value="created_asc">Oldest listed</option>
            <option value="name_asc">Name (A–Z)</option>
            <option value="name_desc">Name (Z–A)</option>
          </NativeSelectField>
        </NativeSelectRoot>
      </Stack>
      <Stack gap="2" minW="180px" flex="1" justify="flex-end" pb="1">
        <Checkbox.Root
          checked={showMyItems}
          onCheckedChange={(d: { checked: boolean | "indeterminate" }) =>
            setShowMyItems(Boolean(d.checked))
          }
        >
          <Checkbox.HiddenInput />
          <Checkbox.Control />
          <Checkbox.Label fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
            Show My Items
          </Checkbox.Label>
        </Checkbox.Root>
        <Checkbox.Root
          checked={showHidden}
          onCheckedChange={(d: { checked: boolean | "indeterminate" }) =>
            setShowHidden(Boolean(d.checked))
          }
        >
          <Checkbox.HiddenInput />
          <Checkbox.Control />
          <Checkbox.Label fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
            Show Hidden
          </Checkbox.Label>
        </Checkbox.Root>
      </Stack>
    </Stack>
  );

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
        <Box flex="1" bg="bg" px={0} py={{ base: "2", md: "2" }}>
          <Box {...APP_SHELL_TRAY_PROPS}>
            <Stack
              gap={{ base: "4", md: "4" }}
              px={{ base: "2", md: "2" }}
              pt={{ base: "2", md: "2" }}
              pb="2"
            >
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
                      👒
                    </Text>
                    <Text as="span">Community Closet</Text>
                  </HStack>
                </Heading>

                <Text
                  fontSize={APP_TEXT_SIZES.body}
                  lineHeight="tall"
                  color="fg"
                >
                  Browse items you and your friends have shared, and manage
                  borrow requests, custody handoffs, and returns in one place.
                </Text>
              </Box>
            </Stack>
            <Tabs.List {...APP_SHELL_TAB_LIST_PROPS}>
              <Tabs.Trigger value="items" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                Items
              </Tabs.Trigger>
              <Tabs.Trigger value="images" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                Image Manager
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="items" p={{ base: "2", md: "2" }}>
              {loading ? (
                <Box {...PANEL_ENTRY_CARD_PROPS}>
                  <PanelListRowSkeleton rows={4} />
                </Box>
              ) : (
                <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
                  {notice ? (
                    <HStack justify="flex-end">
                      <Text
                        color={
                          notice.kind === "success"
                            ? "forest.solid"
                            : "nautical.solid"
                        }
                        fontSize={APP_TEXT_SIZES.helper}
                        fontWeight="medium"
                        textAlign="right"
                      >
                        {notice.message}
                      </Text>
                    </HStack>
                  ) : null}

                  {/* Add Item button / form */}
                  {isAddItemOpen ? (
                    <Box
                      bg="bg.panel"
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
                            color="fg.muted"
                          >
                            JPEG, PNG, or WebP. Resized in the browser before
                            upload.
                          </Text>
                          {newItemImageBusy ? (
                            <HStack gap="2" align="center" color="fg">
                              <Spinner size="sm" colorPalette="teal" />
                              <Text fontSize={APP_TEXT_SIZES.helper}>
                                Uploading photo and saving item…
                              </Text>
                            </HStack>
                          ) : null}
                        </Stack>
                        <HStack>
                          <PondButton
                            colorPalette="teal"
                            loading={newItemImageBusy}
                            onClick={async () => {
                              setError(null);
                              if (!isAllowedClosetCategory(newCategory)) {
                                setNotice({
                                  kind: "error",
                                  message:
                                    "Category must use only letters and /, or pick a suggested option.",
                                });
                                return;
                              }
                              const nn = newName.trim();
                              const nameErr = validateClosetItemName(nn);
                              if (nameErr) {
                                setNotice({ kind: "error", message: nameErr });
                                return;
                              }
                              const descErr = validateClosetFreeText(
                                newDescription,
                                "Description",
                              );
                              if (descErr) {
                                setNotice({ kind: "error", message: descErr });
                                return;
                              }
                              const cat = newCategory.trim();
                              const catErr = validateClosetCategory(cat);
                              if (catErr) {
                                setNotice({ kind: "error", message: catErr });
                                return;
                              }
                              try {
                                setNewItemImageBusy(true);
                                const token = await getApiAccessToken();
                                const file =
                                  newItemPhotoInputRef.current?.files?.[0];
                                let imageKey: string | undefined;
                                if (file) {
                                  imageKey = await uploadClosetImageViaPresign(
                                    getApiAccessToken,
                                    file,
                                  );
                                }
                                await createItem(token, {
                                  name: nn,
                                  description: newDescription,
                                  ...(cat ? { category: cat } : {}),
                                  ...(imageKey ? { image_key: imageKey } : {}),
                                });
                                setNewName("");
                                setNewDescription("");
                                setNewCategory("");
                                if (newItemPhotoInputRef.current) {
                                  newItemPhotoInputRef.current.value = "";
                                }
                                setIsAddItemOpen(false);
                                setGridPage(1);
                                await refreshAll();
                                setNotice({
                                  kind: "success",
                                  message: "Item added.",
                                });
                              } catch (err: unknown) {
                                const message =
                                  err instanceof Error
                                    ? err.message
                                    : "Failed to create item";
                                setNotice({ kind: "error", message });
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
                    <HStack
                      justify={isMobile ? "space-between" : "flex-start"}
                      align="center"
                      w="100%"
                      gap="3"
                      flexWrap="nowrap"
                    >
                      <PondButton
                        colorPalette="forest"
                        color="white"
                        onClick={() => setIsAddItemOpen(true)}
                      >
                        Add Item
                      </PondButton>
                      {isMobile ? (
                        <PondButton
                          type="button"
                          size="sm"
                          colorPalette="teal"
                          onClick={() => setFilterToolsOpen(true)}
                        >
                          Filter &amp; sort
                        </PondButton>
                      ) : null}
                    </HStack>
                  )}

                  {/* Action Items collapsible */}
                  {!isAddItemOpen && totalActionItems > 0 ? (
                    <Box
                      bg="bg.panel"
                      borderWidth="1px"
                      borderColor="border"
                      borderRadius="xl"
                      p="2"
                    >
                      <Collapsible.Root
                        open={actionsOpen}
                        onOpenChange={(d: { open: boolean }) =>
                          setActionsOpen(d.open)
                        }
                      >
                        <Collapsible.Trigger asChild>
                          <button
                            type="button"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              width: "100%",
                              textAlign: "left",
                              fontSize: "1rem",
                              fontWeight: 600,
                              color: "inherit",
                              cursor: "pointer",
                              background: "transparent",
                              border: "none",
                              padding: 0,
                              margin: 0,
                            }}
                          >
                            <Text
                              as="span"
                              transform={
                                actionsOpen ? "rotate(90deg)" : "rotate(0deg)"
                              }
                              transition="transform 0.15s ease"
                              lineHeight="1"
                              flexShrink={0}
                            >
                              ›
                            </Text>
                            <Text as="span" flex="1">
                              Action items ({totalActionItems})
                            </Text>
                          </button>
                        </Collapsible.Trigger>
                        <Collapsible.Content>
                          <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} pt="3">
                            {/* DECLINED REQUEST */}
                            {visibleDeclined.map((item) => (
                              <Box
                                key={`declined-${item.id}`}
                                bg="bg.panel"
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
                                    Owner: {displayName(item.owner_user)} | Need
                                    by:{" "}
                                    {item.my_declined_request?.date_needed_by ??
                                      "—"}
                                  </Text>
                                  {item.my_declined_request?.message ? (
                                    <Text fontSize={APP_TEXT_SIZES.helper}>
                                      Your request:{" "}
                                      {item.my_declined_request.message}
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
                                          confirmDeleteDeclinedRequestItemId ===
                                          item.id
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
                                            confirmDeleteDeclinedRequestItemId !==
                                            item.id
                                          ) {
                                            setConfirmDeleteDeclinedRequestItemId(
                                              item.id,
                                            );
                                            return;
                                          }
                                          try {
                                            const token =
                                              await getApiAccessToken();
                                            await deleteBorrowRequest(
                                              token,
                                              declinedRequest.id,
                                            );
                                            setConfirmDeleteDeclinedRequestItemId(
                                              null,
                                            );
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
                                        {confirmDeleteDeclinedRequestItemId ===
                                        item.id
                                          ? "Confirm delete"
                                          : "Delete request"}
                                      </PondButton>
                                    </HStack>
                                  ) : null}
                                </Stack>
                              </Box>
                            ))}
                            {actionCounts.declined > ACTIONS_PAGE_SIZE ? (
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
                                      setActionsPage((p) => ({
                                        ...p,
                                        declined: Math.max(1, p.declined - 1),
                                      }))
                                    }
                                  >
                                    ←
                                  </PondButton>
                                  <PondButton
                                    size="sm"
                                    colorPalette="nautical"
                                    disabled={
                                      safeDeclinedPage >= totalDeclinedPages
                                    }
                                    onClick={() =>
                                      setActionsPage((p) => ({
                                        ...p,
                                        declined: Math.min(
                                          totalDeclinedPages,
                                          p.declined + 1,
                                        ),
                                      }))
                                    }
                                  >
                                    →
                                  </PondButton>
                                </HStack>
                              </HStack>
                            ) : null}

                            {/* CUSTODY OFFERED */}
                            {visibleCustodyOffered.map((item) => (
                              <Box
                                key={`custody-offer-${item.id}`}
                                bg="bg.panel"
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
                                    Owner: {displayName(item.owner_user)} wants
                                    you to hold this item.
                                  </Text>
                                  {item.description ? (
                                    <Text fontSize={APP_TEXT_SIZES.helper}>
                                      {item.description}
                                    </Text>
                                  ) : null}
                                  <HStack flexWrap="wrap">
                                    <PondButton
                                      size="sm"
                                      colorPalette="teal"
                                      onClick={async () => {
                                        try {
                                          const token =
                                            await getApiAccessToken();
                                          await acceptCustody(token, item.id);
                                          setNotice({
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
                                          const token =
                                            await getApiAccessToken();
                                          await rejectPendingCustody(
                                            token,
                                            item.id,
                                          );
                                          setNotice({
                                            kind: "success",
                                            message:
                                              "Custody offer declined.",
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
                            {actionCounts.custodyOffered > ACTIONS_PAGE_SIZE ? (
                              <HStack justify="space-between">
                                <Text fontSize={APP_TEXT_SIZES.helper}>
                                  Page {safeCustodyOfferedPage} /{" "}
                                  {totalCustodyOfferedPages}
                                </Text>
                                <HStack>
                                  <PondButton
                                    size="sm"
                                    colorPalette="nautical"
                                    disabled={safeCustodyOfferedPage <= 1}
                                    onClick={() =>
                                      setActionsPage((p) => ({
                                        ...p,
                                        custodyOffered: Math.max(
                                          1,
                                          p.custodyOffered - 1,
                                        ),
                                      }))
                                    }
                                  >
                                    ←
                                  </PondButton>
                                  <PondButton
                                    size="sm"
                                    colorPalette="nautical"
                                    disabled={
                                      safeCustodyOfferedPage >=
                                      totalCustodyOfferedPages
                                    }
                                    onClick={() =>
                                      setActionsPage((p) => ({
                                        ...p,
                                        custodyOffered: Math.min(
                                          totalCustodyOfferedPages,
                                          p.custodyOffered + 1,
                                        ),
                                      }))
                                    }
                                  >
                                    →
                                  </PondButton>
                                </HStack>
                              </HStack>
                            ) : null}

                            {/* PENDING REQUESTS on items I own */}
                            {ownedWithPendingRequests.map((item) => (
                              <ClosetItemLinkCard
                                key={`requested-owned-${item.id}`}
                                item={item}
                                closetReturnTo={ITEMS_RETURN_TO}
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
                            ))}

                            {/* BORROWED FROM owner */}
                            {visibleBorrowed.map((item) => (
                              <ClosetItemLinkCard
                                key={`borrowed-${item.id}`}
                                item={item}
                                closetReturnTo={ITEMS_RETURN_TO}
                                dashedBorder
                                titlePrefix={
                                  <Text fontWeight="bold" color="orange.solid">
                                    {`BORROWED FROM ${displayName(
                                      item.owner_user,
                                    ).toUpperCase()}:`}
                                  </Text>
                                }
                              />
                            ))}
                            {actionCounts.borrowed > ACTIONS_PAGE_SIZE ? (
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
                                      setActionsPage((p) => ({
                                        ...p,
                                        borrowed: Math.max(1, p.borrowed - 1),
                                      }))
                                    }
                                  >
                                    ←
                                  </PondButton>
                                  <PondButton
                                    size="sm"
                                    colorPalette="nautical"
                                    disabled={
                                      safeBorrowedPage >= totalBorrowedPages
                                    }
                                    onClick={() =>
                                      setActionsPage((p) => ({
                                        ...p,
                                        borrowed: Math.min(
                                          totalBorrowedPages,
                                          p.borrowed + 1,
                                        ),
                                      }))
                                    }
                                  >
                                    →
                                  </PondButton>
                                </HStack>
                              </HStack>
                            ) : null}

                            {/* PENDING APPROVAL (I requested) */}
                            {visibleRequested.map((item) => (
                              <ClosetItemLinkCard
                                key={`requested-${item.id}`}
                                item={item}
                                closetReturnTo={ITEMS_RETURN_TO}
                                dashedBorder
                                titlePrefix={
                                  <Text fontWeight="bold" color="forest.solid">
                                    PENDING APPROVAL:
                                  </Text>
                                }
                                subtitle={`Owner: ${displayName(item.owner_user)} | Need by: ${item.my_pending_request?.date_needed_by ?? "—"}`}
                              />
                            ))}
                            {actionCounts.requested > ACTIONS_PAGE_SIZE ? (
                              <HStack justify="space-between">
                                <Text fontSize={APP_TEXT_SIZES.helper}>
                                  Page {safeRequestedPage} /{" "}
                                  {totalRequestedPages}
                                </Text>
                                <HStack>
                                  <PondButton
                                    size="sm"
                                    colorPalette="nautical"
                                    disabled={safeRequestedPage <= 1}
                                    onClick={() =>
                                      setActionsPage((p) => ({
                                        ...p,
                                        requested: Math.max(1, p.requested - 1),
                                      }))
                                    }
                                  >
                                    ←
                                  </PondButton>
                                  <PondButton
                                    size="sm"
                                    colorPalette="nautical"
                                    disabled={
                                      safeRequestedPage >= totalRequestedPages
                                    }
                                    onClick={() =>
                                      setActionsPage((p) => ({
                                        ...p,
                                        requested: Math.min(
                                          totalRequestedPages,
                                          p.requested + 1,
                                        ),
                                      }))
                                    }
                                  >
                                    →
                                  </PondButton>
                                </HStack>
                              </HStack>
                            ) : null}

                            {/* LOANED TO holder */}
                            {visibleLoaned.map((item) => (
                              <ClosetItemLinkCard
                                key={`loaned-${item.id}`}
                                item={item}
                                closetReturnTo={ITEMS_RETURN_TO}
                                titlePrefix={
                                  <Text fontWeight="bold" color="sky.solid">
                                    {`LOANED TO ${displayName(
                                      item.current_holder_user,
                                    ).toUpperCase()}:`}
                                  </Text>
                                }
                              />
                            ))}
                            {actionCounts.loaned > ACTIONS_PAGE_SIZE ? (
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
                                      setActionsPage((p) => ({
                                        ...p,
                                        loaned: Math.max(1, p.loaned - 1),
                                      }))
                                    }
                                  >
                                    ←
                                  </PondButton>
                                  <PondButton
                                    size="sm"
                                    colorPalette="nautical"
                                    disabled={safeLoanedPage >= totalLoanedPages}
                                    onClick={() =>
                                      setActionsPage((p) => ({
                                        ...p,
                                        loaned: Math.min(
                                          totalLoanedPages,
                                          p.loaned + 1,
                                        ),
                                      }))
                                    }
                                  >
                                    →
                                  </PondButton>
                                </HStack>
                              </HStack>
                            ) : null}
                          </Stack>
                        </Collapsible.Content>
                      </Collapsible.Root>
                    </Box>
                  ) : null}

                  {/* Filters: desktop inline; mobile opens Filter dialog from row with Add Item */}
                  {!isMobile ? <Stack gap="2">{filterControls}</Stack> : null}
                  {isMobile ? (
                    <Dialog.Root
                      open={filterToolsOpen}
                      lazyMount
                      unmountOnExit
                      onOpenChange={(d: { open: boolean }) =>
                        setFilterToolsOpen(d.open)
                      }
                    >
                      <Dialog.Backdrop />
                      <Dialog.Positioner
                        display="flex"
                        alignItems="flex-end"
                        justifyContent="center"
                        p="0"
                      >
                        <Dialog.Content
                          maxW="100vw"
                          w="100vw"
                          borderTopRadius="xl"
                          borderBottomRadius="0"
                          bg="bg.panel"
                          borderWidth="0"
                          p="3"
                          pb="6"
                          boxShadow="lg"
                          maxH="85vh"
                          overflowY="auto"
                          gap="0"
                        >
                          <HStack
                            justify="space-between"
                            align="start"
                            w="100%"
                            mb="2"
                          >
                            <Text fontSize="md" fontWeight="semibold">
                              Filter &amp; sort
                            </Text>
                            <Dialog.CloseTrigger asChild>
                              <CloseButton
                                type="button"
                                size="sm"
                                aria-label="Close filters"
                              />
                            </Dialog.CloseTrigger>
                          </HStack>
                          <Stack gap="2">{filterControls}</Stack>
                          <HStack justify="flex-end" pt="3">
                            <PondButton
                              colorPalette="teal"
                              onClick={() => setFilterToolsOpen(false)}
                            >
                              Done
                            </PondButton>
                          </HStack>
                        </Dialog.Content>
                      </Dialog.Positioner>
                    </Dialog.Root>
                  ) : null}

                  {/* Grid */}
                  {visibleGridItems.length === 0 ? (
                    <PanelEmptyState
                      title={
                        gridItems.length === 0
                          ? categoryFilter.trim() || tagFilter
                            ? "No items match your filters."
                            : "No items to show yet."
                          : "All items on this page are filtered out."
                      }
                      description={
                        gridItems.length === 0
                          ? categoryFilter.trim() || tagFilter
                            ? "Try clearing your filters."
                            : "When you or your friends add items, they'll show up here."
                          : "Try toggling Show My Items or Show Hidden."
                      }
                      actionLabel={
                        categoryFilter.trim() || tagFilter
                          ? "Clear filters"
                          : "Refresh"
                      }
                      onAction={() => {
                        if (categoryFilter.trim() || tagFilter) {
                          setCategoryFilter("");
                          setTagFilter("");
                          setTagInput("");
                          setGridPage(1);
                        } else {
                          void loadGrid();
                        }
                      }}
                    />
                  ) : null}
                  <SimpleGrid
                    columns={{ base: 2, md: 4 }}
                    gap={MAPPED_CLOSET_TAB_STACK_GAP}
                    w="100%"
                  >
                    {visibleGridItems.map((item) => (
                      <FriendClosetListCard
                        key={`grid-${item.id}`}
                        item={item}
                        closetReturnTo={ITEMS_RETURN_TO}
                      />
                    ))}
                  </SimpleGrid>
                  <HStack justify="space-between">
                    <Text fontSize={APP_TEXT_SIZES.helper}>
                      Page {gridPage} / {totalGridPages}
                    </Text>
                    <HStack>
                      <PondButton
                        size="sm"
                        colorPalette="nautical"
                        disabled={gridPage <= 1}
                        onClick={() => setGridPage((p) => Math.max(1, p - 1))}
                      >
                        ←
                      </PondButton>
                      <PondButton
                        size="sm"
                        colorPalette="nautical"
                        disabled={gridPage >= totalGridPages}
                        onClick={() =>
                          setGridPage((p) => Math.min(totalGridPages, p + 1))
                        }
                      >
                        →
                      </PondButton>
                    </HStack>
                  </HStack>
                </Stack>
              )}
              <AppModal
                open={selectedItemIdValid != null || itemQueryInvalid}
                onOpenChange={(open) => {
                  if (!open) closeExpanded();
                }}
                showHeader={false}
                size="xl"
                positionerProps={
                  isMobile
                    ? {
                        px: "0",
                        py: "0",
                        alignItems: "stretch",
                        justifyContent: "flex-start",
                      }
                    : undefined
                }
                contentProps={
                  isMobile
                    ? {
                        maxW: "100vw",
                        w: "100vw",
                        maxH: "100dvh",
                        h: "fit-content",
                        my: "0",
                        borderRadius: "0",
                        borderWidth: "0",
                        "aria-label": "Item details",
                        overflow: "hidden",
                        pt: "2",
                        px: "2",
                        pb: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
                      }
                    : {
                        maxW: "min(48rem, 100vw - 1.5rem)",
                        "aria-label": "Item details",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        maxH: "min(90vh, 760px)",
                        my: "0",
                        h: "fit-content",
                      }
                }
                bodyProps={
                  isMobile
                    ? {
                        flex: "0 1 auto",
                        minH: 0,
                        overflowY: "auto",
                        maxH:
                          "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)",
                      }
                    : {
                        flex: "0 1 auto",
                        minH: 0,
                        overflowY: "auto",
                        maxH: "min(85vh, 720px)",
                      }
                }
              >
                <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
                  {expandedNotice ? (
                    <Text
                      fontSize={APP_TEXT_SIZES.helper}
                      fontWeight="medium"
                      color={
                        expandedNotice.kind === "error"
                          ? "nautical.solid"
                          : "forest.solid"
                      }
                      role={
                        expandedNotice.kind === "error" ? "alert" : "status"
                      }
                    >
                      {expandedNotice.message}
                    </Text>
                  ) : null}
                  {itemQueryInvalid ? (
                    <Text
                      fontSize={APP_TEXT_SIZES.helper}
                      color="nautical.solid"
                      role="alert"
                    >
                      Invalid item.
                    </Text>
                  ) : selectedItemError && !displayItem ? (
                    <Text
                      fontSize={APP_TEXT_SIZES.helper}
                      color="nautical.solid"
                      role="alert"
                    >
                      {selectedItemError}
                    </Text>
                  ) : !displayItem ? (
                    <PanelBlockSkeleton lines={2} showTitleLine />
                  ) : sameClosetUserId(displayItem.owner_user.id, meId) ? (
                    <ClosetOwnerManagePanel
                      open
                      onClose={closeExpanded}
                      item={displayItem}
                      custodyFriends={friendsForCustody}
                      getToken={getApiAccessToken}
                      meId={meId}
                      onRefreshed={reloadSelectedItem}
                      onNotice={setExpandedNotice}
                      itemNav={itemModalNav}
                    />
                  ) : (
                    <ClosetItemDetailContent
                      item={displayItem}
                      meId={meId}
                      getApiAccessToken={getApiAccessToken}
                      onReload={reloadSelectedItem}
                      itemNav={itemModalNav}
                    />
                  )}
                </Stack>
              </AppModal>
            </Tabs.Content>

            <Tabs.Content value="images" p={{ base: "2", md: "2" }}>
              {loading ? (
                <Box {...PANEL_ENTRY_CARD_PROPS}>
                  <PanelListRowSkeleton rows={4} />
                </Box>
              ) : (
                <Stack gap="4">
                  <HStack
                    justify="space-between"
                    align="center"
                    gap="3"
                    flexWrap="wrap"
                  >
                    <Text>
                      Browse your uploaded images and delete your unneeded
                      files.
                    </Text>
                    {imagesNotice ? (
                      <Text
                        color={
                          imagesNotice.kind === "success"
                            ? "forest.solid"
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
                  {visibleImageRows.length > 0 ? (
                    <SimpleGrid
                      columns={{ base: 2, md: 4 }}
                      gap={MAPPED_CLOSET_TAB_STACK_GAP}
                      w="100%"
                    >
                      {visibleImageRows.map((row) => (
                        <ClosetImageInventoryCard
                          key={row.image_key}
                          row={row}
                          deletingImageKey={deletingImageKey}
                          confirmDeleteImageKey={confirmDeleteImageKey}
                          deleteButtonRef={(node: HTMLButtonElement | null) => {
                            confirmDeleteImageButtonRefs.current[row.image_key] = node;
                          }}
                          onDeleteClick={async (e) => {
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
                        />
                      ))}
                    </SimpleGrid>
                  ) : null}
                </Stack>
              )}
            </Tabs.Content>
            {error ? (
              <Box px={{ base: "2", md: "2" }} pb="2">
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="nautical.solid"
                  role="alert"
                >
                  {error}
                </Text>
              </Box>
            ) : null}
          </Box>
        </Box>
      </Tabs.Root>
    </Stack>
  );
}
