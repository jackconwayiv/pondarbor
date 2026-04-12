import { describe, expect, it } from "vitest";

import { cleanStreamingTitleLine } from "./cleanSongLabel";

describe("cleanStreamingTitleLine", () => {
  it("strips on Apple Music and fixes AppleÂ mojibake", () => {
    const s = "Yes on Apple\u00c2 Music — Owner of a Lonely Heart";
    expect(cleanStreamingTitleLine(s)).toBe("Yes — Owner of a Lonely Heart");
  });

  it("handles UTF-8 NBSP mojibake", () => {
    const s = "A\u00c2\u00a0B on Apple Music — C";
    expect(cleanStreamingTitleLine(s)).toBe("A B — C");
  });
});
