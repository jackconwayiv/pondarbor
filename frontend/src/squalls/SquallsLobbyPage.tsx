import { Box, Heading, HStack, Text, VStack } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { fullBleedStackProps } from "../responsive";
import RestartAdventureConfirmModal from "./RestartAdventureConfirmModal";
import {
  readShantiesSave,
  readShantiesSaveWithMeta,
} from "./shantiesLocalSave";
import {
  buildSaveSummaryLines,
  formatIslandDisplayName,
  formatSavedAt,
  hasResumableAdventure,
} from "./shantiesSaveSummary";
import { renderPortTownName } from "./portTowns";
import {
  formatActSummaryLine,
  formatMidCombatResumeHint,
  isMidCombatSaveState,
} from "./squallsCampaign";
import { SQUALLS_HUD_COLORS } from "./squallsTheme";

export default function SquallsLobbyPage() {
  const navigate = useNavigate();
  const { sessionUser } = useAppSession();
  const isStaff = !!sessionUser?.user?.is_staff;
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);

  const save = readShantiesSave();
  const canResume = save ? hasResumableAdventure(save) : false;
  const midCombat = save
    ? isMidCombatSaveState(save.gameState, save.resumeGameState)
    : false;
  const lobbySaveSummaryLines = useMemo(
    () =>
      save
        ? buildSaveSummaryLines(
            save,
            formatIslandDisplayName,
            renderPortTownName,
          )
        : [],
    [save],
  );
  const lobbySavedAtLabel = formatSavedAt(readShantiesSaveWithMeta()?.savedAtMs ?? null);
  const campaignLine = save ? formatActSummaryLine(save.campaign) : null;

  const startPlay = (intent: "resume" | "restart") => {
    navigate("/squalls/play", { state: { [intent]: true } });
  };

  return (
    <Box {...fullBleedStackProps} px={4} py={6} maxW="2xl" mx="auto" w="100%">
      <VStack
        align="stretch"
        gap={5}
        w="100%"
        borderWidth="1px"
        borderColor={SQUALLS_HUD_COLORS.panelBorder}
        borderRadius="xl"
        bg="rgba(8, 20, 30, 0.72)"
        color={SQUALLS_HUD_COLORS.panelText}
        p={5}
        boxShadow="xl"
      >
        <Heading>🏴‍☠️ Squalls & Shanties</Heading>
        <Text color={SQUALLS_HUD_COLORS.panelMuted}>
          Pocket voyage. Close mid-fight — return to the same hand.
        </Text>

        {save ? (
          <>
            <Text color={SQUALLS_HUD_COLORS.panelMuted}>Yer saved voyage</Text>
            {midCombat ? (
              <Text fontSize="sm" color={SQUALLS_HUD_COLORS.panelText}>
                {formatMidCombatResumeHint()}
              </Text>
            ) : null}
            {campaignLine ? (
              <Text fontSize="sm" color={SQUALLS_HUD_COLORS.panelMuted}>
                {campaignLine}
              </Text>
            ) : null}
            <Box
              w="100%"
              borderWidth="1px"
              borderColor={SQUALLS_HUD_COLORS.panelBorder}
              borderRadius="md"
              bg="rgba(0, 0, 0, 0.2)"
              px={4}
              py={3}
            >
              <VStack align="stretch" gap={2}>
                {lobbySaveSummaryLines.map((line) => (
                  <HStack
                    key={line.label}
                    w="100%"
                    justify="space-between"
                    gap={3}
                    align="baseline"
                  >
                    <Text fontSize="sm" color={SQUALLS_HUD_COLORS.panelSubtle} flexShrink={0}>
                      {line.label}
                    </Text>
                    <Text fontSize="sm" fontWeight="medium" textAlign="right">
                      {line.value}
                    </Text>
                  </HStack>
                ))}
              </VStack>
              {lobbySavedAtLabel ? (
                <Text fontSize="xs" color={SQUALLS_HUD_COLORS.panelSubtle} mt={3}>
                  Last saved {lobbySavedAtLabel}
                </Text>
              ) : null}
            </Box>
          </>
        ) : null}

        <HStack gap={3} wrap="wrap" w="100%">
          <PondButton
            colorPalette="nautical"
            onClick={() => startPlay("resume")}
            disabled={!canResume}
          >
            {midCombat ? "Resume battle" : "Resume voyage"}
          </PondButton>
          <PondButton colorPalette="sky" onClick={() => setRestartConfirmOpen(true)}>
            {canResume ? "New voyage" : "Begin voyage"}
          </PondButton>
        </HStack>

        {!canResume ? (
          <Text fontSize="xs" color={SQUALLS_HUD_COLORS.panelSubtle}>
            ⛵ Chart. Land. Strike.
          </Text>
        ) : null}

        {isStaff ? (
          <Text fontSize="sm" color={SQUALLS_HUD_COLORS.panelMuted}>
            <Link to="/squalls/dm" style={{ textDecoration: "underline" }}>
              Game reference (staff)
            </Link>
          </Text>
        ) : null}
      </VStack>

      <RestartAdventureConfirmModal
        open={restartConfirmOpen}
        onOpenChange={setRestartConfirmOpen}
        onConfirm={() => startPlay("restart")}
      />
    </Box>
  );
}
