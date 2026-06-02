import { HStack, IconButton, Input } from "@chakra-ui/react";

import {
  clampFrequencyCount,
  FREQUENCY_COUNT_MAX,
  FREQUENCY_COUNT_MIN,
} from "./goalFormLimits";
import { GOALS_THEME } from "./theme";

type GoalFrequencyCountInputProps = {
  value: number;
  onChange: (value: number) => void;
};

/** Times-per-day/week count with −/+ steppers for easier mobile input. */
export function GoalFrequencyCountInput({ value, onChange }: GoalFrequencyCountInputProps) {
  const atMin = value <= FREQUENCY_COUNT_MIN;
  const atMax = value >= FREQUENCY_COUNT_MAX;

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
        disabled={atMin}
        onClick={() => onChange(clampFrequencyCount(value - 1))}
      >
        −
      </IconButton>
      <Input
        type="number"
        inputMode="numeric"
        min={FREQUENCY_COUNT_MIN}
        max={FREQUENCY_COUNT_MAX}
        value={value}
        flex="1"
        minW="0"
        textAlign="center"
        fontSize="lg"
        py="2.5"
        onChange={(e) =>
          onChange(clampFrequencyCount(Number(e.target.value) || FREQUENCY_COUNT_MIN))
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
        disabled={atMax}
        onClick={() => onChange(clampFrequencyCount(value + 1))}
      >
        +
      </IconButton>
    </HStack>
  );
}
