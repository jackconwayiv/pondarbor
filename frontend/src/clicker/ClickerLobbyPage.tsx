import { Box, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";
import { createDefaultClickerState, saveClickerState } from "./api";
import { ClickerPageShell } from "./ClickerShell";

export default function ClickerLobbyPage() {
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
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
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
      <ClickerPageShell>
        <Box maxW="lg" mx="auto">
          <Text textStyle={{ base: "sm", md: "md" }}>Sign in to play Pond Clicker.</Text>
        </Box>
      </ClickerPageShell>
    );
  }

  if (isAuthenticated && !sessionUser && !isLoading) {
    return (
      <ClickerPageShell>
        <Box maxW="lg" mx="auto">
          <Text fontSize={{ base: "sm", md: "md" }} color="fg">
            {sessionError ?? "Could not load your account session. Try signing in again."}
          </Text>
        </Box>
      </ClickerPageShell>
    );
  }

  if (isLoading || !sessionUser) {
    return (
      <ClickerPageShell>
        <Text fontSize={{ base: "sm", md: "md" }}>Loading…</Text>
      </ClickerPageShell>
    );
  }

  return (
    <ClickerPageShell>
      <Stack gap="4" maxW="lg" mx="auto" w="full">
        <Heading as="h1" size="lg">
          Pond Clicker
        </Heading>
        <Text fontSize={{ base: "sm", md: "md" }} color="fg">
          Welcome! Tap the pond to earn energy, then spend it in the shop on upgrades that grow your pond.
          Fertility, oxygen, verdancy, and wildlife build up over time and unlock new purchases.
        </Text>
        <Text fontSize={APP_TEXT_SIZES.meta} color="gray.700">
          Progress is saved automatically while you play. Use Reset below only if you want to start a new pond from
          scratch on this account.
        </Text>
        {resetError ? (
          <Text role="alert" fontSize={APP_TEXT_SIZES.helper} color="red.600" fontWeight="medium">
            {resetError}
          </Text>
        ) : null}
        <Flex w="full" justify="space-between" align="center" flexWrap="wrap" gap="2">
          <PondButton
            type="button"
            size="md"
            colorPalette="nautical"
            bg="white"
            color="fg"
            borderWidth="1px"
            borderColor="blackAlpha.100"
            _hover={{
              bg: "gray.50",
              borderColor: "nautical.solid",
              color: "fg",
            }}
            onClick={() => navigate("/clicker/play")}
          >
            Play game
          </PondButton>
          <PondButton
            ref={confirmResetButtonRef}
            type="button"
            size="md"
            colorPalette="nautical"
            variant="outline"
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
      </Stack>
    </ClickerPageShell>
  );
}
