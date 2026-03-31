import {
  Box,
  Flex,
  HStack,
  Image,
  Link as ChakraLink,
  Spacer,
  Stack,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { Link, Outlet } from "react-router";

import { useAppSession } from "./auth/AppSessionContext";
import PondButton from "./PondButton";
import { pondarborLogoSrc } from "./publicAsset";
import { useIsMobile } from "./responsive";

export default function AppLayout() {
  const { isAuthenticated, auth0User } = useAppSession();
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // `auth0User` is cleared when the Auth0 client logs out; rely on it so nav stays in sync.
  const showProfileNav = isAuthenticated && !!auth0User;
  const navLinks = useMemo(
    () => [
      ...(showProfileNav
        ? [
            { to: "/profile", label: "Profile" },
            { to: "/quotes", label: "Quotes" },
          ]
        : []),
      { to: "/quotes/public", label: "Public Quotes" },
    ],
    [showProfileNav],
  );

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

          {!isMobile &&
            navLinks.map((link) => (
              <ChakraLink key={link.to} asChild colorPalette="gray" variant="plain">
                <Link to={link.to}>{link.label}</Link>
              </ChakraLink>
            ))}
        </HStack>
        <Spacer />
        {isMobile && (
          <PondButton
            size="sm"
            colorPalette="sky"
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setIsMobileMenuOpen((open) => !open)}
          >
            {isMobileMenuOpen ? "✕" : "☰"}
          </PondButton>
        )}
      </Flex>
      {isMobile && isMobileMenuOpen && (
        <Box borderBottomWidth="1px" borderColor="border" px="6" py="3">
          <Stack gap="2" align="flex-start">
            {navLinks.map((link) => (
              <ChakraLink
                key={link.to}
                asChild
                colorPalette="gray"
                variant="plain"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Link to={link.to}>{link.label}</Link>
              </ChakraLink>
            ))}
          </Stack>
        </Box>
      )}

      <Box as="main" flex="1" p="6" bg="bg">
        <Outlet />
      </Box>
    </Box>
  );
}
