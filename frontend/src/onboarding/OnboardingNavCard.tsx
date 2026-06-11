import { Box, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

type OnboardingNavCardProps = {
  children: ReactNode;
  detail?: string;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
};

export function OnboardingNavCard({
  children,
  detail,
  onClick,
  selected = false,
  disabled = false,
  type = "button",
}: OnboardingNavCardProps) {
  return (
    <Box
      w="100%"
      minH="5.5rem"
      p="4"
      borderRadius="lg"
      borderWidth="2px"
      borderStyle="solid"
      borderColor={selected ? "lilypad.solid" : "gray.300"}
      bg={selected ? "lilypad.subtle" : "bg"}
      textAlign="center"
      opacity={disabled ? 0.55 : 1}
      transition="border-color 0.12s ease, background 0.12s ease"
      _hover={
        disabled
          ? undefined
          : {
              borderColor: selected ? "lilypad.solid" : "lilypad.emphasized",
              bg: selected ? "lilypad.subtle" : "bg.subtle",
            }
      }
    >
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        style={{
          width: "100%",
          minHeight: "3.5rem",
          cursor: disabled ? "not-allowed" : "pointer",
          background: "transparent",
          border: "none",
          padding: 0,
        }}
      >
        <Stack gap="1" align="center">
          <Text fontSize="md" fontWeight="semibold" color="fg" lineHeight="1.2">
            {children}
          </Text>
          {detail ? (
            <Text fontSize="sm" color="fg.muted" lineHeight="1.2">
              {detail}
            </Text>
          ) : null}
        </Stack>
      </button>
    </Box>
  );
}
