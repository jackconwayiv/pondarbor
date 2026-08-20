import {
  Box,
  Collapsible,
  Heading,
  HStack,
  Image,
  Input,
  Link,
  Grid,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppSession, type SessionUser } from "../auth/AppSessionContext";
import UserCheckboxList from "../calendar/UserCheckboxList";
import { useCheckedUsers } from "../calendar/useCheckedUsers";
import PondButton from "../PondButton";
import { AppModal } from "../components/AppModal";
import PondNativeSelect from "../components/PondNativeSelect";
import {
  PanelEmptyState,
  PanelErrorState,
  PanelListRowSkeleton,
  PanelSessionReconnect,
  SessionLoadingCard,
} from "../components/panelStatus";
import {
  APP_PANEL_PAGE_MIN_HEIGHT_PROPS,
  fullBleedStackProps,
  useIsMobile,
} from "../responsive";
import {
  APP_SHELL_TAB_LIST_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  MAPPED_LIST_CARD_OUTER_PROPS,
  MAPPED_LIST_STACK_GAP,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FIELD_PROPS,
} from "../theme/typography";
import {
  fetchBooksCommunity,
  linkGoodreadsProfile,
  unlinkGoodreadsProfile,
} from "./api";
import {
  blendedBooksForShelf,
  BOOKS_PAGE_SIZE_DESKTOP,
  BOOKS_TAB_OPTIONS,
  booksPageCount,
  communityPeople,
  formatReadLabel,
  isCommunityShelfSlug,
  matchSectionsForViewer,
  paginateList,
  type BooksListSort,
  type BooksListTab,
  type CommunityWorkRow,
  viewerShelfError,
  visibleWorksForShelf,
} from "./communityView";
import BookReadersModal, { BookAvatarGroup, starsLabel } from "./BookReadersModal";
import {
  clearCommunitySnapshot,
  communityEntriesEqual,
  readCommunitySnapshot,
  writeCommunitySnapshot,
} from "./communityCache";
import type { BooksCommunityEntry } from "./types";

const MAPPED_CARD_PROPS = {
  bg: "bg.panel",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "xl",
  w: "100%",
  minW: 0,
  ...MAPPED_LIST_CARD_OUTER_PROPS,
} as const;

/** Desktop card/row height so paginated grids stay the same size page to page. */
const BOOK_CARD_DESKTOP_H = "7rem";

const BOOK_CARD_GRID_PROPS = {
  columns: { base: 1, md: 2 },
  gap: "2",
  w: "100%",
  alignItems: "stretch",
} as const;

function BooksSortSelect({
  value,
  onChange,
}: {
  value: BooksListSort;
  onChange: (next: BooksListSort) => void;
}) {
  return (
    <HStack align="center" gap="2" flexShrink={0}>
      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
        Sort
      </Text>
      <PondNativeSelect
        rootProps={{ size: "sm", w: "auto", minW: "7.5rem" }}
        fieldProps={{
          value,
          "aria-label": "Sort books",
          onChange: (e) => onChange(e.target.value as BooksListSort),
        }}
      >
        <option value="user">User</option>
        <option value="title">Title</option>
        <option value="date">Date</option>
      </PondNativeSelect>
    </HStack>
  );
}

const BOOK_TITLE_MAX_CHARS = 65;

function displayBookTitle(title: string): string {
  if (title.length <= BOOK_TITLE_MAX_CHARS) return title;
  return `${title.slice(0, BOOK_TITLE_MAX_CHARS)}…`;
}

function BookRow({
  row,
  onOpenReaders,
}: {
  row: CommunityWorkRow;
  onOpenReaders: (row: CommunityWorkRow) => void;
}) {
  const book = row.book;
  const cover = (book.book_large_image_url || book.book_image_url).trim();
  const showPersonMeta = !row.collapsed;
  const rating = showPersonMeta ? starsLabel(book.user_rating) : "";
  const readLabel = showPersonMeta ? formatReadLabel(book) : null;
  const displayTitle = displayBookTitle(book.title);
  const title = book.link ? (
    <Link href={book.link} target="_blank" rel="noreferrer" title={book.title}>
      {displayTitle}
    </Link>
  ) : (
    displayTitle
  );
  return (
    <Box
      {...MAPPED_CARD_PROPS}
      h={{ md: BOOK_CARD_DESKTOP_H }}
      minH={{ md: BOOK_CARD_DESKTOP_H }}
      overflow={{ md: "hidden" }}
    >
      <HStack align="stretch" gap="2" w="100%" h="100%">
        {cover ? (
          <Image
            src={cover}
            alt=""
            w="56px"
            h="84px"
            objectFit="cover"
            borderRadius="md"
            flexShrink={0}
          />
        ) : (
          <Box w="56px" h="84px" bg="bg.muted" borderRadius="md" flexShrink={0} />
        )}
        <Stack gap="1" minW={0} flex="1" justify="space-between">
          <Stack gap="1" minW={0}>
            <HStack align="start" justify="space-between" gap="2" w="100%">
              <Text
                fontWeight="semibold"
                fontSize="sm"
                lineClamp={2}
                minW={0}
                flex="1"
                title={book.title}
              >
                {title}
              </Text>
              <BookAvatarGroup
                readers={row.groupReaders}
                onOpen={() => onOpenReaders(row)}
              />
            </HStack>
            <Text
              color="fg.muted"
              fontSize={{ base: "2xs", md: "xs" }}
              lineClamp={1}
            >
              {book.author_name || "\u00a0"}
            </Text>
          </Stack>
          <Grid
            templateColumns="minmax(0, 1fr) minmax(0, 1fr) minmax(0, 2fr)"
            w="100%"
            alignItems="baseline"
            columnGap="2"
            color="fg.muted"
            fontSize={{ base: "2xs", md: "xs" }}
          >
            <Text minW={0} textAlign="left">
              {book.book_published || "\u00a0"}
            </Text>
            <Text
              minW={0}
              textAlign="center"
              aria-label={rating ? `${book.user_rating} stars` : undefined}
            >
              {rating || "\u00a0"}
            </Text>
            <Text minW={0} textAlign="right" fontSize="2xs" lineClamp={1}>
              {readLabel || "\u00a0"}
            </Text>
          </Grid>
        </Stack>
      </HStack>
    </Box>
  );
}

export default function BooksPage() {
  const {
    isLoading,
    error: sessionError,
    refreshSession,
    getApiAccessToken,
    sessionUser,
    updateProfileLocally,
    resyncSessionSilently,
  } = useAppSession();

  const isApproved = Boolean(sessionUser?.user.is_approved);
  const viewerUserId = sessionUser?.user.id;
  const savedId = (sessionUser?.profile.goodreads_user_id ?? "").trim();
  const isMobile = useIsMobile();

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [profileUrl, setProfileUrl] = useState(
    savedId ? `https://www.goodreads.com/user/show/${savedId}` : "",
  );
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [listTab, setListTab] = useState<BooksListTab>("currently-reading");
  const [communityEntries, setCommunityEntries] = useState<BooksCommunityEntry[]>([]);
  const [communityBusy, setCommunityBusy] = useState(false);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [communityLoaded, setCommunityLoaded] = useState(false);
  const [listPage, setListPage] = useState(1);
  const [listSort, setListSort] = useState<BooksListSort>("user");
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [readersRow, setReadersRow] = useState<CommunityWorkRow | null>(null);

  const people = useMemo(() => communityPeople(communityEntries), [communityEntries]);
  const peopleForFilter = useMemo(
    () =>
      people.map((user) => ({
        id: user.id,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      })),
    [people],
  );
  const { orderedCheckedUserIds, setCheckedUserIds } = useCheckedUsers(peopleForFilter);
  const checkedKey = orderedCheckedUserIds.join(",");

  const applySession = useCallback(
    (session: SessionUser | undefined) => {
      if (!session?.profile) return;
      updateProfileLocally({
        goodreads_user_id: session.profile.goodreads_user_id ?? "",
      });
    },
    [updateProfileLocally],
  );

  const loadCommunity = useCallback(async () => {
    const token = await getApiAccessToken();
    const data = await fetchBooksCommunity(token);
    setCommunityEntries((prev) =>
      communityEntriesEqual(prev, data.results) ? prev : data.results,
    );
    if (viewerUserId != null) {
      writeCommunitySnapshot(viewerUserId, data.results);
    }
    setCommunityLoaded(true);
  }, [getApiAccessToken, viewerUserId]);

  useEffect(() => {
    if (isLoading || sessionError || !isApproved || communityLoaded) return;
    let cancelled = false;
    if (viewerUserId != null) {
      const snap = readCommunitySnapshot(viewerUserId);
      if (snap) {
        // Show last snapshot immediately; do not flip communityLoaded here or
        // this effect will re-run and cancel the background fetch.
        setCommunityEntries(snap.results);
      }
    }
    (async () => {
      setCommunityBusy(true);
      setCommunityError(null);
      try {
        await loadCommunity();
      } catch (e) {
        if (!cancelled) {
          setCommunityError(
            e instanceof Error ? e.message : "Could not load community reading.",
          );
          setCommunityLoaded(true);
        }
      } finally {
        if (!cancelled) setCommunityBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isLoading,
    sessionError,
    isApproved,
    communityLoaded,
    loadCommunity,
    viewerUserId,
  ]);

  const unfilteredRows = useMemo(() => {
    if (!isCommunityShelfSlug(listTab)) return [];
    return blendedBooksForShelf(communityEntries, listTab);
  }, [communityEntries, listTab]);
  const visibleRows = useMemo(() => {
    if (!isCommunityShelfSlug(listTab)) return [];
    return visibleWorksForShelf(
      communityEntries,
      listTab,
      orderedCheckedUserIds,
      listSort,
    );
  }, [communityEntries, listTab, orderedCheckedUserIds, listSort]);
  const matchSections = useMemo(
    () =>
      listTab === "matches"
        ? matchSectionsForViewer(
            communityEntries,
            orderedCheckedUserIds,
            viewerUserId,
            listSort,
          )
        : [],
    [listTab, communityEntries, orderedCheckedUserIds, viewerUserId, listSort],
  );
  const ownShelfError = useMemo(
    () =>
      isCommunityShelfSlug(listTab)
        ? viewerShelfError(communityEntries, listTab, viewerUserId)
        : null,
    [communityEntries, listTab, viewerUserId],
  );
  const totalPages = booksPageCount(visibleRows.length, BOOKS_PAGE_SIZE_DESKTOP);
  const safePage = Math.min(Math.max(1, listPage), totalPages);
  const pageRows = useMemo(
    () =>
      isMobile
        ? visibleRows
        : paginateList(visibleRows, safePage, BOOKS_PAGE_SIZE_DESKTOP),
    [isMobile, visibleRows, safePage],
  );
  const showPager = !isMobile && listTab !== "matches" && visibleRows.length > BOOKS_PAGE_SIZE_DESKTOP;

  useEffect(() => {
    setListPage(1);
  }, [listTab, listSort, checkedKey]);

  const openLinkModal = () => {
    setLinkError(null);
    setProfileUrl(savedId ? `https://www.goodreads.com/user/show/${savedId}` : "");
    setLinkModalOpen(true);
  };

  const onLink = async () => {
    setLinkBusy(true);
    setLinkError(null);
    try {
      const token = await getApiAccessToken();
      const data = await linkGoodreadsProfile(token, profileUrl.trim());
      applySession(data.session as SessionUser | undefined);
      await resyncSessionSilently();
      if (viewerUserId != null) clearCommunitySnapshot(viewerUserId);
      setCommunityLoaded(false);
      if (data.goodreads_user_id) {
        setProfileUrl(`https://www.goodreads.com/user/show/${data.goodreads_user_id}`);
      }
      setLinkModalOpen(false);
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "Could not link profile.");
    } finally {
      setLinkBusy(false);
    }
  };

  const onUnlink = async () => {
    setLinkBusy(true);
    setLinkError(null);
    try {
      const token = await getApiAccessToken();
      const data = await unlinkGoodreadsProfile(token);
      applySession(data.session as SessionUser | undefined);
      setProfileUrl("");
      if (viewerUserId != null) clearCommunitySnapshot(viewerUserId);
      setCommunityLoaded(false);
      setLinkModalOpen(false);
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "Could not unlink profile.");
    } finally {
      setLinkBusy(false);
    }
  };

  const onRetryCommunity = async () => {
    setCommunityBusy(true);
    setCommunityError(null);
    try {
      await loadCommunity();
    } catch (e) {
      setCommunityError(
        e instanceof Error ? e.message : "Could not load community reading.",
      );
    } finally {
      setCommunityBusy(false);
    }
  };

  if (isLoading) return <SessionLoadingCard />;
  if (sessionError) {
    return (
      <PanelSessionReconnect sessionError={sessionError} onRetry={() => void refreshSession()} />
    );
  }

  const headingStatus =
    communityBusy && !communityEntries.length
      ? "Loading…"
      : communityBusy && communityEntries.length > 0
        ? "Updating…"
        : null;
  const linkButtonLabel = savedId ? "Edit Goodreads" : "Link Goodreads";

  return (
    <Stack
      flex="1"
      gap="0"
      {...APP_PANEL_PAGE_MIN_HEIGHT_PROPS}
      {...fullBleedStackProps}
    >
      <Box flex="1" bg="bg" px={0} py={{ base: "2", md: "2" }}>
        <Box {...APP_SHELL_TRAY_PROPS}>
          <Stack
            gap={{ base: "4", md: "4" }}
            px={{ base: "2", md: "2" }}
            pt={{ base: "2", md: "2" }}
            pb={{ base: "0", md: "2" }}
          >
            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <HStack align="start" justify="space-between" gap="2" w="100%">
                <Stack gap="2" minW="0" flex="1">
                  <Heading as="h1" size={{ base: "lg", md: "xl" }}>
                    <HStack as="span" display="inline-flex" gap="2" alignItems="center" flexWrap="wrap">
                      <Text as="span" aria-hidden="true">
                        📚
                      </Text>
                      <Text as="span">Books</Text>
                      {headingStatus ? (
                        <Text
                          as="span"
                          fontSize={APP_TEXT_SIZES.helper}
                          color="fg.muted"
                          fontWeight="medium"
                          aria-live="polite"
                        >
                          {headingStatus}
                        </Text>
                      ) : null}
                    </HStack>
                  </Heading>
                  <Text fontSize={APP_TEXT_SIZES.body} lineHeight="tall" color="fg">
                    See what your friends are reading!
                  </Text>
                </Stack>
                <PondButton
                  size="sm"
                  flexShrink={0}
                  colorPalette={savedId ? "sky" : "lilypad"}
                  variant={savedId ? "outline" : "solid"}
                  onClick={openLinkModal}
                >
                  {linkButtonLabel}
                </PondButton>
              </HStack>
            </Box>
          </Stack>

          <Tabs.Root
            value={listTab}
            variant="plain"
            onValueChange={(details) => {
              setListTab(details.value as BooksListTab);
              setListPage(1);
            }}
          >
            <HStack
              {...APP_SHELL_TAB_LIST_PROPS}
              align="center"
              gap="2"
              flexWrap="nowrap"
              pt={{ base: "0", md: "2" }}
            >
              <Tabs.List
                gap="2"
                flexWrap="nowrap"
                alignItems="center"
                borderBottomWidth="0"
                bg="transparent"
                px="0"
                py="0"
                w={{ base: "100%", md: "auto" }}
                minW="0"
                flex="1"
                overflowX="auto"
              >
                {BOOKS_TAB_OPTIONS.map((opt) => (
                  <Tabs.Trigger key={opt.value} value={opt.value} {...APP_SHELL_TAB_TRIGGER_PROPS}>
                    <Text as="span" display={{ base: "inline", md: "none" }}>
                      {opt.shortLabel}
                    </Text>
                    <Text as="span" display={{ base: "none", md: "inline" }}>
                      {opt.label}
                    </Text>
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
              <Box display={{ base: "none", md: "block" }} flexShrink={0}>
                <BooksSortSelect value={listSort} onChange={setListSort} />
              </Box>
            </HStack>
          </Tabs.Root>

          <Box p={{ base: "2", md: "2" }}>
            {!isApproved ? (
              <PanelEmptyState
                title="Approval required."
                description="Community reading is available after your account is approved."
              />
            ) : (
              <Stack gap="2">
                {communityError ? (
                  <PanelErrorState
                    title="Could not load community reading."
                    description={communityError}
                    actionLabel="Retry"
                    onAction={() => void onRetryCommunity()}
                  />
                ) : null}
                {ownShelfError ? (
                  <Text
                    color="nautical.solid"
                    fontSize={APP_TEXT_SIZES.helper}
                    fontWeight="medium"
                    role="alert"
                  >
                    Could not load your shelf right now.
                  </Text>
                ) : null}
                {communityBusy && !communityEntries.length ? (
                  <Box {...PANEL_ENTRY_CARD_PROPS}>
                    <PanelListRowSkeleton rows={4} />
                  </Box>
                ) : null}
                {!communityBusy &&
                communityLoaded &&
                !communityEntries.length &&
                !communityError ? (
                  <PanelEmptyState
                    title="Nobody visible has linked Goodreads yet."
                    description="Link yours with Link Goodreads, or check Profile privacy if friends set Sees me to friends only."
                    actionLabel={linkButtonLabel}
                    onAction={openLinkModal}
                  />
                ) : null}
                {communityEntries.length > 0 ? (
                  <Stack
                    direction={isMobile ? "column" : "row"}
                    gap="2"
                    align="stretch"
                  >
                    {isMobile ? (
                      <Collapsible.Root
                        open={peopleOpen}
                        onOpenChange={(details) => setPeopleOpen(details.open)}
                      >
                        <Stack gap="2">
                          <HStack
                            justify="space-between"
                            align="center"
                            gap="2"
                            w="100%"
                          >
                            <Collapsible.Trigger asChild>
                              <PondButton
                                size="sm"
                                uiClass="filter"
                                uiActive={peopleOpen}
                                justifyContent="center"
                                flexShrink={0}
                              >
                                Filter People
                              </PondButton>
                            </Collapsible.Trigger>
                            <BooksSortSelect
                              value={listSort}
                              onChange={setListSort}
                            />
                          </HStack>
                          <Collapsible.Content>
                            <UserCheckboxList
                              approvedUsers={peopleForFilter}
                              loading={communityBusy && !communityEntries.length}
                              orderedCheckedUserIds={orderedCheckedUserIds}
                              onChange={setCheckedUserIds}
                              rowMarker="avatar"
                            />
                          </Collapsible.Content>
                        </Stack>
                      </Collapsible.Root>
                    ) : (
                      <UserCheckboxList
                        approvedUsers={peopleForFilter}
                        loading={communityBusy && !communityEntries.length}
                        orderedCheckedUserIds={orderedCheckedUserIds}
                        onChange={setCheckedUserIds}
                        rowMarker="avatar"
                      />
                    )}
                    <Box flex="1" minW="0">
                      <Stack gap="2">
                        {!communityBusy &&
                        communityLoaded &&
                        listTab !== "matches" &&
                        unfilteredRows.length === 0 &&
                        !communityError ? (
                          <PanelEmptyState
                            title="No books on this shelf yet."
                            description="Link Goodreads if you have not, or pick another shelf."
                          />
                        ) : null}
                        {!communityBusy &&
                        communityLoaded &&
                        listTab !== "matches" &&
                        unfilteredRows.length > 0 &&
                        visibleRows.length === 0 &&
                        !communityError ? (
                          <PanelEmptyState
                            title="No books match this filter."
                            description="Open Filter People and include at least one person, or use Check all."
                            actionLabel={isMobile ? "Open Filter People" : undefined}
                            onAction={
                              isMobile ? () => setPeopleOpen(true) : undefined
                            }
                          />
                        ) : null}
                        {!communityBusy &&
                        communityLoaded &&
                        listTab === "matches" &&
                        matchSections.length === 0 &&
                        !communityError ? (
                          <PanelEmptyState
                            title="No overlapping books yet."
                            description="When two or more selected people share a title, or someone else's shelf lines up with yours, it shows up here."
                          />
                        ) : null}
                        {listTab === "matches" && matchSections.length > 0 ? (
                          <Stack gap="4">
                            {matchSections.map((section) => (
                              <Stack key={section.id} gap={MAPPED_LIST_STACK_GAP}>
                                <Text
                                  fontSize={APP_TEXT_SIZES.helper}
                                  fontWeight="semibold"
                                  color="fg.muted"
                                >
                                  {section.title}
                                </Text>
                                <SimpleGrid {...BOOK_CARD_GRID_PROPS}>
                                  {section.rows.map((row) => (
                                    <BookRow
                                      key={`${section.id}-${row.key}-${row.shelf}`}
                                      row={row}
                                      onOpenReaders={setReadersRow}
                                    />
                                  ))}
                                </SimpleGrid>
                              </Stack>
                            ))}
                          </Stack>
                        ) : null}
                        {listTab !== "matches" && pageRows.length ? (
                          <Stack gap={MAPPED_LIST_STACK_GAP}>
                            <SimpleGrid {...BOOK_CARD_GRID_PROPS}>
                              {pageRows.map((row) => (
                                <BookRow
                                  key={`${row.key}-${row.shelf}`}
                                  row={row}
                                  onOpenReaders={setReadersRow}
                                />
                              ))}
                              {showPager
                                ? Array.from(
                                    { length: BOOKS_PAGE_SIZE_DESKTOP - pageRows.length },
                                    (_, i) => (
                                      <Box
                                        key={`book-grid-pad-${i}`}
                                        display={{ base: "none", md: "block" }}
                                        h={BOOK_CARD_DESKTOP_H}
                                        minH={BOOK_CARD_DESKTOP_H}
                                        aria-hidden
                                      />
                                    ),
                                  )
                                : null}
                            </SimpleGrid>
                            {showPager ? (
                              <HStack justify="space-between">
                                <Text fontSize={APP_TEXT_SIZES.helper}>
                                  Page {safePage} / {totalPages}
                                </Text>
                                <HStack>
                                  <PondButton
                                    size="sm"
                                    colorPalette="sky"
                                    disabled={safePage <= 1}
                                    onClick={() =>
                                      setListPage((p) => Math.max(1, p - 1))
                                    }
                                  >
                                    ←
                                  </PondButton>
                                  <PondButton
                                    size="sm"
                                    colorPalette="sky"
                                    disabled={safePage >= totalPages}
                                    onClick={() =>
                                      setListPage((p) => Math.min(totalPages, p + 1))
                                    }
                                  >
                                    →
                                  </PondButton>
                                </HStack>
                              </HStack>
                            ) : null}
                          </Stack>
                        ) : null}
                      </Stack>
                    </Box>
                  </Stack>
                ) : null}
              </Stack>
            )}
          </Box>
        </Box>
      </Box>

      <BookReadersModal
        open={readersRow != null}
        onOpenChange={(open) => {
          if (!open) setReadersRow(null);
        }}
        row={readersRow}
      />

      <AppModal
        open={linkModalOpen}
        onOpenChange={(open) => {
          if (!open && linkBusy) return;
          setLinkModalOpen(open);
        }}
        title={linkButtonLabel}
        description="Paste your public Goodreads profile URL. Keep adding books on Goodreads after you link."
        size="md"
      >
        <Stack gap="2">
          <Stack gap="1">
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
              1. On Goodreads, open your profile (your name or photo in the header — not
              My Books).
            </Text>
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
              2. Copy the address bar. It should look like goodreads.com/user/show/ plus
              your id (a name after the id is fine).
            </Text>
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
              3. Under Account settings → Privacy, allow anyone to view your profile and
              bookshelves. Private profiles cannot load here.
            </Text>
          </Stack>
          <Input
            value={profileUrl}
            onChange={(e) => setProfileUrl(e.target.value)}
            placeholder="https://www.goodreads.com/user/show/12345678"
            aria-label="Goodreads profile URL"
            {...PANEL_FIELD_PROPS}
          />
          {savedId ? (
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
              Linked as user {savedId}.{" "}
              <Link
                href={`https://www.goodreads.com/user/show/${savedId}`}
                target="_blank"
                rel="noreferrer"
              >
                Open on Goodreads
              </Link>
            </Text>
          ) : null}
          {linkError ? (
            <Text
              color="nautical.solid"
              fontSize={APP_TEXT_SIZES.helper}
              fontWeight="medium"
              role="alert"
            >
              {linkError}
            </Text>
          ) : null}
          <HStack gap="2" flexWrap="wrap" justify="flex-end" pt="1">
            {savedId ? (
              <PondButton
                size="sm"
                colorPalette="nautical"
                onClick={() => void onUnlink()}
                disabled={linkBusy}
              >
                Unlink
              </PondButton>
            ) : null}
            <PondButton
              size="sm"
              colorPalette="sky"
              variant="outline"
              onClick={() => setLinkModalOpen(false)}
              disabled={linkBusy}
            >
              Cancel
            </PondButton>
            <PondButton
              size="sm"
              onClick={() => void onLink()}
              loading={linkBusy}
              disabled={linkBusy || !profileUrl.trim()}
            >
              {savedId ? "Update & load" : "Link & load"}
            </PondButton>
          </HStack>
        </Stack>
      </AppModal>
    </Stack>
  );
}
