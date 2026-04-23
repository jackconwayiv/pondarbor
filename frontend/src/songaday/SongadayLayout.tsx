import { Box, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { Outlet } from "react-router";

import { fullBleedStackProps } from "../responsive";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";

/**
 * Shared app shell with the Song-a-Day Challenge intro card; tabbed home and entry editor render below.
 */
export default function SongadayLayout() {
  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box
        flex="1"
        bg="bg"
        px={0}
        py={{ base: "2", md: "2" }}
      >
        <Box {...APP_SHELL_TRAY_PROPS}>
            <Stack
              gap={{ base: "4", md: "4" }}
              px={{ base: "2", md: "2" }}
              pt={{ base: "2", md: "2" }}
              pb="2"
            >
              <Box {...PANEL_ENTRY_CARD_PROPS}>
                <Heading
                  as="h1"
                  size={{ base: "lg", md: "xl" }}
                  fontWeight="bold"
                  mb="2"
                >
                  <HStack
                    as="span"
                    display="inline-flex"
                    gap="2"
                    alignItems="center"
                  >
                    <Text as="span" aria-hidden="true">
                      🎶
                    </Text>
                    <Text as="span">Song-a-Day Challenge</Text>
                  </HStack>
                </Heading>
                <Text
                  fontSize={APP_TEXT_SIZES.body}
                  lineHeight="tall"
                  color="fg"
                >
                  Share a song for each day's prompt and see what your friends
                  submitted!
                </Text>
              </Box>
            </Stack>
            <Outlet />
        </Box>
      </Box>
    </Stack>
  );
}
