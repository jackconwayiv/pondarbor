import { Box, Button, Text, VStack } from "@chakra-ui/react";
import { useEffect } from "react";
import { Link as RouterLink, useRouteError } from "react-router";

export const STALE_CHUNK_RELOAD_KEY = "pondarbor:stale-chunk-reloaded";

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Something went wrong.";
  }
}

function isStaleChunkError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("is not a valid javascript mime type") ||
    m.includes("expected a javascript-or-wasm module") ||
    m.includes("failed to fetch dynamically imported module") ||
    m.includes("loading chunk") ||
    m.includes("loading css chunk") ||
    m.includes("importing a module script failed") ||
    m.includes("error loading dynamically imported module")
  );
}

/**
 * Shown when a route throws (e.g. lazy chunk 404 after a new deploy while the tab
 * still has an old index.html). Use `errorElement` on the root layout route.
 */
export default function RouteErrorPage() {
  const err = useRouteError();
  const message = errorMessage(err);
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
        <RouterLink
          to="/"
          style={{
            color: "var(--chakra-colors-lilypad-solid, #7a9e5c)",
            textDecoration: "underline",
          }}
        >
          Go to home
        </RouterLink>
      </Box>
    </VStack>
  );
}
