import { Stack } from "@chakra-ui/react";

import type { NatalChartPayload } from "./chartTypes";
import NatalChartAspectsPanel from "./NatalChartAspectsPanel";
import NatalChartHousesTable from "./NatalChartHousesTable";
import NatalChartPlanetsTable from "./NatalChartPlanetsTable";

type Props = {
  chart: NatalChartPayload;
  aspectsNote?: string;
  aspectsPreviewMax?: number;
};

/** Full vertical layout (positions + houses + aspects) — used on staff import preview. */
export default function NatalChartPositions(props: Props) {
  const { chart, aspectsNote, aspectsPreviewMax } = props;

  return (
    <Stack gap="6">
      <NatalChartPlanetsTable chart={chart} />
      <NatalChartHousesTable chart={chart} />
      <NatalChartAspectsPanel
        chart={chart}
        aspectsNote={aspectsNote}
        aspectsPreviewMax={aspectsPreviewMax}
      />
    </Stack>
  );
}
