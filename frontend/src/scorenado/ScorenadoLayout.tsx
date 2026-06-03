import { Box, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";

import "./scorenadoRetro.css";

import { fullBleedStackProps } from "../responsive";
import {
  AppShellTabsList,
  AppShellTabsRoot,
  AppShellTabsTrigger,
} from "../theme/appShellTabComponents";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import {
  ScoreboardHeaderContext,
  type ScoreboardHeaderState,
} from "./scorenadoScoreboardHeader";
import { ScorenadoOpenGamesBanner } from "./ScorenadoOpenGamesBanner";

const SCORENADO_TABS = {
  play: "/scorenado",
  templates: "/scorenado/templates",
  history: "/scorenado/history",
} as const;

type ScorenadoTab = keyof typeof SCORENADO_TABS;

function tabFromPathname(pathname: string): ScorenadoTab {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p.startsWith("/scorenado/templates")) return "templates";
  if (p.startsWith("/scorenado/history") || p.startsWith("/scorenado/game/")) {
    return "history";
  }
  if (p === "/scorenado" || p.startsWith("/scorenado/play")) return "play";
  return "play";
}

export default function ScorenadoLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = tabFromPathname(location.pathname);
  const onScoreboard =
    location.pathname.includes("/scorenado/game/") &&
    !location.pathname.endsWith("/history");
  const [scoreboardHeader, setScoreboardHeader] = useState<ScoreboardHeaderState | null>(
    null,
  );

  useEffect(() => {
    if (!onScoreboard) setScoreboardHeader(null);
  }, [onScoreboard, location.pathname]);

  return (
    <Stack
      flex="1"
      minH="full"
      gap="0"
      className="scorenado-retro"
      {...fullBleedStackProps}
    >
      <ScoreboardHeaderContext.Provider
        value={{ setScoreboardHeader }}
      >
      <AppShellTabsRoot
        value={tab}
        onValueChange={(details) => {
          const next = details.value as ScorenadoTab;
          void navigate(SCORENADO_TABS[next]);
        }}
      >
        <Box flex="1" bg="bg" px={0} py={{ base: "2", md: "2" }}>
          <Box
            {...(onScoreboard
              ? {
                  maxW: "100%",
                  w: "100%",
                  mx: 0,
                  bg: "bg",
                  borderWidth: 0,
                  borderRadius: 0,
                  boxShadow: "none",
                  overflow: "visible",
                }
              : APP_SHELL_TRAY_PROPS)}
          >
            <Stack
              gap={onScoreboard ? { base: "1", md: "2" } : { base: "4", md: "4" }}
              px={onScoreboard ? { base: "2", md: "3" } : { base: "2", md: "2" }}
              pt={onScoreboard ? { base: "2", md: "2" } : { base: "2", md: "2" }}
              pb={onScoreboard ? { base: "1", md: "2" } : "2"}
            >
              <Box
                {...(onScoreboard
                  ? { px: 0, py: 0 }
                  : PANEL_ENTRY_CARD_PROPS)}
              >
                <Flex
                  align="baseline"
                  justify="space-between"
                  gap="3"
                  flexWrap="wrap"
                >
                  <Heading
                    as="h1"
                    size={
                      onScoreboard
                        ? { base: "md", md: "lg" }
                        : { base: "lg", md: "xl" }
                    }
                    mb={onScoreboard ? "0" : "2"}
                    className="scorenado-pixel-title"
                    flex="1"
                    minW="0"
                  >
                    {onScoreboard && scoreboardHeader
                      ? scoreboardHeader.title
                      : "♣️ Scorenado"}
                  </Heading>
                  {onScoreboard && scoreboardHeader ? (
                    <Text
                      fontSize={APP_TEXT_SIZES.helper}
                      color="fg.muted"
                      textAlign="right"
                      whiteSpace="nowrap"
                      flexShrink={0}
                    >
                      {scoreboardHeader.meta}
                    </Text>
                  ) : null}
                </Flex>
                {!onScoreboard ? (
                  <Text
                    className="scorenado-pixel-body"
                    fontSize={APP_TEXT_SIZES.body}
                    lineHeight="tall"
                    color="fg"
                  >
                    Custom scoreboards and live board-game scoring.
                  </Text>
                ) : null}
              </Box>
            </Stack>

            {!onScoreboard ? (
              <Box px={{ base: "2", md: "2" }}>
                <ScorenadoOpenGamesBanner />
              </Box>
            ) : null}

            {!onScoreboard ? (
              <AppShellTabsList>
                <AppShellTabsTrigger value="play">Play</AppShellTabsTrigger>
                <AppShellTabsTrigger value="templates">Templates</AppShellTabsTrigger>
                <AppShellTabsTrigger value="history">History</AppShellTabsTrigger>
              </AppShellTabsList>
            ) : null}

            <Box
              px={onScoreboard ? { base: "2", md: "3" } : { base: "2", md: "2" }}
              py={onScoreboard ? { base: "2", md: "2" } : { base: "2", md: "2" }}
              className={onScoreboard ? "scorenado-board-wrap" : undefined}
            >
              <Outlet />
            </Box>
          </Box>
        </Box>
      </AppShellTabsRoot>
      </ScoreboardHeaderContext.Provider>
    </Stack>
  );
}
