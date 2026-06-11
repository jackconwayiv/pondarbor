import { HStack, Tag } from "@chakra-ui/react";
import { MEAL_WIZARD_DIETARY_OPTIONS } from "../wizard/mealDietaryOptions";

type MealDietaryPreferencesEditorProps = {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

export function MealDietaryPreferencesEditor({
  value,
  onChange,
  disabled,
}: MealDietaryPreferencesEditorProps) {
  const toggle = (label: string) => {
    if (disabled) return;
    const fold = label.toLowerCase();
    const next = value.some((t) => t.toLowerCase() === fold)
      ? value.filter((t) => t.toLowerCase() !== fold)
      : [...value, label];
    onChange(next);
  };

  return (
    <HStack flexWrap="wrap" gap="1">
      {MEAL_WIZARD_DIETARY_OPTIONS.map((label) => {
        const active = value.some((t) => t.toLowerCase() === label.toLowerCase());
        return (
          <Tag.Root
            key={label}
            size="sm"
            colorPalette="lilypad"
            variant={active ? "solid" : "outline"}
            cursor={disabled ? "not-allowed" : "pointer"}
            opacity={disabled ? 0.6 : 1}
            onClick={() => toggle(label)}
          >
            <Tag.Label>{label}</Tag.Label>
          </Tag.Root>
        );
      })}
    </HStack>
  );
}
