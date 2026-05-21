import { Box, Stack, Text } from "@chakra-ui/react";
import type { KeyboardEvent } from "react";
import { useNavigate } from "react-router";

import { APP_TEXT_SIZES } from "../theme/typography";

export type EstatesResumeTarget = {
  id: string;
  opponentLabel: string;
  scoreLabel: string | null;
};

const RESUME_GAME_FEATURE_BLOCK_PROPS = {
  bg: "sky.subtle",
  borderWidth: "1px",
  borderColor: "sky.border",
  borderLeftWidth: "8px",
  borderLeftColor: "sky.emphasized",
  borderRadius: "xl",
  p: { base: "4", md: "6" },
  boxShadow: "sm",
  textAlign: "left" as const,
  w: "100%",
  cursor: "pointer",
  transition: "box-shadow 0.15s ease",
  _hover: { boxShadow: "md" },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "sky.border",
    outlineOffset: "2px",
  },
};

type EstatesResumeBannersProps = {
  targets: EstatesResumeTarget[];
  loading?: boolean;
};

export default function EstatesResumeBanners({
  targets,
  loading = false,
}: EstatesResumeBannersProps) {
  const navigate = useNavigate();

  if (loading || targets.length === 0) {
    return null;
  }

  function openGame(gameId: string) {
    navigate(`/estates/play/${gameId}`);
  }

  function onCardKeyDown(event: KeyboardEvent<HTMLDivElement>, gameId: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openGame(gameId);
    }
  }

  return (
    <Stack w="100%" gap="2" mt="3" role="region" aria-label="Resume games">
      {targets.map((target) => (
        <Box
          key={target.id}
          role="button"
          tabIndex={0}
          aria-label={`Resume game ${target.opponentLabel}`}
          {...RESUME_GAME_FEATURE_BLOCK_PROPS}
          onClick={() => openGame(target.id)}
          onKeyDown={(e) => onCardKeyDown(e, target.id)}
        >
          <Stack gap="1" align="stretch">
            <Text
              fontSize={APP_TEXT_SIZES.label}
              fontWeight="semibold"
              color="fg"
              lineHeight="short"
            >
              Resume game
            </Text>
            <Text fontSize={APP_TEXT_SIZES.body} color="fg" lineHeight="tall">
              {target.opponentLabel}
              {target.scoreLabel ? ` · ${target.scoreLabel}` : ""}
            </Text>
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" lineHeight="tall">
              Tap to return to the board.
            </Text>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}
