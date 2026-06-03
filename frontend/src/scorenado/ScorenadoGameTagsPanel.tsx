import { Field, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";
import { addGameTag, deleteGameTag } from "./api";
import type { GameDetail } from "./types";

type ScorenadoGameTagsPanelProps = {
  game: GameDetail;
  gameId: string;
  onGameChange: (game: GameDetail) => void;
  onError: (message: string) => void;
};

export function ScorenadoGameTagsPanel({
  game,
  gameId,
  onGameChange,
  onError,
}: ScorenadoGameTagsPanelProps) {
  const { getApiAccessToken } = useAppSession();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Stack gap="2" className="scorenado-retro">
      <Text className="scorenado-pixel-title" fontSize="0.55rem">
        Tags
      </Text>
      <HStack gap="2" flexWrap="wrap">
        {(game.tags ?? []).map((tag) => (
          <HStack
            key={tag.id}
            gap="1"
            px="2"
            py="1"
            bg="bg.panel"
            borderWidth="1px"
            borderColor="border"
            borderRadius="full"
          >
            <Text fontSize={APP_TEXT_SIZES.helper}>{tag.label}</Text>
            <PondButton
              size="xs"
              variant="ghost"
              colorPalette="gray"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  onError("");
                  try {
                    const token = await getApiAccessToken();
                    await deleteGameTag(token, gameId, tag.id);
                    onGameChange({
                      ...game,
                      tags: (game.tags ?? []).filter((t) => t.id !== tag.id),
                    });
                  } catch (err) {
                    onError(err instanceof Error ? err.message : "Could not remove tag.");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              ×
            </PondButton>
          </HStack>
        ))}
      </HStack>
      <Field.Root>
        <HStack gap="2" flexWrap="wrap">
          <Input
            size="sm"
            value={draft}
            placeholder="Add tag"
            maxW="14rem"
            onChange={(e) => setDraft(e.target.value)}
          />
          <PondButton
            size="sm"
            colorPalette="teal"
            disabled={busy || !draft.trim()}
            loading={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                onError("");
                try {
                  const token = await getApiAccessToken();
                  const tag = await addGameTag(token, gameId, {
                    label: draft.trim(),
                  });
                  onGameChange({
                    ...game,
                    tags: [...(game.tags ?? []), tag],
                  });
                  setDraft("");
                } catch (err) {
                  onError(err instanceof Error ? err.message : "Could not add tag.");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Add
          </PondButton>
        </HStack>
      </Field.Root>
    </Stack>
  );
}
