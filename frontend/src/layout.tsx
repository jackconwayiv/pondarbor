import {
  Box,
  Flex,
  HStack,
  Image,
  Link as ChakraLink,
  Spacer,
} from "@chakra-ui/react";
import { Link, Outlet } from "react-router";

import { useAppSession } from "./auth/AppSessionContext";
import { pondarborLogoSrc } from "./publicAsset";

export default function AppLayout() {
  const { isAuthenticated, auth0User } = useAppSession();

  // `auth0User` is cleared when the Auth0 client logs out; rely on it so nav stays in sync.
  const showProfileNav = isAuthenticated && !!auth0User;

  return (
    <Box
      flex="1"
      display="flex"
      flexDirection="column"
      minH="100%"
      bg="bg"
      color="fg"
      borderWidth="1px"
      borderColor="border"
    >
      <Flex
        as="header"
        px="6"
        py="4"
        align="center"
        bg="bg"
        borderBottomWidth="1px"
        borderColor="border"
      >
        <HStack gap="4">
          <ChakraLink asChild colorPalette="gray" variant="plain">
            <Link to="/">
              <Image
                src={pondarborLogoSrc()}
                alt="PondArbor"
                boxSize="40px"
                objectFit="contain"
              />
            </Link>
          </ChakraLink>

          <ChakraLink
            asChild
            colorPalette="gray"
            variant="plain"
            fontWeight="bold"
          >
            <Link to="/">Pond Arbor</Link>
          </ChakraLink>

          {showProfileNav ? (
            <>
              <ChakraLink asChild colorPalette="gray" variant="plain">
                <Link to="/profile">Profile</Link>
              </ChakraLink>
              <ChakraLink asChild colorPalette="gray" variant="plain">
                <Link to="/quotes">Quotes</Link>
              </ChakraLink>
            </>
          ) : null}
          <ChakraLink asChild colorPalette="gray" variant="plain">
            <Link to="/quotes/public">Public Quotes</Link>
          </ChakraLink>
        </HStack>
        <Spacer />
      </Flex>

      <Box as="main" flex="1" p="6" bg="bg">
        <Outlet />
      </Box>
    </Box>
  );
}
