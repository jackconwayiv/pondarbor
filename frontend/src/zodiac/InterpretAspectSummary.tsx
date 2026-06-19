import { Stack, Text } from "@chakra-ui/react";

import { INTERPRET_BODY_FONT_SIZE } from "./interpretTypography";

type Props = {
  paragraphs: string[];
  /** When true, only the second paragraph is shown (inline placement aspect rows). */
  previewOnly?: boolean;
  color?: string;
};

function lowercaseFirstChar(text: string): string {
  if (!text) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export function combineAspectLeadParagraphs(intro: string, cooperation: string): string {
  return `${intro.replace(/\.\s*$/, "")}: ${lowercaseFirstChar(cooperation)}`;
}

export function visibleAspectSummaryParagraphs(
  paragraphs: readonly string[],
  previewOnly: boolean,
): string[] {
  if (previewOnly) {
    return paragraphs.length > 1 ? [paragraphs[1]!] : paragraphs.slice(0, 1);
  }
  if (paragraphs.length >= 2) {
    return [combineAspectLeadParagraphs(paragraphs[0]!, paragraphs[1]!), ...paragraphs.slice(2)];
  }
  return [...paragraphs];
}

export default function InterpretAspectSummary({
  paragraphs,
  previewOnly = false,
  color = "fg",
}: Props) {
  const visible = visibleAspectSummaryParagraphs(paragraphs, previewOnly);

  return (
    <Stack gap="3" w="100%">
      {visible.map((paragraph, idx) => (
        <Text
          key={idx}
          fontSize={INTERPRET_BODY_FONT_SIZE}
          lineHeight="tall"
          color={color}
          fontWeight="normal"
        >
          {paragraph}
        </Text>
      ))}
    </Stack>
  );
}
