import { Box, Flex, Text } from "@chakra-ui/react";

/** Neutral, sentence-case chips for house themes (contrasts with sign `ZodiacPhraseCallouts`). */
export default function ZodiacHousePhraseCallouts({
  phrases,
}: {
  phrases: readonly string[];
}) {
  return (
    <Flex flexWrap="wrap" gap="2" role="list">
      {phrases.map((phrase, i) => (
        <Box
          key={`${phrase}-${i}`}
          role="listitem"
          px="1.5"
          py="1"
          borderRadius="full"
          borderWidth="1px"
          borderColor="border"
          bg="bg.subtle"
        >
          <Text
            fontSize="xs"
            fontWeight="medium"
            color="fg.muted"
            lineHeight="snug"
          >
            {phrase}
          </Text>
        </Box>
      ))}
    </Flex>
  );
}
