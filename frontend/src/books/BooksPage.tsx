import {
  Avatar,
  Box,
  Heading,
  HStack,
  Image,
  Input,
  Link,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router";

import { useAppSession, type SessionUser } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { AppModal } from "../components/AppModal";
import {
  PanelEmptyState,
  PanelErrorState,
  PanelListRowSkeleton,
  PanelSessionReconnect,
  SessionLoadingCard,
} from "../components/panelStatus";
import FriendProfileLink from "../friend/FriendProfileLink";
import { friendProfilePath } from "../friend/profilePaths";
import { APP_PANEL_PAGE_MIN_HEIGHT_PROPS, fullBleedStackProps } from "../responsive";
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
  PANEL_NESTED_BLOCK_PROPS,
} from "../theme/typography";
import {
  fetchBooksCommunity,
  linkGoodreadsProfile,
  unlinkGoodreadsProfile,
} from "./api";
import type {
  BooksCommunityEntry,
  CommunityShelfSlug,
  GoodreadsBook,
} from "./types";

const COMMUNITY_SHELF_OPTIONS: { value: CommunityShelfSlug; label: string }[] = [
  { value: "currently-reading", label: "Currently Reading" },
  { value: "read", label: "Read" },
  { value: "to-read", label: "Want to Read" },
];

const MAPPED_CARD_PROPS = {
  bg: "bg.panel",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "xl",
  w: "100%",
  minW: 0,
  ...MAPPED_LIST_CARD_OUTER_PROPS,
} as const;

const BOOK_CARD_GRID_PROPS = {
  columns: { base: 1, md: 2 },
  gap: "2",
  w: "100%",
  alignItems: "start",
} as const;

function shelfLabelFromSlug(slug: string): string {
  const known = COMMUNITY_SHELF_OPTIONS.find((opt) => opt.value === slug);
  if (known) return known.label;
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const MONTH_ABBR_TO_NUM: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

function pad2(value: number | string): string {
  return String(value).padStart(2, "0");
}

/** Calendar date only (no time/zone). Returns sortable key + MM/DD/YY label. */
function formatBookDateMdY(raw: string | undefined): { key: string; label: string } | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const [, year, month, day] = iso;
    return { key: `${year}-${month}-${day}`, label: `${month}/${day}/${year.slice(-2)}` };
  }
  const rfc =
    /(?:\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+)?(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{4})/i.exec(
      s,
    );
  if (!rfc) return null;
  const day = pad2(rfc[1]);
  const month = MONTH_ABBR_TO_NUM[rfc[2].slice(0, 3).toLowerCase()];
  const year = rfc[3];
  if (!month) return null;
  return { key: `${year}-${month}-${day}`, label: `${month}/${day}/${year.slice(-2)}` };
}

function formatReadLabel(book: GoodreadsBook): string | null {
  const finish = formatBookDateMdY(book.user_read_at);
  if (!finish) return null;
  const start =
    formatBookDateMdY(book.user_started_at) ?? formatBookDateMdY(book.user_date_added);
  if (start && start.key !== finish.key) {
    const [earlier, later] = start.key < finish.key ? [start, finish] : [finish, start];
    return `Read ${earlier.label} - ${later.label}`;
  }
  return `Read ${finish.label}`;
}

function stars(rating: number): string {
  if (!rating || rating < 1) return "";
  const n = Math.min(5, Math.max(0, Math.round(rating)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function BookRow({
  book,
  nested = false,
  ownerName,
  ownerUserId,
  ownerAvatarUrl,
  shelfLabel,
}: {
  book: GoodreadsBook;
  nested?: boolean;
  ownerName: string;
  ownerUserId?: number;
  ownerAvatarUrl?: string;
  shelfLabel: string;
}) {
  const cover = (book.book_large_image_url || book.book_image_url).trim();
  const rating = stars(book.user_rating);
  const readLabel = formatReadLabel(book);
  const title = book.link ? (
    <Link href={book.link} target="_blank" rel="noreferrer">
      {book.title}
    </Link>
  ) : (
    book.title
  );
  const ownerAvatar = (
    <Avatar.Root size="xs" flexShrink={0}>
      {ownerAvatarUrl ? <Avatar.Image src={ownerAvatarUrl} alt="" /> : null}
      <Avatar.Fallback name={ownerName} />
    </Avatar.Root>
  );
  const ownerBlock =
    ownerUserId != null ? (
      <Box flexShrink={0} title={ownerName} aria-label={ownerName}>
        <FriendProfileLink userId={ownerUserId}>{ownerAvatar}</FriendProfileLink>
      </Box>
    ) : (
      <Box flexShrink={0} title={ownerName} aria-label={ownerName}>
        {ownerAvatar}
      </Box>
    );
  const row = (
    <HStack align="start" gap="2" w="100%">
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
      <Stack gap="1" minW={0} flex="1">
        <HStack align="start" justify="space-between" gap="2" w="100%">
          <Text fontWeight="semibold" lineClamp={2} minW={0} flex="1">
            {title}
          </Text>
          {ownerBlock}
        </HStack>
        <HStack align="start" justify="space-between" gap="2" w="100%">
          <Text
            color="fg.muted"
            fontSize={APP_TEXT_SIZES.helper}
            lineClamp={1}
            minW={0}
            flex="1"
          >
            {book.author_name || "\u00a0"}
          </Text>
          <Text
            color="fg.muted"
            fontSize={APP_TEXT_SIZES.helper}
            fontStyle="italic"
            lineClamp={1}
            flexShrink={0}
            textAlign="right"
            maxW="48%"
          >
            {shelfLabel}
          </Text>
        </HStack>
        <HStack gap="2" flexWrap="wrap" color="fg.muted" fontSize={APP_TEXT_SIZES.helper}>
          {rating ? <Text aria-label={`${book.user_rating} stars`}>{rating}</Text> : null}
          {readLabel ? <Text>{readLabel}</Text> : null}
          {book.book_published ? <Text>{book.book_published}</Text> : null}
        </HStack>
      </Stack>
    </HStack>
  );
  if (nested) {
    return (
      <Box w="100%" minW={0} {...PANEL_NESTED_BLOCK_PROPS}>
        {row}
      </Box>
    );
  }
  return <Box {...MAPPED_CARD_PROPS}>{row}</Box>;
}

function CommunityReaderCard({ entry }: { entry: BooksCommunityEntry }) {
  return (
    <Box {...MAPPED_CARD_PROPS}>
      <Stack gap="2">
        <HStack gap="2" justify="space-between" flexWrap="wrap">
          <HStack gap="2" minW={0}>
            <FriendProfileLink userId={entry.user.id}>
              <Avatar.Root size="sm">
                {entry.user.avatar_url ? (
                  <Avatar.Image src={entry.user.avatar_url} alt="" />
                ) : null}
                <Avatar.Fallback name={entry.user.display_name} />
              </Avatar.Root>
            </FriendProfileLink>
            <Stack gap="0" minW={0}>
              <Text fontWeight="semibold" asChild>
                <RouterLink to={friendProfilePath(entry.user.id)}>
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
            <Link
              href={entry.user.profile_url}
              target="_blank"
              rel="noreferrer"
              fontSize={APP_TEXT_SIZES.helper}
            >
              Goodreads
            </Link>
          ) : null}
        </HStack>
        {entry.error ? (
          <Text color="nautical.solid" fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" role="alert">
            Could not load this shelf right now.
          </Text>
        ) : null}
        {entry.books.length ? (
          <Stack gap={MAPPED_LIST_STACK_GAP}>
            <SimpleGrid {...BOOK_CARD_GRID_PROPS}>
              {entry.books.slice(0, 8).map((book) => (
                <BookRow
                  key={`${entry.user.id}-${book.book_id || book.title}-${book.link}`}
                  book={book}
                  nested
                  ownerName={entry.user.display_name}
                  ownerUserId={entry.user.id}
                  ownerAvatarUrl={entry.user.avatar_url}
                  shelfLabel={shelfLabelFromSlug(entry.shelf)}
                />
              ))}
            </SimpleGrid>
            {entry.books.length > 8 ? (
              <Text color="fg.muted" fontSize={APP_TEXT_SIZES.helper}>
                +{entry.books.length - 8} more
              </Text>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
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
  } = useAppSession();

  const isApproved = Boolean(sessionUser?.user.is_approved);
  const savedId = (sessionUser?.profile.goodreads_user_id ?? "").trim();

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [profileUrl, setProfileUrl] = useState(
    savedId ? `https://www.goodreads.com/user/show/${savedId}` : "",
  );
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

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
      setCommunityLoaded(false);
      setLinkModalOpen(false);
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "Could not unlink profile.");
    } finally {
      setLinkBusy(false);
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

  const headingBusy = communityBusy && !communityEntries.length;
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
            pb="2"
          >
            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Heading as="h1" size={{ base: "lg", md: "xl" }} mb="2">
                <HStack as="span" display="inline-flex" gap="2" alignItems="center" flexWrap="wrap">
                  <Text as="span" aria-hidden="true">
                    📚
                  </Text>
                  <Text as="span">Books</Text>
                  {headingBusy ? (
                    <Text
                      as="span"
                      fontSize={APP_TEXT_SIZES.helper}
                      color="fg.muted"
                      fontWeight="medium"
                      aria-live="polite"
                    >
                      Loading…
                    </Text>
                  ) : null}
                </HStack>
              </Heading>
              <Text fontSize={APP_TEXT_SIZES.body} lineHeight="tall" color="fg">
                See what your friends are reading!
              </Text>
            </Box>
          </Stack>

          <Tabs.Root
            value={communityShelf}
            variant="plain"
            onValueChange={(details) =>
              void onChangeCommunityShelf(details.value as CommunityShelfSlug)
            }
          >
            <HStack {...APP_SHELL_TAB_LIST_PROPS} justify="space-between" align="center">
              <Tabs.List
                gap="2"
                flexWrap="wrap"
                alignItems="center"
                borderBottomWidth="0"
                bg="transparent"
                px="0"
                py="0"
                w="auto"
              >
                {COMMUNITY_SHELF_OPTIONS.map((opt) => (
                  <Tabs.Trigger key={opt.value} value={opt.value} {...APP_SHELL_TAB_TRIGGER_PROPS}>
                    {opt.label}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
              <HStack gap="2" flexShrink={0} flexWrap="wrap">
                <PondButton
                  size="sm"
                  colorPalette={savedId ? "sky" : "lilypad"}
                  variant={savedId ? "outline" : "solid"}
                  onClick={openLinkModal}
                >
                  {linkButtonLabel}
                </PondButton>
                <PondButton
                  size="sm"
                  colorPalette="sky"
                  variant="outline"
                  onClick={() => void onRefreshCommunity()}
                  loading={communityBusy}
                  disabled={communityBusy || !isApproved}
                >
                  Refresh
                </PondButton>
              </HStack>
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
                    onAction={() => void onRefreshCommunity()}
                  />
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
                <Stack gap={MAPPED_LIST_STACK_GAP}>
                  {communityEntries.map((entry) => (
                    <CommunityReaderCard key={entry.user.id} entry={entry} />
                  ))}
                </Stack>
              </Stack>
            )}
          </Box>
        </Box>
      </Box>

      <AppModal
        open={linkModalOpen}
        onOpenChange={(open) => {
          if (!open && linkBusy) return;
          setLinkModalOpen(open);
        }}
        title={linkButtonLabel}
        description="Paste your public Goodreads profile URL. Keep updating books on Goodreads after you link."
        size="md"
      >
        <Stack gap="2">
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
