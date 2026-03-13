import { Box, Heading, Text, VStack } from "@chakra-ui/react";

export default function HomePage() {
  return (
    <VStack align="start" gap="4">
      <Heading>Home</Heading>
      <Text>Frontend shell for your Django/DRF apps.</Text>
      <Box>
        Welcome!
      </Box>
    </VStack>
  );
}
