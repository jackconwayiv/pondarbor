import { Box, Field, HStack, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";

import type { SessionUser } from "../auth/AppSessionContext";
import { useAppSession } from "../auth/AppSessionContext";
import { AppModal } from "../components/AppModal";
import PondButton from "../PondButton";
import { fetchFriendsList, type FriendUser } from "../friends/api";
import { APP_TEXT_SIZES } from "../theme/typography";
import { categoryRowColor, SCORENADO_PLAYER_COLORS } from "./playerColors";
import { playerPlaceholderName } from "./playerDisplayName";
import { ScoringStepperInput } from "./ScoringStepperInput";
import {
  SCORENADO_MAX_PLAYERS,
  SCORENADO_MAX_TEMPLATE_ROUNDS,
  templateDefaultRoundCount,
  templateMinPlayers,
} from "./scorenadoTemplateSetup";
import type { ScoreboardTemplate } from "./types";

export { SCORENADO_MAX_PLAYERS } from "./scorenadoTemplateSetup";

export type StartGamePlayerSetup = {
  display_name: string;
  color: string;
  sort_order: number;
  invite_user_id?: number;
};

type PlayerDraft = {
  displayName: string;
  inviteUserId: string;
};

export function buildDefaultPlayers(playerCount: number) {
  const n = Math.max(1, Math.min(SCORENADO_MAX_PLAYERS, playerCount));
  return Array.from({ length: n }, (_, i) => ({
    display_name: playerPlaceholderName(i + 1),
    color: `${SCORENADO_PLAYER_COLORS[i % SCORENADO_PLAYER_COLORS.length]}.200`,
    sort_order: i,
  }));
}

function creatorSeatName(sessionUser: SessionUser | null): string {
  const fromProfile = (sessionUser?.profile.display_name ?? "").trim();
  if (fromProfile) return fromProfile;
  const email = sessionUser?.user.email ?? "";
  const local = email.split("@")[0]?.trim();
  return local || playerPlaceholderName(1);
}

function defaultDrafts(count: number, creatorName: string): PlayerDraft[] {
  return Array.from({ length: count }, (_, i) => ({
    displayName: i === 0 ? creatorName : playerPlaceholderName(i + 1),
    inviteUserId: "",
  }));
}

export function buildPlayersFromDrafts(drafts: PlayerDraft[]): StartGamePlayerSetup[] {
  return drafts.map((draft, i) => ({
    display_name: draft.displayName.trim() || playerPlaceholderName(i + 1),
    color: `${SCORENADO_PLAYER_COLORS[i % SCORENADO_PLAYER_COLORS.length]}.200`,
    sort_order: i,
    invite_user_id: draft.inviteUserId ? Number(draft.inviteUserId) : undefined,
  }));
}

function clampCount(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const inputStyle = {
  flex: "1",
  minWidth: "6rem",
  padding: "0.35rem 0.5rem",
  borderRadius: "0.5rem",
  border: "1px solid var(--chakra-colors-gray-400)",
  backgroundColor: "white",
} as const;

const selectStyle = {
  flex: "1",
  minWidth: "8rem",
  padding: "0.35rem 0.5rem",
  borderRadius: "0.5rem",
  border: "1px solid var(--chakra-colors-gray-400)",
  backgroundColor: "white",
} as const;

type ScorenadoStartGameModalProps = {
  template: ScoreboardTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  starting?: boolean;
  onStart: (opts: {
    playerCount: number;
    roundCount: number;
    players: StartGamePlayerSetup[];
  }) => void | Promise<void>;
};

export function ScorenadoStartGameModal({
  template,
  open,
  onOpenChange,
  starting = false,
  onStart,
}: ScorenadoStartGameModalProps) {
  const { getApiAccessToken, sessionUser } = useAppSession();
  const roundBased = Boolean(template?.scored_by_rounds);
  const minPlayers = templateMinPlayers(template);
  const defaultRounds = templateDefaultRoundCount(template);
  const [playerCount, setPlayerCount] = useState(minPlayers);
  const [roundCount, setRoundCount] = useState(defaultRounds);
  const [playerDrafts, setPlayerDrafts] = useState<PlayerDraft[]>(() =>
    defaultDrafts(minPlayers, creatorSeatName(null)),
  );
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !template) return;
    const min = templateMinPlayers(template);
    setPlayerCount(min);
    setRoundCount(templateDefaultRoundCount(template));
    setPlayerDrafts(defaultDrafts(min, creatorSeatName(sessionUser)));
    setStartError(null);
  }, [open, template, sessionUser]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const token = await getApiAccessToken();
        const list = await fetchFriendsList(token);
        setFriends(list.approved_friends);
      } catch {
        setFriends([]);
      }
    })();
  }, [open, getApiAccessToken]);

  const setCount = useCallback(
    (nextRaw: number) => {
      if (!template) return;
      const next = clampCount(nextRaw, minPlayers, SCORENADO_MAX_PLAYERS);
      setPlayerCount(next);
      setPlayerDrafts((prev) => {
        if (next > prev.length) {
          return [
            ...prev,
            ...Array.from({ length: next - prev.length }, (_, i) => ({
              displayName: playerPlaceholderName(prev.length + i + 1),
              inviteUserId: "",
            })),
          ];
        }
        return prev.slice(0, next);
      });
    },
    [minPlayers, template],
  );

  if (!template) return null;

  const playersValid =
    playerCount >= minPlayers && playerCount <= SCORENADO_MAX_PLAYERS;
  const roundsValid =
    !roundBased ||
    (roundCount >= 1 && roundCount <= SCORENADO_MAX_TEMPLATE_ROUNDS);

  const inviteIds = playerDrafts
    .map((d) => d.inviteUserId)
    .filter((id) => id !== "");
  const duplicateInvite = new Set(inviteIds).size !== inviteIds.length;

  const handleStart = () => {
    if (duplicateInvite) {
      setStartError("Each friend can only be invited to one seat.");
      return;
    }
    setStartError(null);
    void onStart({
      playerCount: clampCount(playerCount, minPlayers, SCORENADO_MAX_PLAYERS),
      roundCount: roundBased
        ? clampCount(roundCount, 1, SCORENADO_MAX_TEMPLATE_ROUNDS)
        : 1,
      players: buildPlayersFromDrafts(playerDrafts),
    });
  };

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="scorenado-pixel-title" style={{ fontSize: "0.65rem" }}>
          {template.name.toUpperCase()}
        </span>
      }
      size="lg"
    >
      <Stack gap="4" className="scorenado-retro">
        <HStack gap="4" align="flex-start" flexWrap="wrap">
          <Field.Root flex="1" minW="140px">
            <Field.Label className="scorenado-pixel-body">Players</Field.Label>
            <HStack justify="center" py="1">
              <ScoringStepperInput
                value={playerCount}
                onChange={(v) => {
                  if (v == null) return;
                  setCount(v);
                }}
              />
            </HStack>
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
              {minPlayers}–{SCORENADO_MAX_PLAYERS} players
            </Text>
          </Field.Root>

          {roundBased ? (
            <Field.Root flex="1" minW="140px">
              <Field.Label className="scorenado-pixel-body">Rounds</Field.Label>
              <HStack justify="center" py="1">
                <ScoringStepperInput
                  value={roundCount}
                  onChange={(v) => {
                    if (v == null) return;
                    setRoundCount(clampCount(v, 1, SCORENADO_MAX_TEMPLATE_ROUNDS));
                  }}
                />
              </HStack>
            </Field.Root>
          ) : null}
        </HStack>

        <Stack gap="2">
          <Text className="scorenado-pixel-body" fontWeight="semibold">
            Name / invite players
          </Text>
          <Stack gap="2">
            {playerDrafts.map((draft, index) => {
              const isCreatorSeat = index === 0;
              const takenInviteIds = new Set(
                playerDrafts
                  .filter((_, i) => i !== index)
                  .map((d) => d.inviteUserId)
                  .filter(Boolean),
              );
              return (
                <Box
                  key={index}
                  className="scorenado-template-row"
                  bg={categoryRowColor(index + 1)}
                  p="1.5"
                  rounded="2xl"
                >
                  <HStack gap="3" align="center" flexWrap="wrap">
                    <Field.Root flex="1" minW="140px">
                      <input
                        value={draft.displayName}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPlayerDrafts((prev) =>
                            prev.map((row, i) =>
                              i === index ? { ...row, displayName: value } : row,
                            ),
                          );
                        }}
                        style={{ ...inputStyle, width: "100%" }}
                      />
                    </Field.Root>
                    {isCreatorSeat ? (
                      <Field.Root flex="1" minW="140px">
                        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                          Linked to you
                        </Text>
                      </Field.Root>
                    ) : (
                      <Field.Root flex="1" minW="140px">
                        <select
                          value={draft.inviteUserId}
                          onChange={(e) => {
                            const value = e.target.value;
                            setPlayerDrafts((prev) =>
                              prev.map((row, i) =>
                                i === index ? { ...row, inviteUserId: value } : row,
                              ),
                            );
                            setStartError(null);
                          }}
                          style={{ ...selectStyle, width: "100%" }}
                        >
                          <option value="">Invite friend</option>
                          {friends
                            .filter((f) => !takenInviteIds.has(String(f.id)))
                            .map((f) => (
                              <option key={f.id} value={String(f.id)}>
                                {f.nickname}
                              </option>
                            ))}
                        </select>
                      </Field.Root>
                    )}
                  </HStack>
                </Box>
              );
            })}
          </Stack>
        </Stack>

        {startError ? (
          <Text color="nautical.solid" fontSize={APP_TEXT_SIZES.helper}>
            {startError}
          </Text>
        ) : null}

        <HStack justify="flex-end" gap="2" flexWrap="wrap">
          <PondButton
            size="sm"
            variant="outline"
            colorPalette="gray"
            disabled={starting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </PondButton>
          <PondButton
            size="sm"
            colorPalette="lilypad"
            loading={starting}
            disabled={starting || !playersValid || !roundsValid || duplicateInvite}
            onClick={handleStart}
          >
            Start game
          </PondButton>
        </HStack>
      </Stack>
    </AppModal>
  );
}
