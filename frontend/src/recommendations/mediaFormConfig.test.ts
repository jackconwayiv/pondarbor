import { describe, expect, it } from "vitest";
import {
  linksEntryCanSubmit,
  mediaEntryCanSubmit,
  resolveMediaTitleForSubmit,
} from "./mediaFormConfig";

describe("mediaFormConfig", () => {
  it("requires a valid URL and title for links", () => {
    expect(linksEntryCanSubmit({ title: "", link: "https://example.com" })).toBe(false);
    expect(linksEntryCanSubmit({ title: "Example", link: "" })).toBe(false);
    expect(linksEntryCanSubmit({ title: "Example", link: "not-a-url" })).toBe(false);
    expect(linksEntryCanSubmit({ title: "Example", link: "https://example.com" })).toBe(true);
  });

  it("requires author for books", () => {
    expect(mediaEntryCanSubmit("books", false, { title: "Dune", creator: "", mediaSource: "" })).toBe(
      false,
    );
    expect(
      mediaEntryCanSubmit("books", false, { title: "Dune", creator: "Frank Herbert", mediaSource: "" }),
    ).toBe(true);
  });

  it("requires artist and album for music", () => {
    expect(
      mediaEntryCanSubmit("music", false, { title: "", creator: "Radiohead", mediaSource: "" }),
    ).toBe(false);
    expect(
      mediaEntryCanSubmit("music", false, {
        title: "",
        creator: "Radiohead",
        mediaSource: "OK Computer",
      }),
    ).toBe(true);
  });

  it("composes music title from artist and album", () => {
    expect(
      resolveMediaTitleForSubmit("music", false, {
        title: "",
        creator: "Radiohead",
        mediaSource: "OK Computer",
      }),
    ).toBe("Radiohead — OK Computer");
  });
});
