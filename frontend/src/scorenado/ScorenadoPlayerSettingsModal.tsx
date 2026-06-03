import { AppModal } from "../components/AppModal";
import { playerDisplayName } from "./playerDisplayName";
import { ScorenadoPlayerSeatEditor } from "./ScorenadoPlayerSeatEditor";
import type { GameDetail, GamePlayer } from "./types";

type ScorenadoPlayerSettingsModalProps = {
  game: GameDetail | null;
  player: GamePlayer | null;
  gameId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGameChange: (game: GameDetail) => void;
  onError: (message: string) => void;
};

export function ScorenadoPlayerSettingsModal({
  game,
  player,
  gameId,
  open,
  onOpenChange,
  onGameChange,
  onError,
}: ScorenadoPlayerSettingsModalProps) {
  if (!game || !player) return null;

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="scorenado-pixel-title" style={{ fontSize: "0.65rem" }}>
          {playerDisplayName(player).toUpperCase()}
        </span>
      }
      size="md"
    >
      <ScorenadoPlayerSeatEditor
        game={game}
        gameId={gameId}
        player={player}
        onGameChange={onGameChange}
        onError={onError}
        onClose={() => onOpenChange(false)}
      />
    </AppModal>
  );
}
