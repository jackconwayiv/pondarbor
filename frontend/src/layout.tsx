import {
  Box,
  Button,
  Flex,
  HStack,
  Image,
  Link as ChakraLink,
  Popover,
  Spacer,
  Stack,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";

import { useAppSession } from "./auth/AppSessionContext";
import { pondarborLogoSrc } from "./publicAsset";
import { useIsMobile } from "./responsive";

/** Wordmark font; fixed look (no route-based styling). */
const NAV_WORDMARK_FONT = '"Brush Script MT", "Segoe Script", cursive';
const NAV_WORDMARK_FONT_SIZE = "calc(2em + 6px)";
const NAV_WORDMARK_LINE_HEIGHT = "1.1";

/** Nav bar links: no underline; no sticky focus/hover chrome after click. */
const navBarLinkProps = {
  textDecoration: "none",
  borderBottom: "none",
  boxShadow: "none",
  _hover: {
    textDecoration: "none",
    borderBottom: "none",
    boxShadow: "none",
  },
  _active: {
    textDecoration: "none",
    borderBottom: "none",
    boxShadow: "none",
  },
  _visited: {
    textDecoration: "none",
  },
  _focus: {
    outline: "none",
    boxShadow: "none",
  },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "rgba(0, 0, 0, 0.45)",
    outlineOffset: "2px",
  },
} as const;

export default function AppLayout() {
  const { isAuthenticated, auth0User } = useAppSession();
  const location = useLocation();
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
    ],
    [showProfileNav],
  );

  return (
    <Box
      flex="1"
      display="flex"
      flexDirection="column"
      minH="100%"
      w="100%"
      maxW="100%"
      bg="bg"
      color="fg"
    >
      <Flex
        as="header"
        px={{ base: "4", md: "6" }}
        py="4"
        align="center"
        bg="lilypad.solid"
      >
        <HStack gap="4" align="center">
          <HStack gap="2" align="center">
            {isMobile && (
              <Popover.Root
                open={isMobileMenuOpen}
                onOpenChange={(e) => setIsMobileMenuOpen(e.open)}
                positioning={{ placement: "bottom-start", gutter: 8 }}
                size="md"
              >
                <Popover.Trigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={
                      isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"
                    }
                    bg="transparent"
                    _hover={{ bg: "transparent" }}
                    _active={{ bg: "transparent" }}
                    _focus={{ boxShadow: "none" }}
                    _focusVisible={{ boxShadow: "none", outline: "none" }}
                    px="2"
                    minW="auto"
                    lineHeight="1"
                    fontSize="lg"
                  >
                    {isMobileMenuOpen ? "✕" : "☰"}
                  </Button>
                </Popover.Trigger>
                <Popover.Positioner>
                  <Popover.Content
                    borderWidth="1px"
                    borderColor="border"
                    minW="min(280px, calc(100dvw - 2rem))"
                    w="max-content"
                    maxW="calc(100dvw - 2rem)"
                  >
                    <Popover.Body py="3" px="0">
                      <Stack gap="3" align="flex-start" px="5">
                        <ChakraLink
                          asChild
                          colorPalette="gray"
                          variant="plain"
                          {...navBarLinkProps}
                          fontFamily={NAV_WORDMARK_FONT}
                          fontWeight="normal"
                          letterSpacing="normal"
                          fontSize={NAV_WORDMARK_FONT_SIZE}
                          lineHeight={NAV_WORDMARK_LINE_HEIGHT}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <Link to="/">Pond Arbor</Link>
                        </ChakraLink>
                        {navLinks.map((link) => (
                          <ChakraLink
                            key={link.to}
                            asChild
                            colorPalette="gray"
                            variant="plain"
                            {...navBarLinkProps}
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <Link to={link.to}>{link.label}</Link>
                          </ChakraLink>
                        ))}
                      </Stack>
                    </Popover.Body>
                  </Popover.Content>
                </Popover.Positioner>
              </Popover.Root>
            )}
            <ChakraLink
              asChild
              colorPalette="gray"
              variant="plain"
              {...navBarLinkProps}
            >
              <Link to="/">
                <Box
                  display="inline-flex"
                  alignItems="center"
                  justifyContent="center"
                  lineHeight={NAV_WORDMARK_LINE_HEIGHT}
                  fontSize={NAV_WORDMARK_FONT_SIZE}
                >
                  <Image
                    src={pondarborLogoSrc()}
                    alt="PondArbor"
                    h="1.1em"
                    w="auto"
                    maxH="1.1em"
                    objectFit="contain"
                    display="block"
                  />
                </Box>
              </Link>
            </ChakraLink>
          </HStack>

          {!isMobile && (
            <ChakraLink
              asChild
              colorPalette="gray"
              variant="plain"
              {...navBarLinkProps}
              fontFamily={NAV_WORDMARK_FONT}
              fontWeight="normal"
              letterSpacing="normal"
              fontSize={NAV_WORDMARK_FONT_SIZE}
              lineHeight={NAV_WORDMARK_LINE_HEIGHT}
              mx={{ base: "4", md: "6" }}
            >
              <Link to="/">Pond Arbor</Link>
            </ChakraLink>
          )}

          {!isMobile &&
            navLinks.map((link) => {
              const sectionActive =
                link.to === "/profile"
                  ? location.pathname.startsWith("/profile")
                  : location.pathname.startsWith("/quotes") ||
                    location.pathname.includes("/public-quotes");
              return (
                <ChakraLink
                  key={link.to}
                  asChild
                  colorPalette="gray"
                  variant="plain"
                  {...navBarLinkProps}
                  fontWeight={sectionActive ? "bold" : "normal"}
                  color={sectionActive ? "white" : undefined}
                  textShadow={
                    sectionActive ? "0 1px 2px rgba(0, 0, 0, 0.35)" : undefined
                  }
                >
                  <Link to={link.to}>{link.label}</Link>
                </ChakraLink>
              );
            })}
        </HStack>
        <Spacer />
      </Flex>
      <Box
        as="main"
        flex="1"
        minW={0}
        w="100%"
        maxW="100%"
        p={{ base: "4", md: "6" }}
        bg="bg"
        display="flex"
        flexDirection="column"
        minH="0"
      >
        <Box flex="1" minH="0" minW={0} w="100%" display="flex" flexDirection="column">
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
