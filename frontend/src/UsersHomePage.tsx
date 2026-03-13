import {
  Link as ChakraLink,
  Heading,
  List,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router";

export default function UsersHomePage() {
  return (
    <VStack align="start" gap="4">
      <Heading>Users</Heading>
      <Text>This route space belongs to the users app.</Text>

      <List.Root>
        <List.Item>
          <ChakraLink asChild>
            <RouterLink to="/users/1">User 1</RouterLink>
          </ChakraLink>
        </List.Item>
        <List.Item>
          <ChakraLink asChild>
            <RouterLink to="/users/2">User 2</RouterLink>
          </ChakraLink>
        </List.Item>
      </List.Root>
    </VStack>
  );
}
