import { HStack, Input, Stack, Text } from "@chakra-ui/react";
import { useMemo } from "react";

import PondNativeSelect from "../components/PondNativeSelect";
import { APP_TEXT_SIZES, PANEL_FIELD_PROPS } from "../theme/typography";
import {
  daysInMonth,
  encodePartialDate,
  parsePartialDate,
  type PartialDateParts,
} from "./partialDate";

export type PersonDateFieldsProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

function clampDay(parts: PartialDateParts): PartialDateParts {
  const month = Number.parseInt(parts.month, 10);
  const day = Number.parseInt(parts.day, 10);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return parts;
  const year = parts.year.trim() ? Number.parseInt(parts.year, 10) : null;
  const max = daysInMonth(month, year);
  if (day <= max) return parts;
  return { ...parts, day: String(max) };
}

function updateParts(
  value: string,
  patch: Partial<PartialDateParts>,
  onChange: (value: string) => void,
) {
  const next = clampDay({ ...parsePartialDate(value), ...patch });
  onChange(encodePartialDate(next));
}

export function PersonDateFields({
  label,
  value,
  onChange,
  disabled = false,
}: PersonDateFieldsProps) {
  const parts = useMemo(() => parsePartialDate(value), [value]);
  const monthNum = Number.parseInt(parts.month, 10);
  const yearNum = parts.year.trim() ? Number.parseInt(parts.year, 10) : null;
  const maxDay = Number.isFinite(monthNum) ? daysInMonth(monthNum, yearNum) : 31;

  const dayOptions = useMemo(
    () => Array.from({ length: maxDay }, (_, i) => String(i + 1)),
    [maxDay],
  );

  return (
    <Stack gap="1">
      <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium" color="fg">
        {label}
      </Text>
      <HStack gap="2" align="flex-end" flexWrap="wrap">
        <Stack gap="0.5" flex="1" minW="6rem">
          <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
            Month
          </Text>
          <PondNativeSelect
            rootProps={{ disabled }}
            fieldProps={{
              value: parts.month,
              onChange: (e) => updateParts(value, { month: e.target.value }, onChange),
            }}
          >
            <option value="">—</option>
            {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </PondNativeSelect>
        </Stack>
        <Stack gap="0.5" flex="1" minW="5rem">
          <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
            Day
          </Text>
          <PondNativeSelect
            rootProps={{ disabled }}
            fieldProps={{
              value: parts.day,
              onChange: (e) => updateParts(value, { day: e.target.value }, onChange),
            }}
          >
            <option value="">—</option>
            {dayOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </PondNativeSelect>
        </Stack>
        <Stack gap="0.5" flex="1" minW="6rem">
          <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
            Year (optional)
          </Text>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={9999}
            placeholder="Unknown"
            value={parts.year}
            onChange={(e) => updateParts(value, { year: e.target.value }, onChange)}
            disabled={disabled}
            {...PANEL_FIELD_PROPS}
          />
        </Stack>
      </HStack>
    </Stack>
  );
}
