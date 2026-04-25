import { Box, Stack } from "@chakra-ui/react";
import { Outlet } from "react-router";

import { fullBleedStackProps } from "../responsive";
import {
  APP_SHELL_TRAY_PROPS,
} from "../theme/typography";

/**
 * Shared tray shell for Song-a-Day pages.
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
          <Outlet />
        </Box>
      </Box>
    </Stack>
  );
}
