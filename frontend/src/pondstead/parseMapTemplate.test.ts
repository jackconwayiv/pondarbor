import { describe, expect, it } from "vitest";

import { PONDSTEAD_DEFAULT_MAP_TEMPLATE } from "./defaultMapTemplate";
import { findHeadquartersCell, parseMapTemplate } from "./parseMapTemplate";

describe("parseMapTemplate", () => {
  it("parses default map as 9×9 with expected HQ and specials", () => {
    const m = parseMapTemplate(PONDSTEAD_DEFAULT_MAP_TEMPLATE);
    expect(m.width).toBe(9);
    expect(m.height).toBe(9);
    expect(m.cells[4]![4]!.symbol).toBe("X");
    expect(m.cells[4]![4]!.building).toBe("hq");
    expect(findHeadquartersCell(m)).toEqual({ row: 4, col: 4 });
    expect(m.cells[3]![5]!.symbol).toBe("O");
    expect(m.cells[3]![5]!.building).toBe("orchard");
    expect(m.cells[5]![3]!.symbol).toBe("C");
    expect(m.cells[5]![3]!.building).toBe("camp");
    expect(m.cells[4]![4]!.buildingOwnerId).toBe(0);
    expect(m.cells[3]![5]!.buildingOwnerId).toBe(0);
  });

  it("rejects ragged rows", () => {
    expect(() => parseMapTemplate("AB\nA")).toThrow();
  });
});
