import type {
  BooksCommunityEntry,
  BooksReader,
  CommunityShelfSlug,
  GoodreadsBook,
} from "./types";

export const COMMUNITY_SHELF_SLUGS: CommunityShelfSlug[] = [
  "currently-reading",
  "to-read",
  "did-not-finish",
  "read",
];

export const COMMUNITY_SHELF_OPTIONS: {
  value: CommunityShelfSlug;
  label: string;
  shortLabel: string;
}[] = [
  { value: "currently-reading", label: "Currently Reading", shortLabel: "Reading" },
  { value: "to-read", label: "Want to Read", shortLabel: "To Read" },
  { value: "did-not-finish", label: "Did Not Finish", shortLabel: "DNF" },
  { value: "read", label: "Read", shortLabel: "Finished" },
];

export type BooksListTab = CommunityShelfSlug | "matches";

export const BOOKS_TAB_OPTIONS: {
  value: BooksListTab;
  label: string;
  shortLabel: string;
}[] = [
  ...COMMUNITY_SHELF_OPTIONS,
  { value: "matches", label: "Matches", shortLabel: "Shared" },
];

export function isCommunityShelfSlug(value: string): value is CommunityShelfSlug {
  return (COMMUNITY_SHELF_SLUGS as string[]).includes(value);
}

export function shelfOptionLabel(slug: CommunityShelfSlug): string {
  return COMMUNITY_SHELF_OPTIONS.find((opt) => opt.value === slug)?.label ?? slug;
}

export const BOOKS_PAGE_SIZE = 8;
export const BOOKS_PAGE_SIZE_DESKTOP = 10;

export type BooksListSort = "user" | "title" | "date";

export type CommunityBookRow = {
  book: GoodreadsBook;
  owner: BooksReader;
};

export type WorkPlacement = {
  reader: BooksReader;
  book: GoodreadsBook;
  shelf: CommunityShelfSlug;
};

export type CommunityWorkRow = {
  key: string;
  shelf: CommunityShelfSlug;
  book: GoodreadsBook;
  collapsed: boolean;
  byShelf: Record<CommunityShelfSlug, WorkPlacement[]>;
  groupReaders: BooksReader[];
};

export type MatchSection = {
  id: string;
  title: string;
  rows: CommunityWorkRow[];
};

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

/** Calendar date only (no time/zone). Sortable key plus MM/YY month label. */
export function formatBookDateMdY(
  raw: string | undefined,
): { key: string; monthKey: string; monthLabel: string } | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const [, year, month] = iso;
    return {
      key: `${year}-${month}-${iso[3]}`,
      monthKey: `${year}-${month}`,
      monthLabel: `${month}/${year.slice(-2)}`,
    };
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
  return {
    key: `${year}-${month}-${day}`,
    monthKey: `${year}-${month}`,
    monthLabel: `${month}/${year.slice(-2)}`,
  };
}

export function formatReadLabel(book: GoodreadsBook): string | null {
  const finish = formatBookDateMdY(book.user_read_at);
  if (!finish) return null;
  const start =
    formatBookDateMdY(book.user_started_at) ?? formatBookDateMdY(book.user_date_added);
  if (start && start.monthKey !== finish.monthKey) {
    const [earlier, later] =
      start.monthKey < finish.monthKey ? [start, finish] : [finish, start];
    return `Read ${earlier.monthLabel} - ${later.monthLabel}`;
  }
  return `Read ${finish.monthLabel}`;
}

export function bookDateSortKey(book: GoodreadsBook): string | null {
  return (
    formatBookDateMdY(book.user_read_at)?.key ??
    formatBookDateMdY(book.user_started_at)?.key ??
    formatBookDateMdY(book.user_date_added)?.key ??
    null
  );
}

function compareIgnoreCase(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function compareTitleThenOwner(a: CommunityBookRow, b: CommunityBookRow): number {
  const byTitle = compareIgnoreCase(a.book.title, b.book.title);
  if (byTitle !== 0) return byTitle;
  return compareIgnoreCase(a.owner.display_name, b.owner.display_name);
}

export function viewerShelfError(
  results: BooksCommunityEntry[],
  shelf: CommunityShelfSlug,
  viewerUserId: number | undefined,
): string | null {
  if (viewerUserId == null) return null;
  const entry = results.find((row) => row.user.id === viewerUserId);
  const shelfRow = entry?.shelves.find((item) => item.slug === shelf);
  return shelfRow?.error ?? null;
}

export function communityPeople(results: BooksCommunityEntry[]): BooksReader[] {
  return [...results]
    .map((entry) => entry.user)
    .sort((a, b) => compareIgnoreCase(a.display_name, b.display_name));
}

export function blendedBooksForShelf(
  results: BooksCommunityEntry[],
  shelf: CommunityShelfSlug,
): CommunityBookRow[] {
  const rows: CommunityBookRow[] = [];
  for (const entry of results) {
    const shelfRow = entry.shelves.find((item) => item.slug === shelf);
    if (!shelfRow || shelfRow.error) continue;
    for (const book of shelfRow.books) {
      rows.push({ book, owner: entry.user });
    }
  }
  return rows;
}

export function filterBooksByOwners(
  rows: CommunityBookRow[],
  checkedUserIds: readonly number[],
): CommunityBookRow[] {
  if (checkedUserIds.length === 0) return [];
  const allowed = new Set(checkedUserIds);
  return rows.filter((row) => allowed.has(row.owner.id));
}

export function sortCommunityBooks(
  rows: CommunityBookRow[],
  sort: BooksListSort,
): CommunityBookRow[] {
  const copy = [...rows];
  if (sort === "user") {
    copy.sort((a, b) => {
      const byOwner = compareIgnoreCase(a.owner.display_name, b.owner.display_name);
      if (byOwner !== 0) return byOwner;
      return compareIgnoreCase(a.book.title, b.book.title);
    });
    return copy;
  }
  if (sort === "date") {
    copy.sort((a, b) => {
      const ka = bookDateSortKey(a.book);
      const kb = bookDateSortKey(b.book);
      if (ka == null && kb == null) return compareTitleThenOwner(a, b);
      if (ka == null) return 1;
      if (kb == null) return -1;
      if (ka !== kb) return kb.localeCompare(ka);
      return compareTitleThenOwner(a, b);
    });
    return copy;
  }
  copy.sort(compareTitleThenOwner);
  return copy;
}

export function visibleCommunityBooks(
  results: BooksCommunityEntry[],
  shelf: CommunityShelfSlug,
  checkedUserIds: readonly number[],
  sort: BooksListSort,
): CommunityBookRow[] {
  return sortCommunityBooks(
    filterBooksByOwners(blendedBooksForShelf(results, shelf), checkedUserIds),
    sort,
  );
}

export function booksPageCount(total: number, pageSize: number = BOOKS_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function paginateBooks(
  rows: CommunityBookRow[],
  page: number,
  pageSize: number = BOOKS_PAGE_SIZE,
): CommunityBookRow[] {
  return paginateList(rows, page, pageSize);
}

export function paginateList<T>(
  rows: readonly T[],
  page: number,
  pageSize: number = BOOKS_PAGE_SIZE,
): T[] {
  if (!rows.length) return [];
  const totalPages = booksPageCount(rows.length, pageSize);
  const safe = Math.min(Math.max(1, page), totalPages);
  const start = (safe - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export function bookWorkKey(book: GoodreadsBook): string {
  const id = (book.book_id ?? "").trim();
  if (id) return `id:${id}`;
  const isbn = (book.isbn ?? "").trim();
  if (isbn) return `isbn:${isbn}`;
  const title = book.title.trim().toLowerCase();
  const author = book.author_name.trim().toLowerCase();
  return `ta:${title}|${author}`;
}

function emptyByShelf(): Record<CommunityShelfSlug, WorkPlacement[]> {
  return {
    "currently-reading": [],
    "to-read": [],
    "did-not-finish": [],
    read: [],
  };
}

function uniqueReaders(placements: readonly WorkPlacement[]): BooksReader[] {
  const seen = new Set<number>();
  const out: BooksReader[] = [];
  const sorted = [...placements].sort((a, b) =>
    compareIgnoreCase(a.reader.display_name, b.reader.display_name),
  );
  for (const row of sorted) {
    if (seen.has(row.reader.id)) continue;
    seen.add(row.reader.id);
    out.push(row.reader);
  }
  return out;
}

function sortPlacements(placements: WorkPlacement[]): WorkPlacement[] {
  return [...placements].sort((a, b) => {
    const byName = compareIgnoreCase(a.reader.display_name, b.reader.display_name);
    if (byName !== 0) return byName;
    return compareIgnoreCase(a.book.title, b.book.title);
  });
}

export function indexCommunityWorks(
  results: BooksCommunityEntry[],
  checkedUserIds: readonly number[],
): Map<string, WorkPlacement[]> {
  const byKey = new Map<string, WorkPlacement[]>();
  if (checkedUserIds.length === 0) return byKey;
  const allowed = new Set(checkedUserIds);
  for (const entry of results) {
    if (!allowed.has(entry.user.id)) continue;
    for (const shelfRow of entry.shelves) {
      if (shelfRow.error) continue;
      if (!isCommunityShelfSlug(shelfRow.slug)) continue;
      for (const book of shelfRow.books) {
        const key = bookWorkKey(book);
        const list = byKey.get(key) ?? [];
        list.push({ reader: entry.user, book, shelf: shelfRow.slug });
        byKey.set(key, list);
      }
    }
  }
  return byKey;
}

function workRowFromPlacements(
  key: string,
  shelf: CommunityShelfSlug,
  allPlacements: WorkPlacement[],
): CommunityWorkRow | null {
  const byShelf = emptyByShelf();
  for (const row of allPlacements) {
    byShelf[row.shelf].push(row);
  }
  for (const slug of COMMUNITY_SHELF_SLUGS) {
    byShelf[slug] = sortPlacements(byShelf[slug]);
  }
  const onShelf = byShelf[shelf];
  if (onShelf.length === 0) return null;
  const uniqueOnShelf = uniqueReaders(onShelf);
  return {
    key,
    shelf,
    book: onShelf[0]!.book,
    collapsed: uniqueOnShelf.length >= 2,
    byShelf,
    groupReaders: uniqueReaders(allPlacements),
  };
}

function compareWorkRows(a: CommunityWorkRow, b: CommunityWorkRow, sort: BooksListSort): number {
  if (sort === "user") {
    const aName = uniqueReaders(a.byShelf[a.shelf])[0]?.display_name ?? "";
    const bName = uniqueReaders(b.byShelf[b.shelf])[0]?.display_name ?? "";
    const byOwner = compareIgnoreCase(aName, bName);
    if (byOwner !== 0) return byOwner;
    return compareIgnoreCase(a.book.title, b.book.title);
  }
  if (sort === "date") {
    const dates = (row: CommunityWorkRow) =>
      row.byShelf[row.shelf]
        .map((p) => bookDateSortKey(p.book))
        .filter((k): k is string => k != null)
        .sort()
        .at(-1);
    const ka = dates(a);
    const kb = dates(b);
    if (ka == null && kb == null) return compareIgnoreCase(a.book.title, b.book.title);
    if (ka == null) return 1;
    if (kb == null) return -1;
    if (ka !== kb) return kb.localeCompare(ka);
    return compareIgnoreCase(a.book.title, b.book.title);
  }
  return compareIgnoreCase(a.book.title, b.book.title);
}

export function collapsedRowsForShelf(
  indexed: Map<string, WorkPlacement[]>,
  shelf: CommunityShelfSlug,
  sort: BooksListSort,
): CommunityWorkRow[] {
  const rows: CommunityWorkRow[] = [];
  for (const [key, placements] of indexed) {
    const row = workRowFromPlacements(key, shelf, placements);
    if (row) rows.push(row);
  }
  rows.sort((a, b) => compareWorkRows(a, b, sort));
  return rows;
}

export function visibleWorksForShelf(
  results: BooksCommunityEntry[],
  shelf: CommunityShelfSlug,
  checkedUserIds: readonly number[],
  sort: BooksListSort,
): CommunityWorkRow[] {
  return collapsedRowsForShelf(indexCommunityWorks(results, checkedUserIds), shelf, sort);
}

function viewerHasShelf(
  placements: WorkPlacement[],
  viewerUserId: number,
  shelf: CommunityShelfSlug,
): boolean {
  return placements.some((p) => p.reader.id === viewerUserId && p.shelf === shelf);
}

function othersHaveShelf(
  placements: WorkPlacement[],
  viewerUserId: number,
  shelf: CommunityShelfSlug,
): boolean {
  return placements.some((p) => p.reader.id !== viewerUserId && p.shelf === shelf);
}

export function matchSectionsForViewer(
  results: BooksCommunityEntry[],
  checkedUserIds: readonly number[],
  viewerUserId: number | undefined,
  sort: BooksListSort,
): MatchSection[] {
  const indexed = indexCommunityWorks(results, checkedUserIds);
  const sameShelf: MatchSection[] = COMMUNITY_SHELF_OPTIONS.map((opt) => ({
    id: `same-${opt.value}`,
    title: `${opt.label} together`,
    rows: collapsedRowsForShelf(indexed, opt.value, sort).filter((row) => row.collapsed),
  }));

  const withYou: MatchSection[] = [];
  if (viewerUserId != null && checkedUserIds.includes(viewerUserId)) {
    const cross: { id: string; title: string; you: CommunityShelfSlug; they: CommunityShelfSlug }[] =
      [
        {
          id: "you-reading-they-finished",
          title: "You're reading — they finished",
          you: "currently-reading",
          they: "read",
        },
        {
          id: "you-reading-they-dnf",
          title: "You're reading — they DNF",
          you: "currently-reading",
          they: "did-not-finish",
        },
        {
          id: "you-reading-they-want",
          title: "You're reading — they want to read",
          you: "currently-reading",
          they: "to-read",
        },
        {
          id: "you-want-they-finished",
          title: "You want to read — they finished",
          you: "to-read",
          they: "read",
        },
        {
          id: "you-finished-they-want",
          title: "You finished — they want to read",
          you: "read",
          they: "to-read",
        },
      ];
    for (const spec of cross) {
      const rows: CommunityWorkRow[] = [];
      for (const [key, placements] of indexed) {
        if (!viewerHasShelf(placements, viewerUserId, spec.you)) continue;
        if (!othersHaveShelf(placements, viewerUserId, spec.they)) continue;
        const row = workRowFromPlacements(key, spec.you, placements);
        if (row) rows.push(row);
      }
      rows.sort((a, b) => compareWorkRows(a, b, sort));
      withYou.push({ id: spec.id, title: spec.title, rows });
    }
  }

  return [...sameShelf, ...withYou].filter((section) => section.rows.length > 0);
}
