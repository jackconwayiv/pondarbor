import { Box, Button, Heading, HStack, Text, VStack } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
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

export default function SquallsLobbyPage() {
  const navigate = useNavigate();
  const { sessionUser } = useAppSession();
  const isStaff = !!sessionUser?.user?.is_staff;
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);

  const save = readShantiesSave();
  const canResume = save ? hasResumableAdventure(save) : false;
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

  const startPlay = (intent: "resume" | "restart") => {
    navigate("/squalls/play", { state: { [intent]: true } });
  };

  return (
    <Box {...fullBleedStackProps} px={4} py={6} maxW="2xl" mx="auto" w="100%">
      <VStack align="stretch" gap={5} w="100%">
        <Heading>🏴‍☠️ Squalls & Shanties</Heading>
        <Text color="gray.900">
          Chart yer course from the harbor — resume a saved voyage or begin anew.
        </Text>

        {save ? (
          <>
            <Text color="gray.900">Yer saved adventure</Text>
            <Box
              w="100%"
              borderWidth="1px"
              borderColor="blackAlpha.200"
              borderRadius="md"
              bg="blackAlpha.50"
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
                    <Text fontSize="sm" color="gray.900" flexShrink={0}>
                      {line.label}
                    </Text>
                    <Text fontSize="sm" fontWeight="medium" textAlign="right">
                      {line.value}
                    </Text>
                  </HStack>
                ))}
              </VStack>
              {lobbySavedAtLabel ? (
                <Text fontSize="xs" color="gray.900" mt={3}>
                  Last saved {lobbySavedAtLabel}
                </Text>
              ) : null}
            </Box>
          </>
        ) : null}

        <HStack gap={3} wrap="wrap" w="100%">
          <Button
            colorPalette="orange"
            onClick={() => startPlay("resume")}
            disabled={!canResume}
          >
            Resume playing
          </Button>
          <Button variant="outline" onClick={() => setRestartConfirmOpen(true)}>
            {canResume ? "Restart adventure" : "Start adventure"}
          </Button>
        </HStack>

        {!canResume ? (
          <Text fontSize="xs" color="gray.900">
            No adventure in progress — start a new voyage to set sail.
          </Text>
        ) : null}

        {isStaff ? (
          <Text fontSize="sm">
            <Link to="/squalls/dm">Game reference (staff)</Link>
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
