import { HStack, IconButton, Input } from "@chakra-ui/react";

import {
  FREQUENCY_COUNT_MAX,
  FREQUENCY_COUNT_MIN,
} from "./goalFormLimits";
import { GOALS_THEME } from "./theme";

type GoalFrequencyCountInputProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
};

function clampCount(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Times-per-day/week count with −/+ steppers for easier mobile input. */
export function GoalFrequencyCountInput({
  value,
  onChange,
  min = FREQUENCY_COUNT_MIN,
  max = FREQUENCY_COUNT_MAX,
  disabled = false,
}: GoalFrequencyCountInputProps) {
  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <HStack gap="2" width="full" maxW="11rem">
      <IconButton
        type="button"
        aria-label="Decrease count"
        variant="outline"
        size="lg"
        flexShrink={0}
        minW="11"
        minH="11"
        fontSize="xl"
        lineHeight="1"
        borderColor={GOALS_THEME.cardBodyBorder}
        color={GOALS_THEME.textOnLight}
        disabled={disabled || atMin}
        onClick={() => onChange(clampCount(value - 1, min, max))}
      >
        −
      </IconButton>
      <Input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        flex="1"
        minW="0"
        textAlign="center"
        fontSize="lg"
        py="2.5"
        disabled={disabled}
        onChange={(e) =>
          onChange(clampCount(Number(e.target.value) || min, min, max))
        }
      />
      <IconButton
        type="button"
        aria-label="Increase count"
        variant="outline"
        size="lg"
        flexShrink={0}
        minW="11"
        minH="11"
        fontSize="xl"
        lineHeight="1"
        borderColor={GOALS_THEME.cardBodyBorder}
        color={GOALS_THEME.textOnLight}
        disabled={disabled || atMax}
        onClick={() => onChange(clampCount(value + 1, min, max))}
      >
        +
      </IconButton>
    </HStack>
  );
}
