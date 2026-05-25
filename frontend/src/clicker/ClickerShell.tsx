import { Box, Flex, Stack } from "@chakra-ui/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { fullBleedStackProps } from "../responsive";

import "./clickerPageWeather.css";

const DEFAULT_PAGE_BACKGROUND_FADE_MS = 1_000;
/** Above weather backdrop layers; below game UI (shop, pond, counters). */
const PAGE_CONTENT_Z_INDEX = 5;

export function ClickerPageShell({
  titleLeft,
  titleRight,
  defaultPageBackground,
  pageBackground,
  pageBackgroundFadeOutMs = DEFAULT_PAGE_BACKGROUND_FADE_MS,
  sunshinePulseKey = 0,
  sunshinePageBackground,
  sunshinePulseDurationMs = 7_000,
  /** When true, content uses the full shell width (no `7xl` cap). */
  fullWidthContent = false,
  children,
}: {
  titleLeft?: ReactNode;
  titleRight?: ReactNode;
  /** Base play-area backdrop (e.g. clear-weather brand tint). */
  defaultPageBackground?: string;
  /** When set, fills the play area behind game content (e.g. rainstorm sky). */
  pageBackground?: string;
  /** Fade-out duration when `pageBackground` clears (default 1s). */
  pageBackgroundFadeOutMs?: number;
  /** One-shot play-area sunshine tint (page backdrop only); restarts when the key changes. */
  sunshinePulseKey?: number;
  sunshinePageBackground?: string;
  /** Total fade-in + hold + fade-out (must match `clickerSunshinePagePulse` keyframe ratios). */
  sunshinePulseDurationMs?: number;
  fullWidthContent?: boolean;
  children: ReactNode;
}) {
  const [fadeOutBackground, setFadeOutBackground] = useState<string | null>(
    null,
  );
  const [fadeOutDefaultBackground, setFadeOutDefaultBackground] = useState<
    string | null
  >(null);
  const fadeOutKeyRef = useRef(0);
  const fadeOutDefaultKeyRef = useRef(0);
  const prevPageBackgroundRef = useRef<string | undefined>(pageBackground);
  const prevDefaultPageBackgroundRef = useRef<string | undefined>(
    defaultPageBackground,
  );

  useEffect(() => {
    const prev = prevPageBackgroundRef.current;
    prevPageBackgroundRef.current = pageBackground;

    if (pageBackground) {
      setFadeOutBackground(null);
      return;
    }
    if (!prev) return;

    fadeOutKeyRef.current += 1;
    setFadeOutBackground(prev);
    const id = window.setTimeout(
      () => setFadeOutBackground(null),
      pageBackgroundFadeOutMs,
    );
    return () => window.clearTimeout(id);
  }, [pageBackground, pageBackgroundFadeOutMs]);

  useEffect(() => {
    const prev = prevDefaultPageBackgroundRef.current;
    prevDefaultPageBackgroundRef.current = defaultPageBackground;

    if (!defaultPageBackground || defaultPageBackground === prev) {
      return;
    }
    if (!prev) return;

    fadeOutDefaultKeyRef.current += 1;
    setFadeOutDefaultBackground(prev);
    const id = window.setTimeout(
      () => setFadeOutDefaultBackground(null),
      pageBackgroundFadeOutMs,
    );
    return () => window.clearTimeout(id);
  }, [defaultPageBackground, pageBackgroundFadeOutMs]);

  const showSunshinePulse =
    sunshinePulseKey > 0 && sunshinePageBackground != null && !pageBackground;

  return (
    <Stack
      flex="1"
      minH="0"
      gap="0"
      display="flex"
      flexDirection="column"
      position="relative"
      bg="transparent"
      {...fullBleedStackProps}
    >
      {defaultPageBackground ? (
        <Box
          position="absolute"
          inset={0}
          zIndex={0}
          pointerEvents="none"
          bg={defaultPageBackground}
          aria-hidden
        />
      ) : null}
      {showSunshinePulse ? (
        <Box
          key={sunshinePulseKey}
          className="clickerSunshinePagePulse"
          position="absolute"
          inset={0}
          zIndex={1}
          pointerEvents="none"
          bg={sunshinePageBackground}
          style={{ animationDuration: `${sunshinePulseDurationMs}ms` }}
          aria-hidden
        />
      ) : null}
      {fadeOutDefaultBackground ? (
        <Box
          key={fadeOutDefaultKeyRef.current}
          className="clickerPageBackgroundFade"
          position="absolute"
          inset={0}
          zIndex={2}
          pointerEvents="none"
          bg={fadeOutDefaultBackground}
          aria-hidden
        />
      ) : null}
      {pageBackground ? (
        <Box
          position="absolute"
          inset={0}
          zIndex={3}
          pointerEvents="none"
          bg={pageBackground}
          aria-hidden
        />
      ) : null}
      {fadeOutBackground ? (
        <Box
          key={fadeOutKeyRef.current}
          className="clickerPageBackgroundFade"
          position="absolute"
          inset={0}
          zIndex={4}
          pointerEvents="none"
          bg={fadeOutBackground}
          aria-hidden
        />
      ) : null}
      <Box
        flex="1"
        minH="0"
        display="flex"
        flexDirection="column"
        bg="transparent"
        position="relative"
        zIndex={PAGE_CONTENT_Z_INDEX}
        px={{ base: "3", md: "4" }}
        py={{ base: "1", md: "2" }}
      >
        <Stack
          gap="1.5"
          maxW={fullWidthContent ? undefined : "7xl"}
          mx={fullWidthContent ? undefined : "auto"}
          w="full"
          flex="1"
          minH="0"
        >
          {titleLeft != null || titleRight != null ? (
            <Flex align="center" justify="space-between" gap="3" flexWrap="wrap" w="full">
              <Flex flexWrap="wrap" align="center" gap={{ base: 2, md: 4 }} flex="1" minW="0">
                {titleLeft}
              </Flex>
              {titleRight}
            </Flex>
          ) : null}
          {children}
        </Stack>
      </Box>
    </Stack>
  );
}
