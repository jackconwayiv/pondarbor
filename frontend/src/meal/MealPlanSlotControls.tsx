import { HStack, Text } from "@chakra-ui/react";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";

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
  return (
    <HStack gap="2" flexWrap="wrap" align="center">
      <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
        {slotsPerDay} meal {slotsPerDay === 1 ? "slot" : "slots"} per day
      </Text>
      <PondButton
        size="sm"
        variant="outline"
        colorPalette="sky"
        disabled={disabled || slotsPerDay <= 1}
        onClick={() => void onChange(slotsPerDay - 1)}
      >
        Remove row
      </PondButton>
      <PondButton
        size="sm"
        variant="outline"
        colorPalette="sky"
        disabled={disabled || slotsPerDay >= 5}
        onClick={() => void onChange(slotsPerDay + 1)}
      >
        Add row
      </PondButton>
    </HStack>
  );
}
