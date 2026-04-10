import { Box, Table, Text } from "@chakra-ui/react";
import { APP_TEXT_SIZES, PANEL_NESTED_BLOCK_PROPS } from "../theme/typography";
import { WEEKDAY_SHORT, dayColumnOrder, mealLabel } from "./mealLabels";
import type { Meal } from "./types";

export type MealReadonlySlot = {
  day_index: number;
  slot_index: number;
  meal_id: number | null;
};

function slotMealId(
  slots: MealReadonlySlot[],
  dayIndex: number,
  slotIndex: number,
): number | null {
  const row = slots.find((x) => x.day_index === dayIndex && x.slot_index === slotIndex);
  return row?.meal_id ?? null;
}

function calendarDateForDay(weekStartIso: string, dayIndex: number): Date {
  const [y, m, d] = weekStartIso.split("-").map(Number);
  return new Date(y, m - 1, d + dayIndex);
}

function formatDayColumnHeader(weekStartIso: string, dayIndex: number): string {
  return calendarDateForDay(weekStartIso, dayIndex).toLocaleDateString(undefined, {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  });
}

type MealReadonlyGridProps = {
  slots: MealReadonlySlot[];
  slotsPerDay: number;
  weekStartsOn: number;
  mealsById: Map<number, Meal>;
} & (
  | { headerMode: "dates"; weekStartIso: string }
  | { headerMode: "weekdays" }
);

/**
 * Read-only week grid: columns = days, rows = slots. Matches `MealSlotGrid` / week-plan layout.
 * Use `headerMode="dates"` with a real `weekStartIso` for plan instances; `weekdays` for templates.
 */
export function MealReadonlyGrid(props: MealReadonlyGridProps) {
  const { slots, slotsPerDay, weekStartsOn, mealsById, headerMode } = props;
  const dayOrder = dayColumnOrder(weekStartsOn);
  const n = Math.max(1, slotsPerDay);

  function labelForMealId(mid: number | null): string {
    if (mid == null) return "—";
    const m = mealsById.get(mid);
    return m ? mealLabel(m) : `Meal #${mid}`;
  }

  return (
    <Box {...PANEL_NESTED_BLOCK_PROPS} bg="bg">
      <Box overflowX="auto">
        <Table.Root size="sm" variant="line">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader w="14" fontSize={APP_TEXT_SIZES.meta} color="fg.muted" />
              {dayOrder.map((dayIndex) => (
                <Table.ColumnHeader key={dayIndex} textAlign="center" px="1" maxW="32">
                  <Text
                    fontWeight="semibold"
                    fontSize={APP_TEXT_SIZES.helper}
                    color="fg"
                    lineHeight="short"
                  >
                    {headerMode === "dates"
                      ? formatDayColumnHeader(props.weekStartIso, dayIndex)
                      : WEEKDAY_SHORT[dayIndex]}
                  </Text>
                </Table.ColumnHeader>
              ))}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {Array.from({ length: n }, (_, slotIndex) => (
            <Table.Row key={slotIndex}>
              <Table.Cell fontSize={APP_TEXT_SIZES.meta} color="fg.muted" verticalAlign="top">
                {slotIndex + 1}
              </Table.Cell>
              {dayOrder.map((dayIndex) => (
                <Table.Cell key={dayIndex} px="1" py="2" verticalAlign="top" maxW="32">
                  <Text
                    fontSize={APP_TEXT_SIZES.helper}
                    color="fg.muted"
                    lineHeight="short"
                    wordBreak="break-word"
                  >
                    {labelForMealId(slotMealId(slots, dayIndex, slotIndex))}
                  </Text>
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
        </Table.Root>
      </Box>
    </Box>
  );
}
