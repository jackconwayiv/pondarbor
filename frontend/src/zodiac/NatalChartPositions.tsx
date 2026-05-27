import { Stack } from "@chakra-ui/react";

import type { NatalChartPayload } from "./chartTypes";
import NatalChartAspectsPanel from "./NatalChartAspectsPanel";
import NatalChartHousesTable from "./NatalChartHousesTable";
import NatalChartPlanetsTable from "./NatalChartPlanetsTable";

type Props = {
  chart: NatalChartPayload;
  aspectsNote?: string;
  aspectsPreviewMax?: number;
  /** Staff-meaningful: hide house table and angle-related aspects. */
  birthTimeUnknown?: boolean;
};

/** Full vertical layout (positions + houses + aspects) — used on staff import preview. */
export default function NatalChartPositions(props: Props) {
  const { chart, aspectsNote, aspectsPreviewMax, birthTimeUnknown } = props;

  return (
    <Stack gap="6">
      <NatalChartPlanetsTable chart={chart} hideAngles={birthTimeUnknown} />
      {birthTimeUnknown ? null : <NatalChartHousesTable chart={chart} />}
      <NatalChartAspectsPanel
        chart={chart}
        aspectsNote={aspectsNote}
        aspectsPreviewMax={aspectsPreviewMax}
        excludeAngleBodies={birthTimeUnknown}
      />
    </Stack>
  );
}
