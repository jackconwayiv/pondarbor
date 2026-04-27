import type { BuildingKind, GroundKind, MapCell, ParsedMap, ResourceKind } from "./types";

/** First cell with the given building, scanning row-major. */
export function findFirstBuildingCell(
  map: ParsedMap,
  building: BuildingKind,
): { row: number; col: number } | null {
  for (let r = 0; r < map.height; r++) {
    for (let c = 0; c < map.width; c++) {
      if (map.cells[r]![c]!.building === building) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

function cellFromChar(ch: string, row: number, col: number): MapCell {
  const fail = (msg: string): never => {
    throw new Error(`Map parse error at row ${row} col ${col} ('${ch}'): ${msg}`);
  };

  let ground: GroundKind;
  let resource: ResourceKind = "none";
  let building: BuildingKind = "none";

  switch (ch) {
    case "G":
      ground = "grass";
      break;
    case "M":
      ground = "marsh";
      break;
    case "P":
      ground = "water";
      break;
    case "S":
      ground = "grass";
      resource = "stone";
      break;
    case "W":
      ground = "reed";
      resource = "wood";
      break;
    case "F":
      ground = "berry";
      resource = "food";
      break;
    case "X":
      ground = "grass";
      building = "hq";
      break;
    case "O":
      ground = "berry";
      resource = "food";
      building = "orchard";
      break;
    case "C":
      ground = "reed";
      resource = "wood";
      building = "camp";
      break;
    default:
      return fail(`unknown symbol '${ch}'`);
  }

  const cell: MapCell = { symbol: ch, ground, resource, building };
  if (building !== "none") {
    cell.buildingOwnerId = 0;
  }
  return cell;
}

/**
 * Parse a rectangular ASCII map. Lines are trimmed; empty lines are skipped.
 */
export function parseMapTemplate(text: string): ParsedMap {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    throw new Error("Map parse error: template is empty");
  }
  const width = lines[0]!.length;
  for (let r = 0; r < lines.length; r++) {
    if (lines[r]!.length !== width) {
      throw new Error(
        `Map parse error: row ${r} has length ${lines[r]!.length}, expected ${width}`,
      );
    }
  }
  const height = lines.length;
  const cells: MapCell[][] = [];
  for (let r = 0; r < height; r++) {
    const line = lines[r]!;
    const row: MapCell[] = [];
    for (let c = 0; c < width; c++) {
      row.push(cellFromChar(line[c]!, r, c));
    }
    cells.push(row);
  }
  return { width, height, cells };
}

/** First cell with an HQ building, or null. */
export function findHeadquartersCell(map: ParsedMap): { row: number; col: number } | null {
  return findFirstBuildingCell(map, "hq");
}
