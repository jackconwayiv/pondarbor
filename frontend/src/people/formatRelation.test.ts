import { describe, expect, it } from "vitest";

import { formatDefaultRelationLine, formatRelationLine } from "./formatRelation";
import { testPerson } from "./testPerson";

describe("formatRelationLine", () => {
  it("shows default with prefixes and suffixes when alias is empty", () => {
    const p = testPerson("p1", {
      relation_core: "mother",
      relation_prefix_tokens: ["step"],
      relation_suffix_tokens: ["in_law"],
    });
    expect(formatRelationLine(p)).toBe("step-mother in-law");
  });

  it("shows alias only when it differs from the default", () => {
    const p = testPerson("p1", {
      relation_core: "mother",
      relation_prefix_tokens: ["step"],
      relation_alias: "Mom",
    });
    expect(formatRelationLine(p)).toBe("Mom");
    expect(formatDefaultRelationLine(p)).toBe("step-mother");
  });

  it("shows default when alias matches default (case-insensitive)", () => {
    const p = testPerson("p1", {
      relation_core: "mother",
      relation_alias: "Mother",
    });
    expect(formatRelationLine(p)).toBe("mother");
  });

  it("does not append alias in parentheses", () => {
    const p = testPerson("p1", {
      relation_core: "friend",
      relation_suffix_tokens: ["best"],
      relation_alias: "BFF",
    });
    expect(formatRelationLine(p)).toBe("BFF");
    expect(formatRelationLine(p)).not.toContain("(");
  });

  it("shows default when alias is only the core label but suffixes apply", () => {
    const p = testPerson("p1", {
      relation_core: "brother",
      relation_suffix_tokens: ["in_law"],
      relation_alias: "Brother",
    });
    expect(formatRelationLine(p)).toBe("brother in-law");
  });
});
