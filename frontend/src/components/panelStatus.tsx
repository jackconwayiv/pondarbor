import {
  Box,
  HStack,
  Skeleton,
  SkeletonText,
  Stack,
  Text,
} from "@chakra-ui/react";
import type { ReactNode } from "react";
import PondButton from "../PondButton";
import { fullBleedStackProps } from "../responsive";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";

type PanelPageShellProps = { children: ReactNode };

/**
 * Standard full-bleed main column: background + `APP_SHELL_TRAY` (bordered 5xl tray).
 */
export function PanelPageShell({ children }: PanelPageShellProps) {
  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box
        flex="1"
        bg="bg"
        px={0}
        py={{ base: "2", md: "2" }}
      >
        <Box {...APP_SHELL_TRAY_PROPS}>
          {children}
        </Box>
      </Box>
    </Stack>
  );
}

const TRAY_INNER_STACK_GAP = { base: "4", md: "4" } as const;
const TRAY_INNER_P = { base: "2", md: "2" } as const;

type SessionLoadingCardProps = {
  /** Padded stack content inside the tray (defaults to a single block skeleton in an entry card). */
  children?: ReactNode;
};

/**
 * Full tray + one intro-style card with block skeleton. Use while session (or route) is loading.
 */
export function SessionLoadingCard({ children }: SessionLoadingCardProps) {
  return (
    <PanelPageShell>
      <Stack
        gap={TRAY_INNER_STACK_GAP}
        p={TRAY_INNER_P}
        role="status"
        aria-live="polite"
      >
        {children ?? (
          <Box {...PANEL_ENTRY_CARD_PROPS}>
            <PanelBlockSkeleton lines={3} showTitleLine />
          </Box>
        )}
      </Stack>
    </PanelPageShell>
  );
}

/** One intro card: optional title line + N body lines, stable height. */
export function PanelBlockSkeleton({
  lines = 3,
  showTitleLine = true,
}: {
  lines?: number;
  showTitleLine?: boolean;
}) {
  return (
    <Stack gap="3" w="100%" align="stretch" role="status" aria-live="polite">
      {showTitleLine ? (
        <Skeleton height="1.4em" maxW="12rem" borderRadius="md" />
      ) : null}
      <SkeletonText noOfLines={lines} gap="2" lineHeight="1.4" />
    </Stack>
  );
}

/** Horizontal strip that mirrors a `Tabs.List` (loading chrome). */
export function PanelTabBarSkeleton({ tabCount = 4 }: { tabCount?: number }) {
  return (
    <HStack
      gap="2"
      px={{ base: "2", md: "2" }}
      pb="2"
      pt="0"
      role="status"
      aria-live="polite"
      flexWrap="wrap"
    >
      {Array.from({ length: tabCount }, (_, i) => (
        <Skeleton
          key={`tab-skel-${i}`}
          height="2rem"
          width="4.5rem"
          borderRadius="md"
        />
      ))}
    </HStack>
  );
}

/** A few list rows in an entry card. */
export function PanelListRowSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Stack gap="2" w="100%" role="status" aria-live="polite">
      {Array.from({ length: rows }, (_, i) => (
        <HStack
          key={`row-skel-${i}`}
          gap="3"
          align="center"
          w="100%"
        >
          <Skeleton height="2.5rem" flex="1" borderRadius="md" maxW="100%" />
        </HStack>
      ))}
    </Stack>
  );
}

/** Reserves optional vertical space so error/success copy does not shift surrounding layout. */
export function PanelMessageSlot({
  error,
  success,
  minH = "2.75rem",
  children,
  reserve = false,
}: {
  error?: string | null;
  success?: string | null;
  minH?: string;
  children?: ReactNode;
  /** When true, keep `minH` even with no message (use where feedback often appears). */
  reserve?: boolean;
}) {
  const hasMsg = Boolean(
    (error && error.trim() !== "") ||
      (success && success.trim() !== "") ||
      children,
  );
  if (!reserve && !hasMsg) return null;
  return (
    <Box minH={reserve && !hasMsg ? minH : undefined} w="100%">
      {error ? (
        <Text
          role="alert"
          color="nautical.solid"
          fontWeight="medium"
          fontSize={APP_TEXT_SIZES.helper}
        >
          {error}
        </Text>
      ) : null}
      {success ? (
        <Text
          role="status"
          fontSize={APP_TEXT_SIZES.helper}
          color="teal.solid"
          fontWeight="medium"
        >
          {success}
        </Text>
      ) : null}
      {children}
    </Box>
  );
}

type PanelStateBaseProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionColorPalette?: Parameters<typeof PondButton>[0]["colorPalette"];
};

/** Standard empty-state block for panel/tray apps. */
export function PanelEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  actionColorPalette = "teal",
}: PanelStateBaseProps) {
  return (
    <Box {...PANEL_ENTRY_CARD_PROPS}>
      <Stack gap="2" align="flex-start">
        <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.body} color="fg">
          {title}
        </Text>
        {description ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
            {description}
          </Text>
        ) : null}
        {actionLabel && onAction ? (
          <PondButton size="sm" colorPalette={actionColorPalette} onClick={onAction}>
            {actionLabel}
          </PondButton>
        ) : null}
      </Stack>
    </Box>
  );
}

/** Standard error-state block for panel/tray apps (non-fatal; keeps user in the tray). */
export function PanelErrorState({
  title,
  description,
  actionLabel,
  onAction,
  actionColorPalette = "sky",
}: PanelStateBaseProps) {
  return (
    <Box {...PANEL_ENTRY_CARD_PROPS}>
      <Stack gap="2" align="flex-start">
        <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.body} color="fg">
          {title}
        </Text>
        {description ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="nautical.solid" fontWeight="medium" role="alert">
            {description}
          </Text>
        ) : null}
        {actionLabel && onAction ? (
          <PondButton size="sm" colorPalette={actionColorPalette} onClick={onAction}>
            {actionLabel}
          </PondButton>
        ) : null}
      </Stack>
    </Box>
  );
}

/**
 * API session present in Auth0 but profile not ready — same tray/card as other app pages.
 */
export function PanelSessionReconnect({
  sessionError,
  onRetry,
}: {
  sessionError?: string | null;
  onRetry: () => void;
}) {
  return (
    <PanelPageShell>
      <Stack gap={TRAY_INNER_STACK_GAP} p={TRAY_INNER_P}>
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <Stack gap="3" align="flex-start">
            <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.body}>
              Reconnecting your API session…
            </Text>
            <Text fontSize={APP_TEXT_SIZES.helper}>
              {sessionError ||
                "You are authenticated, but the API session is not ready yet."}
            </Text>
            <PondButton colorPalette="sky" onClick={() => void onRetry()}>
              Retry session sync
            </PondButton>
          </Stack>
        </Box>
      </Stack>
    </PanelPageShell>
  );
}
