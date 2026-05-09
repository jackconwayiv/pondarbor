import { Box, Table, Text } from "@chakra-ui/react";

import { PANEL_NESTED_BLOCK_PROPS } from "../theme/typography";
import type { ChartPoint, NatalChartPayload } from "./chartTypes";
import { CHART_POINT_ORDER } from "./chartPointOrder";
import { formatDegreesMinutesInSignOnly } from "./chartAngles";

function formatUpperSnake(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function mergedPointEntries(chart: NatalChartPayload): [string, ChartPoint][] {
  const merged: Record<string, ChartPoint> = {
    ...chart.points,
    ...chart.angles,
  };
  const keys = Object.keys(merged);
  const rank = (k: string) => {
    const i = CHART_POINT_ORDER.indexOf(k);
    return i === -1 ? 1000 : i;
  };
  keys.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  return keys.map((k) => [k, merged[k]!]);
}

export default function NatalChartPlanetsTable({ chart }: { chart: NatalChartPayload }) {
  const rows = mergedPointEntries(chart);

  return (
    <Box {...PANEL_NESTED_BLOCK_PROPS} overflowX="auto">
      <Table.Root size="sm" variant="line">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>House</Table.ColumnHeader>
            <Table.ColumnHeader>Body</Table.ColumnHeader>
            <Table.ColumnHeader>Degrees</Table.ColumnHeader>
            <Table.ColumnHeader>Sign</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map(([k, v]) => {
            const displayName = formatUpperSnake(k);
            return (
            <Table.Row key={k}>
              <Table.Cell>{v.house ?? "—"}</Table.Cell>
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
              <Table.Cell whiteSpace="nowrap">
                {formatDegreesMinutesInSignOnly(v.longitude_deg)}
              </Table.Cell>
              <Table.Cell textTransform="capitalize">{v.sign}</Table.Cell>
            </Table.Row>
            );
          })}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}
