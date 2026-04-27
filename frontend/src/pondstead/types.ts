/** Base ground shown under resources/buildings. */
export type GroundKind = "grass" | "marsh" | "water" | "berry" | "reed";

/** Optional harvest node (emoji affordance on grass or themed tile). */
export type ResourceKind = "none" | "stone" | "wood" | "food";

export type BuildingKind =
  | "none"
  | "hq"
  | "orchard"
  | "camp"
  | "quarry"
  /** +20% food income (stacking); 2-day civic build. */
  | "granary"
  /** +20% wood income (stacking); 2-day civic build. */
  | "sawmill"
  /** +20% stone income (stacking); 2-day civic build. */
  | "masonYard"
  | "wall"
  | "barracks"
  /** World Wonder: +1 vision radius for your units & buildings (3 pts). */
  | "lighthouse"
  /** World Wonder: +1 daily Chebyshev march cap per stack (3 pts). */
  | "colossus"
  /** World Wonder: worker recruits from civ buildings spawn immediately once/day each (3 pts). */
  | "mausoleum"
  /** World Wonder: +10% food/wood/stone income each (additive; 3 pts). */
  | "pyramid"
  /** World Wonder: +3 max action points per day (3 pts). */
  | "academy";

export type MapCell = {
  /** Source template character. */
  symbol: string;
  ground: GroundKind;
  resource: ResourceKind;
  building: BuildingKind;
  /** Who owns the built structure on this tile (default 0 = local player in solo). */
  buildingOwnerId?: number;
  /**
   * When set, a unit is building this structure here; it finishes at the start of the next day.
   * `building` stays `none` until then.
   */
  constructionTarget?: BuildingKind;
  /** Owner of the in-progress build (copied to {@link buildingOwnerId} when construction completes). */
  constructionOwnerId?: number;
  /**
   * Unit absorbed into this site until the build finishes (same population slot as on-map).
   * If omitted, kind is inferred: wall → soldier, otherwise worker.
   */
  constructionBorrowedUnitKind?: "worker" | "soldier";
  /**
   * “Start new day” passes remaining before this build finishes. Default 1.
   * While greater than 1, the site stays under construction and the builder stays embedded.
   */
  constructionNightsLeft?: number;
};

export type ParsedMap = {
  width: number;
  height: number;
  /** Row-major: cells[row][col] = north-west indexed */
  cells: MapCell[][];
};
