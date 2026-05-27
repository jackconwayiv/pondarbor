import { Box, Table, Text } from "@chakra-ui/react";
import type { KeyboardEvent } from "react";

import { PANEL_NESTED_BLOCK_PROPS } from "../theme/typography";
import type { ChartPoint, NatalChartPayload } from "./chartTypes";
import { CHART_POINT_ORDER } from "./chartPointOrder";
import { formatDegreesMinutesInSignOnly } from "./chartAngles";
import { PLACEMENT_PANE_CHART_KEYS } from "./zodiacPlacementFromChart";
import { ZODIAC_MEMBER_PLANET_EXCLUDE_KEYS } from "./zodiacDisplayConfig";

function formatUpperSnake(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** e.g. `in Libra` */
function inSignPhrase(sign: string | undefined): string {
  const s = sign?.trim();
  if (!s) return "—";
  const lower = s.toLowerCase();
  return `in ${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
}

/** e.g. `in the 7th House`, or em dash when house unknown. */
function inTheNthHousePhrase(house: number | undefined | null): string {
  if (house == null || !Number.isInteger(house) || house < 1 || house > 12) return "—";
  const n = house;
  const suffix =
    n % 10 === 1 && n % 100 !== 11
      ? "st"
      : n % 10 === 2 && n % 100 !== 12
        ? "nd"
        : n % 10 === 3 && n % 100 !== 13
          ? "rd"
          : "th";
  return `in the ${n}${suffix} House`;
}

function mergedPointEntries(
  chart: NatalChartPayload,
  hideAngles?: boolean,
): [string, ChartPoint][] {
  const merged: Record<string, ChartPoint> = {
    ...chart.points,
    ...chart.angles,
  };
  if (hideAngles) {
    delete merged.ascendant;
    delete merged.midheaven;
  }
  const keys = Object.keys(merged).filter((k) => !ZODIAC_MEMBER_PLANET_EXCLUDE_KEYS.has(k));
  const rank = (k: string) => {
    const i = CHART_POINT_ORDER.indexOf(k);
    return i === -1 ? 1000 : i;
  };
  keys.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  return keys.map((k) => [k, merged[k]!]);
}

type Props = {
  chart: NatalChartPayload;
  onBodyRowClick?: (chartKey: string) => void;
  /** Omit ascendant and midheaven (e.g. birth time unknown). */
  hideAngles?: boolean;
};

export default function NatalChartPlanetsTable({ chart, onBodyRowClick, hideAngles }: Props) {
  const rows = mergedPointEntries(chart, hideAngles);

  const rowKeyActivate = (chartKey: string, e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onBodyRowClick?.(chartKey);
    }
  };

  return (
    <Box {...PANEL_NESTED_BLOCK_PROPS} overflowX="auto">
      <Table.Root size="sm" variant="line">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader fontWeight="bold">Body</Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="bold">Sign</Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="bold">House</Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="bold">Degrees</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map(([k, v]) => {
            const displayName = formatUpperSnake(k);
            const interactive =
              Boolean(onBodyRowClick) && PLACEMENT_PANE_CHART_KEYS.has(k);
            return (
              <Table.Row
                key={k}
                tabIndex={interactive ? 0 : undefined}
                cursor={interactive ? "pointer" : undefined}
                onClick={interactive ? () => onBodyRowClick?.(k) : undefined}
                onKeyDown={interactive ? (e) => rowKeyActivate(k, e) : undefined}
                aria-label={
                  interactive ? `${displayName}: open placement details` : undefined
                }
                _focusVisible={
                  interactive
                    ? { outline: "2px solid", outlineColor: "fg", outlineOffset: "2px" }
                    : undefined
                }
              >
                <Table.Cell>
                  <Text
                    as="span"
                    aria-label={v.retrograde ? `${displayName}, retrograde` : displayName}
                  >
                    {displayName}
                    {v.retrograde ? (
                      <Text
                        as="span"
                        ml="1"
                        color="fg.muted"
                        fontWeight="normal"
                        aria-hidden="true"
                      >
                        Я
                      </Text>
                    ) : null}
                  </Text>
                </Table.Cell>
                <Table.Cell>{inSignPhrase(v.sign)}</Table.Cell>
                <Table.Cell>{inTheNthHousePhrase(v.house)}</Table.Cell>
                <Table.Cell whiteSpace="nowrap">
                  {formatDegreesMinutesInSignOnly(v.longitude_deg)}
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}
