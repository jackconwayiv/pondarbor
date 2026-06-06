import { Field } from "@chakra-ui/react";

import { GoalFrequencyCountInput } from "./GoalFrequencyCountInput";

type GoalIntervalMonthsInputProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

export function GoalIntervalMonthsInput({
  value,
  onChange,
  disabled,
}: GoalIntervalMonthsInputProps) {
  return (
    <Field.Root width="full" maxW="11rem">
      <Field.Label>Every N months</Field.Label>
      <GoalFrequencyCountInput
        value={value}
        onChange={onChange}
        min={1}
        max={24}
        disabled={disabled}
      />
    </Field.Root>
  );
}
