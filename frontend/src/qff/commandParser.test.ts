import { describe, expect, it } from "vitest";

import {
  optimisticMoveHeadLine,
  parseQffCommandLine,
  tryParseQffMoveDirection,
} from "./commandParser";

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
    assertKnown("/leave");
    assertKnown("exit");
    assertKnown("/exit");
    assertKnown("quit");
  });

  it("search", () => {
    assertKnown("search");
    assertKnown("/search");
  });

  it("unknown", () => {
    assertUnknown("xyzzy");
  });

  it("tryParseQffMoveDirection", () => {
    expect(tryParseQffMoveDirection("n")).toBe("n");
    expect(tryParseQffMoveDirection("north")).toBe("n");
    expect(tryParseQffMoveDirection("/go NW")).toBe("nw");
    expect(tryParseQffMoveDirection("out")).toBe("out");
    expect(tryParseQffMoveDirection("/out")).toBe("out");
    expect(tryParseQffMoveDirection("leave")).toBe(null);
    expect(tryParseQffMoveDirection("/leave")).toBe(null);
    expect(tryParseQffMoveDirection("exit")).toBe(null);
    expect(tryParseQffMoveDirection("/exit")).toBe(null);
    expect(tryParseQffMoveDirection("search")).toBe(null);
    expect(tryParseQffMoveDirection("eat bread")).toBe(null);
  });

  it("optimisticMoveHeadLine", () => {
    const exits = [
      { direction: "n", label: "North", is_blocked: false },
      { direction: "s", label: "South", is_blocked: true },
    ];
    expect(optimisticMoveHeadLine(exits, "n")).toBe("You head north.");
    expect(optimisticMoveHeadLine(exits, "s")).toBe(null);
    expect(optimisticMoveHeadLine(exits, "e")).toBe(null);
    expect(
      optimisticMoveHeadLine(
        [
          { direction: "n", label: "North", is_blocked: false },
          { direction: "n", label: "North", is_blocked: false },
        ],
        "n",
      ),
    ).toBe(null);
  });

  it("take alias", () => {
    assertKnown("take red potion");
  });

  it("eat drink", () => {
    assertKnown("eat bread");
    assertKnown("drink water");
  });
});
