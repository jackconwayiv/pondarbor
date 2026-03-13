import { Heading, Text, VStack } from "@chakra-ui/react";
import { useParams } from "react-router";

export default function UserDetailPage() {
  const { userId } = useParams();

  return (
    <VStack align="start" gap="4">
      <Heading>User Detail</Heading>
      <Text>User ID: {userId}</Text>
    </VStack>
  );
}
