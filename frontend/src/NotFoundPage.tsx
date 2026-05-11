import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router";

import PondButton from "./PondButton";
import { fullBleedStackProps } from "./responsive";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_PROPS,
} from "./theme/typography";

export default function NotFoundPage() {
  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box
        flex="1"
        bg="bg"
        px={0}
        py={{ base: "2", md: "2" }}
      >
        <Box {...APP_SHELL_TRAY_PROPS}>
          <Stack gap={{ base: "4", md: "4" }} p={{ base: "2", md: "2" }}>
            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Heading
                as="h1"
                size={{ base: "lg", md: "xl" }}
                mb="2"
              >
                404: Page not found
              </Heading>
              <Text
                fontSize={APP_TEXT_SIZES.body}
                lineHeight="tall"
                color="fg"
                mb="4"
              >
                We couldn&apos;t find a page at this address. It may have been
                moved or the link might be wrong.
              </Text>
              <PondButton asChild colorPalette="teal">
                <RouterLink to="/">Back to home</RouterLink>
              </PondButton>
            </Box>
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}
