import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router";

import PondButton from "./PondButton";
import { fullBleedStackProps } from "./responsive";
import { APP_TEXT_SIZES } from "./theme/typography";

const ENTRY_CARD_PROPS = {
  bg: "white",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "xl",
  p: { base: "4", md: "4" },
} as const;

export default function NotFoundPage() {
  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box flex="1" bg="sky.solid" px={{ base: "4", md: "6" }} py={{ base: "5", md: "6" }}>
        <Box
          maxW="4xl"
          w="100%"
          mx="auto"
          bg="gray.100"
          borderWidth="1px"
          borderColor="border"
          borderRadius="xl"
          overflow="hidden"
        >
          <Stack gap={{ base: "4", md: "4" }} p={{ base: "4", md: "6" }}>
            <Box {...ENTRY_CARD_PROPS}>
              <Heading as="h1" size={{ base: "lg", md: "xl" }} fontWeight="bold" mb="2">
                404: Page not found
              </Heading>
              <Text fontSize={APP_TEXT_SIZES.body} lineHeight="tall" color="fg" mb="4">
                We couldn&apos;t find a page at this address. It may have been moved or the link might be wrong.
              </Text>
              <PondButton asChild colorPalette="lilypad">
                <RouterLink to="/">Back to home</RouterLink>
              </PondButton>
            </Box>
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}
