import { Box, HStack, Text } from "@chakra-ui/react";

/**
 * Non-interactive heart + count for the entry owner (matches SongadayHeartButton styling without a button).
 * Renders nothing when count is 0.
 */
export default function SongadayHeartReadOnly({
  heartCount,
  plain,
}: {
  heartCount: number;
  /** No border (own song card). */
  plain?: boolean;
}) {
  if (heartCount <= 0) return null;
  const label = heartCount === 1 ? "1 heart" : `${heartCount} hearts`;
  if (plain) {
    return (
      <HStack gap="1" align="center" lineHeight="1" role="img" aria-label={label}>
        <Text as="span">❤️</Text>
        <Text as="span">{heartCount}</Text>
      </HStack>
    );
  }
  return (
    <HStack
      gap="1"
      align="center"
      px="2"
      py="1"
      borderWidth="1px"
      borderColor="teal.solid"
      borderRadius="xl"
      bg="white"
      role="img"
      aria-label={label}
    >
      <Text as="span">❤️</Text>
      <Text as="span">{heartCount}</Text>
    </HStack>
  );
}

/** Stops navigation when this sits inside a card wrapped by RouterLink. */
export function SongadayHeartReadOnlyBlockLink({ heartCount }: { heartCount: number }) {
  if (heartCount <= 0) return null;
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
