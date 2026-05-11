import { Box, Flex, Heading, Stack, Text } from "@chakra-ui/react";

import { APP_TEXT_SIZES } from "../theme/typography";
import { modeElementPairPageSections } from "./astroLexicon";
import { signCardAccent } from "./signCardAccent";
import ZodiacPhraseCallouts from "./ZodiacPhraseCallouts";

const titleHeadingProps = {
  as: "h2" as const,
  size: "lg" as const,
  fontFamily: "heading",
  lineHeight: "short",
  color: "fg",
  mb: "0",
  flexShrink: 0,
};

function ModeElementSectionTitle({
  title,
  membersParen,
}: {
  title: string;
  membersParen: string;
}) {
  return (
    <Flex
      align="baseline"
      justify="space-between"
      gap="3"
      flexWrap="wrap"
      mb="3"
      w="100%"
    >
      <Heading {...titleHeadingProps}>{title}</Heading>
      <Text
        as="span"
        fontSize={APP_TEXT_SIZES.body}
        fontWeight="normal"
        fontFamily="body"
        color="fg.muted"
        textAlign="right"
        flex="1"
        minW="0"
        lineHeight="short"
      >
        ({membersParen})
      </Text>
    </Flex>
  );
}

export default function ZodiacComboDescriptorBodyContent({
  signRaw,
  showCardChrome = true,
}: {
  signRaw: string;
  /** When false, omit panel chrome for embedding (unused on member page; mirrors placement body). */
  showCardChrome?: boolean;
}) {
  const sections = modeElementPairPageSections(signRaw);
  const shell = signCardAccent(signRaw);

  if (!sections) return null;

  const inner = (
    <Stack gap={{ base: "5", md: "6" }}>
      <Box>
        <ModeElementSectionTitle
          title={sections.modeLabel}
          membersParen={sections.modeMembers}
        />
        <ZodiacPhraseCallouts
          phrases={sections.modePhrases}
          accentBorderColor={shell.borderColor}
        />
      </Box>
      <Box>
        <ModeElementSectionTitle
          title={sections.elementLabel}
          membersParen={sections.elementMembers}
        />
        <ZodiacPhraseCallouts
          phrases={sections.elementPhrases}
          accentBorderColor={shell.borderColor}
        />
      </Box>
    </Stack>
  );

  if (!showCardChrome) {
    return inner;
  }

  return (
    <Box
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border"
      borderRadius="xl"
      boxShadow="sm"
      p={{ base: "5", md: "6" }}
    >
      {inner}
    </Box>
  );
}
