import { describe, expect, it } from "vitest";

import { orderPartnerPair, orderPeopleInRow } from "./orderRowPeople";
import { testPerson } from "./testPerson";

describe("orderRowPeople", () => {
  it("places male partner to the left of female", () => {
    const husband = testPerson("h", { name: "Tom", gender: "male" });
    const sister = testPerson("s", { name: "Sarah", gender: "female", relation_core: "sister" });
    const [left, right] = orderPartnerPair(husband, sister);
    expect(left.id).toBe("h");
    expect(right.id).toBe("s");
  });

  it("keeps partners adjacent with husband left of sister in a mixed row", () => {
    const self = testPerson("me", { is_self: true, name: "Me" });
    const sister = testPerson("s", { name: "Sarah", gender: "female", relation_core: "sister" });
    const husband = testPerson("h", { name: "Tom", gender: "male" });
    const zoe = testPerson("z", { name: "Zoe" });
    const row = orderPeopleInRow(
      [zoe, husband, self, sister],
      [
        {
          id: "p1",
          person_a_id: "h",
          person_b_id: "s",
          status: "current",
          anniversary_date: null,
        },
      ],
      self,
    );
    const ids = row.map((p) => p.id);
    expect(ids.indexOf("h")).toBe(ids.indexOf("s") - 1);
    expect(ids[0]).toBe("me");
  });

  it("places pets under owner column in the lower row", () => {
    const self = testPerson("me", { is_self: true, name: "Me" });
    const dog = testPerson("dog", { relation_core: "pet", name: "Dog" });
    const kid = testPerson("kid", { name: "Kid" });
    const prevRow = [self, testPerson("sis", { name: "Sis" })];
    const row = orderPeopleInRow([kid, dog], [], self, { prevRow });
    expect(row.map((p) => p.id)).toEqual(["kid", "dog"]);
  });
});
