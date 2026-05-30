import { Box, HStack, Text, VStack, chakra, type BoxProps } from "@chakra-ui/react";
import type { ReactNode } from "react";

import {
  SQUALLS_ACTION_ACCENT_HEX,
  SQUALLS_ACTION_SHEET,
  SQUALLS_HEADING_FONT_FAMILY,
  SQUALLS_HUD_COLORS,
  SQUALLS_TEXT_ZONE,
} from "./squallsTheme";

const OptionButton = chakra("button");

type SquallsActionTone = "explore" | "service" | "risk" | "retreat" | "neutral";

const TONE_BORDER: Record<SquallsActionTone, string> = {
  explore: SQUALLS_ACTION_ACCENT_HEX.teal,
  service: SQUALLS_ACTION_ACCENT_HEX.yellow,
  risk: SQUALLS_ACTION_ACCENT_HEX.orange,
  retreat: SQUALLS_ACTION_ACCENT_HEX.blue,
  neutral: SQUALLS_ACTION_ACCENT_HEX.gray,
};

const OPTION_CARD_BG =
  "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 36%), repeating-linear-gradient(0deg, rgba(61, 43, 25, 0.045) 0 1px, rgba(61, 43, 25, 0) 1px 18px), radial-gradient(circle at 88% 18%, rgba(61, 43, 25, 0.07) 0%, rgba(61, 43, 25, 0) 28%)";

function optionCardChrome(tone: SquallsActionTone, disabled = false) {
  return {
    borderWidth: "1px",
    borderRadius: "md",
    borderColor: TONE_BORDER[tone],
    bg: SQUALLS_ACTION_SHEET.optionBg,
    backgroundImage: OPTION_CARD_BG,
    color: SQUALLS_ACTION_SHEET.optionText,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    transition: "transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease",
    _hover: disabled
      ? undefined
      : {
          transform: "translateY(-1px)",
          borderColor: SQUALLS_HUD_COLORS.focusRing,
          boxShadow: "0 6px 12px rgba(48, 33, 18, 0.22)",
        },
    _active: disabled ? undefined : { transform: "translateY(0)" },
    _focusVisible: {
      outline: `2px solid ${SQUALLS_HUD_COLORS.focusRing}`,
      outlineOffset: "2px",
    },
  } as const;
}

type PanelBackButtonProps = {
  label: string;
  onClick: () => void;
  tone?: SquallsActionTone;
};

/** Compact map-style card for panel headers (e.g. shop leave). */
export function SquallsPanelBackButton({
  label,
  onClick,
  tone = "retreat",
}: PanelBackButtonProps) {
  return (
    <OptionButton
      type="button"
      onClick={onClick}
      flexShrink={0}
      alignSelf="flex-start"
      textAlign="left"
      maxW={{ base: "9.5rem", sm: "11rem" }}
      px={{ base: 2, md: 2.5 }}
      py={{ base: 2, md: 2 }}
      {...optionCardChrome(tone)}
    >
      <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="semibold" lineHeight="short">
        {label}
      </Text>
    </OptionButton>
  );
}

export function SquallsTextZone({ children, ...rest }: BoxProps) {
  return (
    <Box
      w="100%"
      borderWidth="1px"
      borderColor={SQUALLS_TEXT_ZONE.border}
      borderRadius="md"
      bg={SQUALLS_TEXT_ZONE.bg}
      color={SQUALLS_TEXT_ZONE.text}
      boxShadow={SQUALLS_TEXT_ZONE.shadow}
      px={{ base: 2.5, md: 3 }}
      py={{ base: 2, md: 2.5 }}
      {...rest}
    >
      {children}
    </Box>
  );
}

type ActionSheetProps = {
  title?: string;
  children: ReactNode;
  variant?: "default" | "white";
};

export function SquallsActionSheet({
  title,
  children,
  variant = "default",
}: ActionSheetProps) {
  const isWhite = variant === "white";
  return (
    <VStack
      align="stretch"
      gap={{ base: 2.5, md: 3 }}
      w="100%"
      p={{ base: 2.5, md: 3 }}
      borderRadius="lg"
      borderWidth="1px"
      borderColor={SQUALLS_ACTION_SHEET.panelBorder}
      bg={isWhite ? "#FFFFFF" : SQUALLS_ACTION_SHEET.panelBg}
      backgroundImage={
        isWhite
          ? undefined
          : "radial-gradient(circle at 16% 12%, rgba(71, 53, 34, 0.14) 0%, rgba(71, 53, 34, 0) 35%), radial-gradient(circle at 82% 75%, rgba(71, 53, 34, 0.1) 0%, rgba(71, 53, 34, 0) 38%)"
      }
      boxShadow={
        isWhite ? "sm" : "inset 0 0 0 1px rgba(255, 247, 224, 0.28)"
      }
    >
      {title ? (
        <Text
          fontSize="xs"
          textTransform="uppercase"
          letterSpacing="wider"
          color={SQUALLS_ACTION_SHEET.sectionLabel}
          fontWeight="bold"
        >
          {title}
        </Text>
      ) : null}
      {children}
    </VStack>
  );
}

type ActionSectionProps = {
  label: string;
  children: ReactNode;
};

export function SquallsActionSection({ label, children }: ActionSectionProps) {
  return (
    <VStack align="stretch" gap={{ base: 1.5, md: 2 }}>
      <Text
        fontSize="2xs"
        textTransform="uppercase"
        letterSpacing="wider"
        color={SQUALLS_ACTION_SHEET.sectionLabel}
        fontWeight="bold"
      >
        {label}
      </Text>
      <VStack align="stretch" gap={{ base: 1.25, md: 1.5 }}>
        {children}
      </VStack>
    </VStack>
  );
}

type ActionOptionProps = {
  emoji: string;
  title: string;
  detail?: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: SquallsActionTone;
};

export function SquallsActionOption({
  emoji,
  title,
  detail,
  onClick,
  disabled = false,
  tone = "neutral",
}: ActionOptionProps) {
  return (
    <OptionButton
      type="button"
      onClick={onClick}
      disabled={disabled}
      w="100%"
      textAlign="left"
      px={{ base: 2.5, md: 3 }}
      py={{ base: 2.5, md: 2 }}
      minH={{ base: "3.5rem", md: "unset" }}
      {...optionCardChrome(tone, disabled)}
    >
      <HStack align="start" gap={2}>
        <Text fontSize={{ base: "lg", md: "xl" }} lineHeight={1} aria-hidden>
          {emoji}
        </Text>
        <VStack align="start" gap={0.5} flex={1} minW={0}>
          <Text
            fontFamily={SQUALLS_HEADING_FONT_FAMILY}
            fontSize={{ base: "lg", md: "xl" }}
            fontWeight="normal"
            lineHeight="short"
          >
            {title}
          </Text>
          {detail ? (
            <Text
              fontSize={{ base: "2xs", md: "xs" }}
              color={SQUALLS_ACTION_SHEET.optionMuted}
              lineHeight="short"
            >
              {detail}
            </Text>
          ) : null}
        </VStack>
      </HStack>
    </OptionButton>
  );
}
