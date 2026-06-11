import { HStack, IconButton, Text } from "@chakra-ui/react";
import { APP_TEXT_SIZES } from "../theme/typography";

const MIN_SLOTS = 1;
const MAX_SLOTS = 5;

type MealPlanSlotControlsProps = {
  slotsPerDay: number;
  disabled?: boolean;
  onChange: (next: number) => void | Promise<void>;
};

export function MealPlanSlotControls({
  slotsPerDay,
  disabled,
  onChange,
}: MealPlanSlotControlsProps) {
  const atMin = slotsPerDay <= MIN_SLOTS;
  const atMax = slotsPerDay >= MAX_SLOTS;

  return (
    <HStack gap="3" align="center" flexWrap="wrap">
      <Text fontSize={APP_TEXT_SIZES.label} fontWeight="semibold">
        Meals per day
      </Text>
      <HStack gap="1" align="center">
        <IconButton
          type="button"
          aria-label="Fewer meals per day"
          variant="outline"
          size="sm"
          minW="8"
          fontSize="lg"
          lineHeight="1"
          disabled={disabled || atMin}
          onClick={() => void onChange(slotsPerDay - 1)}
        >
          −
        </IconButton>
        <Text
          fontSize="xl"
          fontWeight="semibold"
          minW="2ch"
          textAlign="center"
          aria-live="polite"
        >
          {slotsPerDay}
        </Text>
        <IconButton
          type="button"
          aria-label="More meals per day"
          variant="outline"
          size="sm"
          minW="8"
          fontSize="lg"
          lineHeight="1"
          disabled={disabled || atMax}
          onClick={() => void onChange(slotsPerDay + 1)}
        >
          +
        </IconButton>
      </HStack>
    </HStack>
  );
}
