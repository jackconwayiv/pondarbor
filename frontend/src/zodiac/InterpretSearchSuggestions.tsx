import { Box, Text } from "@chakra-ui/react";

import { APP_TEXT_SIZES } from "../theme/typography";
import ZodiacHousePhraseCallouts from "./ZodiacHousePhraseCallouts";

type Props = {
  items: readonly string[];
};

export default function InterpretSearchSuggestions({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <Box
      pt="4"
      mt="2"
      borderTopWidth="1px"
      borderColor="border"
      w="100%"
    >
      <Text
        fontSize={APP_TEXT_SIZES.helper}
        fontWeight="medium"
        color="fg.muted"
        mb="2"
      >
        Want to know more? Search for:
      </Text>
      <ZodiacHousePhraseCallouts phrases={items} />
    </Box>
  );
}
