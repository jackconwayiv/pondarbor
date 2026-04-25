import { describe, expect, it } from "vitest";

import { normalizeHarborState } from "./api";
import type { HarborCatalog } from "./engine/types";

const CATALOG: HarborCatalog = {
  catalog_version: 1,
  ships: [
    {
      id: 1,
      slug: "skiff",
      name: "Skiff",
      description: "",
      stage_min: 1,
      stage_max: null,
      tags: [],
      extra: {},
      enabled: true,
      sort_order: 0,
    },
  ],
  buildings: [
    {
      id: 1,
      slug: "warehouse",
      name: "Warehouse",
      description: "",
      stage_min: 1,
      stage_max: null,
      tags: [],
      extra: {},
      enabled: true,
      sort_order: 0,
    },
  ],
  operations: [],
  arrivals: [],
  events: [],
  consequences: [],
  policies: [],
  doctrines: [],
};

describe("normalizeHarborState", () => {
  it("returns blank state for non-objects", () => {
    const s = normalizeHarborState(null, CATALOG, 1);
    expect(s.day).toBe(1);
    expect(s.ships).toEqual([]);
  });

  it("drops ship references whose defSlug is not in catalog", () => {
    const raw = {
      stageId: 1,
      ships: [
        { id: "s-1", defSlug: "skiff", status: "reserve", hp: 1 },
        { id: "s-2", defSlug: "ghost-ship", status: "reserve", hp: 1 },
      ],
    };
    const s = normalizeHarborState(raw, CATALOG, 1);
    expect(s.ships.map((x) => x.defSlug)).toEqual(["skiff"]);
  });

  it("drops buildings referencing missing slugs", () => {
    const raw = {
      stageId: 1,
      buildings: [
        { slug: "warehouse", level: 2 },
        { slug: "phantom", level: 3 },
      ],
    };
    const s = normalizeHarborState(raw, CATALOG, 1);
    expect(s.buildings.map((b) => b.slug)).toEqual(["warehouse"]);
  });

  it("clamps log to 200 entries", () => {
    const raw = {
      stageId: 1,
      log: Array.from({ length: 500 }, (_, i) => ({
        day: i,
        text: `entry ${i}`,
        kind: "info",
      })),
    };
    const s = normalizeHarborState(raw, CATALOG, 1);
    expect(s.log.length).toBe(200);
  });
});
