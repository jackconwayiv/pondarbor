import { chebyshevDistance, inBounds } from "./adjacency";
export type PondsteadUnitKind = "worker" | "soldier";

/**
 * At most one stack per kind is typical; two+ stacks of the same kind on one cell are allowed
 * after a same-tile split. Dragging a stack onto a cell with matching units merges all into one.
 */
export type UnitStack = {
  id: string;
  kind: PondsteadUnitKind;
  count: number;
  row: number;
  col: number;
  /** Which player owns these units (default 0 = local in solo). */
  ownerId?: number;
};

export const PONDSTEAD_UNIT_KINDS: readonly PondsteadUnitKind[] = ["worker", "soldier"] as const;

/** Max total units of one kind on a single tile (all stacks of that kind sum to this cap). */
export const PONDSTEAD_MAX_PER_KIND_ON_TILE = 6;

/** How far a stack can march in one day (8 directions including diagonal; distance = Chebyshev). */
export const PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY = 3;

export function recruitBlockedMessage(kind: PondsteadUnitKind): string {
  return kind === "worker"
    ? "There's no room for more Workers here!"
    : "There's no room for more Soldiers here!";
}

export const PONDSTEAD_DND_STACK = (stackId: string) => `pondstead-stack-${stackId}`;

export const PONDSTEAD_DND_TILE = (row: number, col: number) => `pondstead-tile-${row}-${col}`;

export function parseDndTileId(id: string | number | null | undefined): { row: number; col: number } | null {
  const s = String(id ?? "");
  const m = s.match(/^pondstead-tile-(\d+)-(\d+)$/);
  if (!m) return null;
  return { row: Number(m[1]), col: Number(m[2]) };
}

export function parseDndStackId(id: string | number | null | undefined): string | null {
  const s = String(id ?? "");
  const m = s.match(/^pondstead-stack-(.+)$/);
  return m ? m[1]! : null;
}

const UNIT_EMOJI: Record<PondsteadUnitKind, string> = {
  worker: "⛏️",
  soldier: "⚔️",
};

const UNIT_KIND_LABEL: Record<PondsteadUnitKind, string> = {
  worker: "Worker",
  soldier: "Soldier",
};

export function unitEmoji(kind: PondsteadUnitKind): string {
  return UNIT_EMOJI[kind];
}

export function unitKindLabel(kind: PondsteadUnitKind): string {
  return UNIT_KIND_LABEL[kind];
}

export function stackAriaLabel(kind: PondsteadUnitKind, count: number): string {
  const base = unitKindLabel(kind);
  return count > 1 ? `${base} stack, ${count} units` : `${base} unit`;
}

/**
 * HQ: two workers and one soldier; first Camp and first Orchard in the template: two workers each.
 */
export function createInitialStacks(
  hq: { row: number; col: number },
  camp: { row: number; col: number } | null,
  orchard: { row: number; col: number } | null,
): UnitStack[] {
  const stacks: UnitStack[] = [
    { id: "hq-workers", kind: "worker", count: 2, row: hq.row, col: hq.col, ownerId: 0 },
    { id: "hq-soldier", kind: "soldier", count: 1, row: hq.row, col: hq.col, ownerId: 0 },
  ];
  if (camp) {
    stacks.push({
      id: "camp-workers",
      kind: "worker",
      count: 2,
      row: camp.row,
      col: camp.col,
      ownerId: 0,
    });
  }
  if (orchard) {
    stacks.push({
      id: "orchard-workers",
      kind: "worker",
      count: 2,
      row: orchard.row,
      col: orchard.col,
      ownerId: 0,
    });
  }
  return stacks;
}

export function stacksOnCell(stacks: UnitStack[], row: number, col: number): UnitStack[] {
  return stacks.filter((s) => s.row === row && s.col === col);
}

/** Remove one unit of {@link kind} from {@link row},{@link col} (lowest id stack first). */
export function removeOneUnitOfKindFromCell(
  stacks: UnitStack[],
  row: number,
  col: number,
  kind: PondsteadUnitKind,
): UnitStack[] | null {
  const onCell = stacksOnCell(stacks, row, col)
    .filter((s) => s.kind === kind)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (onCell.length === 0) return null;
  const target = onCell[0]!;
  if (target.count <= 1) {
    return stacks.filter((s) => s.id !== target.id);
  }
  return stacks.map((s) => (s.id === target.id ? { ...s, count: s.count - 1 } : s));
}

export function totalKindCountOnCell(
  stacks: UnitStack[],
  row: number,
  col: number,
  kind: PondsteadUnitKind,
): number {
  return stacksOnCell(stacks, row, col)
    .filter((s) => s.kind === kind)
    .reduce((sum, s) => sum + s.count, 0);
}

/** All units of this kind on the map (for recruit marginal cost by headcount). */
export function totalKindCountInArmy(stacks: UnitStack[], kind: PondsteadUnitKind): number {
  return stacks.filter((s) => s.kind === kind).reduce((sum, s) => sum + s.count, 0);
}

/** Order for flex layout: all workers, then all soldiers, stable by id. */
export function sortStacksForDisplay(here: UnitStack[]): UnitStack[] {
  return [...here].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "worker" ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

function newStackId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `stack-${crypto.randomUUID()}`;
  }
  return `stack-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Split {@link splitCount} into a new stack on the same tile (two piles, same kind). Callers
 * should copy the source stack’s daily march-used onto the new stack id (same spent / remaining
 * as the parent).
 */
export function applyStackSplit(
  stacks: UnitStack[],
  stackId: string,
  splitCount: number,
): UnitStack[] | null {
  const source = stacks.find((s) => s.id === stackId);
  if (!source) return null;
  if (splitCount < 1 || splitCount > 3 || splitCount >= source.count) return null;

  const { row: r, col: c } = source;
  const newStack: UnitStack = {
    id: newStackId(),
    kind: source.kind,
    count: splitCount,
    row: r,
    col: c,
    ownerId: source.ownerId ?? 0,
  };
  return stacks.map((x) => (x.id === stackId ? { ...x, count: x.count - splitCount } : x)).concat(newStack);
}

export function applyStackDragEnd(
  stacks: UnitStack[],
  stackId: string,
  toRow: number,
  toCol: number,
  mapWidth: number,
  mapHeight: number,
  movesUsedThisDay: Readonly<Record<string, number>> = {},
  kingMarchCapPerDay: number = PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY,
): UnitStack[] | null {
  const dragged = stacks.find((s) => s.id === stackId);
  if (!dragged) return null;
  if (!inBounds(toRow, toCol, mapWidth, mapHeight)) return null;

  const sameCell = dragged.row === toRow && dragged.col === toCol;
  if (sameCell) {
    const others = stacks.filter((s) => s.id !== stackId);
    const onDest = others.filter((s) => s.row === toRow && s.col === toCol);
    const sameKindOnDest = onDest.filter((s) => s.kind === dragged.kind);
    if (sameKindOnDest.length === 0) {
      return stacks;
    }
    const keepId = sameKindOnDest[0]!.id;
    const total = dragged.count + sameKindOnDest.reduce((sum, s) => sum + s.count, 0);
    if (total > PONDSTEAD_MAX_PER_KIND_ON_TILE) return null;
    const removeIds = new Set(sameKindOnDest.map((s) => s.id));
    return others
      .filter((s) => !removeIds.has(s.id))
      .concat({ id: keepId, kind: dragged.kind, count: total, row: toRow, col: toCol });
  }

  const d = chebyshevDistance(
    { row: dragged.row, col: dragged.col },
    { row: toRow, col: toCol },
  );
  if (d < 1) return null;

  const used = movesUsedThisDay[stackId] ?? 0;
  const remaining = kingMarchCapPerDay - used;

  const others = stacks.filter((s) => s.id !== stackId);
  const onDest = others.filter((s) => s.row === toRow && s.col === toCol);
  const sameKindOnDest = onDest.filter((s) => s.kind === dragged.kind);

  if (sameKindOnDest.length > 0) {
    if (d !== 1) return null;
    const mergeMoveCost = 1;
    if (mergeMoveCost > remaining) return null;
    const keepId = sameKindOnDest[0]!.id;
    const total = dragged.count + sameKindOnDest.reduce((sum, s) => sum + s.count, 0);
    if (total > PONDSTEAD_MAX_PER_KIND_ON_TILE) return null;
    const removeIds = new Set(sameKindOnDest.map((s) => s.id));
    return others
      .filter((s) => !removeIds.has(s.id))
      .concat({ id: keepId, kind: dragged.kind, count: total, row: toRow, col: toCol });
  }

  if (d > remaining) return null;
  if (dragged.count > PONDSTEAD_MAX_PER_KIND_ON_TILE) return null;
  return others.concat({ ...dragged, row: toRow, col: toCol });
}

function totalUnitCount(stacks: UnitStack[]): number {
  return stacks.reduce((sum, s) => sum + s.count, 0);
}

/** Outcome of attempting to recruit from a building modal. */
export type RecruitAttemptResult =
  | "ok"
  | "population"
  | "tile"
  | "insufficient"
  | "recruit_pending"
  | "already_recruited_today"
  | "no_actions";

/**
 * How a stack drag onto a tile resolves. `merge` = different tile, same-kind, king-adjacent (d = 1):
 * 1 march + 1 action, then combine. `merge_same_cell` = more than one same-kind pile on this tile:
 * free, survivor keeps the higher march-spent. `move` = Chebyshev 1..remaining march; action cost
 * follows diagonal 1.5 and orthogonal 1 per step (see `chebyshevMoveActionCost`). Split is separate UI, not a drag.
 */
export type StackDragOutcome =
  | "noop"
  | "merge"
  | "merge_same_cell"
  | "move"
  | "invalid"
  | "out_of_march";

/**
 * Classify a drag. Adjacent same-kind merges need 1 free march. Same-cell merges are free.
 * {@link movesUsedThisDay} is for the dragged stack (adjacent merge only).
 */
export function classifyStackDragEnd(
  stacks: UnitStack[],
  stackId: string,
  toRow: number,
  toCol: number,
  mapWidth: number,
  mapHeight: number,
  movesUsedThisDay: Readonly<Record<string, number>> = {},
  kingMarchCapPerDay: number = PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY,
): StackDragOutcome {
  const dragged = stacks.find((s) => s.id === stackId);
  if (!dragged) return "invalid";
  if (!inBounds(toRow, toCol, mapWidth, mapHeight)) return "invalid";

  const sameCell = dragged.row === toRow && dragged.col === toCol;
  if (sameCell) {
    const others = stacks.filter((s) => s.id !== stackId);
    const sameKindElsewhereOnCell = others.filter(
      (s) => s.row === toRow && s.col === toCol && s.kind === dragged.kind,
    );
    if (sameKindElsewhereOnCell.length === 0) {
      return "noop";
    }
    const total = dragged.count + sameKindElsewhereOnCell.reduce((sum, s) => sum + s.count, 0);
    if (total > PONDSTEAD_MAX_PER_KIND_ON_TILE) {
      return "invalid";
    }
    return "merge_same_cell";
  }

  const d = chebyshevDistance(
    { row: dragged.row, col: dragged.col },
    { row: toRow, col: toCol },
  );
  if (d < 1) return "invalid";

  const used = movesUsedThisDay[stackId] ?? 0;
  const remaining = kingMarchCapPerDay - used;

  const others = stacks.filter((s) => s.id !== stackId);
  const onDest = others.filter((s) => s.row === toRow && s.col === toCol);
  const sameKindOnDest = onDest.filter((s) => s.kind === dragged.kind);

  if (sameKindOnDest.length > 0) {
    if (d > 1) return "invalid";
    const total = dragged.count + sameKindOnDest.reduce((sum, s) => sum + s.count, 0);
    if (total > PONDSTEAD_MAX_PER_KIND_ON_TILE) return "invalid";
    const mergeMoveCost = 1;
    if (mergeMoveCost > remaining) return "out_of_march";
    return "merge";
  }

  if (d > remaining) return "out_of_march";
  if (dragged.count > PONDSTEAD_MAX_PER_KIND_ON_TILE) return "invalid";
  return "move";
}

/**
 * The stack id that survives a same-kind merge (matches {@link applyStackDragEnd}’s
 * `sameKindOnDest[0]`), for combining march state from both piles. Same for adjacent and same-cell
 * merges.
 */
export function mergeSurvivorStackId(
  stacks: UnitStack[],
  draggedStackId: string,
  destRow: number,
  destCol: number,
): string | null {
  const others = stacks.filter((s) => s.id !== draggedStackId);
  const onDest = others.filter((s) => s.row === destRow && s.col === destCol);
  const dragged = stacks.find((s) => s.id === draggedStackId);
  if (!dragged) return null;
  const sameKind = onDest.filter((s) => s.kind === dragged.kind);
  return sameKind[0]?.id ?? null;
}

/**
 * Add one unit of {@link kind} on {@link row},{@link col}. Merges into the first same-kind stack
 * on that cell (by id), otherwise creates a new stack of count 1.
 * Returns null if total units are already at {@link populationCap}, or if that kind is already at
 * {@link PONDSTEAD_MAX_PER_KIND_ON_TILE} on the tile.
 */
export function applyRecruit(
  stacks: UnitStack[],
  row: number,
  col: number,
  kind: PondsteadUnitKind,
  populationCap: number,
  stackOwnerId = 0,
): UnitStack[] | null {
  if (totalUnitCount(stacks) >= populationCap) {
    return null;
  }
  if (totalKindCountOnCell(stacks, row, col, kind) >= PONDSTEAD_MAX_PER_KIND_ON_TILE) {
    return null;
  }
  const sameKindHere = stacksOnCell(stacks, row, col)
    .filter((s) => s.kind === kind)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (sameKindHere.length > 0) {
    const targetId = sameKindHere[0]!.id;
    return stacks.map((s) => (s.id === targetId ? { ...s, count: s.count + 1 } : s));
  }
  return stacks.concat({ id: newStackId(), kind, count: 1, row, col, ownerId: stackOwnerId });
}

/**
 * Place one unit on a tile like {@link applyRecruit} but without a population-cap check.
 * Used when a builder returns after construction completes.
 */
export function mergeOneUnitIgnoringPopulationCap(
  stacks: UnitStack[],
  row: number,
  col: number,
  kind: PondsteadUnitKind,
  ownerId = 0,
): UnitStack[] | null {
  if (totalKindCountOnCell(stacks, row, col, kind) >= PONDSTEAD_MAX_PER_KIND_ON_TILE) return null;
  const sameKindHere = stacksOnCell(stacks, row, col)
    .filter((s) => s.kind === kind)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (sameKindHere.length > 0) {
    const targetId = sameKindHere[0]!.id;
    return stacks.map((s) => (s.id === targetId ? { ...s, count: s.count + 1 } : s));
  }
  return stacks.concat({ id: newStackId(), kind, count: 1, row, col, ownerId });
}
