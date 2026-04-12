import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import { Outlet } from "react-router";

import { fullBleedStackProps } from "../responsive";
import { APP_TEXT_SIZES, PANEL_ENTRY_CARD_PROPS } from "../theme/typography";

/**
 * Shared sky + gray tray shell with the Song a Day intro card; tabbed home and entry editor render below.
 */
export default function SongadayLayout() {
  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box flex="1" bg="sky.solid" px={{ base: "2", md: "2" }} py={{ base: "2", md: "2" }}>
        <Box maxW="4xl" w="100%" mx="auto">
          <Box
            bg="gray.100"
            borderWidth="1px"
            borderColor="border"
            borderRadius="xl"
            overflow="hidden"
          >
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
                  Song a Day
                </Heading>
                <Text fontSize={APP_TEXT_SIZES.body} lineHeight="tall" color="fg">
                  Share a song for each day&apos;s prompt, hear what friends picked, and heart
                  their submissions. Use the Archive tab for a full history.
                </Text>
              </Box>
            </Stack>
            <Outlet />
          </Box>
        </Box>
      </Box>
    </Stack>
  );
}
