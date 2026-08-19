import { describe, expect, it } from "vitest";

import {
  USER_COLOR_ORDER,
  colorAssignedToUser,
  colorForCheckedUser,
} from "./userColors";

describe("colorAssignedToUser", () => {
  it("assigns by people-list position, not check order", () => {
    const people = [10, 20, 30];
    expect(colorAssignedToUser(10, people)).toBe(USER_COLOR_ORDER[0]);
    expect(colorAssignedToUser(20, people)).toBe(USER_COLOR_ORDER[1]);
    expect(colorAssignedToUser(30, people)).toBe(USER_COLOR_ORDER[2]);
  });
});

describe("colorForCheckedUser", () => {
  it("hides unchecked users without reassigning remaining colors", () => {
    const people = [10, 20, 30];
    expect(colorForCheckedUser(20, [10, 20, 30], people)).toBe(USER_COLOR_ORDER[1]);
    expect(colorForCheckedUser(20, [10, 30], people)).toBeNull();
    expect(colorForCheckedUser(30, [10, 30], people)).toBe(USER_COLOR_ORDER[2]);
  });
});
