import { Box, HStack, Text } from "@chakra-ui/react";

/**
 * Non-interactive heart + count for the entry owner (matches SongadayHeartButton styling without a button).
 */
export default function SongadayHeartReadOnly({ heartCount }: { heartCount: number }) {
  const label = heartCount === 1 ? "1 heart" : `${heartCount} hearts`;
  return (
    <HStack
      gap="1"
      align="center"
      px="2"
      py="1"
      borderWidth="1px"
      borderColor="lilypad.solid"
      borderRadius="xl"
      bg="white"
      role="img"
      aria-label={label}
    >
      <Text as="span">❤️</Text>
      {heartCount > 0 ? <Text as="span">{heartCount}</Text> : null}
    </HStack>
  );
}

/** Stops navigation when this sits inside a card wrapped by RouterLink. */
export function SongadayHeartReadOnlyBlockLink({ heartCount }: { heartCount: number }) {
  return (
    <Box
      display="inline-block"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <SongadayHeartReadOnly heartCount={heartCount} />
    </Box>
  );
}
