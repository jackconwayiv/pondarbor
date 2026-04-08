import { Box, Spinner, Text, VStack } from "@chakra-ui/react";

export default function RouteLoadingFallback() {
  return (
    <VStack
      minH="40"
      justify="center"
      align="center"
      gap="3"
      role="status"
      aria-live="polite"
    >
      <Spinner size="sm" colorPalette="lilypad" />
      <Box
        bg="lilypad.solid"
        color="lilypad.contrast"
        borderRadius="xl"
        px="3"
        py="1.5"
      >
        <Text fontSize="sm" fontWeight="medium">
          Loading page...
        </Text>
      </Box>
    </VStack>
  );
}
