import { useAuth0 } from "@auth0/auth0-react";
import { Box, Flex, Grid, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { auth0LoginAuthorizationParams } from "../auth/auth0LoginParams";
import { PanelBlockSkeleton } from "../components/panelStatus";
import PondButton from "../PondButton";
import { fullBleedStackProps } from "../responsive";
import { DESIGN } from "../theme/tokens";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { createDefaultClickerState, saveClickerState } from "./api";
import {
  createDefaultClicker2State,
  saveClicker2State,
} from "../clicker2/api";

function ClickerEntryChrome({ children }: { children: ReactNode }) {
  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box flex="1" bg="bg" px={0} py={{ base: "2", md: "2" }}>
        <Box {...APP_SHELL_TRAY_PROPS}>
          <Stack
            gap={{ base: "4", md: "4" }}
            px={{ base: "2", md: "2" }}
            pt={{ base: "2", md: "2" }}
            pb="2"
          >
            {children}
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}

const REDUX_LOBBY_CARD_GRADIENT = `linear-gradient(135deg, ${DESIGN.skyLight} 0%, ${DESIGN.surface} 100%)`;
const LEGACY_LOBBY_CARD_GRADIENT = `linear-gradient(135deg, ${DESIGN.lilypadLight} 0%, ${DESIGN.grayLightBase} 100%)`;

function GameChoiceCard({
  emoji,
  title,
  description,
  gradient,
  onPlay,
}: {
  emoji: string;
  title: string;
  description: string;
  gradient: string;
  onPlay: () => void;
}) {
  return (
    <Box
      aspectRatio={1}
      w="full"
      minW="0"
      borderRadius="lg"
      bg={gradient}
      p={{ base: "3", md: "4" }}
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      textAlign="center"
      gap="2"
      cursor="pointer"
      transition="transform 0.12s ease, box-shadow 0.12s ease"
      _hover={{ transform: "translateY(-2px)", boxShadow: "md" }}
      _active={{ transform: "translateY(0)" }}
      onClick={onPlay}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPlay();
        }
      }}
    >
      <Text fontSize={{ base: "3xl", md: "4xl" }} aria-hidden lineHeight={1}>
        {emoji}
      </Text>
      <Heading as="h2" size={{ base: "sm", md: "md" }} lineHeight="short">
        {title}
      </Heading>
      <Text
        fontSize={APP_TEXT_SIZES.helper}
        lineHeight="tall"
        color="fg"
        css={{
          display: "-webkit-box",
          WebkitLineClamp: 5,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {description}
      </Text>
    </Box>
  );
}

type ResetTarget = "legacy" | "redux" | null;

export default function ClickerLobbyPage() {
  const { loginWithRedirect } = useAuth0();
  const navigate = useNavigate();
  const {
    isAuthenticated,
    sessionUser,
    isLoading,
    error: sessionError,
    getApiAccessToken,
  } = useAppSession();
  const [confirmReset, setConfirmReset] = useState<ResetTarget>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const confirmResetButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!confirmReset) return;
    const onPointerDown = (e: PointerEvent) => {
      const btn = confirmResetButtonRef.current;
      if (btn && e.target instanceof Node && btn.contains(e.target)) return;
      setConfirmReset(null);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [confirmReset]);

  const performReset = useCallback(async () => {
    if (!confirmReset) return;
    setResetBusy(true);
    setResetError(null);
    try {
      const token = await getApiAccessToken();
      if (confirmReset === "legacy") {
        await saveClickerState(token, createDefaultClickerState());
      } else {
        await saveClicker2State(token, createDefaultClicker2State());
      }
      setConfirmReset(null);
    } catch (e) {
      setResetError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetBusy(false);
    }
  }, [confirmReset, getApiAccessToken]);

  if (!isAuthenticated) {
    return (
      <ClickerEntryChrome>
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <Heading as="h1" size={{ base: "lg", md: "xl" }} mb="2">
            PondClicker
          </Heading>
          <Stack gap="3" align="flex-start">
            <Text fontSize={APP_TEXT_SIZES.body} lineHeight="tall" color="fg">
              Sign in to play PondClicker.
            </Text>
            <PondButton
              type="button"
              colorPalette="lilypad"
              size="sm"
              onClick={() =>
                void loginWithRedirect({
                  authorizationParams: auth0LoginAuthorizationParams(),
                })
              }
            >
              Log in
            </PondButton>
          </Stack>
        </Box>
      </ClickerEntryChrome>
    );
  }

  if (isAuthenticated && !sessionUser && !isLoading) {
    return (
      <ClickerEntryChrome>
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <Heading as="h1" size={{ base: "lg", md: "xl" }} mb="2">
            PondClicker
          </Heading>
          <Text
            role="alert"
            fontSize={APP_TEXT_SIZES.body}
            lineHeight="tall"
            color="nautical.solid"
            fontWeight="medium"
          >
            {sessionError ??
              "Could not load your account session. Try signing in again."}
          </Text>
        </Box>
      </ClickerEntryChrome>
    );
  }

  if (isLoading || !sessionUser) {
    return (
      <ClickerEntryChrome>
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <PanelBlockSkeleton lines={2} showTitleLine />
        </Box>
      </ClickerEntryChrome>
    );
  }

  const isStaff = !!sessionUser.user.is_staff;

  return (
    <ClickerEntryChrome>
      <Box {...PANEL_ENTRY_CARD_PROPS}>
        <Heading as="h1" size={{ base: "lg", md: "xl" }} mb="2">
          <HStack as="span" display="inline-flex" gap="2" alignItems="center">
            <Text as="span" aria-hidden="true">
              🐸
            </Text>
            <Text as="span">PondClicker</Text>
          </HStack>
        </Heading>
        <Text fontSize={APP_TEXT_SIZES.body} lineHeight="tall" color="fg">
          Choose a pond to tend. Progress saves automatically on your account.
        </Text>
      </Box>

      <Grid
        templateColumns="repeat(2, minmax(0, 1fr))"
        gap={{ base: "2", md: "3" }}
        w="full"
        maxW="32rem"
        mx="auto"
      >
        <GameChoiceCard
          emoji="🌊"
          title="PondClicker Redux"
          description="New and improved PondClicker gives limitless room to grow from ripples to transcendence."
          gradient={REDUX_LOBBY_CARD_GRADIENT}
          onPlay={() => navigate("/clicker/2")}
        />

        <GameChoiceCard
          emoji="🪷"
          title="PondClicker Legacy"
          description="The original PondClicker demands a careful balance of depth, oxygen, fertility, and shelter."
          gradient={LEGACY_LOBBY_CARD_GRADIENT}
          onPlay={() => navigate("/clicker/play")}
        />
      </Grid>

      <Box {...PANEL_ENTRY_CARD_PROPS}>
        {resetError ? (
          <Text
            role="alert"
            fontSize={APP_TEXT_SIZES.helper}
            color="nautical.solid"
            fontWeight="medium"
            mb="3"
          >
            {resetError}
          </Text>
        ) : null}
        <Text fontSize={APP_TEXT_SIZES.helper} color="gray.600" mb="3">
          Reset only the save for the game you choose. This cannot be undone.
        </Text>
        <Flex w="full" flexWrap="wrap" gap="2" align="center">
          {isStaff ? (
            <>
              <PondButton
                type="button"
                size="md"
                variant="outline"
                colorPalette="gray"
                onClick={() => navigate("/clicker/dev/redux-catalog")}
              >
                View Redux catalog
              </PondButton>
              <PondButton
                type="button"
                size="md"
                variant="outline"
                colorPalette="gray"
                onClick={() => navigate("/clicker/dev/catalog")}
              >
                View Legacy catalog
              </PondButton>
            </>
          ) : null}
          <PondButton
            ref={confirmResetButtonRef}
            type="button"
            size="md"
            colorPalette="orange"
            loading={resetBusy && confirmReset === "redux"}
            disabled={resetBusy}
            onClick={(e) => {
              e.stopPropagation();
              if (confirmReset !== "redux") {
                setConfirmReset("redux");
                setResetError(null);
                return;
              }
              void performReset();
            }}
          >
            {confirmReset === "redux" ? "Confirm Redux reset" : "Reset Redux"}
          </PondButton>
          <PondButton
            type="button"
            size="md"
            colorPalette="orange"
            variant="outline"
            loading={resetBusy && confirmReset === "legacy"}
            disabled={resetBusy}
            onClick={(e) => {
              e.stopPropagation();
              if (confirmReset !== "legacy") {
                setConfirmReset("legacy");
                setResetError(null);
                return;
              }
              void performReset();
            }}
          >
            {confirmReset === "legacy" ? "Confirm Legacy reset" : "Reset Legacy"}
          </PondButton>
        </Flex>
      </Box>
    </ClickerEntryChrome>
  );
}
