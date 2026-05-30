import { Text, chakra } from "@chakra-ui/react";
import { SQUALLS_ACTION_ACCENT_HEX, SQUALLS_HUD_COLORS } from "./squallsTheme";

const ActionButton = chakra("button");

export type SquallsActionAccent =
  | "blue"
  | "teal"
  | "orange"
  | "yellow"
  | "purple"
  | "gray";

const ACCENT_BORDER: Record<SquallsActionAccent, string> = SQUALLS_ACTION_ACCENT_HEX;

type Props = {
  emoji: string;
  label: string;
  /** Secondary line(s) below the label — disables the square aspect ratio. */
  subtext?: string;
  onClick: () => void;
  accent?: SquallsActionAccent;
  disabled?: boolean;
  compact?: boolean;
  /** Vertically center emoji, label, and subtext (e.g. loot tiles in a grid cell). */
  centerContent?: boolean;
};

export default function SquallsActionCard({
  emoji,
  label,
  subtext,
  onClick,
  accent = "blue",
  disabled = false,
  compact = false,
  centerContent = false,
}: Props) {
  const hasSubtext = !!subtext;

  return (
    <ActionButton
      type="button"
      disabled={disabled}
      onClick={onClick}
      w="100%"
      h={centerContent ? "100%" : undefined}
      aspectRatio={hasSubtext && !centerContent ? undefined : centerContent ? undefined : 1}
      minH={
        centerContent
          ? "7.5rem"
          : hasSubtext
            ? compact
              ? "7.5rem"
              : "9rem"
            : compact
              ? "4.25rem"
              : "6rem"
      }
      p={compact ? 2 : 3}
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent={centerContent || !hasSubtext ? "center" : "flex-start"}
      gap={hasSubtext ? 1 : compact ? 1 : 2}
      borderRadius="lg"
      borderWidth="2px"
      borderColor={ACCENT_BORDER[accent]}
      bg={`linear-gradient(180deg, ${SQUALLS_HUD_COLORS.cardBg} 0%, #E8D6B3 100%)`}
      color={SQUALLS_HUD_COLORS.cardText}
      boxShadow={SQUALLS_HUD_COLORS.actionShadow}
      cursor={disabled ? "not-allowed" : "pointer"}
      opacity={disabled ? 0.5 : 1}
      transition="transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease"
      _hover={
        disabled
          ? undefined
          : {
              transform: "translateY(-3px)",
              boxShadow: SQUALLS_HUD_COLORS.actionShadowHover,
              borderColor: SQUALLS_HUD_COLORS.focusRing,
            }
      }
      _active={
        disabled
          ? undefined
          : {
              transform: "translateY(-1px)",
            }
      }
      _disabled={{ pointerEvents: "none" }}
      _focusVisible={{
        outline: `2px solid ${SQUALLS_HUD_COLORS.focusRing}`,
        outlineOffset: "2px",
      }}
    >
      <Text fontSize={compact ? "xl" : "2xl"} lineHeight={1} aria-hidden>
        {emoji}
      </Text>
      <Text
        fontSize={compact ? "xs" : "sm"}
        fontWeight="bold"
        textAlign="center"
        lineHeight="short"
        px={compact ? 0 : 1}
      >
        {label}
      </Text>
      {subtext ? (
        <Text
          fontSize="xs"
          fontWeight="normal"
          color="#4B3825"
          textAlign="center"
          lineHeight="snug"
          px={0.5}
        >
          {subtext}
        </Text>
      ) : null}
    </ActionButton>
  );
}
