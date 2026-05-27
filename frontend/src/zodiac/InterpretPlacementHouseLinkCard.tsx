import { Box, Heading, Text } from "@chakra-ui/react";
import type { ComponentProps, KeyboardEvent } from "react";

import { buildHouseInterpretWriteup } from "./buildHouseInterpretWriteup";
import type { NatalChartPayload } from "./chartTypes";
import {
  INTERPRET_BODY_FONT_SIZE,
  INTERPRET_HEADING_SIZE,
} from "./interpretTypography";
import { signCardAccent } from "./signCardAccent";
import { formatHouseOrdinal } from "./zodiacHouseDescriptors";

type Props = {
  house: number;
  text: string;
  chart: NatalChartPayload;
  bodyFontSize?: ComponentProps<typeof Text>["fontSize"];
  headingSize?: ComponentProps<typeof Heading>["size"];
  showHeading?: boolean;
  /** Sign key for card chrome (defaults to house cusp sign). */
  accentSign?: string;
  onOpen?: () => void;
};

export default function InterpretPlacementHouseLinkCard({
  house,
  text,
  chart,
  bodyFontSize = INTERPRET_BODY_FONT_SIZE,
  headingSize = INTERPRET_HEADING_SIZE,
  showHeading = true,
  accentSign,
  onOpen,
}: Props) {
  const houseWriteup = buildHouseInterpretWriteup(house, chart);
  const accent = signCardAccent(accentSign ?? houseWriteup?.cuspSign ?? "aries");
  const ordinal = formatHouseOrdinal(house);
  const theme = houseWriteup?.theme ?? null;
  const heading =
    ordinal && theme ? `${ordinal} House - ${theme}` : ordinal ? `${ordinal} House` : null;
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
        interactive
          ? showHeading && heading
            ? `Open ${heading} interpretation.`
            : ordinal
              ? `Open ${ordinal} House interpretation.`
              : `Open House interpretation.`
          : undefined
      }
      cursor={interactive ? "pointer" : "default"}
      borderLeftWidth="3px"
      borderLeftColor={accent.borderColor}
      borderWidth="1px"
      borderColor={accent.borderColor}
      borderRadius="lg"
      bg={accent.bg}
      p="3"
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
      {showHeading && heading ? (
        <Heading
          as="h3"
          size={headingSize}
          fontFamily="heading"
          fontWeight="normal"
          color={accent.labelColor}
          lineHeight="short"
          mb="2"
        >
          {heading}
        </Heading>
      ) : null}
      <Text
        fontSize={bodyFontSize}
        lineHeight="tall"
        color={accent.valueColor}
        fontWeight="normal"
      >
        {text}
      </Text>
    </Box>
  );
}
