import { Stack, Text } from "@chakra-ui/react";
import PondNativeSelect from "../components/PondNativeSelect";
import { APP_TEXT_SIZES } from "../theme/typography";
import { INGREDIENT_FOOD_GROUP_PRESETS } from "./pantryTagVocab";

type IngredientFoodGroupSelectProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function IngredientFoodGroupSelect({
  value,
  onChange,
  disabled,
}: IngredientFoodGroupSelectProps) {
  return (
    <Stack gap="2">
      <Text fontSize={APP_TEXT_SIZES.label}>Category</Text>
      <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
        Applies to this ingredient everywhere (pantry, meals, grocery).
      </Text>
      <PondNativeSelect
        rootProps={{ disabled }}
        fieldProps={{
          value,
          onChange: (e) => onChange(e.target.value),
        }}
      >
        <option value="">None</option>
        {INGREDIENT_FOOD_GROUP_PRESETS.map((label) => (
          <option key={label} value={label}>
            {label}
          </option>
        ))}
      </PondNativeSelect>
    </Stack>
  );
}
