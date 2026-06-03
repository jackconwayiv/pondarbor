import { Box, Stack, Text } from "@chakra-ui/react";
import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { APP_TEXT_SIZES } from "../theme/typography";
import { fetchGames } from "./api";

const OPEN_GAMES_BANNER_PROPS = {
  bg: "lilypad.subtle",
  borderWidth: "1px",
  borderColor: "lilypad.border",
  borderLeftWidth: "8px",
  borderLeftColor: "lilypad.emphasized",
  borderRadius: "xl",
  p: { base: "3", md: "4" },
  boxShadow: "sm",
  textAlign: "left" as const,
  w: "100%",
  cursor: "pointer",
  transition: "box-shadow 0.15s ease",
  _hover: { boxShadow: "md" },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "lilypad.border",
    outlineOffset: "2px",
  },
};

function useScorenadoOpenGamesCount() {
  const { getApiAccessToken } = useAppSession();
  const location = useLocation();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const token = await getApiAccessToken();
      const games = await fetchGames(token);
      setCount(games.filter((game) => !game.is_finalized).length);
    } catch {
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [getApiAccessToken]);

  useEffect(() => {
    void load();
  }, [load, location.pathname]);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  return { count, loading };
}

export function ScorenadoOpenGamesBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { count, loading } = useScorenadoOpenGamesCount();

  if (loading || count === 0) {
    return null;
  }

  if (location.pathname.replace(/\/$/, "") === "/scorenado/history") {
    return null;
  }

  const title =
    count === 1 ? "Game in progress" : `${count} games in progress`;

  function goToHistory() {
    void navigate("/scorenado/history");
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      goToHistory();
    }
  }

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={`${title}. Go to history.`}
      mb={{ base: "2", md: "3" }}
      {...OPEN_GAMES_BANNER_PROPS}
      onClick={goToHistory}
      onKeyDown={onKeyDown}
    >
      <Stack gap="1" align="stretch">
        <Text
          className="scorenado-pixel-body"
          fontSize={APP_TEXT_SIZES.label}
          fontWeight="semibold"
          color="fg"
          lineHeight="short"
        >
          {title}
        </Text>
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" lineHeight="tall">
          Tap to open History and resume scoring.
        </Text>
      </Stack>
    </Box>
  );
}
