import { describe, expect, it } from "vitest";
import { uploadProgressPercent, uploadStatusLabel } from "./uploadProgressUi";

describe("uploadProgressUi", () => {
  it("computes upload percent when length is known", () => {
    expect(
      uploadProgressPercent({ phase: "uploading", loaded: 50, total: 200 }),
    ).toBe(25);
  });

  it("returns null percent while preparing", () => {
    expect(uploadProgressPercent({ phase: "preparing" })).toBeNull();
  });

  it("labels busy and success states", () => {
    expect(uploadStatusLabel("busy", { phase: "preparing" }, "Done")).toBe(
      "Preparing image…",
    );
    expect(uploadStatusLabel("success", null, "Photo uploaded")).toBe("Photo uploaded");
  });
});
