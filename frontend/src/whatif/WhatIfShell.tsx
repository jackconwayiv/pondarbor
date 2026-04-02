import { Box, type BoxProps } from "@chakra-ui/react";
import type { ReactNode } from "react";

type WhatIfShellProps = {
  children: ReactNode;
  /** Match quotes cards (`3xl`) or wider TV board (`5xl`). */
  maxW?: BoxProps["maxW"];
  /** Set false for pages that should render directly on site background. */
  withPanel?: boolean;
};

/**
 * White panel on the site sky background — same pattern as the quotes “add quote” card.
 */
export default function WhatIfShell({ children, maxW = "3xl", withPanel = true }: WhatIfShellProps) {
  return (
    <Box w="100%" maxW={maxW} mx="auto" py={{ base: "4", md: "6" }}>
      {withPanel ? (
        <Box
          bg="bg"
          borderWidth="1px"
          borderColor="border"
          borderRadius="xl"
          p={{ base: "4", md: "6" }}
          color="fg"
        >
          {children}
        </Box>
      ) : (
        <Box color="fg">{children}</Box>
      )}
    </Box>
  );
}
