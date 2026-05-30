import { Box, HStack } from "@chakra-ui/react";

type Props = {
  /** Deck tab: green = in deck. Binder tab: green = in binder (owned, not in deck). */
  mode: "deck" | "binder";
  inDeck: number;
  owned: number;
};

const PIP_SIZE = "6px";
const PIP_GREEN = "#22C55E";
const PIP_GRAY = "#9CA3AF";

export default function CardCopyPips({ mode, inDeck, owned }: Props) {
  const inBinder = Math.max(0, owned - inDeck);
  const greenCount = mode === "deck" ? inDeck : inBinder;
  const grayCount = mode === "deck" ? inBinder : inDeck;

  if (owned <= 0) return null;

  return (
    <HStack
      gap={0.5}
      justify="center"
      px={1}
      py={0.5}
      borderRadius="sm"
      bg="rgba(255,255,255,0.8)"
      aria-label={
        mode === "deck"
          ? `${inDeck} in deck, ${inBinder} in binder`
          : `${inBinder} in binder, ${inDeck} in deck`
      }
    >
      {Array.from({ length: greenCount }, (_, index) => (
        <Box
          key={`green-${index}`}
          w={PIP_SIZE}
          h={PIP_SIZE}
          borderRadius="full"
          bg={PIP_GREEN}
          flexShrink={0}
        />
      ))}
      {Array.from({ length: grayCount }, (_, index) => (
        <Box
          key={`gray-${index}`}
          w={PIP_SIZE}
          h={PIP_SIZE}
          borderRadius="full"
          bg={PIP_GRAY}
          flexShrink={0}
        />
      ))}
    </HStack>
  );
}
