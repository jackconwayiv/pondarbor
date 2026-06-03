import { Stack, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { AppModal } from "../components/AppModal";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";
import { formatPlayedAtShort, historyGameLabels } from "./scorenadoHistoryFormat";
import type { GameListItem } from "./types";

type ScorenadoGameDetailModalProps = {
  game: GameListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deleteBusy?: boolean;
  onDelete: (game: GameListItem) => void | Promise<void>;
};

export function ScorenadoGameDetailModal({
  game,
  open,
  onOpenChange,
  deleteBusy = false,
  onDelete,
}: ScorenadoGameDetailModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmDeleteButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) setConfirmDelete(false);
  }, [open, game?.id]);

  if (!game) return null;

  const { primary, templateLine } = historyGameLabels(game);
  const playerLine =
    game.player_count > 0
      ? `${game.player_count} ${game.player_count === 1 ? "player" : "players"}`
      : null;
  const detailLine = [templateLine, playerLine].filter(Boolean).join(" · ");

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={primary}
      size="md"
      bodyProps={{
        onPointerDownCapture: (event) => {
          if (!confirmDelete) return;
          const target = event.target as Node | null;
          if (!target) return;
          if (confirmDeleteButtonRef.current?.contains(target)) return;
          setConfirmDelete(false);
        },
      }}
    >
      <Stack gap="4" className="scorenado-retro">
        <Stack gap="1">
          {detailLine ? (
            <Text className="scorenado-pixel-body" fontSize={APP_TEXT_SIZES.body}>
              {detailLine}
            </Text>
          ) : null}
          <Text className="scorenado-pixel-body" fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
            {formatPlayedAtShort(game.played_at)}
          </Text>
          <Text
            fontSize={APP_TEXT_SIZES.helper}
            fontWeight="medium"
            color={game.is_finalized ? "lilypad.solid" : "nautical.solid"}
          >
            {game.is_finalized ? "Finalized" : "In progress"}
          </Text>
        </Stack>

        <Stack direction={{ base: "column", sm: "row" }} gap="2">
          <PondButton asChild colorPalette="lilypad">
            <Link to={`/scorenado/game/${game.id}`} onClick={() => onOpenChange(false)}>
              Open scoreboard
            </Link>
          </PondButton>
          {!game.is_finalized ? (
            <PondButton
              ref={confirmDeleteButtonRef}
              variant="outline"
              colorPalette="nautical"
              flexShrink={0}
              loading={deleteBusy}
              disabled={deleteBusy}
              onClick={(e) => {
                e.stopPropagation();
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                void Promise.resolve(onDelete(game)).catch(() =>
                  setConfirmDelete(false),
                );
              }}
            >
              {confirmDelete ? "Confirm delete" : "Delete game"}
            </PondButton>
          ) : null}
        </Stack>
      </Stack>
    </AppModal>
  );
}
