import { describe, expect, it } from "vitest";

import { currentlyReadingLine } from "./publicUser";

describe("currentlyReadingLine", () => {
  it("returns null when empty", () => {
    expect(currentlyReadingLine(undefined)).toBeNull();
    expect(currentlyReadingLine([])).toBeNull();
    expect(currentlyReadingLine([{ title: "  ", author_name: "X" }])).toBeNull();
  });

  it("formats quoted titles with authors", () => {
    expect(
      currentlyReadingLine([
        { title: "Joe Country", author_name: "Mick Herron" },
        { title: "Dune", author_name: "Frank Herbert" },
        { title: "Emma", author_name: "Jane Austen" },
      ]),
    ).toBe(
      'Currently Reading: "Joe Country" by Mick Herron, "Dune" by Frank Herbert, "Emma" by Jane Austen',
    );
  });

  it("omits by-author when author is blank", () => {
    expect(currentlyReadingLine([{ title: "Untitled", author_name: "" }])).toBe(
      'Currently Reading: "Untitled"',
    );
  });
});
