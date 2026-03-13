import { Heading, Text, VStack } from "@chakra-ui/react";

export default function NotFoundPage() {
  return (
    <VStack align="start" gap="4">
      <Heading>404</Heading>
      <Text>Page not found.</Text>
    </VStack>
  );
}
