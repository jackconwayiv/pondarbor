import { Box, Card, Heading, Table, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router";
import {
  APP_TEXT_SIZES,
  MEAL_NAV_LINK_CARD_PROPS,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_NESTED_BLOCK_PROPS,
} from "../theme/typography";
import { MealPlanSlotCell } from "./MealPlanSlotCell";
import { dayColumnOrder } from "./mealLabels";
import { formatWeekStartShort } from "./mealPlanDates";
import type { MealReadonlySlot } from "./MealReadonlyGrid";

function slotMealIds(
  slots: MealReadonlySlot[],
  dayIndex: number,
  slotIndex: number,
): number[] {
  const row = slots.find((x) => x.day_index === dayIndex && x.slot_index === slotIndex);
  return row?.meal_ids ?? [];
}

type MealPlanWeekStripProps = {
  weekStartIso: string;
  slots: MealReadonlySlot[];
  slotsPerDay: number;
  weekStartsOn: number;
  selectedDayIndex: number;
};

export function MealPlanWeekStrip({
  weekStartIso,
  slots,
  slotsPerDay,
  weekStartsOn,
  selectedDayIndex,
}: MealPlanWeekStripProps) {
  const dayOrder = dayColumnOrder(weekStartsOn);
  const n = Math.max(1, slotsPerDay);
  const editorTo = `/meal/plan/plans/new?week=${encodeURIComponent(weekStartIso)}`;
  const weekLabel = formatWeekStartShort(weekStartIso);

  return (
    <RouterLink
      to={editorTo}
      aria-label={`Edit week of ${weekLabel}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0" {...MEAL_NAV_LINK_CARD_PROPS}>
        <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
          <Heading size="sm" mb="2">
            This week
          </Heading>
          <Box {...PANEL_NESTED_BLOCK_PROPS} bg="bg" p="2">
            <Box overflowX="auto">
              <Table.Root size="sm" variant="line">
                <Table.Header>
                  <Table.Row>
                    {dayOrder.map((dayIndex) => {
                      const [y, m, d] = weekStartIso.split("-").map(Number);
                      const date = new Date(y, m - 1, d + dayIndex);
                      const header = date.toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "numeric",
                        day: "numeric",
                      });
                      const isSelected = dayIndex === selectedDayIndex;
                      return (
                        <Table.ColumnHeader
                          key={dayIndex}
                          textAlign="center"
                          px="1"
                          fontWeight={isSelected ? "bold" : "semibold"}
                          color={isSelected ? "teal.solid" : "fg"}
                          borderBottomColor={isSelected ? "teal.solid" : undefined}
                          borderBottomWidth={isSelected ? "2px" : undefined}
                        >
                          <Text fontSize={APP_TEXT_SIZES.meta}>{header}</Text>
                        </Table.ColumnHeader>
                      );
                    })}
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {Array.from({ length: n }, (_, slotIndex) => (
                    <Table.Row key={slotIndex} _last={{ "& td": { borderBottom: "none" } }}>
                      {dayOrder.map((dayIndex) => {
                        const mids = slotMealIds(slots, dayIndex, slotIndex);
                        return (
                          <Table.Cell key={dayIndex} px="1" py="1" verticalAlign="top">
                            <MealPlanSlotCell variant="weekDot" isFilled={mids.length > 0} />
                          </Table.Cell>
                        );
                      })}
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
          </Box>
        </Card.Body>
      </Card.Root>
    </RouterLink>
  );
}
