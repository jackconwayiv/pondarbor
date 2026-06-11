import { HStack, Input, Stack, Text } from "@chakra-ui/react";
import PondNativeSelect from "../components/PondNativeSelect";
import { APP_TEXT_SIZES, PANEL_FIELD_PROPS } from "../theme/typography";
import { PANTRY_SORT_OPTIONS, type PantrySortKey } from "./pantryInventoryListUtils";
import {
  PANTRY_TAG_DIMENSION_LABELS,
  PANTRY_TAG_DIMENSIONS,
  PANTRY_TAG_PRESETS,
} from "./pantryTagVocab";
import type { PantryTagDimension } from "./pantryTagVocab";

export type PantryInventoryFilterPanelProps = {
  sort: PantrySortKey;
  onSortChange: (value: PantrySortKey) => void;
  nameQuery: string;
  onNameQueryChange: (value: string) => void;
  tagFilters: Partial<Record<PantryTagDimension, string>>;
  onTagFiltersChange: (value: Partial<Record<PantryTagDimension, string>>) => void;
};

export function PantryInventoryFilterPanel({
  sort,
  onSortChange,
  nameQuery,
  onNameQueryChange,
  tagFilters,
  onTagFiltersChange,
}: PantryInventoryFilterPanelProps) {
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
              onChange: (e) => onSortChange(e.target.value as PantrySortKey),
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
            onChange={(e) => onNameQueryChange(e.target.value)}
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
                  onTagFiltersChange({
                    ...tagFilters,
                    [dim]: e.target.value,
                  }),
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
    </Stack>
  );
}
