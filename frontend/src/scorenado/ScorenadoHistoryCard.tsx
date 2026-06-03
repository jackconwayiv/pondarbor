import { Card, Stack, Text } from "@chakra-ui/react";

import { formatPlayedAtShort, historyGameLabels } from "./scorenadoHistoryFormat";
import type { GameListItem } from "./types";

type ScorenadoHistoryCardProps = {
  game: GameListItem;
  onClick: () => void;
};

export function ScorenadoHistoryCard({ game, onClick }: ScorenadoHistoryCardProps) {
  const { primary, templateLine } = historyGameLabels(game);
  const cardBg = game.is_finalized ? "gray.300" : "bg";

  return (
    <Card.Root
      cursor="pointer"
      borderWidth="2px"
      borderStyle="solid"
      borderColor="black"
      borderRadius="2xl"
      boxShadow="xl"
      bg={cardBg}
      onClick={onClick}
      w="100%"
      aspectRatio={1}
    >
      <Card.Body p="2" h="full" display="flex" alignItems="center" justifyContent="center">
        <Stack
          gap="1"
          textAlign="center"
          w="100%"
          minW="0"
          className="scorenado-pixel-title"
        >
          <Text
            fontSize="clamp(0.7rem, 4.5vw, 0.95rem)"
            color="black"
            lineHeight="1.3"
            wordBreak="break-word"
          >
            {primary.toUpperCase()}
          </Text>
          {templateLine ? (
            <Text
              className="scorenado-pixel-body"
              fontSize="0.9rem"
              color="black"
              lineHeight="1.15"
              wordBreak="break-word"
            >
              {templateLine}
            </Text>
          ) : null}
          <Text fontSize="0.45rem" color="black" lineHeight="1.3">
            {game.is_finalized ? "FINALIZED" : "IN PROGRESS"}
          </Text>
          <Text
            className="scorenado-pixel-body"
            fontSize="0.95rem"
            color="black"
            lineHeight="1.15"
          >
            {formatPlayedAtShort(game.played_at)}
          </Text>
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}
