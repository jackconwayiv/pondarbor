import { HStack, NativeSelectField, NativeSelectRoot, Stack, Text } from "@chakra-ui/react";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES, PANEL_FIELD_PROPS } from "../theme/typography";
import type { Recipe } from "./types";

export default function MealRecipeIdsPicker({
  recipes,
  recipeIds,
  onChange,
  disabled = false,
}: {
  recipes: Recipe[];
  recipeIds: number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
}) {
  const available = recipes.filter((r) => !recipeIds.includes(r.id));
  return (
    <Stack gap="2" w="100%">
      {recipeIds.length > 0 ? (
        <Stack gap="1">
          {recipeIds.map((rid) => (
            <HStack key={rid} justify="space-between" align="center" flexWrap="wrap" gap="2">
              <Text fontSize={APP_TEXT_SIZES.body} minW="0" flex="1">
                {recipes.find((r) => r.id === rid)?.title ?? `Recipe #${rid}`}
              </Text>
              <PondButton
                size="xs"
                colorPalette="nautical"
                variant="outline"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(recipeIds.filter((x) => x !== rid));
                }}
              >
                Remove
              </PondButton>
            </HStack>
          ))}
        </Stack>
      ) : null}
      {available.length > 0 ? (
        <NativeSelectRoot key={recipeIds.join("-")} size="sm" maxW="100%">
          <NativeSelectField
            {...PANEL_FIELD_PROPS}
            value=""
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") return;
              const id = Number(v);
              if (!Number.isFinite(id) || recipeIds.includes(id)) return;
              onChange([...recipeIds, id]);
            }}
          >
            <option value="">Add recipe…</option>
            {available.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </NativeSelectField>
        </NativeSelectRoot>
      ) : recipeIds.length === 0 ? (
        <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
          No recipes in your library yet. Create some under Menu → Recipes.
        </Text>
      ) : null}
    </Stack>
  );
}
