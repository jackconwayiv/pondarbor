import { Field } from "@chakra-ui/react";

import { GoalFrequencyCountInput } from "./GoalFrequencyCountInput";

type GoalIntervalWeeksInputProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

export function GoalIntervalWeeksInput({
  value,
  onChange,
  disabled,
}: GoalIntervalWeeksInputProps) {
  return (
    <Field.Root width="full" maxW="11rem">
      <Field.Label>Every N weeks</Field.Label>
      <GoalFrequencyCountInput
        value={value}
        onChange={onChange}
        min={1}
        max={52}
        disabled={disabled}
      />
    </Field.Root>
  );
}
