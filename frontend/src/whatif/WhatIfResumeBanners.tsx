import { Box, Stack, Text } from "@chakra-ui/react";
import type { KeyboardEvent } from "react";
import { useNavigate } from "react-router";

import { APP_TEXT_SIZES } from "../theme/typography";
import { savePlayerToken } from "./api";
import { useWhatIfResumeContext } from "./WhatIfResumeContext";

/** “Focus with Orange” feature block from palette v2 (index_v_2 `.feature` orange variant). */
const RESUME_GAME_FEATURE_BLOCK_PROPS = {
  bg: "nautical.subtle",
  borderWidth: "1px",
  borderColor: "border",
  borderLeftWidth: "8px",
  borderLeftColor: "nautical.emphasized",
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
    outlineColor: "nautical.border",
    outlineOffset: "2px",
  },
};

export default function WhatIfResumeBanners() {
  const navigate = useNavigate();
  const { targets, loading } = useWhatIfResumeContext();

  if (loading || targets.length === 0) {
    return null;
  }

  function openHand(code: string, playerSecret: string) {
    savePlayerToken(code, playerSecret);
    navigate(`/whatif/hand/${code}`);
  }

  function onCardKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    code: string,
    playerSecret: string,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openHand(code, playerSecret);
    }
  }

  return (
    <Stack
      w="100%"
      gap="2"
      mt="3"
      role="region"
      aria-label="Resume games"
    >
      {targets.map((target) => (
        <Box
          key={target.short_code}
          role="button"
          tabIndex={0}
          aria-label={`Resume game ${target.short_code}`}
          {...RESUME_GAME_FEATURE_BLOCK_PROPS}
          onClick={() => openHand(target.short_code, target.player_secret)}
          onKeyDown={(e) =>
            onCardKeyDown(e, target.short_code, target.player_secret)
          }
        >
          <Stack gap="1" align="stretch">
            <Text
              fontSize={APP_TEXT_SIZES.label}
              fontWeight="semibold"
              color="fg"
              lineHeight="short"
            >
              Resume game {target.short_code}
            </Text>
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" lineHeight="tall">
              Tap to return to your hand.
            </Text>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}
