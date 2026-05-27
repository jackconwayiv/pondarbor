import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import type { ComponentProps, KeyboardEvent } from "react";

import { bodySymbolForTileId, signSymbolForSign } from "./astroLexicon";
import type { InterpretHouseOccupant } from "./buildHouseInterpretWriteup";
import {
  INTERPRET_BODY_FONT_SIZE,
  INTERPRET_HEADING_SIZE,
} from "./interpretTypography";
import { signCardAccent } from "./signCardAccent";

type Props = {
  occupant: InterpretHouseOccupant;
  bodyFontSize?: ComponentProps<typeof Text>["fontSize"];
  headingSize?: ComponentProps<typeof Heading>["size"];
  onOpen?: () => void;
};

export default function InterpretHouseOccupantCard({
  occupant,
  bodyFontSize = INTERPRET_BODY_FONT_SIZE,
  headingSize = INTERPRET_HEADING_SIZE,
  onOpen,
}: Props) {
  const accent = signCardAccent(occupant.sign);
  const bodySym = bodySymbolForTileId(occupant.chartKey);
  const signSym = signSymbolForSign(occupant.sign);
  const interactive = onOpen != null;
  const headingLabel = `${occupant.label} in ${occupant.signName}`;

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
        interactive
          ? `${headingLabel}. Open ${occupant.label} interpretation.`
          : `${headingLabel}.`
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
      minH="5.5rem"
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
      <Flex align="center" gap="1.5" mb="2" flexWrap="wrap">
        {bodySym ? (
          <Text
            fontSize={headingSize}
            fontWeight="normal"
            color={accent.labelColor}
            aria-hidden="true"
            lineHeight="short"
          >
            {bodySym}
          </Text>
        ) : null}
        <Heading
          as="h3"
          size={headingSize}
          fontFamily="heading"
          fontWeight="normal"
          color={accent.labelColor}
          lineHeight="short"
          mb="0"
          display="flex"
          flexWrap="wrap"
          alignItems="center"
          gap="1"
        >
          <Text as="span">
            {occupant.label}
            {" in "}
          </Text>
          {signSym ? (
            <Text as="span" aria-hidden="true">
              {signSym}
            </Text>
          ) : null}
          <Text as="span" textTransform="capitalize">
            {occupant.signName}
          </Text>
        </Heading>
      </Flex>
      <Text fontSize={bodyFontSize} lineHeight="tall" color={accent.valueColor} fontWeight="normal">
        {occupant.summary}
      </Text>
    </Box>
  );
}
