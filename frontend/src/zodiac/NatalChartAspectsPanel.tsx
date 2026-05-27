import { Box, Heading, Stack, Table, Text } from "@chakra-ui/react";
import { useMemo } from "react";

import { APP_TEXT_SIZES, PANEL_NESTED_BLOCK_PROPS } from "../theme/typography";
import type { NatalChartPayload } from "./chartTypes";
import { formatOrbAsDegMin } from "./chartAngles";

function formatUpperSnake(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const ASPECT_LABEL: Record<string, string> = {
  conjunction: "Conjunction",
  opposition: "Opposition",
  square: "Square",
  trine: "Trine",
  sextile: "Sextile",
  semi_square: "Semi-square",
  sesqui_square: "Sesqui-square",
  quincunx: "Quincunx",
  semi_sextile: "Semi-sextile",
  quintile: "Quintile",
  bi_quintile: "Bi-quintile",
};

/** Ptolemaic / “major” five; everything else (quintiles, semi-, etc.) is minor. */
const MAJOR_ASPECT_TYPES = new Set([
  "conjunction",
  "opposition",
  "square",
  "trine",
  "sextile",
]);

function formatAspectType(type: string): string {
  return ASPECT_LABEL[type] ?? formatUpperSnake(type);
}

function isMajorAspectType(type: string): boolean {
  return MAJOR_ASPECT_TYPES.has(type);
}

function sortAspectsByOrb<
  T extends { orb_deg: number; body_a: string; type: string; body_b: string },
>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const byOrb = a.orb_deg - b.orb_deg;
    if (byOrb !== 0) return byOrb;
    const ka = `${a.body_a}\0${a.type}\0${a.body_b}`;
    const kb = `${b.body_a}\0${b.type}\0${b.body_b}`;
    return ka.localeCompare(kb);
  });
}

type Props = {
  chart: NatalChartPayload;
  aspectsNote?: string;
  aspectsPreviewMax?: number;
  /** When set, only aspects where `body_a` or `body_b` is in this set are shown. */
  anchorBodies?: Set<string>;
  /** Drop aspects involving ascendant or midheaven (e.g. birth time unknown UI). */
  excludeAngleBodies?: boolean;
};

type AspectRow = NatalChartPayload["aspects"][number];

function AspectRows({ rows }: { rows: AspectRow[] }) {
  if (rows.length === 0) {
    return (
      <Table.Row>
        <Table.Cell colSpan={4}>
          <Text fontSize="sm" color="fg.muted">
            None in chart.
          </Text>
        </Table.Cell>
      </Table.Row>
    );
  }
  return (
    <>
      {rows.map((a, idx) => (
        <Table.Row key={`${a.body_a}-${a.type}-${a.body_b}-${idx}`}>
          <Table.Cell>{formatUpperSnake(a.body_a)}</Table.Cell>
          <Table.Cell>{formatAspectType(a.type)}</Table.Cell>
          <Table.Cell>{formatUpperSnake(a.body_b)}</Table.Cell>
          <Table.Cell whiteSpace="nowrap">{formatOrbAsDegMin(a.orb_deg)}</Table.Cell>
        </Table.Row>
      ))}
    </>
  );
}

function AspectTable({ title, rows }: { title: string; rows: AspectRow[] }) {
  return (
    <Box>
      <Heading as="h3" size="sm" mb="2">
        {title}
      </Heading>
      <Box {...PANEL_NESTED_BLOCK_PROPS} overflowX="auto">
        <Table.Root size="sm" variant="line">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader fontWeight="bold">Body</Table.ColumnHeader>
              <Table.ColumnHeader fontWeight="bold">Aspect</Table.ColumnHeader>
              <Table.ColumnHeader fontWeight="bold">Body</Table.ColumnHeader>
              <Table.ColumnHeader fontWeight="bold">Orb</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            <AspectRows rows={rows} />
          </Table.Body>
        </Table.Root>
      </Box>
    </Box>
  );
}

export default function NatalChartAspectsPanel(props: Props) {
  const {
    chart,
    aspectsNote,
    aspectsPreviewMax,
    anchorBodies,
    excludeAngleBodies,
  } = props;

  const { majorRows, minorRows, filteredTotal } = useMemo(() => {
    let raw = [...chart.aspects];
    if (excludeAngleBodies) {
      const isAngle = (b: string) => b === "ascendant" || b === "midheaven";
      raw = raw.filter((a) => !isAngle(a.body_a) && !isAngle(a.body_b));
    }
    if (anchorBodies?.size) {
      raw = raw.filter(
        (a) => anchorBodies.has(a.body_a) || anchorBodies.has(a.body_b),
      );
    }
    if (aspectsPreviewMax != null) {
      raw = raw.slice(0, aspectsPreviewMax);
    }
    const major = raw.filter((a) => isMajorAspectType(a.type));
    const minor = raw.filter((a) => !isMajorAspectType(a.type));
    return {
      majorRows: sortAspectsByOrb(major),
      minorRows: sortAspectsByOrb(minor),
      filteredTotal: raw.length,
    };
  }, [chart.aspects, aspectsPreviewMax, anchorBodies, excludeAngleBodies]);

  const defaultNote = anchorBodies?.size
    ? `${filteredTotal} aspect${filteredTotal === 1 ? "" : "s"} involving the Sun, Moon, Ascendant, Mercury, Venus, Mars, or Midheaven.`
    : `${chart.aspects.length} aspect${chart.aspects.length === 1 ? "" : "s"}.`;

  return (
    <>
      <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" mb="3">
        {aspectsNote ?? defaultNote}
      </Text>
      <Stack gap="6" w="100%">
        <AspectTable title="Major Aspects" rows={majorRows} />
        <AspectTable title="Minor Aspects" rows={minorRows} />
      </Stack>
    </>
  );
}
