import { NativeSelectField, NativeSelectRoot } from "@chakra-ui/react";

export type MealCategoryAxis = "meal_type" | "cuisine" | "time";

export type MealCategoryOptionRow = { id: number; name: string };

type Props = {
  placeholderOption: string;
  value: string;
  onValueChange: (id: string) => void;
  options: MealCategoryOptionRow[];
  disabled?: boolean;
  size?: "sm" | "md";
  ariaLabel: string;
};

/** Single-axis category dropdown (meal type, cuisine, or time). */
export function MealCategorySelect({
  placeholderOption,
  value,
  onValueChange,
  options,
  disabled = false,
  size = "md",
  ariaLabel,
}: Props) {
  const rootProps = size === "sm" ? { size: "sm" as const, maxW: "xs" as const, w: "100%" } : { w: "100%" };

  return (
    <NativeSelectRoot {...rootProps} disabled={disabled}>
      <NativeSelectField value={value} onChange={(e) => onValueChange(e.target.value)} aria-label={ariaLabel}>
        <option value="">{placeholderOption}</option>
        {options.map((o) => (
          <option key={o.id} value={String(o.id)}>
            {o.name}
          </option>
        ))}
      </NativeSelectField>
    </NativeSelectRoot>
  );
}
