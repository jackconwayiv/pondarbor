import {
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
  fetchBooksShelves,
  linkGoodreadsProfile,
  unlinkGoodreadsProfile,
} from "./api";
import type { GoodreadsBook, GoodreadsShelf } from "./types";

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
        <Box
          w="56px"
          h="84px"
          bg="blackAlpha.100"
          borderRadius="sm"
          flexShrink={0}
        />
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
        No books on this shelf (or the shelf is empty in the public RSS feed, which
        only includes up to about 100 recent titles).
      </Text>
    );
  }
  return (
    <Stack gap={MAPPED_LIST_STACK_GAP}>
      {shelf.books.map((book) => (
        <BookRow key={`${shelf.slug}-${book.book_id || book.title}-${book.link}`} book={book} />
      ))}
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

  const savedId = (sessionUser?.profile.goodreads_user_id ?? "").trim();
  const [profileUrl, setProfileUrl] = useState(
    savedId ? `https://www.goodreads.com/user/show/${savedId}` : "",
  );
  const [shelves, setShelves] = useState<GoodreadsShelf[]>([]);
  const [activeShelf, setActiveShelf] = useState<string>("currently-reading");
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

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
      setLoaded(true);
    },
    [getApiAccessToken],
  );

  useEffect(() => {
    if (isLoading || sessionError || !savedId || loaded) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      setPageError(null);
      try {
        await loadShelves();
      } catch (e) {
        if (!cancelled) {
          setPageError(e instanceof Error ? e.message : "Could not load shelves.");
          setLoaded(true);
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoading, sessionError, savedId, loaded, loadShelves]);

  const onLink = async () => {
    setBusy(true);
    setPageError(null);
    try {
      const token = await getApiAccessToken();
      const data = await linkGoodreadsProfile(token, profileUrl.trim());
      applySession(data.session as SessionUser | undefined);
      setShelves(data.shelves);
      setActiveShelf(data.shelves[0]?.slug ?? "currently-reading");
      setLoaded(true);
      if (data.goodreads_user_id) {
        setProfileUrl(`https://www.goodreads.com/user/show/${data.goodreads_user_id}`);
      }
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Could not link profile.");
    } finally {
      setBusy(false);
    }
  };

  const onUnlink = async () => {
    setBusy(true);
    setPageError(null);
    try {
      const token = await getApiAccessToken();
      const data = await unlinkGoodreadsProfile(token);
      applySession(data.session as SessionUser | undefined);
      setShelves([]);
      setLoaded(false);
      setProfileUrl("");
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Could not unlink profile.");
    } finally {
      setBusy(false);
    }
  };

  const onRefresh = async () => {
    setBusy(true);
    setPageError(null);
    try {
      await loadShelves({ refresh: true });
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Could not refresh shelves.");
    } finally {
      setBusy(false);
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
          Paste your public Goodreads profile share link. We save it on your account and
          load every shelf available from Goodreads&apos; public RSS feeds (about 100
          recent books per shelf).
        </Text>
      </Stack>

      <Stack gap={3} {...PANEL_ENTRY_CARD_PROPS}>
        <Text fontWeight="medium">Goodreads profile</Text>
        <Input
          value={profileUrl}
          onChange={(e) => setProfileUrl(e.target.value)}
          placeholder="https://www.goodreads.com/user/show/12345678"
          aria-label="Goodreads profile URL"
        />
        <HStack gap={2} flexWrap="wrap">
          <PondButton size="sm" onClick={() => void onLink()} disabled={busy || !profileUrl.trim()}>
            {savedId ? "Update & load" : "Link & load"}
          </PondButton>
          {savedId ? (
            <>
              <PondButton size="sm" variant="outline" onClick={() => void onRefresh()} disabled={busy}>
                Refresh
              </PondButton>
              <PondButton size="sm" variant="outline" onClick={() => void onUnlink()} disabled={busy}>
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
        {pageError ? (
          <Text color="red.500" fontSize={APP_TEXT_SIZES.helper}>
            {pageError}
          </Text>
        ) : null}
      </Stack>

      {busy && !shelves.length ? (
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
              <Tabs.Trigger key={shelf.slug} value={shelf.slug} {...APP_SHELL_TAB_TRIGGER_PROPS}>
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

      {!busy && loaded && savedId && shelves.length === 0 && !pageError ? (
        <Text color="fg.muted">
          No public shelves returned. Make sure your Goodreads profile is public.
        </Text>
      ) : null}
    </Stack>
  );
}
