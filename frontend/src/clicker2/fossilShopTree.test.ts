import { describe, expect, it } from "vitest";

import {
  buildFossilShopTreeGraph,
  FAE_PORTAL_SPECIALTY_ID,
  FOSSIL_RECORD_SPECIALTY_ID,
  GLASSES_SPECIALTY_ID,
  GNOMES_SPECIALTY_ID,
  GREMLINS_SPECIALTY_ID,
  IMPS_SPECIALTY_ID,
  initialExpandedFossilShopTreeNodes,
  MICROSCOPE_SPECIALTY_ID,
  PETROGLYPH_I_SPECIALTY_ID,
  PIXIES_SPECIALTY_ID,
  STRATIFIED_POND_SPECIALTY_ID,
  TELESCOPE_SPECIALTY_ID,
  WOODED_SHORE_SPECIALTY_ID,
  GATHERING_CLOUDS_SPECIALTY_ID,
  formatFossilsBalanceHeader,
} from "./fossilShop";

describe("buildFossilShopTreeGraph", () => {
  it("uses Stratified Pond as root with direct children in catalog order", () => {
    const graph = buildFossilShopTreeGraph();
    const root = graph.nodes.get(STRATIFIED_POND_SPECIALTY_ID);
    expect(graph.rootId).toBe(STRATIFIED_POND_SPECIALTY_ID);
    expect(root?.parentId).toBeNull();
    expect(root?.children).toEqual([
      FOSSIL_RECORD_SPECIALTY_ID,
      MICROSCOPE_SPECIALTY_ID,
      FAE_PORTAL_SPECIALTY_ID,
      WOODED_SHORE_SPECIALTY_ID,
      GATHERING_CLOUDS_SPECIALTY_ID,
    ]);
    expect(root?.children).not.toContain(686);
    expect(root?.children).not.toContain(687);
  });

  it("models the Fae Portal branch fork and tier-3 evolutions", () => {
    const graph = buildFossilShopTreeGraph();
    expect(graph.nodes.get(FAE_PORTAL_SPECIALTY_ID)?.children).toEqual([
      PIXIES_SPECIALTY_ID,
      IMPS_SPECIALTY_ID,
    ]);
    expect(graph.nodes.get(PIXIES_SPECIALTY_ID)?.children).toEqual([
      GNOMES_SPECIALTY_ID,
    ]);
    expect(graph.nodes.get(IMPS_SPECIALTY_ID)?.children).toEqual([
      GREMLINS_SPECIALTY_ID,
    ]);
  });

  it("places Ripples of Eternity under Fossil Record and Petroglyph I under Ripples", () => {
    const graph = buildFossilShopTreeGraph();
    expect(graph.nodes.get(686)?.parentId).toBe(FOSSIL_RECORD_SPECIALTY_ID);
    expect(graph.nodes.get(PETROGLYPH_I_SPECIALTY_ID)?.parentId).toBe(686);
    expect(graph.nodes.get(FOSSIL_RECORD_SPECIALTY_ID)?.children).toContain(686);
    expect(graph.nodes.get(686)?.children).toContain(PETROGLYPH_I_SPECIALTY_ID);
    expect(graph.nodes.get(FOSSIL_RECORD_SPECIALTY_ID)?.children).not.toContain(
      PETROGLYPH_I_SPECIALTY_ID,
    );
  });

  it("places El Niño under Gathering Clouds", () => {
    const graph = buildFossilShopTreeGraph();
    expect(graph.nodes.get(687)?.parentId).toBe(GATHERING_CLOUDS_SPECIALTY_ID);
    expect(graph.nodes.get(GATHERING_CLOUDS_SPECIALTY_ID)?.children).toContain(
      687,
    );
  });

  it("models the optics chain under Stratified Pond", () => {
    const graph = buildFossilShopTreeGraph();
    expect(graph.nodes.get(MICROSCOPE_SPECIALTY_ID)?.parentId).toBe(
      STRATIFIED_POND_SPECIALTY_ID,
    );
    expect(graph.nodes.get(GLASSES_SPECIALTY_ID)?.parentId).toBe(
      MICROSCOPE_SPECIALTY_ID,
    );
    expect(graph.nodes.get(728)?.parentId).toBe(GLASSES_SPECIALTY_ID);
    expect(graph.nodes.get(TELESCOPE_SPECIALTY_ID)?.parentId).toBe(728);
  });
});

describe("initialExpandedFossilShopTreeNodes", () => {
  it("starts collapsed when nothing is owned", () => {
    const expanded = initialExpandedFossilShopTreeNodes({});
    expect(expanded.size).toBe(0);
  });

  it("expands owned nodes and their ancestors", () => {
    const expanded = initialExpandedFossilShopTreeNodes({
      [FAE_PORTAL_SPECIALTY_ID]: true,
      [PIXIES_SPECIALTY_ID]: true,
    });
    expect(expanded.has(STRATIFIED_POND_SPECIALTY_ID)).toBe(true);
    expect(expanded.has(FAE_PORTAL_SPECIALTY_ID)).toBe(true);
    expect(expanded.has(PIXIES_SPECIALTY_ID)).toBe(true);
    expect(expanded.has(GNOMES_SPECIALTY_ID)).toBe(false);
  });
});

describe("formatFossilsBalanceHeader", () => {
  it("formats the interstitial header balance", () => {
    expect(formatFossilsBalanceHeader(12)).toBe("🦴 FOSSILS: 12");
  });
});
