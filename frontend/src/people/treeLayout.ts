import { orderPeopleInRow } from "./orderRowPeople";
import { computePersonRanks, isTreeFriend } from "./rankPeople";
import type { PeoplePartnershipRow, PeoplePerson, PeopleTreeLayout } from "./types";

export const GRID_COL_STEP = 1;
export const GRID_ROW_STEP = 1;
export const GRID_PADDING = 2;

export type GridCoord = { col: number; row: number };

export function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

export function cellOccupant(
  layout: PeopleTreeLayout,
  col: number,
  row: number,
): string | null {
  for (const [id, pos] of Object.entries(layout.positions)) {
    if (pos.col === col && pos.row === row) return id;
  }
  return null;
}

export function occupiedCells(layout: PeopleTreeLayout): Set<string> {
  const out = new Set<string>();
  for (const pos of Object.values(layout.positions)) {
    out.add(cellKey(pos.col, pos.row));
  }
  return out;
}

/** Shrink bounds to `pad` empty cells beyond the furthest occupied cell in each direction. */
export function trimGridAroundOccupied(
  layout: PeopleTreeLayout,
  pad = GRID_PADDING,
): PeopleTreeLayout {
  const positions = Object.values(layout.positions);
  if (positions.length === 0) {
    return ensureGridPadding(layout, pad);
  }
  let minCol = positions[0]!.col;
  let maxCol = positions[0]!.col;
  let minRow = positions[0]!.row;
  let maxRow = positions[0]!.row;
  for (const pos of positions) {
    if (pos.col < minCol) minCol = pos.col;
    if (pos.col > maxCol) maxCol = pos.col;
    if (pos.row < minRow) minRow = pos.row;
    if (pos.row > maxRow) maxRow = pos.row;
  }
  return {
    ...layout,
    min_col: minCol - pad,
    max_col: maxCol + pad,
    min_row: minRow - pad,
    max_row: maxRow + pad,
  };
}

/** Extend bounds so at least `pad` empty rows/cols exist beyond every occupied cell. */
export function ensureGridPadding(layout: PeopleTreeLayout, pad = GRID_PADDING): PeopleTreeLayout {
  let { min_col, min_row, max_col, max_row } = layout;
  for (const pos of Object.values(layout.positions)) {
    if (pos.col - pad < min_col) min_col = pos.col - pad;
    if (pos.col + pad > max_col) max_col = pos.col + pad;
    if (pos.row - pad < min_row) min_row = pos.row - pad;
    if (pos.row + pad > max_row) max_row = pos.row + pad;
  }
  if (Object.keys(layout.positions).length === 0) {
    return { ...layout, min_col: -pad, min_row: -pad, max_col: pad, max_row: pad };
  }
  return { ...layout, min_col, min_row, max_col, max_row };
}

/** Drop on inner boundary empty cell → expand +2 on that edge. */
export function expandGridOnPlacement(
  layout: PeopleTreeLayout,
  col: number,
  row: number,
): PeopleTreeLayout {
  let { min_col, min_row, max_col, max_row } = layout;
  if (col === min_col) min_col -= 2;
  if (col === max_col) max_col += 2;
  if (row === min_row) min_row -= 2;
  if (row === max_row) max_row += 2;
  return ensureGridPadding({ ...layout, min_col, min_row, max_col, max_row });
}

function rankMapForLayout(
  people: PeoplePerson[],
  partnerships: PeoplePartnershipRow[],
): Map<string, number> {
  const family = people.filter((p) => !isTreeFriend(p));
  const friends = people.filter(isTreeFriend);
  const self = people.find((p) => p.is_self);
  const ranks = computePersonRanks(family, partnerships);
  if (self) {
    const selfRank = ranks.get(self.id) ?? 0;
    for (const f of friends) {
      ranks.set(f.id, selfRank + 1);
    }
  }
  for (const p of people) {
    if (!ranks.has(p.id)) {
      ranks.set(p.id, self ? (ranks.get(self.id) ?? 0) : 0);
    }
  }
  return ranks;
}

function firstFreeColOnRow(
  layout: Pick<PeopleTreeLayout, "positions">,
  row: number,
  startCol = 0,
): number {
  const occupied = occupiedCells(layout as PeopleTreeLayout);
  for (let col = startCol; col < startCol + 200; col += 1) {
    if (!occupied.has(cellKey(col, row))) return col;
  }
  return startCol;
}

export function seedLayoutFromPeople(
  people: PeoplePerson[],
  partnerships: PeoplePartnershipRow[],
): PeopleTreeLayout {
  const self = people.find((p) => p.is_self);
  const ranks = rankMapForLayout(people, partnerships);

  const positions: Record<string, GridCoord> = {};
  const rankToRow = new Map<number, number>();

  if (self) {
    const selfRank = ranks.get(self.id) ?? 0;
    for (const p of people) {
      const r = ranks.get(p.id) ?? selfRank;
      rankToRow.set(r, (r - selfRank) * GRID_ROW_STEP);
    }
  } else {
    const rankValues = [...new Set([...ranks.values()])].sort((a, b) => a - b);
    const mid = Math.floor(rankValues.length / 2);
    const baseRank = rankValues[mid] ?? 0;
    for (const p of people) {
      const r = ranks.get(p.id) ?? baseRank;
      rankToRow.set(r, (r - baseRank) * GRID_ROW_STEP);
    }
  }

  const peopleByRank = new Map<number, PeoplePerson[]>();
  for (const p of people) {
    const r = ranks.get(p.id) ?? 0;
    const list = peopleByRank.get(r) ?? [];
    list.push(p);
    peopleByRank.set(r, list);
  }

  for (const [rank, rowPeople] of peopleByRank) {
    const gridRow = rankToRow.get(rank) ?? 0;
    const ordered = orderPeopleInRow(rowPeople, partnerships, self);
    const selfIdx = self ? ordered.findIndex((p) => p.id === self.id) : -1;
    const centerIdx = selfIdx >= 0 ? selfIdx : Math.floor((ordered.length - 1) / 2);
    ordered.forEach((p, i) => {
      const col = (i - centerIdx) * GRID_COL_STEP;
      positions[p.id] = { col, row: gridRow };
    });
  }

  // Fallback: anyone missing (e.g. unranked) goes near self row
  for (const p of people) {
    if (positions[p.id]) continue;
    const row = self ? (rankToRow.get(ranks.get(self.id) ?? 0) ?? 0) : 0;
    const col = firstFreeColOnRow({ positions }, row);
    positions[p.id] = { col, row };
  }

  let layout: PeopleTreeLayout = {
    positions,
    min_col: 0,
    min_row: 0,
    max_col: 0,
    max_row: 0,
  };
  layout = ensureGridPadding(layout);
  return layout;
}

export function placeNewPersonInLayout(
  layout: PeopleTreeLayout,
  person: PeoplePerson,
  people: PeoplePerson[],
  partnerships: PeoplePartnershipRow[],
): PeopleTreeLayout {
  const ranks = rankMapForLayout(people, partnerships);
  const self = people.find((p) => p.is_self);
  const selfRank = self ? (ranks.get(self.id) ?? 0) : 0;
  const personRank = ranks.get(person.id) ?? selfRank;
  const row = (personRank - selfRank) * GRID_ROW_STEP;
  const col = firstFreeColOnRow(layout, row);
  const next: PeopleTreeLayout = {
    ...layout,
    positions: { ...layout.positions, [person.id]: { col, row } },
  };
  return ensureGridPadding(next);
}

export function mergeLayoutWithPeople(
  layout: PeopleTreeLayout,
  people: PeoplePerson[],
  partnerships: PeoplePartnershipRow[],
): PeopleTreeLayout {
  const activeIds = new Set(people.map((p) => p.id));
  const positions: Record<string, GridCoord> = {};
  for (const [id, pos] of Object.entries(layout.positions)) {
    if (activeIds.has(id)) positions[id] = pos;
  }
  let next: PeopleTreeLayout = { ...layout, positions };
  for (const p of people) {
    if (!next.positions[p.id]) {
      next = placeNewPersonInLayout(next, p, people, partnerships);
    }
  }
  return ensureGridPadding(next);
}

export function resolveDisplayLayout(
  bundleLayout: PeopleTreeLayout | null | undefined,
  people: PeoplePerson[],
  partnerships: PeoplePartnershipRow[],
): PeopleTreeLayout {
  if (bundleLayout && Object.keys(bundleLayout.positions).length > 0) {
    return mergeLayoutWithPeople(bundleLayout, people, partnerships);
  }
  return seedLayoutFromPeople(people, partnerships);
}

export function swapPeopleInLayout(
  layout: PeopleTreeLayout,
  draggedPersonId: string,
  targetCol: number,
  targetRow: number,
  people: PeoplePerson[],
): PeopleTreeLayout | null {
  const self = people.find((p) => p.is_self);
  if (self?.id === draggedPersonId) return null;

  const from = layout.positions[draggedPersonId];
  if (!from) return null;

  const occupantId = cellOccupant(layout, targetCol, targetRow);
  let positions = { ...layout.positions };

  if (occupantId && occupantId !== draggedPersonId) {
    if (self?.id === occupantId) return null;
    positions[occupantId] = { ...from };
    positions[draggedPersonId] = { col: targetCol, row: targetRow };
  } else {
    positions[draggedPersonId] = { col: targetCol, row: targetRow };
  }

  let next: PeopleTreeLayout = { ...layout, positions };
  if (
    targetCol === layout.min_col ||
    targetCol === layout.max_col ||
    targetRow === layout.min_row ||
    targetRow === layout.max_row
  ) {
    next = expandGridOnPlacement(next, targetCol, targetRow);
  }
  return trimGridAroundOccupied(next);
}

export function gridColumnCount(layout: PeopleTreeLayout): number {
  return layout.max_col - layout.min_col + 1;
}

export function gridRowCount(layout: PeopleTreeLayout): number {
  return layout.max_row - layout.min_row + 1;
}

export function gridColumnIndex(layout: PeopleTreeLayout, col: number): number {
  return col - layout.min_col + 1;
}

export function gridRowIndex(layout: PeopleTreeLayout, row: number): number {
  return row - layout.min_row + 1;
}
