import { Box, Flex, Stack } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { fullBleedStackProps } from "../responsive";

export function ClickerPageShell({
  titleLeft,
  titleRight,
  children,
}: {
  titleLeft?: ReactNode;
  titleRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Stack
      flex="1"
      minH="0"
      gap="0"
      display="flex"
      flexDirection="column"
      {...fullBleedStackProps}
    >
      <Box
        flex="1"
        minH="0"
        display="flex"
        flexDirection="column"
        bg="sky.solid"
        px={{ base: "3", md: "4" }}
        py={{ base: "2", md: "3" }}
      >
        <Stack gap="2" maxW="7xl" mx="auto" w="full" flex="1" minH="0">
          {titleLeft != null || titleRight != null ? (
            <Flex align="center" justify="space-between" gap="3" flexWrap="wrap" w="full">
              <Flex flexWrap="wrap" align="center" gap={{ base: 2, md: 4 }} flex="1" minW="0">
                {titleLeft}
              </Flex>
              {titleRight}
            </Flex>
          ) : null}
          {children}
        </Stack>
      </Box>
    </Stack>
  );
}
