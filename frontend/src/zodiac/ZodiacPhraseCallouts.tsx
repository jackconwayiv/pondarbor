import { Box, Flex, Text } from "@chakra-ui/react";

/** Uppercase chip cards so zodiac modal phrase lists read as distinct callouts. */
export default function ZodiacPhraseCallouts({
  phrases,
  accentBorderColor,
}: {
  phrases: readonly string[];
  accentBorderColor: string;
}) {
  return (
    <Flex flexWrap="wrap" gap="2" role="list">
      {phrases.map((phrase, i) => (
        <Box
          key={`${phrase}-${i}`}
          role="listitem"
          px="1.5"
          py="1"
          borderRadius="lg"
          borderWidth="1px"
          borderColor={accentBorderColor}
          bg="bg.muted"
        >
          <Text
            fontSize="xs"
            fontWeight="semibold"
            letterSpacing="0.08em"
            textTransform="uppercase"
            color="fg"
            lineHeight="snug"
          >
            {phrase}
          </Text>
        </Box>
      ))}
    </Flex>
  );
}
