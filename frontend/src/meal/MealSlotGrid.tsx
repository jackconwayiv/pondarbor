import { Box, Button, HStack, Stack, Table, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { useIsMobile } from "../responsive";
import { APP_TEXT_SIZES, PANEL_NESTED_BLOCK_PROPS } from "../theme/typography";
import type { Meal, MealCreateInput } from "./types";
import { WEEKDAY_FULL, WEEKDAY_SHORT, dayColumnOrder, mealLabel } from "./mealLabels";
import { formatCalendarDayInWeek } from "./mealPlanDates";
import { MealPlanSlotCell } from "./MealPlanSlotCell";
import { MealSlotPickerDialog } from "./MealSlotPickerDialog";

function slotDisplayName(slotLabels: string[] | undefined, slotIndex: number): string {
  const s = slotLabels?.[slotIndex]?.trim();
  if (s) return s;
  return `Slot ${slotIndex + 1}`;
}

export default function MealSlotGrid({
  slots,
  slotsPerDay,
  weekStartsOn,
  weekStartIso,
  slotLabels,
  meals,
  disabled,
  onCellChange,
  onApplySlotToAllDays,
  createMeal,
  onMealCreated,
}: {
  slots: { day_index: number; slot_index: number; meal_ids: number[] }[];
  slotsPerDay: number;
  weekStartsOn: number;
  /** When set, mobile day header includes this calendar date. */
  weekStartIso?: string;
  /** One label per row, length `slotsPerDay`. */
  slotLabels?: string[];
  meals: Meal[];
  disabled?: boolean;
  onCellChange: (dayIndex: number, slotIndex: number, mealIds: number[]) => void | Promise<void>;
  /** When set, picker shows “Apply to all days” for the open row. */
  onApplySlotToAllDays?: (slotIndex: number, mealIds: number[]) => void | Promise<void>;
  createMeal?: (body: MealCreateInput) => Promise<Meal>;
  onMealCreated?: (meal: Meal) => void;
}) {
  const cols = dayColumnOrder(weekStartsOn);
  const [picker, setPicker] = useState<{ dayIndex: number; slotIndex: number } | null>(null);
  const [mobileDayPage, setMobileDayPage] = useState(0);
  const isMobile = useIsMobile();

  useEffect(() => {
    setMobileDayPage(0);
  }, [weekStartsOn]);

  const mealsById = useMemo(() => new Map(meals.map((m) => [m.id, m])), [meals]);

  function mealsAt(day: number, slot: number): number[] {
    const row = slots.find((x) => x.day_index === day && x.slot_index === slot);
    return row?.meal_ids ?? [];
  }

  function renderCell(dayIndex: number, slotIndex: number) {
    const mids = mealsAt(dayIndex, slotIndex);
    const isEmpty = mids.length === 0;
    const name = slotDisplayName(slotLabels, slotIndex);
    return (
      <MealPlanSlotCell
        variant={isEmpty ? "emptyInput" : "scheduled"}
        disabled={disabled}
        aria-label={isEmpty ? `Empty ${name}, add meals` : `${name}: ${mids.length} meal(s)`}
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
        {!isEmpty
          ? mids.map((id) => {
              const m = mealsById.get(id);
              const label = m ? mealLabel(m) : `Meal #${id}`;
              return (
                <Text
                  key={id}
                  fontSize={APP_TEXT_SIZES.helper}
                  fontWeight="bold"
                  color="fg"
                  lineHeight="short"
                  whiteSpace="normal"
                  wordBreak="break-word"
                >
                  {label}
                </Text>
              );
            })
          : undefined}
      </MealPlanSlotCell>
    );
  }

  const pickerApplyAll =
    onApplySlotToAllDays && picker
      ? async (mealIds: number[]) => {
          await onApplySlotToAllDays(picker.slotIndex, mealIds);
        }
      : undefined;

  const dialog =
    picker != null ? (
      <MealSlotPickerDialog
        open
        onOpenChange={(next) => {
          if (!next) setPicker(null);
        }}
        dayLabel={WEEKDAY_FULL[picker.dayIndex]}
        slotDisplayName={slotDisplayName(slotLabels, picker.slotIndex)}
        mealIds={mealsAt(picker.dayIndex, picker.slotIndex)}
        meals={meals}
        disabled={disabled}
        onCommit={(ids) => Promise.resolve(onCellChange(picker.dayIndex, picker.slotIndex, ids))}
        onApplyToAllDays={pickerApplyAll}
        createMeal={createMeal}
        onMealCreated={onMealCreated}
      />
    ) : null;

  if (isMobile) {
    const dayIndex = cols[mobileDayPage % cols.length];
    const dayTitle = WEEKDAY_FULL[dayIndex];
    const dateLine =
      weekStartIso != null ? formatCalendarDayInWeek(weekStartIso, dayIndex) : null;

    return (
      <Box {...PANEL_NESTED_BLOCK_PROPS} bg="bg">
        <HStack justify="space-between" align="center" mb="3" flexWrap="wrap" gap="2">
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => setMobileDayPage((p) => (p + 6) % 7)}
          >
            Previous day
          </Button>
          <Text
            fontWeight="semibold"
            fontSize={APP_TEXT_SIZES.body}
            textAlign="center"
            flex="1"
            minW="0"
          >
            {dateLine ? `${dayTitle} · ${dateLine}` : dayTitle}
          </Text>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => setMobileDayPage((p) => (p + 1) % 7)}
          >
            Next day
          </Button>
        </HStack>
        <Stack gap="2">
          {Array.from({ length: slotsPerDay }, (_, slotIndex) => (
            <Box key={slotIndex}>{renderCell(dayIndex, slotIndex)}</Box>
          ))}
        </Stack>
        {dialog}
      </Box>
    );
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
                {cols.map((dayIndex) => (
                  <Table.Cell key={`${dayIndex}-${slotIndex}`} px="1" verticalAlign="top">
                    {renderCell(dayIndex, slotIndex)}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>
      {dialog}
    </Box>
  );
}
