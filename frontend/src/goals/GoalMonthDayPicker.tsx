import { Field, NativeSelect } from "@chakra-ui/react";

import { ordinalDay } from "./goalCopy";

type GoalMonthDayPickerProps = {
  value: number | null;
  onChange: (day: number) => void;
  disabled?: boolean;
};

export function GoalMonthDayPicker({ value, onChange, disabled }: GoalMonthDayPickerProps) {
  return (
    <Field.Root maxW="10rem">
      <Field.Label>Day of month</Field.Label>
      <NativeSelect.Root disabled={disabled}>
        <NativeSelect.Field
          value={value ?? 1}
          onChange={(e) => onChange(Number(e.target.value))}
        >
          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
            <option key={day} value={day}>
              {ordinalDay(day)}
            </option>
          ))}
        </NativeSelect.Field>
      </NativeSelect.Root>
    </Field.Root>
  );
}
