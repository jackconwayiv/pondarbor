import { useAuth0 } from "@auth0/auth0-react";
import { Box, Flex, Heading, HStack, Stack, Text } from "@chakra-ui/react";
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
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { createDefaultClickerState, saveClickerState } from "./api";

function ClickerEntryChrome({ children }: { children: ReactNode }) {
  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box
        flex="1"
        bg="bg"
        px={0}
        py={{ base: "2", md: "2" }}
      >
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
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const confirmResetButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!confirmReset) return;
    const onPointerDown = (e: PointerEvent) => {
      const btn = confirmResetButtonRef.current;
      if (btn && e.target instanceof Node && btn.contains(e.target)) return;
      setConfirmReset(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [confirmReset]);

  const performReset = useCallback(async () => {
    setResetBusy(true);
    setResetError(null);
    try {
      const token = await getApiAccessToken();
      const fresh = createDefaultClickerState();
      await saveClickerState(token, fresh);
      setConfirmReset(false);
    } catch (e) {
      setResetError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetBusy(false);
    }
  }, [getApiAccessToken]);

  if (!isAuthenticated) {
    return (
      <ClickerEntryChrome>
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <Heading
            as="h1"
            size={{ base: "lg", md: "xl" }}
            fontWeight="bold"
            mb="2"
          >
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
          <Heading
            as="h1"
            size={{ base: "lg", md: "xl" }}
            fontWeight="bold"
            mb="2"
          >
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
        <Heading
          as="h1"
          size={{ base: "lg", md: "xl" }}
          fontWeight="bold"
          mb="2"
        >
          <HStack as="span" display="inline-flex" gap="2" alignItems="center">
            <Text as="span" aria-hidden="true">
              🐸
            </Text>
            <Text as="span">PondClicker</Text>
          </HStack>
        </Heading>
        <Text fontSize={APP_TEXT_SIZES.body} lineHeight="tall" color="fg">
          An idle game where you click the pond to earn energy, then spend it in
          the shop on upgrades that grow your pond. Increase your pond's depth,
          oxygen, fertility, and shelter to attract a wide diversity of pond
          life! This game is optimized for play on a desktop computer.
        </Text>
        <Text fontSize={APP_TEXT_SIZES.helper} color="gray.600" mt="3">
          Progress is saved automatically as you play. Use Reset below only if
          you want to start a new pond from scratch on this account.
        </Text>
      </Box>
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
        <Flex
          w="full"
          justify="space-between"
          align="center"
          flexWrap="wrap"
          gap="2"
        >
          <Flex gap="2" flexWrap="wrap" align="center">
            <PondButton
              type="button"
              size="md"
              colorPalette="teal"
              onClick={() => navigate("/clicker/play")}
            >
              Play game
            </PondButton>
            {isStaff ? (
              <PondButton
                type="button"
                size="md"
                variant="outline"
                colorPalette="gray"
                onClick={() => navigate("/clicker/dev/catalog")}
              >
                View Upgrades
              </PondButton>
            ) : null}
          </Flex>
          <PondButton
            ref={confirmResetButtonRef}
            type="button"
            size="md"
            colorPalette="orange"
            loading={resetBusy}
            disabled={resetBusy}
            onClick={(e) => {
              e.stopPropagation();
              if (!confirmReset) {
                setConfirmReset(true);
                setResetError(null);
                return;
              }
              void performReset();
            }}
          >
            {confirmReset ? "Confirm reset" : "Reset game"}
          </PondButton>
        </Flex>
      </Box>
    </ClickerEntryChrome>
  );
}
