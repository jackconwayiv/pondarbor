import { Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import PondNativeSelect from "../components/PondNativeSelect";
import { APP_TEXT_SIZES, PANEL_FIELD_PROPS } from "../theme/typography";
import {
  filterPantryRows,
  formatPantryQuantity,
  PANTRY_SORT_OPTIONS,
  sortPantryRows,
  type PantrySortKey,
} from "./pantryInventoryListUtils";
import {
  PANTRY_TAG_DIMENSION_LABELS,
  PANTRY_TAG_DIMENSIONS,
  PANTRY_TAG_PRESETS,
  hasAnyPantryTags,
  normalizePantryTags,
  pantryTagsSummary,
} from "./pantryTagVocab";
import type { PantryInventoryRow } from "./types";
import type { PantryTagDimension } from "./pantryTagVocab";

type PantryInventoryListProps = {
  rows: PantryInventoryRow[];
  busy?: boolean;
  onEditRow: (row: PantryInventoryRow) => void;
};

export function PantryInventoryList({ rows, busy, onEditRow }: PantryInventoryListProps) {
  const [sort, setSort] = useState<PantrySortKey>("name_asc");
  const [nameQuery, setNameQuery] = useState("");
  const [tagFilters, setTagFilters] = useState<Partial<Record<PantryTagDimension, string>>>({});

  const displayed = useMemo(
    () => sortPantryRows(filterPantryRows(rows, nameQuery, tagFilters), sort),
    [rows, nameQuery, tagFilters, sort],
  );

  return (
    <Stack gap="3">
      <HStack gap="2" flexWrap="wrap" align="flex-end">
        <Stack gap="1" minW="10rem">
          <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
            Sort
          </Text>
          <PondNativeSelect
            rootProps={{ size: "sm" }}
            fieldProps={{
              value: sort,
              onChange: (e) => setSort(e.target.value as PantrySortKey),
            }}
          >
            {PANTRY_SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </PondNativeSelect>
        </Stack>
        <Stack gap="1" flex="1" minW="10rem">
          <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
            Search
          </Text>
          <Input
            size="sm"
            placeholder="Filter by name"
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            {...PANEL_FIELD_PROPS}
          />
        </Stack>
      </HStack>

      <HStack gap="2" flexWrap="wrap" align="flex-end">
        {PANTRY_TAG_DIMENSIONS.map((dim) => (
          <Stack key={dim} gap="1" minW="8rem">
            <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
              {PANTRY_TAG_DIMENSION_LABELS[dim]}
            </Text>
            <PondNativeSelect
              rootProps={{ size: "sm" }}
              fieldProps={{
                value: tagFilters[dim] ?? "",
                onChange: (e) =>
                  setTagFilters((prev) => ({
                    ...prev,
                    [dim]: e.target.value,
                  })),
              }}
            >
              <option value="">Any</option>
              {PANTRY_TAG_PRESETS[dim].map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </PondNativeSelect>
          </Stack>
        ))}
      </HStack>

      {displayed.length === 0 ? (
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
          {rows.length === 0
            ? "No rows yet — use Add to pantry to import or add items."
            : "No items match your filters."}
        </Text>
      ) : (
        <Stack gap="0" borderWidth="1px" borderColor="border.muted" borderRadius="md" overflow="hidden">
          {displayed.map((row) => {
            const tags = normalizePantryTags(row.pantry_tags);
            const tagLine = hasAnyPantryTags(tags) ? pantryTagsSummary(tags) : null;
            const loc = (row.location ?? "").trim();
            return (
              <Button
                key={row.id}
                variant="ghost"
                w="100%"
                h="auto"
                justifyContent="flex-start"
                textAlign="left"
                px="3"
                py="2"
                borderRadius="0"
                borderBottomWidth="1px"
                borderColor="border.muted"
                bg="bg"
                cursor={busy ? "wait" : "pointer"}
                opacity={busy ? 0.7 : 1}
                _hover={{ bg: "bg.subtle" }}
                onClick={() => onEditRow(row)}
              >
                <Text fontSize={APP_TEXT_SIZES.body} fontWeight="semibold">
                  {row.ingredient.name}
                </Text>
                <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                  {formatPantryQuantity(row)}
                  {loc ? ` · ${loc}` : null}
                  {row.owner_label?.trim() ? ` · ${row.owner_label}` : null}
                </Text>
                {tagLine ? (
                  <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
                    {tagLine}
                  </Text>
                ) : null}
              </Button>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
