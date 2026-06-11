import { HStack, Input, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import type { Dispatch, SetStateAction } from "react";
import PondNativeSelect from "../components/PondNativeSelect";
import { APP_TEXT_SIZES, PANEL_FIELD_PROPS } from "../theme/typography";
import type { MealListQuery } from "./api";
import { MealCategoryAddEditor } from "./MealCategoryAddEditor";
import { MealCategorySelect } from "./MealCategorySelect";

const SECTION_LABEL_PROPS = {
  fontSize: APP_TEXT_SIZES.helper,
  fontWeight: "semibold" as const,
  color: "fg.muted",
};

export type MealMealsFilterPanelProps = {
  listQ: string;
  onListQChange: (value: string) => void;
  listTags: string;
  onListTagsChange: (value: string) => void;
  sort: MealListQuery["sort"];
  onSortChange: (value: MealListQuery["sort"]) => void;
  listIngredientQ: string;
  onListIngredientQChange: (value: string) => void;
  mealTypeFilter: string;
  onMealTypeFilterChange: (value: string) => void;
  cuisineFilter: string;
  onCuisineFilterChange: (value: string) => void;
  timeFilter: string;
  onTimeFilterChange: (value: string) => void;
  mealTypeOpts: { id: number; name: string }[];
  cuisineOpts: { id: number; name: string }[];
  timeOpts: { id: number; name: string }[];
  getApiAccessToken: () => Promise<string>;
  setMealTypeOpts: Dispatch<SetStateAction<{ id: number; name: string }[]>>;
  setCuisineOpts: Dispatch<SetStateAction<{ id: number; name: string }[]>>;
  setTimeOpts: Dispatch<SetStateAction<{ id: number; name: string }[]>>;
};

export function MealMealsFilterPanel({
  listQ,
  onListQChange,
  listTags,
  onListTagsChange,
  sort,
  onSortChange,
  listIngredientQ,
  onListIngredientQChange,
  mealTypeFilter,
  onMealTypeFilterChange,
  cuisineFilter,
  onCuisineFilterChange,
  timeFilter,
  onTimeFilterChange,
  mealTypeOpts,
  cuisineOpts,
  timeOpts,
  getApiAccessToken,
  setMealTypeOpts,
  setCuisineOpts,
  setTimeOpts,
}: MealMealsFilterPanelProps) {
  return (
    <Stack gap="3" w="100%" pt="1">
      <SimpleGrid columns={2} gap="3" w="100%">
        <Stack gap="2" minW={0}>
          <Text {...SECTION_LABEL_PROPS}>Search</Text>
          <Input
            w="100%"
            placeholder="Search title & recipe text"
            value={listQ}
            onChange={(e) => onListQChange(e.target.value)}
            {...PANEL_FIELD_PROPS}
          />
        </Stack>
        <Stack gap="2" minW={0}>
          <Text {...SECTION_LABEL_PROPS}>Tags</Text>
          <Input
            w="100%"
            placeholder="Comma-separated, AND"
            value={listTags}
            onChange={(e) => onListTagsChange(e.target.value)}
            {...PANEL_FIELD_PROPS}
          />
        </Stack>
      </SimpleGrid>

      <SimpleGrid columns={2} gap="3" w="100%">
        <Stack gap="2" minW={0}>
          <Text {...SECTION_LABEL_PROPS}>Sort</Text>
          <PondNativeSelect
            rootProps={{ size: "sm", w: "100%" }}
            fieldProps={{
              value: sort ?? "pantry_coverage_pct",
              onChange: (e) => onSortChange(e.target.value as MealListQuery["sort"]),
              "aria-label": "Sort",
            }}
          >
            <option value="pantry_coverage_pct">Pantry match (high–low)</option>
            <option value="updated_at">Recently updated</option>
            <option value="title">Title A–Z</option>
            <option value="upcoming_slot_count">Most upcoming plans</option>
          </PondNativeSelect>
        </Stack>
        <Stack gap="2" minW={0}>
          <Text {...SECTION_LABEL_PROPS}>Ingredient contains</Text>
          <Input
            w="100%"
            placeholder="Match ingredient lines"
            value={listIngredientQ}
            onChange={(e) => onListIngredientQChange(e.target.value)}
            {...PANEL_FIELD_PROPS}
          />
        </Stack>
      </SimpleGrid>

      <Text {...SECTION_LABEL_PROPS}>Categories</Text>
      <HStack gap="2" flexWrap="wrap" align="flex-start" w="100%">
        <Stack gap="2" flex="1" minW="min(100%, 10rem)">
          <Text {...SECTION_LABEL_PROPS}>Meal type</Text>
          <MealCategorySelect
            placeholderOption="All meal types"
            ariaLabel="Meal type filter"
            value={mealTypeFilter}
            onValueChange={onMealTypeFilterChange}
            options={mealTypeOpts}
            size="sm"
          />
        </Stack>
        <Stack gap="2" flex="1" minW="min(100%, 10rem)">
          <Text {...SECTION_LABEL_PROPS}>Cuisine</Text>
          <MealCategorySelect
            placeholderOption="All cuisines"
            ariaLabel="Cuisine filter"
            value={cuisineFilter}
            onValueChange={onCuisineFilterChange}
            options={cuisineOpts}
            size="sm"
          />
        </Stack>
        <Stack gap="2" flex="1" minW="min(100%, 10rem)">
          <Text {...SECTION_LABEL_PROPS}>Time</Text>
          <MealCategorySelect
            placeholderOption="All times"
            ariaLabel="Time filter"
            value={timeFilter}
            onValueChange={onTimeFilterChange}
            options={timeOpts}
            size="sm"
          />
        </Stack>
        <Stack gap="2" w={{ base: "100%", md: "auto" }} minW={{ md: "11rem" }} flexShrink={0}>
          <MealCategoryAddEditor
            getApiAccessToken={getApiAccessToken}
            size="sm"
            triggerLabels={{ closed: "Add Category", open: "Close" }}
            mealTypeOpts={mealTypeOpts}
            cuisineOpts={cuisineOpts}
            timeOpts={timeOpts}
            setMealTypeOpts={setMealTypeOpts}
            setCuisineOpts={setCuisineOpts}
            setTimeOpts={setTimeOpts}
            pickMealType={onMealTypeFilterChange}
            pickCuisine={onCuisineFilterChange}
            pickTime={onTimeFilterChange}
          />
        </Stack>
      </HStack>
    </Stack>
  );
}
