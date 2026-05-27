import { Box, Text } from "@chakra-ui/react";
import type { ComponentProps, KeyboardEvent } from "react";

import { signDisplayName } from "./astroLexicon";
import { INTERPRET_BODY_FONT_SIZE } from "./interpretTypography";
import { signCardAccent } from "./signCardAccent";

type Props = {
  sign: string;
  text: string;
  /** Override for aria-label when linking to a placement page (e.g. “Mercury”). */
  openLabel?: string;
  bodyFontSize?: ComponentProps<typeof Text>["fontSize"];
  onOpen?: () => void;
};

export default function InterpretSignLinkCard({
  sign,
  text,
  openLabel,
  bodyFontSize = INTERPRET_BODY_FONT_SIZE,
  onOpen,
}: Props) {
  const accent = signCardAccent(sign);
  const signName = signDisplayName(sign);
  const linkTargetName = openLabel ?? signName;
  const interactive = onOpen != null;

  const onKeyDown = (e: KeyboardEvent) => {
    if (!interactive || !onOpen) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <Box
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={
        interactive ? `Open ${linkTargetName} interpretation.` : undefined
      }
      cursor={interactive ? "pointer" : "default"}
      borderLeftWidth="3px"
      borderLeftColor={accent.borderColor}
      borderWidth="1px"
      borderColor={accent.borderColor}
      borderRadius="lg"
      bg={accent.bg}
      p="3"
      h="100%"
      transition="box-shadow 0.15s ease"
      _hover={interactive ? { boxShadow: "md" } : undefined}
      _focusVisible={
        interactive
          ? {
              outline: "2px solid",
              outlineColor: "fg",
              outlineOffset: "2px",
            }
          : undefined
      }
      onClick={interactive ? onOpen : undefined}
      onKeyDown={onKeyDown}
    >
      <Text fontSize={bodyFontSize} lineHeight="tall" color={accent.valueColor} fontWeight="normal">
        {text}
      </Text>
    </Box>
  );
}
