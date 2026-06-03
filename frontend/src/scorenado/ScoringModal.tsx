import { HStack, Stack, Table, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { AppModal } from "../components/AppModal";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";
import {
  isLastCategoryInRound,
  isLastScoringRound,
  isScoredByRounds,
  roundScoringStepCount,
  scoresForRound,
  scoringStepCount,
  scoringStepIndex,
} from "./scorenadoRounds";
import { ScoringStepperInput } from "./ScoringStepperInput";
import { playerDisplayName } from "./playerDisplayName";
import type { GameDetail } from "./types";

type ScoringModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: GameDetail;
  categoryIndex: number;
  activeRound: number;
  onScoringStepChange: (delta: number) => void;
  onScoreChange: (playerId: string, value: number | null) => Promise<void>;
  onPlayOn?: () => void;
  onScoreNextRound?: () => void;
  onFinalizeGame?: () => void;
  finalizeBusy?: boolean;
};

export function ScoringModal({
  open,
  onOpenChange,
  game,
  categoryIndex,
  activeRound,
  onScoringStepChange,
  onScoreChange,
  onPlayOn,
  onScoreNextRound,
  onFinalizeGame,
  finalizeBusy = false,
}: ScoringModalProps) {
  const { categories, scored_by_rounds: scoredByRounds } = game.template;
  const category = categories[categoryIndex];
  const players = game.players;
  const roundBased = isScoredByRounds(scoredByRounds);
  const [values, setValues] = useState<Record<string, number | null>>({});

  useEffect(() => {
    if (!category) return;
    const next: Record<string, number | null> = {};
    const roundScores = scoresForRound(category, activeRound, roundBased);
    for (const p of players) {
      next[p.id] = roundScores[p.id] ?? null;
    }
    setValues(next);
  }, [category, players, open, activeRound, roundBased]);

  if (!category) return null;

  const totalSteps = roundBased
    ? roundScoringStepCount(categories.length)
    : scoringStepCount(categories.length, game.round_count, roundBased);
  const stepIndex = roundBased
    ? categoryIndex
    : scoringStepIndex(
        categoryIndex,
        activeRound,
        game.round_count,
        roundBased,
      );
  const atRoundEnd = roundBased && isLastCategoryInRound(categoryIndex, categories.length);
  const atLastRound = roundBased && isLastScoringRound(activeRound, game.round_count);
  const atBeginning = stepIndex <= 0;
  const atEnd = !roundBased && stepIndex >= totalSteps - 1;

  const modalTitle = roundBased
    ? `${category.name.toUpperCase()} - ROUND ${activeRound}`
    : category.name.toUpperCase();
  const descriptionText = category.description?.trim() ?? "";

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="scorenado-pixel-title" style={{ fontSize: "0.65rem" }}>
          {modalTitle}
        </span>
      }
      description={descriptionText || "\u00a0"}
      descriptionProps={{
        fontSize: APP_TEXT_SIZES.body,
        color: "fg",
        lineHeight: "tall",
        minH: "5.25rem",
        maxH: "5.25rem",
        overflowY: "auto",
      }}
      size="xl"
    >
      <Stack gap="3">
        <Table.Root size="sm" variant="outline" className="scorenado-pixel-body">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Player</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">
                Points
              </Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {players.map((player) => (
              <Table.Row key={player.id}>
                <Table.Cell>{playerDisplayName(player)}</Table.Cell>
                <Table.Cell>
                  <ScoringStepperInput
                    value={values[player.id] ?? null}
                    tabIndex={players.indexOf(player) + 1}
                    onChange={(v) => {
                      setValues((prev) => ({ ...prev, [player.id]: v }));
                      void onScoreChange(player.id, v);
                    }}
                  />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>

        <HStack justify="space-between" flexWrap="wrap" gap="2">
          {!atBeginning ? (
            <PondButton
              size="sm"
              variant="outline"
              colorPalette="sky"
              onClick={() => onScoringStepChange(-1)}
            >
              {roundBased ? "Previous" : "Previous category"}
            </PondButton>
          ) : (
            <span />
          )}
          {atRoundEnd ? (
            <HStack gap="2" flexWrap="wrap" justify="flex-end">
              <PondButton
                size="sm"
                variant="outline"
                colorPalette="gray"
                onClick={() => onPlayOn?.()}
              >
                Play On
              </PondButton>
              {atLastRound ? (
                <PondButton
                  size="sm"
                  colorPalette="teal"
                  loading={finalizeBusy}
                  disabled={finalizeBusy}
                  onClick={() => onFinalizeGame?.()}
                >
                  Finalize Game
                </PondButton>
              ) : (
                <PondButton
                  size="sm"
                  colorPalette="lilypad"
                  onClick={() => onScoreNextRound?.()}
                >
                  Score Next Round
                </PondButton>
              )}
            </HStack>
          ) : atEnd ? null : (
            <PondButton
              size="sm"
              variant="outline"
              colorPalette="sky"
              onClick={() => onScoringStepChange(1)}
            >
              {roundBased ? "Next" : "Next category"}
            </PondButton>
          )}
        </HStack>
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
          {roundBased
            ? `Category ${stepIndex + 1} of ${totalSteps} · Round ${activeRound} of ${game.round_count}`
            : `Category ${categoryIndex + 1} of ${categories.length}`}
        </Text>
      </Stack>
    </AppModal>
  );
}
