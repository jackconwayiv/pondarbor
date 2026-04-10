import { Box, NativeSelectField, NativeSelectRoot, Table } from "@chakra-ui/react";
import { APP_TEXT_SIZES, PANEL_FIELD_PROPS, PANEL_NESTED_BLOCK_PROPS } from "../theme/typography";
import type { Meal } from "./types";
import { WEEKDAY_SHORT, dayColumnOrder, mealLabel } from "./mealLabels";

export default function MealSlotGrid({
  slots,
  slotsPerDay,
  weekStartsOn,
  meals,
  disabled,
  onCellChange,
}: {
  slots: { day_index: number; slot_index: number; meal_ids: number[] }[];
  slotsPerDay: number;
  weekStartsOn: number;
  meals: Meal[];
  disabled?: boolean;
  onCellChange: (dayIndex: number, slotIndex: number, mealIds: number[]) => void;
}) {
  const cols = dayColumnOrder(weekStartsOn);

  function mealsAt(day: number, slot: number): number[] {
    const row = slots.find((x) => x.day_index === day && x.slot_index === slot);
    return row?.meal_ids ?? [];
  }

  return (
    <Box {...PANEL_NESTED_BLOCK_PROPS} bg="bg">
      <Box overflowX="auto">
        <Table.Root size="sm" variant="line">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader w="14" fontSize={APP_TEXT_SIZES.meta} color="fg.muted" />
              {cols.map((d) => (
                <Table.ColumnHeader
                  key={d}
                  textAlign="center"
                  fontWeight="semibold"
                  fontSize={APP_TEXT_SIZES.helper}
                  color="fg"
                >
                  {WEEKDAY_SHORT[d]}
                </Table.ColumnHeader>
              ))}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {Array.from({ length: slotsPerDay }, (_, slotIndex) => (
              <Table.Row key={slotIndex}>
                <Table.Cell fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
                  {slotIndex + 1}
                </Table.Cell>
                {cols.map((dayIndex) => {
                  const mids = mealsAt(dayIndex, slotIndex);
                  return (
                    <Table.Cell key={`${dayIndex}-${slotIndex}`} px="1">
                      <NativeSelectRoot size="xs" disabled={disabled}>
                        <NativeSelectField
                          {...PANEL_FIELD_PROPS}
                          multiple
                          value={mids.map(String)}
                          onChange={(e) => {
                            const selected = Array.from(e.target.selectedOptions).map((opt) =>
                              Number(opt.value),
                            );
                            onCellChange(dayIndex, slotIndex, selected);
                          }}
                        >
                          {meals.map((m) => (
                            <option key={m.id} value={m.id}>
                              {mealLabel(m)}
                            </option>
                          ))}
                        </NativeSelectField>
                      </NativeSelectRoot>
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
