import { describe, expect, it } from "vitest";

import { PONDSTEAD_DEFAULT_MAP_TEMPLATE } from "./defaultMapTemplate";
import { parseMapTemplate } from "./parseMapTemplate";
import { listLocalConstructionsForHud, listQueuedRecruitsForHud } from "./pondsteadHudQueue";

describe("listQueuedRecruitsForHud", () => {
  it("lists a worker queued at a valid building", () => {
    const map = parseMapTemplate(PONDSTEAD_DEFAULT_MAP_TEMPLATE);
    const queues = { "4-4": "worker" as const };
    const out = listQueuedRecruitsForHud(map, queues, 0);
    expect(out.length).toBe(1);
    expect(out[0]!.kind).toBe("worker");
    expect(out[0]!.atBuildingLabel).toBe("Headquarters");
  });
});

describe("listLocalConstructionsForHud", () => {
  it("returns empty when no construction sites", () => {
    const map = parseMapTemplate(PONDSTEAD_DEFAULT_MAP_TEMPLATE);
    expect(listLocalConstructionsForHud(map, 0)).toEqual([]);
  });
});
