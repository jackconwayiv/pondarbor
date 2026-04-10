import { Box, Stack, Table, Text } from "@chakra-ui/react";
import { APP_TEXT_SIZES, PANEL_NESTED_BLOCK_PROPS } from "../theme/typography";
import { WEEKDAY_SHORT, dayColumnOrder, mealLabel } from "./mealLabels";
import type { Meal } from "./types";

export type MealReadonlySlot = {
  day_index: number;
  slot_index: number;
  meal_ids: number[];
};

function slotMealIds(
  slots: MealReadonlySlot[],
  dayIndex: number,
  slotIndex: number,
): number[] {
  const row = slots.find((x) => x.day_index === dayIndex && x.slot_index === slotIndex);
  return row?.meal_ids ?? [];
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
  /** Omit inner border when the grid is the sole content inside a parent `Card`. */
  embeddedInParentCard?: boolean;
} & (
  | { headerMode: "dates"; weekStartIso: string }
  | { headerMode: "weekdays" }
);

/**
 * Read-only week grid: columns = days, rows = slots. Matches `MealSlotGrid` / week-plan layout.
 * Use `headerMode="dates"` with a real `weekStartIso` for plan instances; `weekdays` for templates.
 */
export function MealReadonlyGrid(props: MealReadonlyGridProps) {
  const { slots, slotsPerDay, weekStartsOn, mealsById, headerMode, embeddedInParentCard } = props;
  const frameProps = embeddedInParentCard
    ? { p: "2" as const, bg: "bg" as const, borderWidth: "0" as const, borderRadius: "0" as const }
    : PANEL_NESTED_BLOCK_PROPS;
  const dayOrder = dayColumnOrder(weekStartsOn);
  const n = Math.max(1, slotsPerDay);

  return (
    <Box {...frameProps}>
      <Box overflowX="auto">
        <Table.Root size="sm" variant="line">
          <Table.Header>
            <Table.Row>
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
            <Table.Row key={slotIndex} _last={{ "& td": { borderBottom: "none" } }}>
              {dayOrder.map((dayIndex) => {
                const mids = slotMealIds(slots, dayIndex, slotIndex);
                return (
                  <Table.Cell key={dayIndex} px="1" py="2" verticalAlign="top" maxW="32">
                    {mids.length === 0 ? (
                      <Text
                        fontSize={APP_TEXT_SIZES.helper}
                        color="fg.muted"
                        lineHeight="short"
                        wordBreak="break-word"
                      >
                        —
                      </Text>
                    ) : (
                      <Stack gap="1" w="100%" align="stretch">
                        {mids.map((mid) => {
                          const m = mealsById.get(mid);
                          const label = m ? mealLabel(m) : `Meal #${mid}`;
                          return (
                            <Text
                              key={mid}
                              fontSize={APP_TEXT_SIZES.helper}
                              color="fg.muted"
                              lineHeight="short"
                              wordBreak="break-word"
                            >
                              {label}
                            </Text>
                          );
                        })}
                      </Stack>
                    )}
                  </Table.Cell>
                );
              })}
            </Table.Row>
          ))}
        </Table.Body>
        </Table.Root>
      </Box>
    </Box>
  );
}
