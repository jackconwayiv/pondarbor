import { Box, Card, Center, Text } from "@chakra-ui/react";

import {
  categoryRowBorderColor,
  categoryRowColor,
  categoryRowColorLight,
} from "./playerColors";

/** Three-up grid for Play / Templates card pickers. */
export const SCORENADO_CARD_GRID_PROPS = {
  columns: 3,
  gap: "3",
  w: "100%",
} as const;

/** Two-up grid for History (larger square cards). */
export const SCORENADO_HISTORY_CARD_GRID_PROPS = {
  columns: 2,
  gap: "3",
  w: "100%",
} as const;

/** `play` — “SCORE A … GAME” start card; `label` — “name [template]” (templates list); `newTemplate` — “+” add card. */
export type ScorenadoGameCardVariant = "play" | "label" | "newTemplate";

type ScorenadoGameCardProps = {
  label: string;
  index: number;
  onClick?: () => void;
  variant?: ScorenadoGameCardVariant;
  loading?: boolean;
  /** When true, show 🔒 on private template cards. */
  privateTemplate?: boolean;
};

export function ScorenadoGameCard({
  label,
  index,
  onClick,
  variant = "play",
  loading = false,
  privateTemplate = false,
}: ScorenadoGameCardProps) {
  const isNew = variant === "newTemplate";
  const isPlay = variant === "play";
  const isLabel = variant === "label";
  const interactive = Boolean(onClick) && !loading;
  const colorIndex = isPlay ? index : isNew ? 0 : index - 1;
  const safeColorIndex = Math.max(0, colorIndex);
  const rowBg = isNew
    ? undefined
    : isLabel
      ? categoryRowColorLight(safeColorIndex)
      : categoryRowColor(safeColorIndex);

  return (
    <Card.Root
      cursor={loading ? "wait" : interactive ? "pointer" : "default"}
      opacity={loading ? 0.7 : 1}
      borderWidth="2px"
      borderStyle={isNew || isLabel ? "dashed" : "solid"}
      borderColor={
        isNew ? "gray.400" : isLabel ? categoryRowBorderColor(safeColorIndex) : "black"
      }
      borderRadius="2xl"
      boxShadow="xl"
      bg={isNew ? undefined : rowBg}
      bgGradient={
        isNew ? "linear(to-br, gray.100, gray.400)" : undefined
      }
      onClick={interactive ? onClick : undefined}
      w="100%"
      aspectRatio={1}
    >
      <Card.Body p="2" h="full" position="relative">
        {isLabel && privateTemplate ? (
          <Box
            position="absolute"
            top="2"
            left="2"
            fontSize="1.5rem"
            lineHeight="1"
            aria-hidden
          >
            🔒
          </Box>
        ) : null}
        <Center h="full">
          <Text
            className="scorenado-pixel-title"
            fontSize={isNew ? "2.25rem" : "0.5rem"}
            color="black"
            textAlign="center"
            lineHeight="1.4"
            wordBreak="break-word"
          >
            {isNew ? (
              "+"
            ) : isPlay ? (
              <>
                SCORE A
                <Box
                  as="span"
                  display="block"
                  my="0.5"
                  fontSize="0.625rem"
                  lineHeight="1.35"
                >
                  {label.toUpperCase()}
                </Box>
                GAME
              </>
            ) : (
              `${label.toUpperCase()} [template]`
            )}
          </Text>
        </Center>
      </Card.Body>
    </Card.Root>
  );
}
