import { mapCellBuildingOwner } from "./pondsteadVision";
import type { BuildingCondition, BuildingKind, MapCell, ParsedMap } from "./types";
import type { UnitStack } from "./pondsteadUnits";

/** Uniform [0, 1); used as `Math.floor(u * x) + 1` for 1..x inclusive. */
export type CombatRng = () => number;

function stackOwner(s: UnitStack): number {
  return s.ownerId ?? 0;
}

function roll1dx(x: number, rng: CombatRng): number {
  if (x <= 0) return 0;
  const u = rng();
  return Math.min(x, Math.floor(u * x) + 1);
}

/** Merge stacks that share row, col, owner, and kind (same-day combat prep). */
export function mergeStacksForCombat(stacks: UnitStack[]): UnitStack[] {
  const m = new Map<string, UnitStack>();
  for (const s of stacks) {
    if (s.count <= 0) continue;
    const key = `${s.row}-${s.col}-${stackOwner(s)}-${s.kind}`;
    const ex = m.get(key);
    if (!ex) {
      m.set(key, { ...s });
    } else {
      m.set(key, { ...ex, count: ex.count + s.count });
    }
  }
  return Array.from(m.values());
}

function cellAt(map: ParsedMap, r: number, c: number): MapCell | undefined {
  return map.cells[r]?.[c];
}

function isMarsh(map: ParsedMap, r: number, c: number): boolean {
  return cellAt(map, r, c)?.ground === "marsh";
}

function stacksOnCell(stacks: UnitStack[], row: number, col: number): UnitStack[] {
  return stacks.filter((s) => s.row === row && s.col === col && s.count > 0);
}

/** Owners with at least one military unit (worker or soldier) on the tile. */
function militaryOwnersOnCell(stacks: UnitStack[], row: number, col: number): Set<number> {
  const set = new Set<number>();
  for (const s of stacksOnCell(stacks, row, col)) {
    if (s.kind === "soldier" || s.kind === "worker") set.add(stackOwner(s));
  }
  return set;
}

function playerStackCountOnCell(stacks: UnitStack[], row: number, col: number, owner: number): number {
  return stacksOnCell(stacks, row, col).filter((s) => stackOwner(s) === owner).length;
}

function ownerHasSoldierOnCell(stacks: UnitStack[], row: number, col: number, owner: number): boolean {
  return stacksOnCell(stacks, row, col).some(
    (s) => stackOwner(s) === owner && s.kind === "soldier" && s.count > 0,
  );
}

/** Raw roll then marsh −1 (floors at 0). */
function marshAdjustedRoll(x: number, map: ParsedMap, row: number, col: number, rng: CombatRng): number {
  const raw = roll1dx(x, rng);
  if (!isMarsh(map, row, col)) return raw;
  return Math.max(0, raw - 1);
}

/**
 * Damage this player’s roll deals to enemy units: full roll if any soldier present on their force;
 * otherwise halved (floor) per worker-only participation rule.
 */
export function effectiveDamageFromRoll(raw: number, stacks: UnitStack[], row: number, col: number, owner: number): number {
  if (raw <= 0) return 0;
  if (ownerHasSoldierOnCell(stacks, row, col, owner)) return raw;
  return Math.floor(raw / 2);
}

function replaceCell(map: ParsedMap, row: number, col: number, cell: MapCell): ParsedMap {
  const cells = map.cells.map((rrow, ri) =>
    rrow.map((c, ci) => (ri === row && ci === col ? cell : c)),
  );
  return { ...map, cells };
}

function defaultBuildingCondition(cell: MapCell): BuildingCondition | undefined {
  if (cell.building === "none") return undefined;
  return cell.buildingCondition ?? "intact";
}

function nextBuildingCondition(current: BuildingCondition | undefined): BuildingCondition | "destroyed" {
  const c = current ?? "intact";
  if (c === "intact") return "damaged";
  if (c === "damaged") return "badly_damaged";
  return "destroyed";
}

/**
 * One siege pulse: overflow ≥ 2 applies one structure step (non-HQ escalates / destroys; HQ awards +1, never removed).
 */
function applyStructureDamageFromOverflow(
  map: ParsedMap,
  row: number,
  col: number,
  attacker: number,
  overflow: number,
  points: Record<number, number>,
): { map: ParsedMap; lines: string[] } {
  const lines: string[] = [];
  if (overflow < 2) return { map, lines };
  const cell = map.cells[row]![col]!;
  if (cell.building === "none") return { map, lines };
  const owner = mapCellBuildingOwner(cell);
  if (owner === attacker) return { map, lines };

  if (cell.building === "hq") {
    points[attacker] = (points[attacker] ?? 0) + 1;
    lines.push(`Seat ${attacker} scored +1 for pressing the enemy HQ.`);
    return { map, lines };
  }

  const cond = defaultBuildingCondition(cell);
  const next = nextBuildingCondition(cond);
  if (next === "destroyed") {
    points[attacker] = (points[attacker] ?? 0) + 1;
    const cleared: MapCell = {
      ...cell,
      building: "none" as BuildingKind,
      buildingOwnerId: undefined,
      buildingCondition: undefined,
    };
    lines.push(`A building was destroyed; seat ${attacker} gains +1.`);
    return { map: replaceCell(map, row, col, cleared), lines };
  }
  const nc: MapCell = { ...cell, buildingCondition: next };
  lines.push(`Building structure worsened to ${next}.`);
  return { map: replaceCell(map, row, col, nc), lines };
}

/**
 * Remove up to `damage` units from `defender` on (row,col); soldiers first, then workers (stable id order).
 * Returns updated stacks and how many hits were placed into units.
 */
export function removeUnitsFromOwnerOnCell(
  stacks: UnitStack[],
  row: number,
  col: number,
  defender: number,
  damage: number,
): { stacks: UnitStack[]; absorbed: number } {
  if (damage <= 0) return { stacks, absorbed: 0 };
  const onCell = stacks
    .filter((s) => s.row === row && s.col === col && stackOwner(s) === defender && s.count > 0)
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "soldier" ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
  let left = damage;
  let next = stacks;
  for (const target of onCell) {
    if (left <= 0) break;
    const take = Math.min(target.count, left);
    left -= take;
    next = next
      .map((s) => (s.id === target.id ? { ...s, count: s.count - take } : s))
      .filter((s) => s.count > 0);
  }
  return { stacks: next, absorbed: damage - left };
}

function resolveTwoPlayerTile(
  map: ParsedMap,
  stacks: UnitStack[],
  row: number,
  col: number,
  owners: number[],
  rng: CombatRng,
  combatLines: string[],
  points: Record<number, number>,
): { map: ParsedMap; stacks: UnitStack[] } {
  let m = map;
  let s = stacks;
  const [a, b] = owners;
  const xA = playerStackCountOnCell(s, row, col, a);
  const xB = playerStackCountOnCell(s, row, col, b);
  const rawA = marshAdjustedRoll(xA, m, row, col, rng);
  const rawB = marshAdjustedRoll(xB, m, row, col, rng);
  const dmgA = effectiveDamageFromRoll(rawA, s, row, col, a);
  const dmgB = effectiveDamageFromRoll(rawB, s, row, col, b);
  combatLines.push(`Combat at ${row}-${col}: seat ${a} rolled ${rawA} (→${dmgA} dmg), seat ${b} rolled ${rawB} (→${dmgB} dmg).`);

  const r1 = removeUnitsFromOwnerOnCell(s, row, col, b, dmgA);
  s = r1.stacks;
  const overflowA = Math.max(0, dmgA - r1.absorbed);
  const u = applyStructureDamageFromOverflow(m, row, col, a, overflowA, points);
  m = u.map;
  combatLines.push(...u.lines);

  const r2 = removeUnitsFromOwnerOnCell(s, row, col, a, dmgB);
  s = r2.stacks;
  const overflowB = Math.max(0, dmgB - r2.absorbed);
  const v = applyStructureDamageFromOverflow(m, row, col, b, overflowB, points);
  m = v.map;
  combatLines.push(...v.lines);

  return { map: m, stacks: s };
}

function resolveMultiPlayerTile(
  map: ParsedMap,
  stacks: UnitStack[],
  row: number,
  col: number,
  owners: number[],
  rng: CombatRng,
  combatLines: string[],
  points: Record<number, number>,
): { map: ParsedMap; stacks: UnitStack[] } {
  let m = map;
  let s = stacks;
  const rawByOwner = new Map<number, number>();
  const dmgByOwner = new Map<number, number>();
  for (const o of owners) {
    const x = playerStackCountOnCell(s, row, col, o);
    const raw = marshAdjustedRoll(x, m, row, col, rng);
    rawByOwner.set(o, raw);
    dmgByOwner.set(o, effectiveDamageFromRoll(raw, s, row, col, o));
  }
  combatLines.push(
    `Combat at ${row}-${col} (${owners.length} players): ` +
      owners.map((o) => `seat ${o} rolled ${rawByOwner.get(o)}`).join("; ") +
      ".",
  );

  for (const defender of owners) {
    let incoming = 0;
    for (const attacker of owners) {
      if (attacker === defender) continue;
      incoming += dmgByOwner.get(attacker) ?? 0;
    }
    const r = removeUnitsFromOwnerOnCell(s, row, col, defender, incoming);
    s = r.stacks;
    const overflow = Math.max(0, incoming - r.absorbed);
    let bestAtt = owners[0]!;
    let bestDmg = -1;
    for (const att of owners) {
      if (att === defender) continue;
      const d = dmgByOwner.get(att) ?? 0;
      if (d > bestDmg) {
        bestDmg = d;
        bestAtt = att;
      }
    }
    const u = applyStructureDamageFromOverflow(m, row, col, bestAtt, overflow, points);
    m = u.map;
    combatLines.push(...u.lines);
  }
  return { map: m, stacks: s };
}

/**
 * Day-start combat: contested tiles (≥2 military owners), merged stacks, 1dx rolls, marsh −1,
 * worker-only forces deal halved damage, 2P and 3P+ rules, then structure overflow (≥2) per plan.
 */
export function resolveDayStartCombat(
  map: ParsedMap,
  stacks: UnitStack[],
  rng: CombatRng,
): {
  map: ParsedMap;
  stacks: UnitStack[];
  combatLines: string[];
  pointsAwarded: Record<number, number>;
} {
  const merged = mergeStacksForCombat(stacks);
  const combatLines: string[] = [];
  const pointsAwarded: Record<number, number> = {};
  let m = structuredClone(map);
  let s = merged.map((x) => ({ ...x }));

  const seen = new Set<string>();
  for (const st of s) {
    const key = `${st.row}-${st.col}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const owners = [...militaryOwnersOnCell(s, st.row, st.col)];
    if (owners.length < 2) continue;

    owners.sort((x, y) => x - y);
    const res =
      owners.length === 2
        ? resolveTwoPlayerTile(m, s, st.row, st.col, owners, rng, combatLines, pointsAwarded)
        : resolveMultiPlayerTile(m, s, st.row, st.col, owners, rng, combatLines, pointsAwarded);
    m = res.map;
    s = res.stacks;
  }

  return { map: m, stacks: s, combatLines, pointsAwarded: pointsAwarded };
}
