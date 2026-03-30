import {
  Box,
  Link as ChakraLink,
  Flex,
  HStack,
  Spacer,
} from "@chakra-ui/react";
import { Link, Outlet } from "react-router";

export default function AppLayout() {
  return (
    <Box minH="100vh">
      <Flex as="header" px="6" py="4" borderBottomWidth="1px" align="center">
        <HStack gap="4">
          <ChakraLink asChild>
            <Link to="/">Home</Link>
          </ChakraLink>

          <ChakraLink asChild>
            <Link to="/users">Users</Link>
          </ChakraLink>

          <ChakraLink asChild>
            <Link to="/profile">Profile</Link>
          </ChakraLink>
        </HStack>
        <Spacer />
      </Flex>

      <Box as="main" p="6">
        <Outlet />
      </Box>
    </Box>
  );
}
