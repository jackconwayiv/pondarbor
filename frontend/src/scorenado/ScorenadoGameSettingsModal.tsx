import { Field, HStack, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { AppModal } from "../components/AppModal";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";
import {
  clampGamePlayerCount,
  clampGameRoundCount,
  gameMinPlayers,
} from "./scorenadoGameSettings";
import { isScoredByRounds } from "./scorenadoRounds";
import {
  SCORENADO_MAX_PLAYERS,
  SCORENADO_MAX_TEMPLATE_ROUNDS,
} from "./scorenadoTemplateSetup";
import { ScorenadoGameTagsPanel } from "./ScorenadoGameTagsPanel";
import { seatStatusLabel } from "./ScorenadoPlayerSeatEditor";
import { playerDisplayName } from "./playerDisplayName";
import { ScoringStepperInput } from "./ScoringStepperInput";
import type { GameDetail } from "./types";

type ScorenadoGameSettingsModalProps = {
  game: GameDetail | null;
  gameId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving?: boolean;
  onSave: (opts: { playerCount: number; roundCount: number }) => void | Promise<void>;
  onGameChange: (game: GameDetail) => void;
  onError: (message: string) => void;
  onOpenPlayer?: (playerId: string) => void;
  canDelete?: boolean;
  onDelete?: () => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
};

export function ScorenadoGameSettingsModal({
  game,
  gameId,
  open,
  onOpenChange,
  saving = false,
  onSave,
  onGameChange,
  onError,
  onOpenPlayer,
  canDelete = false,
  onDelete,
  onRefresh,
}: ScorenadoGameSettingsModalProps) {
  const [playerCount, setPlayerCount] = useState(2);
  const [roundCount, setRoundCount] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);

  useEffect(() => {
    if (!open || !game) return;
    setPlayerCount(game.players.length);
    setRoundCount(game.round_count);
    setConfirmDelete(false);
  }, [open, game]);

  useEffect(() => {
    if (!canDelete) setConfirmDelete(false);
  }, [canDelete]);

  if (!game) return null;

  const roundBased = isScoredByRounds(game.template.scored_by_rounds);
  const minPlayers = gameMinPlayers(game);

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="scorenado-pixel-title" style={{ fontSize: "0.65rem" }}>
          SETTINGS
        </span>
      }
      size="md"
    >
      <Stack gap="4" className="scorenado-retro">
        <Field.Root>
          <Field.Label className="scorenado-pixel-body">Players</Field.Label>
          <HStack justify="center" py="1">
            <ScoringStepperInput
              value={playerCount}
              onChange={(v) => {
                if (v == null) return;
                setPlayerCount(clampGamePlayerCount(game, v));
              }}
            />
          </HStack>
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
            {minPlayers}–{SCORENADO_MAX_PLAYERS} players. Click a player column
            header to invite a friend.
          </Text>
          {onOpenPlayer && !game.is_finalized ? (
            <Stack gap="1" mt="2">
              {game.players.map((p) => (
                <PondButton
                  key={p.id}
                  size="sm"
                  variant="outline"
                  colorPalette="gray"
                  justifyContent="space-between"
                  width="100%"
                  onClick={() => onOpenPlayer(p.id)}
                >
                  <span>{playerDisplayName(p)}</span>
                  <Text as="span" fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                    {seatStatusLabel(p)}
                  </Text>
                </PondButton>
              ))}
            </Stack>
          ) : null}
        </Field.Root>

        {roundBased ? (
          <Field.Root>
            <Field.Label className="scorenado-pixel-body">Rounds</Field.Label>
            <HStack justify="center" py="1">
              <ScoringStepperInput
                value={roundCount}
                onChange={(v) => {
                  if (v == null) return;
                  setRoundCount(clampGameRoundCount(game, v));
                }}
              />
            </HStack>
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
              {game.round_count}–{SCORENADO_MAX_TEMPLATE_ROUNDS} rounds (cannot remove
              rounds that may have scores).
            </Text>
          </Field.Root>
        ) : null}

        <ScorenadoGameTagsPanel
          game={game}
          gameId={gameId}
          onGameChange={onGameChange}
          onError={onError}
        />

        <HStack justify="space-between" gap="2" flexWrap="wrap">
          <HStack gap="2" flexWrap="wrap">
            {!game.is_finalized && onRefresh ? (
              <PondButton
                size="sm"
                variant="outline"
                colorPalette="sky"
                loading={refreshBusy}
                disabled={refreshBusy || saving || deleteBusy}
                onClick={() => {
                  void (async () => {
                    setRefreshBusy(true);
                    onError("");
                    try {
                      await onRefresh();
                    } catch (err) {
                      onError(
                        err instanceof Error ? err.message : "Could not refresh game.",
                      );
                    } finally {
                      setRefreshBusy(false);
                    }
                  })();
                }}
              >
                Refresh
              </PondButton>
            ) : null}
            {canDelete && onDelete ? (
              <PondButton
                size="sm"
                variant="outline"
                colorPalette="nautical"
                loading={deleteBusy}
                disabled={deleteBusy || saving || refreshBusy}
                onClick={() => {
                  if (!confirmDelete) {
                    setConfirmDelete(true);
                    return;
                  }
                  void (async () => {
                    setDeleteBusy(true);
                    onError("");
                    try {
                      await onDelete();
                    } catch (err) {
                      onError(
                        err instanceof Error ? err.message : "Could not delete game.",
                      );
                      setConfirmDelete(false);
                    } finally {
                      setDeleteBusy(false);
                    }
                  })();
                }}
              >
                {confirmDelete ? "Confirm delete" : "Delete game"}
              </PondButton>
            ) : null}
          </HStack>
          <HStack justify="flex-end" gap="2" flexWrap="wrap">
            <PondButton
              size="sm"
              variant="outline"
              colorPalette="gray"
              disabled={saving || deleteBusy || refreshBusy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </PondButton>
            <PondButton
              size="sm"
              colorPalette="lilypad"
              loading={saving}
              disabled={saving || deleteBusy || refreshBusy}
              onClick={() =>
                void onSave({
                  playerCount: clampGamePlayerCount(game, playerCount),
                  roundCount: roundBased
                    ? clampGameRoundCount(game, roundCount)
                    : game.round_count,
                })
              }
            >
              Save
            </PondButton>
          </HStack>
        </HStack>
      </Stack>
    </AppModal>
  );
}
