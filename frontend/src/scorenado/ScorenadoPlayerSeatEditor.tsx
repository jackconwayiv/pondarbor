import { Field, HStack, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { fetchFriendsList, type FriendUser } from "../friends/api";
import { APP_TEXT_SIZES } from "../theme/typography";
import {
  cancelSeatInvite,
  inviteFriendToSeat,
  patchPlayer,
  unclaimSeat,
} from "./api";
import { playerPlaceholderName } from "./playerDisplayName";
import type { GameDetail, GamePlayer } from "./types";

export function seatStatusLabel(player: GamePlayer): string {
  if (player.claimed_user) {
    return `Linked · ${player.claimed_user.display_name}`;
  }
  if (player.invite_status === "pending" && player.invited_user) {
    return `Pending · ${player.invited_user.display_name}`;
  }
  return "Unassigned";
}

type ScorenadoPlayerSeatEditorProps = {
  game: GameDetail;
  gameId: string;
  player: GamePlayer;
  onGameChange: (game: GameDetail) => void;
  onError: (message: string) => void;
  onClose?: () => void;
};

export function ScorenadoPlayerSeatEditor({
  game,
  gameId,
  player,
  onGameChange,
  onError,
  onClose,
}: ScorenadoPlayerSeatEditorProps) {
  const { getApiAccessToken, sessionUser } = useAppSession();
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [assignUserId, setAssignUserId] = useState("");
  const [displayName, setDisplayName] = useState(player.display_name);
  const [busy, setBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const isCreatorSeat =
    game.is_owner &&
    player.sort_order === 0 &&
    player.claimed_user?.id === sessionUser?.user.id;

  const nameDirty =
    displayName.trim() !== player.display_name.trim() && displayName.trim().length > 0;

  useEffect(() => {
    setInviteError(null);
    setAssignUserId("");
    setDisplayName(player.display_name);
  }, [player.id, player.display_name]);

  useEffect(() => {
    void (async () => {
      try {
        const token = await getApiAccessToken();
        const list = await fetchFriendsList(token);
        setFriends(list.approved_friends);
      } catch {
        setFriends([]);
      }
    })();
  }, [getApiAccessToken]);

  const runAction = async (action: () => Promise<GameDetail>) => {
    setBusy(true);
    onError("");
    try {
      onGameChange(await action());
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not update player.");
    } finally {
      setBusy(false);
    }
  };

  const handleInvite = async () => {
    const userId = Number(assignUserId);
    if (!userId) return;
    setBusy(true);
    setInviteError(null);
    try {
      const token = await getApiAccessToken();
      onGameChange(await inviteFriendToSeat(token, gameId, player.id, userId));
      onClose?.();
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : "Could not send invite.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSaveName = async () => {
    const trimmed = displayName.trim();
    if (!trimmed || trimmed === player.display_name.trim()) return;
    await runAction(async () => {
      const token = await getApiAccessToken();
      return patchPlayer(token, gameId, player.id, { display_name: trimmed });
    });
  };

  return (
    <Stack gap="4" className="scorenado-retro">
      <Stack gap="2">
        <Text className="scorenado-pixel-body" fontWeight="semibold">
          {isCreatorSeat ? `Your seat (${playerPlaceholderName(1)})` : seatStatusLabel(player)}
        </Text>
        <HStack gap="3" align="flex-end" flexWrap="wrap">
          <Field.Root flex="1" minW="140px">
            <Field.Label fontSize={APP_TEXT_SIZES.helper}>Name</Field.Label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{
                width: "100%",
                padding: "0.35rem 0.5rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--chakra-colors-gray-400)",
              }}
            />
          </Field.Root>
          <PondButton
            size="sm"
            colorPalette="lilypad"
            loading={busy}
            disabled={busy || !nameDirty}
            alignSelf="flex-end"
            onClick={() => {
              void handleSaveName();
            }}
          >
            Save name
          </PondButton>
        </HStack>
      </Stack>

      {isCreatorSeat ? null : (
        <Stack gap="2">
          <Text className="scorenado-pixel-body" fontWeight="semibold">
            Assignment
          </Text>
          {inviteError ? (
            <Text color="nautical.solid" fontSize={APP_TEXT_SIZES.helper}>
              {inviteError}
            </Text>
          ) : null}
          <HStack gap="2" flexWrap="wrap">
            {player.invite_status === "pending" ? (
              <PondButton
                size="sm"
                variant="outline"
                colorPalette="gray"
                loading={busy}
                disabled={busy}
                onClick={() =>
                  void runAction(async () => {
                    const token = await getApiAccessToken();
                    return cancelSeatInvite(token, gameId, player.id);
                  })
                }
              >
                Cancel invite
              </PondButton>
            ) : null}
            {player.claimed_user ? (
              <PondButton
                size="sm"
                variant="outline"
                colorPalette="nautical"
                loading={busy}
                disabled={busy}
                onClick={() =>
                  void runAction(async () => {
                    const token = await getApiAccessToken();
                    return unclaimSeat(token, gameId, player.id);
                  })
                }
              >
                Unlink
              </PondButton>
            ) : (
              <>
                <Field.Root flex="1" minW="10rem">
                  <Field.Label fontSize={APP_TEXT_SIZES.helper}>
                    Invite friend
                  </Field.Label>
                  <select
                    value={assignUserId}
                    onChange={(e) => {
                      setAssignUserId(e.target.value);
                      setInviteError(null);
                    }}
                    style={{
                      width: "100%",
                      padding: "0.35rem 0.5rem",
                      borderRadius: "0.5rem",
                      border: "1px solid var(--chakra-colors-gray-400)",
                    }}
                  >
                    <option value="">Choose friend…</option>
                    {friends.map((f) => (
                      <option key={f.id} value={String(f.id)}>
                        {f.nickname}
                      </option>
                    ))}
                  </select>
                </Field.Root>
                <PondButton
                  size="sm"
                  colorPalette="teal"
                  loading={busy}
                  disabled={busy || !assignUserId}
                  alignSelf="flex-end"
                  onClick={() => {
                    void handleInvite();
                  }}
                >
                  Invite
                </PondButton>
              </>
            )}
          </HStack>
        </Stack>
      )}

      {onClose ? (
        <HStack justify="flex-end">
          <PondButton size="sm" variant="outline" colorPalette="gray" onClick={onClose}>
            Close
          </PondButton>
        </HStack>
      ) : null}
    </Stack>
  );
}
