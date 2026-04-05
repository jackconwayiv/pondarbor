import { Box } from "@chakra-ui/react";
import { Outlet } from "react-router";

/** Scoped shell for QFF routes (no global nav). */
export default function QffLayout() {
  return (
    <Box
      flex="1"
      minH="0"
      display="flex"
      flexDirection="column"
      w="100%"
      maxW="100%"
      bg="#0c0c0c"
      color="#c8e6a8"
      fontFamily="'IBM Plex Mono', 'Consolas', monospace"
      /* Keep long pages (e.g. DM grid) scrolling inside the dark shell, not over the sky layout. */
      overflowY="auto"
    >
      <Outlet />
    </Box>
  );
}
