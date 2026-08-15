import {
  Avatar,
  Box,
  Heading,
  HStack,
  Image,
  Input,
  Stack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router";

import { useAppSession, type SessionUser } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { PanelSessionReconnect, SessionLoadingCard } from "../components/panelStatus";
import {
  APP_SHELL_TABS_ROOT_PROPS,
  APP_SHELL_TAB_LIST_INSET_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import { APP_TEXT_SIZES, MAPPED_LIST_STACK_GAP, PANEL_ENTRY_CARD_PROPS } from "../theme/typography";
import {
  fetchBooksCommunity,
  fetchBooksShelves,
  linkGoodreadsProfile,
  unlinkGoodreadsProfile,
} from "./api";
import type {
  BooksCommunityEntry,
  CommunityShelfSlug,
  GoodreadsBook,
  GoodreadsShelf,
} from "./types";

type PageTab = "community" | "mine";

const COMMUNITY_SHELF_OPTIONS: { value: CommunityShelfSlug; label: string }[] = [
  { value: "currently-reading", label: "Currently Reading" },
  { value: "read", label: "Read" },
  { value: "to-read", label: "Want to Read" },
];

function stars(rating: number): string {
  if (!rating || rating < 1) return "";
  const n = Math.min(5, Math.max(0, Math.round(rating)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function BookRow({ book }: { book: GoodreadsBook }) {
  const cover = book.book_image_url?.trim();
  const rating = stars(book.user_rating);
  return (
    <HStack align="start" gap={3} {...PANEL_ENTRY_CARD_PROPS} w="100%">
      {cover ? (
        <Image
          src={cover}
          alt=""
          w="56px"
          h="84px"
          objectFit="cover"
          borderRadius="sm"
          flexShrink={0}
        />
      ) : (
        <Box w="56px" h="84px" bg="blackAlpha.100" borderRadius="sm" flexShrink={0} />
      )}
      <Stack gap={1} minW={0} flex="1">
        <Text fontWeight="semibold" lineClamp={2}>
          {book.link ? (
            <a href={book.link} target="_blank" rel="noreferrer">
              {book.title}
            </a>
          ) : (
            book.title
          )}
        </Text>
        {book.author_name ? (
          <Text color="fg.muted" fontSize={APP_TEXT_SIZES.helper}>
            {book.author_name}
          </Text>
        ) : null}
        <HStack gap={3} flexWrap="wrap" color="fg.muted" fontSize={APP_TEXT_SIZES.helper}>
          {rating ? <Text aria-label={`${book.user_rating} stars`}>{rating}</Text> : null}
          {book.user_read_at ? <Text>Read {book.user_read_at}</Text> : null}
          {book.book_published ? <Text>{book.book_published}</Text> : null}
        </HStack>
      </Stack>
    </HStack>
  );
}

function ShelfPanel({ shelf }: { shelf: GoodreadsShelf }) {
  if (!shelf.books.length) {
    return (
      <Text color="fg.muted" py={4}>
        No books on this shelf (or the shelf is empty in the public RSS feed, which only
        includes up to about 100 recent titles).
      </Text>
    );
  }
  return (
    <Stack gap={MAPPED_LIST_STACK_GAP}>
      {shelf.books.map((book) => (
        <BookRow
          key={`${shelf.slug}-${book.book_id || book.title}-${book.link}`}
          book={book}
        />
      ))}
    </Stack>
  );
}

function CommunityReaderCard({ entry }: { entry: BooksCommunityEntry }) {
  return (
    <Stack gap={3} {...PANEL_ENTRY_CARD_PROPS} w="100%">
      <HStack gap={3} justify="space-between" flexWrap="wrap">
        <HStack gap={3} minW={0}>
          <Avatar.Root size="sm">
            {entry.user.avatar_url ? (
              <Avatar.Image src={entry.user.avatar_url} alt="" />
            ) : null}
            <Avatar.Fallback name={entry.user.display_name} />
          </Avatar.Root>
          <Stack gap={0} minW={0}>
            <Text fontWeight="semibold" asChild>
              <RouterLink to={`/friend/${entry.user.id}`}>
                {entry.user.display_name}
              </RouterLink>
            </Text>
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
              {entry.book_count
                ? `${entry.book_count} book${entry.book_count === 1 ? "" : "s"}`
                : "No books on this shelf"}
            </Text>
          </Stack>
        </HStack>
        {entry.user.profile_url ? (
          <Text fontSize={APP_TEXT_SIZES.helper}>
            <a href={entry.user.profile_url} target="_blank" rel="noreferrer">
              Goodreads
            </a>
          </Text>
        ) : null}
      </HStack>
      {entry.error ? (
        <Text color="fg.muted" fontSize={APP_TEXT_SIZES.helper}>
          Could not load this shelf right now.
        </Text>
      ) : null}
      {entry.books.length ? (
        <Stack gap={MAPPED_LIST_STACK_GAP}>
          {entry.books.slice(0, 8).map((book) => (
            <BookRow
              key={`${entry.user.id}-${book.book_id || book.title}-${book.link}`}
              book={book}
            />
          ))}
          {entry.books.length > 8 ? (
            <Text color="fg.muted" fontSize={APP_TEXT_SIZES.helper}>
              +{entry.books.length - 8} more
            </Text>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
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
  } = useAppSession();

  const isApproved = Boolean(sessionUser?.user.is_approved);
  const savedId = (sessionUser?.profile.goodreads_user_id ?? "").trim();

  const [pageTab, setPageTab] = useState<PageTab>("community");
  const [profileUrl, setProfileUrl] = useState(
    savedId ? `https://www.goodreads.com/user/show/${savedId}` : "",
  );
  const [shelves, setShelves] = useState<GoodreadsShelf[]>([]);
  const [activeShelf, setActiveShelf] = useState<string>("currently-reading");
  const [mineBusy, setMineBusy] = useState(false);
  const [mineError, setMineError] = useState<string | null>(null);
  const [mineLoaded, setMineLoaded] = useState(false);

  const [communityShelf, setCommunityShelf] =
    useState<CommunityShelfSlug>("currently-reading");
  const [communityEntries, setCommunityEntries] = useState<BooksCommunityEntry[]>([]);
  const [communityBusy, setCommunityBusy] = useState(false);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [communityLoaded, setCommunityLoaded] = useState(false);

  const applySession = useCallback(
    (session: SessionUser | undefined) => {
      if (!session?.profile) return;
      updateProfileLocally({
        goodreads_user_id: session.profile.goodreads_user_id ?? "",
      });
    },
    [updateProfileLocally],
  );

  const loadShelves = useCallback(
    async (opts?: { refresh?: boolean }) => {
      const token = await getApiAccessToken();
      const data = await fetchBooksShelves(token, opts);
      setShelves(data.shelves);
      setActiveShelf((prev) => {
        if (data.shelves.some((s) => s.slug === prev)) return prev;
        return data.shelves[0]?.slug ?? "currently-reading";
      });
      setMineLoaded(true);
    },
    [getApiAccessToken],
  );

  const loadCommunity = useCallback(
    async (opts?: { shelf?: CommunityShelfSlug; refresh?: boolean }) => {
      const token = await getApiAccessToken();
      const shelf = opts?.shelf ?? communityShelf;
      const data = await fetchBooksCommunity(token, {
        shelf,
        refresh: opts?.refresh,
      });
      setCommunityEntries(data.results);
      setCommunityLoaded(true);
    },
    [communityShelf, getApiAccessToken],
  );

  useEffect(() => {
    if (isLoading || sessionError || !isApproved || communityLoaded) return;
    let cancelled = false;
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
  }, [isLoading, sessionError, isApproved, communityLoaded, loadCommunity]);

  useEffect(() => {
    if (isLoading || sessionError || !savedId || mineLoaded || pageTab !== "mine") return;
    let cancelled = false;
    (async () => {
      setMineBusy(true);
      setMineError(null);
      try {
        await loadShelves();
      } catch (e) {
        if (!cancelled) {
          setMineError(e instanceof Error ? e.message : "Could not load shelves.");
          setMineLoaded(true);
        }
      } finally {
        if (!cancelled) setMineBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoading, sessionError, savedId, mineLoaded, pageTab, loadShelves]);

  const onLink = async () => {
    setMineBusy(true);
    setMineError(null);
    try {
      const token = await getApiAccessToken();
      const data = await linkGoodreadsProfile(token, profileUrl.trim());
      applySession(data.session as SessionUser | undefined);
      setShelves(data.shelves);
      setActiveShelf(data.shelves[0]?.slug ?? "currently-reading");
      setMineLoaded(true);
      setCommunityLoaded(false);
      if (data.goodreads_user_id) {
        setProfileUrl(`https://www.goodreads.com/user/show/${data.goodreads_user_id}`);
      }
    } catch (e) {
      setMineError(e instanceof Error ? e.message : "Could not link profile.");
    } finally {
      setMineBusy(false);
    }
  };

  const onUnlink = async () => {
    setMineBusy(true);
    setMineError(null);
    try {
      const token = await getApiAccessToken();
      const data = await unlinkGoodreadsProfile(token);
      applySession(data.session as SessionUser | undefined);
      setShelves([]);
      setMineLoaded(false);
      setProfileUrl("");
      setCommunityLoaded(false);
    } catch (e) {
      setMineError(e instanceof Error ? e.message : "Could not unlink profile.");
    } finally {
      setMineBusy(false);
    }
  };

  const onRefreshMine = async () => {
    setMineBusy(true);
    setMineError(null);
    try {
      await loadShelves({ refresh: true });
    } catch (e) {
      setMineError(e instanceof Error ? e.message : "Could not refresh shelves.");
    } finally {
      setMineBusy(false);
    }
  };

  const onChangeCommunityShelf = async (shelf: CommunityShelfSlug) => {
    setCommunityShelf(shelf);
    setCommunityBusy(true);
    setCommunityError(null);
    try {
      await loadCommunity({ shelf });
    } catch (e) {
      setCommunityError(
        e instanceof Error ? e.message : "Could not load community reading.",
      );
    } finally {
      setCommunityBusy(false);
    }
  };

  const onRefreshCommunity = async () => {
    setCommunityBusy(true);
    setCommunityError(null);
    try {
      await loadCommunity({ refresh: true });
    } catch (e) {
      setCommunityError(
        e instanceof Error ? e.message : "Could not refresh community reading.",
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

  return (
    <Stack gap={6} maxW="4xl" mx="auto" w="100%">
      <Stack gap={2}>
        <Heading size="lg">📚 Books</Heading>
        <Text color="fg.muted">
          Link your public Goodreads profile once, then keep updating books on Goodreads.
          Community reading uses the same Sees me / Show me privacy settings as the rest of
          the site.
        </Text>
      </Stack>

      <Tabs.Root
        {...APP_SHELL_TABS_ROOT_PROPS}
        value={pageTab}
        onValueChange={(details) => setPageTab(details.value as PageTab)}
      >
        <Tabs.List {...APP_SHELL_TAB_LIST_INSET_PROPS}>
          <Tabs.Trigger value="community" {...APP_SHELL_TAB_TRIGGER_PROPS}>
            Community
          </Tabs.Trigger>
          <Tabs.Trigger value="mine" {...APP_SHELL_TAB_TRIGGER_PROPS}>
            My shelves
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="community" pt={4}>
          {!isApproved ? (
            <Text color="fg.muted">
              Community reading is available after your account is approved.
            </Text>
          ) : (
            <Stack gap={4}>
              <HStack justify="space-between" align="start" flexWrap="wrap" gap={3}>
                <Tabs.Root
                  value={communityShelf}
                  variant="plain"
                  size="sm"
                  onValueChange={(details) =>
                    void onChangeCommunityShelf(details.value as CommunityShelfSlug)
                  }
                >
                  <Tabs.List gap={1} flexWrap="wrap">
                    {COMMUNITY_SHELF_OPTIONS.map((opt) => (
                      <Tabs.Trigger key={opt.value} value={opt.value} px={3} py={1}>
                        {opt.label}
                      </Tabs.Trigger>
                    ))}
                  </Tabs.List>
                </Tabs.Root>
                <PondButton
                  size="sm"
                  variant="outline"
                  onClick={() => void onRefreshCommunity()}
                  disabled={communityBusy}
                >
                  Refresh
                </PondButton>
              </HStack>

              {communityError ? (
                <Text color="red.500" fontSize={APP_TEXT_SIZES.helper}>
                  {communityError}
                </Text>
              ) : null}
              {communityBusy && !communityEntries.length ? (
                <Text color="fg.muted">Loading what people are reading…</Text>
              ) : null}
              {!communityBusy && communityLoaded && !communityEntries.length && !communityError ? (
                <Text color="fg.muted">
                  Nobody visible has linked Goodreads yet. Link yours under My shelves, or
                  check Profile privacy if friends set Sees me to friends only.
                </Text>
              ) : null}
              <Stack gap={MAPPED_LIST_STACK_GAP}>
                {communityEntries.map((entry) => (
                  <CommunityReaderCard key={entry.user.id} entry={entry} />
                ))}
              </Stack>
            </Stack>
          )}
        </Tabs.Content>

        <Tabs.Content value="mine" pt={4}>
          <Stack gap={4}>
            <Stack gap={3} {...PANEL_ENTRY_CARD_PROPS}>
              <Text fontWeight="medium">Goodreads profile</Text>
              <Input
                value={profileUrl}
                onChange={(e) => setProfileUrl(e.target.value)}
                placeholder="https://www.goodreads.com/user/show/12345678"
                aria-label="Goodreads profile URL"
              />
              <HStack gap={2} flexWrap="wrap">
                <PondButton
                  size="sm"
                  onClick={() => void onLink()}
                  disabled={mineBusy || !profileUrl.trim()}
                >
                  {savedId ? "Update & load" : "Link & load"}
                </PondButton>
                {savedId ? (
                  <>
                    <PondButton
                      size="sm"
                      variant="outline"
                      onClick={() => void onRefreshMine()}
                      disabled={mineBusy}
                    >
                      Refresh
                    </PondButton>
                    <PondButton
                      size="sm"
                      variant="outline"
                      onClick={() => void onUnlink()}
                      disabled={mineBusy}
                    >
                      Unlink
                    </PondButton>
                  </>
                ) : null}
              </HStack>
              {savedId ? (
                <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                  Linked as user {savedId}.{" "}
                  <a
                    href={`https://www.goodreads.com/user/show/${savedId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open on Goodreads
                  </a>
                </Text>
              ) : null}
              {mineError ? (
                <Text color="red.500" fontSize={APP_TEXT_SIZES.helper}>
                  {mineError}
                </Text>
              ) : null}
            </Stack>

            {mineBusy && !shelves.length ? (
              <Text color="fg.muted">Loading shelves from Goodreads…</Text>
            ) : null}

            {shelves.length > 0 ? (
              <Tabs.Root
                {...APP_SHELL_TABS_ROOT_PROPS}
                value={activeShelf}
                lazyMount
                unmountOnExit
                onValueChange={(details) => setActiveShelf(details.value)}
              >
                <Tabs.List {...APP_SHELL_TAB_LIST_INSET_PROPS}>
                  {shelves.map((shelf) => (
                    <Tabs.Trigger
                      key={shelf.slug}
                      value={shelf.slug}
                      {...APP_SHELL_TAB_TRIGGER_PROPS}
                    >
                      {shelf.label}
                      {shelf.book_count ? ` (${shelf.book_count})` : ""}
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>
                {shelves.map((shelf) => (
                  <Tabs.Content key={shelf.slug} value={shelf.slug} pt={4}>
                    <ShelfPanel shelf={shelf} />
                  </Tabs.Content>
                ))}
              </Tabs.Root>
            ) : null}

            {!mineBusy && mineLoaded && savedId && shelves.length === 0 && !mineError ? (
              <Text color="fg.muted">
                No public shelves returned. Make sure your Goodreads profile is public.
              </Text>
            ) : null}
          </Stack>
        </Tabs.Content>
      </Tabs.Root>
    </Stack>
  );
}
