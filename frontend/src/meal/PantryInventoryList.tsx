import { SimpleGrid, Text } from "@chakra-ui/react";
import { useMemo } from "react";
import { APP_TEXT_SIZES } from "../theme/typography";
import { PantryIngredientCard } from "./PantryIngredientCard";
import {
  filterPantryRows,
  partitionDepletedPantryRows,
  sortPantryRows,
  type PantrySortKey,
} from "./pantryInventoryListUtils";
import type { PantryInventoryRow } from "./types";
import type { PantryTagDimension } from "./pantryTagVocab";

type PantryInventoryListProps = {
  rows: PantryInventoryRow[];
  busy?: boolean;
  sort: PantrySortKey;
  nameQuery: string;
  tagFilters: Partial<Record<PantryTagDimension, string>>;
  onEditRow: (row: PantryInventoryRow) => void;
};

export function PantryInventoryList({
  rows,
  busy,
  sort,
  nameQuery,
  tagFilters,
  onEditRow,
}: PantryInventoryListProps) {
  const displayed = useMemo(
    () =>
      partitionDepletedPantryRows(
        sortPantryRows(filterPantryRows(rows, nameQuery, tagFilters), sort),
      ),
    [rows, nameQuery, tagFilters, sort],
  );

  if (displayed.length === 0) {
    return (
      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
        {rows.length === 0
          ? "No items yet — use Add item(s) to import or add ingredients."
          : "No items match your filters."}
      </Text>
    );
  }

  return (
    <SimpleGrid columns={{ base: 3, md: 6 }} gap="1" w="100%">
      {displayed.map((row) => (
        <PantryIngredientCard key={row.id} row={row} busy={busy} onEditRow={onEditRow} />
      ))}
    </SimpleGrid>
  );
}
