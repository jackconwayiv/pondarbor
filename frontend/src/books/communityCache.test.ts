import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearCommunitySnapshot,
  communityEntriesEqual,
  readCommunitySnapshot,
  writeCommunitySnapshot,
} from "./communityCache";
import type { BooksCommunityEntry, BooksReader } from "./types";

function reader(id: number, name: string): BooksReader {
  return {
    id,
    display_name: name,
    avatar_url: "",
    goodreads_user_id: String(id),
    profile_url: null,
  };
}

function entry(id: number, name: string): BooksCommunityEntry {
  return {
    user: reader(id, name),
    shelves: [
      {
        slug: "currently-reading",
        label: "Currently Reading",
        book_count: 0,
        books: [],
        error: null,
      },
    ],
  };
}

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const memory = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: memory,
    configurable: true,
    writable: true,
  });
  return memory;
}

beforeEach(() => {
  installMemoryLocalStorage();
});

afterEach(() => {
  localStorage.clear();
});

describe("communityCache", () => {
  it("round-trips a snapshot", () => {
    const results = [entry(1, "Ada")];
    writeCommunitySnapshot(7, results);
    const snap = readCommunitySnapshot(7);
    expect(snap).not.toBeNull();
    expect(snap?.results).toEqual(results);
    expect(typeof snap?.savedAt).toBe("number");
  });

  it("returns null for missing or corrupt data", () => {
    expect(readCommunitySnapshot(9)).toBeNull();
    localStorage.setItem("pondarbor:books:community:v1:9", "{not-json");
    expect(readCommunitySnapshot(9)).toBeNull();
    localStorage.setItem(
      "pondarbor:books:community:v1:9",
      JSON.stringify({ savedAt: 1, results: [{ nope: true }] }),
    );
    expect(readCommunitySnapshot(9)).toBeNull();
  });

  it("clears a snapshot", () => {
    writeCommunitySnapshot(3, [entry(1, "Ada")]);
    clearCommunitySnapshot(3);
    expect(readCommunitySnapshot(3)).toBeNull();
  });

  it("compares community entries by JSON", () => {
    const a = [entry(1, "Ada")];
    const b = [entry(1, "Ada")];
    const c = [entry(2, "Zoe")];
    expect(communityEntriesEqual(a, b)).toBe(true);
    expect(communityEntriesEqual(a, c)).toBe(false);
  });
});
