import { Box, Button, Text, VStack } from "@chakra-ui/react";
import { useEffect } from "react";

import {
  errorMessage,
  isStaleChunkError,
  STALE_CHUNK_RELOAD_KEY,
} from "./RouteErrorPage";

type RootErrorFallbackProps = {
  error: unknown;
};

/**
 * Fallback when the root error boundary catches a render error (same UX as route errorElement).
 * Uses `<a href="/">` so recovery works even if the router tree is unstable.
 */
export default function RootErrorFallback({ error }: RootErrorFallbackProps) {
  const message = errorMessage(error);
  const staleChunk = isStaleChunkError(message);

  useEffect(() => {
    if (!staleChunk) return;
    if (sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY)) return;
    sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, "1");
    window.location.reload();
  }, [staleChunk]);

  return (
    <VStack
      minH="60vh"
      justify="center"
      align="center"
      gap="4"
      px="4"
      py="8"
      role="alert"
    >
      <Text fontSize="lg" fontWeight="semibold" color="teal.solid">
        {staleChunk ? "Update available" : "Something went wrong"}
      </Text>
      <Box maxW="md" textAlign="center">
        <Text fontSize="sm" color="gray.700">
          {staleChunk
            ? "This page is out of date (the app was just deployed). Reload to load the latest version."
            : message}
        </Text>
      </Box>
      <Button
        colorPalette="teal"
        onClick={() => {
          window.location.reload();
        }}
      >
        Reload page
      </Button>
      <Box fontSize="sm">
        <a
          href="/"
          style={{
            color: "var(--chakra-colors-lilypad-solid, #7a9e5c)",
            textDecoration: "underline",
          }}
        >
          Go to home
        </a>
      </Box>
    </VStack>
  );
}
