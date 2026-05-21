import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { PersonAnchorSlot } from "./PersonAnchorSlot";
import { gridColumnCount, gridColumnIndex, gridRowCount, gridRowIndex } from "./treeLayout";
import { TREE_CARD_SIZE, TREE_GRID_GAP } from "./treeGridConstants";
import type { PeopleTreeLayout } from "./types";

export type FamilyTreeGridProps = {
  layout: PeopleTreeLayout;
  registerAnchor: (personId: string, el: HTMLElement | null) => void;
  showGridLines?: boolean;
  renderCell: (col: number, row: number, occupantId: string | null) => ReactNode;
  renderOverlay?: ReactNode;
};

export default function FamilyTreeGrid({
  layout,
  registerAnchor,
  showGridLines = false,
  renderCell,
  renderOverlay,
}: FamilyTreeGridProps) {
  const cols = gridColumnCount(layout);
  const rows = gridRowCount(layout);
  const cells: { col: number; row: number; occupantId: string | null }[] = [];

  for (let row = layout.min_row; row <= layout.max_row; row += 1) {
    for (let col = layout.min_col; col <= layout.max_col; col += 1) {
      let occupantId: string | null = null;
      for (const [id, pos] of Object.entries(layout.positions)) {
        if (pos.col === col && pos.row === row) {
          occupantId = id;
          break;
        }
      }
      cells.push({ col, row, occupantId });
    }
  }

  return (
    <Box position="relative" zIndex={1}>
      {renderOverlay}
      <Box
        display="grid"
        gridTemplateColumns={`repeat(${cols}, ${TREE_CARD_SIZE})`}
        gridTemplateRows={`repeat(${rows}, ${TREE_CARD_SIZE})`}
        gap={TREE_GRID_GAP}
        position="relative"
      >
        {cells.map(({ col, row, occupantId }) => (
          <Box
            key={`${col},${row}`}
            gridColumn={gridColumnIndex(layout, col)}
            gridRow={gridRowIndex(layout, row)}
            w={TREE_CARD_SIZE}
            h={TREE_CARD_SIZE}
            minW={0}
            minH={0}
            borderWidth={showGridLines ? "1px" : undefined}
            borderColor={showGridLines ? "border" : undefined}
            borderStyle={showGridLines ? "dashed" : undefined}
            borderRadius={showGridLines ? "md" : undefined}
            bg={showGridLines ? "whiteAlpha.50" : undefined}
            data-tree-cell-droppable=""
            data-tree-empty-cell={occupantId ? undefined : ""}
            data-cell-col={col}
            data-cell-row={row}
            cursor={!occupantId && showGridLines ? "grab" : undefined}
          >
            {occupantId ? (
              <PersonAnchorSlot personId={occupantId} registerAnchor={registerAnchor}>
                {renderCell(col, row, occupantId)}
              </PersonAnchorSlot>
            ) : (
              renderCell(col, row, null)
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function cellDndId(col: number, row: number): string {
  return `cell:${col}:${row}`;
}

export function parseCellDndId(id: string): { col: number; row: number } | null {
  const m = /^cell:(-?\d+):(-?\d+)$/.exec(id);
  if (!m) return null;
  return { col: Number(m[1]), row: Number(m[2]) };
}
