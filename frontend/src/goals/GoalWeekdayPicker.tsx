import { Button, HStack } from "@chakra-ui/react";

import { weekdayLabel } from "./goalCopy";
import { GOALS_THEME } from "./theme";

type GoalWeekdayPickerProps = {
  value: number | null;
  onChange: (weekday: number) => void;
  disabled?: boolean;
};

export function GoalWeekdayPicker({ value, onChange, disabled }: GoalWeekdayPickerProps) {
  return (
    <HStack gap="1.5" flexWrap="wrap">
      {Array.from({ length: 7 }, (_, weekday) => {
        const selected = value === weekday;
        return (
          <Button
            key={weekday}
            size="xs"
            variant={selected ? "solid" : "outline"}
            colorPalette={selected ? "teal" : "gray"}
            borderColor={selected ? GOALS_THEME.pineGreen : undefined}
            bg={selected ? GOALS_THEME.pineLight : undefined}
            color={GOALS_THEME.textOnLight}
            disabled={disabled}
            onClick={() => onChange(weekday)}
          >
            {weekdayLabel(weekday)}
          </Button>
        );
      })}
    </HStack>
  );
}
