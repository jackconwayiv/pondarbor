import { Box, SimpleGrid, Text } from "@chakra-ui/react";

import { APP_TEXT_SIZES } from "../theme/typography";
import { signCardAccent } from "./signCardAccent";

export default function BigThreeStrip(props: {
  sunSign: string;
  moonSign: string;
  risingSign: string;
}) {
  const tiles = [
    {
      label: "Sun",
      value: props.sunSign,
      accent: signCardAccent(props.sunSign),
    },
    {
      label: "Moon",
      value: props.moonSign,
      accent: signCardAccent(props.moonSign),
    },
    {
      label: "Rising",
      value: props.risingSign,
      accent: signCardAccent(props.risingSign),
    },
  ] as const;

  return (
    <SimpleGrid columns={{ base: 1, md: 3 }} gap={{ base: "3", md: "4" }} w="100%">
      {tiles.map((t) => (
        <Box
          key={t.label}
          borderLeftWidth="8px"
          borderLeftColor={t.accent.borderColor}
          borderWidth="1px"
          borderColor="border"
          borderRadius="xl"
          bg={t.accent.bg}
          p={{ base: "4", md: "5" }}
          boxShadow="sm"
        >
          <Text fontSize={APP_TEXT_SIZES.label} fontWeight="semibold" color={t.accent.labelColor}>
            {t.label}
          </Text>
          <Text
            fontSize={{ base: "xl", md: "2xl" }}
            fontWeight="bold"
            fontFamily="heading"
            textTransform="capitalize"
            color={t.accent.valueColor}
            lineHeight="short"
            mt="1"
          >
            {t.value}
          </Text>
        </Box>
      ))}
    </SimpleGrid>
  );
}
