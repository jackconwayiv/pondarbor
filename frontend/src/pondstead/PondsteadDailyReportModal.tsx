import { Text, VStack } from "@chakra-ui/react";

import { AppModal } from "../components/AppModal";

export type PondsteadDailyReport = {
  welcomeDay: number;
  playerName: string;
  foodGained: number;
  woodGained: number;
  stoneGained: number;
  recruits: { kindLabel: string; buildingLabel: string }[];
  /** “Your Orchard has finished construction!” */
  completedBuildings: { label: string }[];
  /** In-progress sites after this morning’s tick. */
  stillBuilding: { label: string; nightsLeft: number }[];
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
          </>
        ) : null}
      </VStack>
    </AppModal>
  );
}
