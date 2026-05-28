import { Text, chakra } from "@chakra-ui/react";

const ActionButton = chakra("button");

export type SquallsActionAccent =
  | "blue"
  | "teal"
  | "orange"
  | "yellow"
  | "purple"
  | "gray";

const ACCENT_BORDER: Record<SquallsActionAccent, string> = {
  blue: "blue.500",
  teal: "teal.500",
  orange: "orange.500",
  yellow: "yellow.600",
  purple: "purple.500",
  gray: "gray.500",
};

type Props = {
  emoji: string;
  label: string;
  onClick: () => void;
  accent?: SquallsActionAccent;
  disabled?: boolean;
  compact?: boolean;
};

export default function SquallsActionCard({
  emoji,
  label,
  onClick,
  accent = "blue",
  disabled = false,
  compact = false,
}: Props) {
  return (
    <ActionButton
      type="button"
      disabled={disabled}
      onClick={onClick}
      w="100%"
      aspectRatio="1"
      minH={compact ? "4.25rem" : "6rem"}
      p={compact ? 2 : 3}
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={compact ? 1 : 2}
      borderRadius="lg"
      borderWidth="2px"
      borderColor={ACCENT_BORDER[accent]}
      bg="white"
      color="gray.900"
      boxShadow="sm"
      cursor={disabled ? "not-allowed" : "pointer"}
      opacity={disabled ? 0.5 : 1}
      transition="transform 0.12s ease, box-shadow 0.12s ease"
      _hover={
        disabled
          ? undefined
          : {
              transform: "translateY(-3px)",
              boxShadow: "md",
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
    </ActionButton>
  );
}
