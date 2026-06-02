import { Box, Card, Heading, Stack, Table, Text } from "@chakra-ui/react";
import { APP_TEXT_SIZES, PANEL_ENTRY_CARD_BODY_PROPS, PANEL_ENTRY_CARD_PROPS, PANEL_NESTED_BLOCK_PROPS } from "../theme/typography";
import { dayColumnOrder, mealLabel } from "./mealLabels";
import type { Meal } from "./types";
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
  mealsById: Map<number, Meal>;
  selectedDayIndex: number;
  onSelectDay: (dayIndex: number) => void;
};

export function MealPlanWeekStrip({
  weekStartIso,
  slots,
  slotsPerDay,
  weekStartsOn,
  mealsById,
  selectedDayIndex,
  onSelectDay,
}: MealPlanWeekStripProps) {
  const dayOrder = dayColumnOrder(weekStartsOn);
  const n = Math.max(1, slotsPerDay);

  function renderCell(dayIndex: number, slotIndex: number) {
    const mids = slotMealIds(slots, dayIndex, slotIndex);
    const isEmpty = mids.length === 0;
    const isSelectedDay = dayIndex === selectedDayIndex;
    return (
      <Box
        role="button"
        tabIndex={0}
        minH="10"
        px="1"
        py="1"
        borderRadius="md"
        borderWidth="2px"
        borderColor={isSelectedDay ? "teal.solid" : "border"}
        bg={isEmpty ? "gray.200" : "lilypad.subtle"}
        cursor="pointer"
        onClick={() => onSelectDay(dayIndex)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectDay(dayIndex);
          }
        }}
        aria-label={`View day ${dayIndex + 1}`}
      >
        {!isEmpty ? (
          <Stack gap="0">
            {mids.slice(0, 2).map((id) => {
              const m = mealsById.get(id);
              const label = m ? mealLabel(m) : `#${id}`;
              return (
                <Text
                  key={id}
                  fontSize={APP_TEXT_SIZES.meta}
                  color="fg"
                  lineClamp={2}
                  lineHeight="short"
                  wordBreak="break-word"
                >
                  {label}
                </Text>
              );
            })}
            {mids.length > 2 ? (
              <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
                +{mids.length - 2}
              </Text>
            ) : null}
          </Stack>
        ) : null}
      </Box>
    );
  }

  return (
    <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
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
                    return (
                      <Table.ColumnHeader
                        key={dayIndex}
                        textAlign="center"
                        px="1"
                        fontWeight={dayIndex === selectedDayIndex ? "bold" : "semibold"}
                        color={dayIndex === selectedDayIndex ? "teal.solid" : "fg"}
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
                    {dayOrder.map((dayIndex) => (
                      <Table.Cell key={dayIndex} px="1" py="1" verticalAlign="top">
                        {renderCell(dayIndex, slotIndex)}
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        </Box>
      </Card.Body>
    </Card.Root>
  );
}
