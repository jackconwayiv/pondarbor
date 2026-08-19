import type {
  BooksCommunityEntry,
  BooksReader,
  CommunityShelfSlug,
  GoodreadsBook,
} from "./types";

export const COMMUNITY_SHELF_OPTIONS: { value: CommunityShelfSlug; label: string }[] = [
  { value: "currently-reading", label: "Currently Reading" },
  { value: "to-read", label: "Want to Read" },
  { value: "did-not-finish", label: "Did Not Finish" },
  { value: "read", label: "Read" },
];

export const BOOKS_PAGE_SIZE = 8;

export type BooksListSort = "title" | "person" | "date";

export type CommunityBookRow = {
  book: GoodreadsBook;
  owner: BooksReader;
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

/** Calendar date only (no time/zone). Returns sortable key + MM/DD/YY label. */
export function formatBookDateMdY(
  raw: string | undefined,
): { key: string; label: string } | null {
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
  if (sort === "person") {
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

export function booksPageCount(total: number): number {
  return Math.max(1, Math.ceil(total / BOOKS_PAGE_SIZE));
}

export function paginateBooks(
  rows: CommunityBookRow[],
  page: number,
): CommunityBookRow[] {
  if (!rows.length) return [];
  const totalPages = booksPageCount(rows.length);
  const safe = Math.min(Math.max(1, page), totalPages);
  const start = (safe - 1) * BOOKS_PAGE_SIZE;
  return rows.slice(start, start + BOOKS_PAGE_SIZE);
}
