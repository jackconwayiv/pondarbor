import { Text, VStack } from "@chakra-ui/react";

import { AppModal } from "../components/AppModal";

export type PondsteadDailyReport = {
  welcomeDay: number;
  playerName: string;
  /** Seat whose private income block is shown (hotseat). */
  viewerSeat?: number;
  foodGained: number;
  woodGained: number;
  stoneGained: number;
  recruits: { kindLabel: string; buildingLabel: string }[];
  /** “Your Orchard has finished construction!” */
  completedBuildings: { label: string }[];
  /** In-progress sites after this morning’s tick. */
  stillBuilding: { label: string; nightsLeft: number }[];
  /** Day-start combat log lines (private + echoed in global). */
  combatLines?: string[];
  /** Public headlines (e.g. other seats’ combat). */
  globalHeadlines?: string[];
  /** End-of-report standings. */
  scoreboard?: Array<{ seatIndex: number; displayName: string; points: number }>;
};

type Props = {
  report: PondsteadDailyReport | null;
  onOpenChange: (open: boolean) => void;
};

function moreDaysOfConstructionLine(label: string, nightsLeft: number): string {
  if (nightsLeft === 1) {
    return `Your ${label} has 1 more day of construction.`;
  }
  return `Your ${label} has ${nightsLeft} more days of construction.`;
}

export default function PondsteadDailyReportModal({ report, onOpenChange }: Props) {
  const open = report != null;
  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title="Daily Report"
      size="md"
      bodyProps={{ pb: "4" }}
    >
      <VStack align="stretch" gap="3">
        {report ? (
          <>
            <Text fontSize="md" fontWeight="semibold" color="fg">
              Welcome to Day {report.welcomeDay}, {report.playerName}!
            </Text>
            {report.foodGained > 0 ? (
              <Text fontSize="sm" color="fg">
                You gained {report.foodGained} food.
              </Text>
            ) : null}
            {report.woodGained > 0 ? (
              <Text fontSize="sm" color="fg">
                You gained {report.woodGained} wood.
              </Text>
            ) : null}
            {report.stoneGained > 0 ? (
              <Text fontSize="sm" color="fg">
                You gained {report.stoneGained} stone.
              </Text>
            ) : null}
            {report.recruits.map((r, i) => (
              <Text key={`r-${i}`} fontSize="sm" color="fg">
                A new {r.kindLabel} has been recruited at your {r.buildingLabel}.
              </Text>
            ))}
            {report.completedBuildings.map((b, i) => (
              <Text key={`c-${i}`} fontSize="sm" color="fg">
                Your {b.label} has finished construction!
              </Text>
            ))}
            {report.stillBuilding.map((s, i) => (
              <Text key={`s-${i}`} fontSize="sm" color="fg">
                {moreDaysOfConstructionLine(s.label, s.nightsLeft)}
              </Text>
            ))}
            {report.combatLines != null && report.combatLines.length > 0 ? (
              <>
                <Text fontSize="sm" fontWeight="semibold" color="fg.muted" pt="1">
                  Combat
                </Text>
                {report.combatLines.map((line, i) => (
                  <Text key={`x-${i}`} fontSize="sm" color="fg">
                    {line}
                  </Text>
                ))}
              </>
            ) : null}
            {report.globalHeadlines != null && report.globalHeadlines.length > 0 ? (
              <>
                <Text fontSize="sm" fontWeight="semibold" color="fg.muted" pt="1">
                  World news
                </Text>
                {report.globalHeadlines.map((line, i) => (
                  <Text key={`g-${i}`} fontSize="sm" color="fg">
                    {line}
                  </Text>
                ))}
              </>
            ) : null}
            {report.scoreboard != null && report.scoreboard.length > 0 ? (
              <>
                <Text fontSize="sm" fontWeight="semibold" color="fg.muted" pt="1">
                  Scoreboard
                </Text>
                {report.scoreboard.map((row) => (
                  <Text key={`sb-${row.seatIndex}`} fontSize="sm" color="fg">
                    {row.displayName} (seat {row.seatIndex}): {row.points} pts
                  </Text>
                ))}
              </>
            ) : null}
          </>
        ) : null}
      </VStack>
    </AppModal>
  );
}
