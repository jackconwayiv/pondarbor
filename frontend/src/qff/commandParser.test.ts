import { describe, expect, it } from "vitest";

import { parseQffCommandLine } from "./commandParser";

function assertKnown(cmd: string) {
  expect(parseQffCommandLine(cmd).kind).toBe("known");
}

function assertUnknown(cmd: string) {
  const r = parseQffCommandLine(cmd);
  expect(r.kind).toBe("unknown");
  if (r.kind === "unknown") {
    expect(r.raw).toBe(cmd);
  }
}

describe("parseQffCommandLine (parity with backend/qff/tests/test_command_parser.py)", () => {
  it("cardinals", () => {
    for (const cmd of ["n", "north", "/north", "go north", "N", "GO NORTH"]) {
      assertKnown(cmd);
    }
  });

  it("intercardinals", () => {
    assertKnown("nw");
  });

  it("up down in out", () => {
    assertKnown("u");
    assertKnown("d");
    assertKnown("enter");
    assertKnown("leave");
  });

  it("search", () => {
    assertKnown("search");
    assertKnown("/search");
  });

  it("unknown", () => {
    assertUnknown("xyzzy");
  });

  it("take alias", () => {
    assertKnown("take red potion");
  });

  it("eat drink", () => {
    assertKnown("eat bread");
    assertKnown("drink water");
  });
});
