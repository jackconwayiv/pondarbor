import { Box, Table, Text } from "@chakra-ui/react";

import { APP_TEXT_SIZES, PANEL_NESTED_BLOCK_PROPS } from "../theme/typography";
import type { NatalChartPayload } from "./chartTypes";
import { formatDegreesMinutesSign } from "./chartAngles";

export default function NatalChartHousesTable({ chart }: { chart: NatalChartPayload }) {
  const cusps = chart.houses.cusps_longitude_deg;
  const system = chart.houses.system;

  return (
    <>
      <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" mb="3">
        House system: {system}
      </Text>
      <Box {...PANEL_NESTED_BLOCK_PROPS} overflowX="auto">
        <Table.Root size="sm" variant="line">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>House</Table.ColumnHeader>
              <Table.ColumnHeader>Degrees</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {cusps.map((lon, idx) => (
              <Table.Row key={idx}>
                <Table.Cell>{idx + 1}</Table.Cell>
                <Table.Cell whiteSpace="nowrap">{formatDegreesMinutesSign(lon)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>
    </>
  );
}
