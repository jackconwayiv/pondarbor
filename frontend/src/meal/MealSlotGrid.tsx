import { Box, Stack, Table, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { APP_TEXT_SIZES, PANEL_NESTED_BLOCK_PROPS } from "../theme/typography";
import type { Meal, MealCreateInput } from "./types";
import { WEEKDAY_FULL, WEEKDAY_SHORT, dayColumnOrder, mealLabel } from "./mealLabels";
import { MealSlotPickerDialog } from "./MealSlotPickerDialog";

export default function MealSlotGrid({
  slots,
  slotsPerDay,
  weekStartsOn,
  meals,
  disabled,
  onCellChange,
  createMeal,
  onMealCreated,
}: {
  slots: { day_index: number; slot_index: number; meal_ids: number[] }[];
  slotsPerDay: number;
  weekStartsOn: number;
  meals: Meal[];
  disabled?: boolean;
  onCellChange: (dayIndex: number, slotIndex: number, mealIds: number[]) => void | Promise<void>;
  createMeal?: (body: MealCreateInput) => Promise<Meal>;
  onMealCreated?: (meal: Meal) => void;
}) {
  const cols = dayColumnOrder(weekStartsOn);
  const [picker, setPicker] = useState<{ dayIndex: number; slotIndex: number } | null>(null);

  const mealsById = useMemo(() => new Map(meals.map((m) => [m.id, m])), [meals]);

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
              <Table.Row key={slotIndex} _last={{ "& td": { borderBottom: "none" } }}>
                {cols.map((dayIndex) => {
                  const mids = mealsAt(dayIndex, slotIndex);
                  const isEmpty = mids.length === 0;
                  return (
                    <Table.Cell key={`${dayIndex}-${slotIndex}`} px="1" verticalAlign="top">
                      <Box
                        role="button"
                        tabIndex={disabled ? -1 : 0}
                        minH="12"
                        px="2"
                        py="2"
                        borderRadius="md"
                        borderWidth="1px"
                        borderColor="border"
                        bg={isEmpty ? "gray.200" : undefined}
                        cursor={disabled ? "not-allowed" : "pointer"}
                        opacity={disabled ? 0.65 : 1}
                        transition="border-color 0.15s, background 0.15s"
                        aria-label={isEmpty ? "Empty slot, add meals" : undefined}
                        _hover={
                          disabled
                            ? undefined
                            : { borderColor: "lilypad.solid", bg: "lilypad.subtle" }
                        }
                        onClick={() => {
                          if (!disabled) setPicker({ dayIndex, slotIndex });
                        }}
                        onKeyDown={(e) => {
                          if (disabled) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setPicker({ dayIndex, slotIndex });
                          }
                        }}
                      >
                        {!isEmpty ? (
                          <Stack gap="1" w="100%" align="stretch">
                            {mids.map((id) => {
                              const m = mealsById.get(id);
                              const label = m ? mealLabel(m) : `Meal #${id}`;
                              return (
                                <Text
                                  key={id}
                                  fontSize={APP_TEXT_SIZES.helper}
                                  color="fg"
                                  lineHeight="short"
                                  whiteSpace="normal"
                                  wordBreak="break-word"
                                >
                                  {label}
                                </Text>
                              );
                            })}
                          </Stack>
                        ) : null}
                      </Box>
                    </Table.Cell>
                  );
                })}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>

      {picker ? (
        <MealSlotPickerDialog
          open
          onOpenChange={(next) => {
            if (!next) setPicker(null);
          }}
          dayLabel={WEEKDAY_FULL[picker.dayIndex]}
          slotNumber={picker.slotIndex + 1}
          mealIds={mealsAt(picker.dayIndex, picker.slotIndex)}
          meals={meals}
          disabled={disabled}
          onCommit={(ids) => Promise.resolve(onCellChange(picker.dayIndex, picker.slotIndex, ids))}
          createMeal={createMeal}
          onMealCreated={onMealCreated}
        />
      ) : null}
    </Box>
  );
}
