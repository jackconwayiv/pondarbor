import { describe, expect, it } from "vitest";

import {
  bookWorkKey,
  blendedBooksForShelf,
  BOOKS_PAGE_SIZE,
  BOOKS_PAGE_SIZE_DESKTOP,
  communityPeople,
  filterBooksByOwners,
  formatReadLabel,
  matchSectionsForViewer,
  paginateBooks,
  sortCommunityBooks,
  viewerShelfError,
  visibleWorksForShelf,
} from "./communityView";
import type { BooksCommunityEntry, BooksReader, GoodreadsBook } from "./types";

function reader(id: number, name: string): BooksReader {
  return {
    id,
    display_name: name,
    avatar_url: "",
    goodreads_user_id: String(id),
    profile_url: null,
  };
}

function book(
  title: string,
  dates?: { read?: string; started?: string; added?: string },
): GoodreadsBook {
  return {
    title,
    author_name: "Author",
    book_id: title,
    isbn: "",
    link: "",
    book_image_url: "",
    book_large_image_url: "",
    num_pages: "",
    user_rating: 0,
    user_read_at: dates?.read ?? "",
    user_started_at: dates?.started,
    user_date_added: dates?.added ?? "",
    average_rating: "",
    book_published: "",
    user_review: "",
  };
}

function emptyShelves(
  overrides: Partial<Record<string, { books?: GoodreadsBook[]; error?: string | null }>>,
): BooksCommunityEntry["shelves"] {
  const slugs = ["currently-reading", "to-read", "did-not-finish", "read"] as const;
  return slugs.map((slug) => ({
    slug,
    label: slug,
    book_count: overrides[slug]?.books?.length ?? 0,
    books: overrides[slug]?.books ?? [],
    error: overrides[slug]?.error ?? null,
  }));
}

describe("blendedBooksForShelf", () => {
  it("merges books from every loaded shelf", () => {
    const results: BooksCommunityEntry[] = [
      {
        user: reader(2, "Zoe"),
        shelves: emptyShelves({
          "currently-reading": { books: [book("Dune"), book("Emma")] },
        }),
      },
      {
        user: reader(1, "Ada"),
        shelves: emptyShelves({
          "currently-reading": { books: [book("Dune")] },
        }),
      },
    ];
    const rows = blendedBooksForShelf(results, "currently-reading");
    expect(rows).toHaveLength(3);
    expect(sortCommunityBooks(rows, "title").map((r) => `${r.book.title}:${r.owner.display_name}`)).toEqual([
      "Dune:Ada",
      "Dune:Zoe",
      "Emma:Zoe",
    ]);
  });

  it("omits other readers whose shelf failed", () => {
    const results: BooksCommunityEntry[] = [
      {
        user: reader(1, "Me"),
        shelves: emptyShelves({
          read: { books: [book("Mine")] },
        }),
      },
      {
        user: reader(2, "Pat"),
        shelves: emptyShelves({
          read: { error: "private", books: [book("Hidden")] },
        }),
      },
    ];
    const rows = blendedBooksForShelf(results, "read");
    expect(rows.map((r) => r.book.title)).toEqual(["Mine"]);
  });
});

describe("viewerShelfError", () => {
  it("returns the viewer shelf error only", () => {
    const results: BooksCommunityEntry[] = [
      {
        user: reader(1, "Me"),
        shelves: emptyShelves({
          "to-read": { error: "Could not load" },
        }),
      },
    ];
    expect(viewerShelfError(results, "to-read", 1)).toBe("Could not load");
    expect(viewerShelfError(results, "read", 1)).toBeNull();
    expect(viewerShelfError(results, "to-read", 2)).toBeNull();
  });
});

describe("paginateBooks", () => {
  it("pages eight at a time", () => {
    const owner = reader(1, "Ada");
    const rows = Array.from({ length: BOOKS_PAGE_SIZE + 1 }, (_, i) => ({
      book: book(`Book ${String(i + 1).padStart(2, "0")}`),
      owner,
    }));
    expect(paginateBooks(rows, 1)).toHaveLength(BOOKS_PAGE_SIZE);
    expect(paginateBooks(rows, 2)).toHaveLength(1);
  });

  it("pages ten at a time when asked", () => {
    const owner = reader(1, "Ada");
    const rows = Array.from({ length: BOOKS_PAGE_SIZE_DESKTOP + 1 }, (_, i) => ({
      book: book(`Book ${String(i + 1).padStart(2, "0")}`),
      owner,
    }));
    expect(paginateBooks(rows, 1, BOOKS_PAGE_SIZE_DESKTOP)).toHaveLength(
      BOOKS_PAGE_SIZE_DESKTOP,
    );
    expect(paginateBooks(rows, 2, BOOKS_PAGE_SIZE_DESKTOP)).toHaveLength(1);
  });
});

describe("filterBooksByOwners", () => {
  it("returns none when nobody is checked", () => {
    const rows = [
      { book: book("Dune"), owner: reader(1, "Ada") },
      { book: book("Emma"), owner: reader(2, "Zoe") },
    ];
    expect(filterBooksByOwners(rows, [])).toEqual([]);
  });

  it("keeps only checked owners", () => {
    const rows = [
      { book: book("Dune"), owner: reader(1, "Ada") },
      { book: book("Emma"), owner: reader(2, "Zoe") },
    ];
    expect(filterBooksByOwners(rows, [2]).map((r) => r.book.title)).toEqual(["Emma"]);
  });
});

describe("sortCommunityBooks", () => {
  it("sorts by user then title", () => {
    const rows = [
      { book: book("Emma"), owner: reader(2, "Zoe") },
      { book: book("Dune"), owner: reader(1, "Ada") },
      { book: book("Ada"), owner: reader(2, "Zoe") },
    ];
    expect(
      sortCommunityBooks(rows, "user").map((r) => `${r.owner.display_name}:${r.book.title}`),
    ).toEqual(["Ada:Dune", "Zoe:Ada", "Zoe:Emma"]);
  });

  it("sorts by date newest first and missing dates last", () => {
    const rows = [
      { book: book("Old", { added: "2020-01-01" }), owner: reader(1, "Ada") },
      { book: book("No date"), owner: reader(1, "Ada") },
      { book: book("New", { read: "Thu, 6 Feb 2025 00:00:00 +0000" }), owner: reader(1, "Ada") },
    ];
    expect(sortCommunityBooks(rows, "date").map((r) => r.book.title)).toEqual([
      "New",
      "Old",
      "No date",
    ]);
  });
});

describe("formatReadLabel", () => {
  it("uses month/year and collapses the same month", () => {
    expect(
      formatReadLabel(
        book("A", {
          started: "2025-02-03",
          read: "Thu, 6 Feb 2025 00:00:00 +0000",
        }),
      ),
    ).toBe("Read 02/25");
  });

  it("shows a month range across different months", () => {
    expect(
      formatReadLabel(
        book("A", {
          started: "2025-01-15",
          read: "2025-03-02",
        }),
      ),
    ).toBe("Read 01/25 - 03/25");
  });
});

describe("communityPeople", () => {
  it("sorts readers by display name", () => {
    const results: BooksCommunityEntry[] = [
      { user: reader(2, "Zoe"), shelves: emptyShelves({}) },
      { user: reader(1, "Ada"), shelves: emptyShelves({}) },
    ];
    expect(communityPeople(results).map((u) => u.display_name)).toEqual(["Ada", "Zoe"]);
  });
});

describe("bookWorkKey", () => {
  it("prefers book_id then isbn then title and author", () => {
    expect(bookWorkKey(book("Dune"))).toBe("id:Dune");
    expect(
      bookWorkKey({
        ...book("Dune"),
        book_id: "",
        isbn: "9780441013593",
      }),
    ).toBe("isbn:9780441013593");
    expect(
      bookWorkKey({
        ...book("Dune"),
        book_id: "",
        isbn: "",
      }),
    ).toBe("ta:dune|author");
  });
});

describe("visibleWorksForShelf", () => {
  it("collapses two people on the same shelf into one row", () => {
    const results: BooksCommunityEntry[] = [
      {
        user: reader(2, "Zoe"),
        shelves: emptyShelves({
          "currently-reading": { books: [book("Dune"), book("Emma")] },
        }),
      },
      {
        user: reader(1, "Ada"),
        shelves: emptyShelves({
          "currently-reading": { books: [book("Dune")] },
        }),
      },
    ];
    const rows = visibleWorksForShelf(results, "currently-reading", [1, 2], "title");
    expect(rows.map((r) => `${r.book.title}:${r.collapsed}:${r.groupReaders.length}`)).toEqual([
      "Dune:true:2",
      "Emma:false:1",
    ]);
  });

  it("still lists a work on every shelf it appears on", () => {
    const dune = book("Dune");
    const results: BooksCommunityEntry[] = [
      {
        user: reader(1, "Ada"),
        shelves: emptyShelves({
          "currently-reading": { books: [dune] },
        }),
      },
      {
        user: reader(2, "Bob"),
        shelves: emptyShelves({
          read: { books: [book("Dune")] },
        }),
      },
    ];
    const reading = visibleWorksForShelf(results, "currently-reading", [1, 2], "title");
    const finished = visibleWorksForShelf(results, "read", [1, 2], "title");
    expect(reading).toHaveLength(1);
    expect(finished).toHaveLength(1);
    expect(reading[0]?.collapsed).toBe(false);
    expect(reading[0]?.groupReaders.map((r) => r.display_name)).toEqual(["Ada", "Bob"]);
    expect(finished[0]?.groupReaders.map((r) => r.display_name)).toEqual(["Ada", "Bob"]);
  });
});

describe("matchSectionsForViewer", () => {
  it("groups same-shelf overlaps and viewer cross-status", () => {
    const results: BooksCommunityEntry[] = [
      {
        user: reader(1, "Ada"),
        shelves: emptyShelves({
          "currently-reading": { books: [book("Dune")] },
          read: { books: [book("Emma")] },
        }),
      },
      {
        user: reader(2, "Zoe"),
        shelves: emptyShelves({
          "currently-reading": { books: [book("Dune")] },
          "to-read": { books: [book("Emma")] },
        }),
      },
    ];
    const sections = matchSectionsForViewer(results, [1, 2], 1, "title");
    expect(sections.map((s) => s.id)).toEqual([
      "same-currently-reading",
      "you-finished-they-want",
    ]);
    expect(sections[0]?.rows.map((r) => r.book.title)).toEqual(["Dune"]);
    expect(sections[1]?.rows.map((r) => r.book.title)).toEqual(["Emma"]);
  });
});
