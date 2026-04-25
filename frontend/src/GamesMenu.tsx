import { useAuth0 } from "@auth0/auth0-react";
import {
  Box,
  HStack,
  Link as ChakraLink,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router";

import { useAppSession } from "./auth/AppSessionContext";
import {
  auth0LoginAuthorizationParams,
  auth0SignupAuthorizationParams,
} from "./auth/auth0LoginParams";
import PondButton from "./PondButton";
import { fullBleedStackProps, viewPortWidthBarProps } from "./responsive";
import { APP_SHELL_CONTENT_MAX_PROPS } from "./theme/typography";

/** Harbormaster (`/harbor`) is not listed here until the game is public-ready. */
const GAMES_NAV_ITEMS = [
  { to: "/clicker", label: "PondClicker", emoji: "🪷" },
  { to: "/whatif", label: "WhatIf", emoji: "🤔" },
  {
    to: "/qff",
    label: "Quest For Fat IV (demo)",
    emoji: "⚔️",
  },
] as const;

function canOpenGameTile(
  to: (typeof GAMES_NAV_ITEMS)[number]["to"],
  isAuthenticated: boolean,
): boolean {
  if (to === "/clicker") return isAuthenticated;
  return true;
}

export default function GamesMenu() {
  const { loginWithRedirect } = useAuth0();
  const { isAuthenticated } = useAppSession();

  return (
    <Stack
      flex="1"
      minH="full"
      gap="0"
      align="stretch"
      w="100%"
      {...fullBleedStackProps}
    >
      <Box flex="1" w="100%" bg="bg" px={0} py={{ base: "2", md: "2" }}>
        <Stack
          gap={{ base: "4", md: "4" }}
          align="flex-start"
          {...APP_SHELL_CONTENT_MAX_PROPS}
          px={{ base: "2", md: "2" }}
        >
          {!isAuthenticated ? (
            <HStack gap="3" align="center" flexWrap="wrap" w="100%">
              <PondButton
                colorPalette="lilypad"
                onClick={() =>
                  loginWithRedirect({
                    authorizationParams: auth0LoginAuthorizationParams(),
                  })
                }
              >
                Log in
              </PondButton>
              <PondButton
                colorPalette="teal"
                onClick={() =>
                  loginWithRedirect({
                    authorizationParams: auth0SignupAuthorizationParams(),
                  })
                }
              >
                Sign up
              </PondButton>
            </HStack>
          ) : null}

          <Text
            fontSize="xs"
            fontWeight="semibold"
            textTransform="uppercase"
            letterSpacing="wider"
            color="fg.muted"
            w="100%"
          >
            Play
          </Text>
          <SimpleGrid
            as="ul"
            w="100%"
            maxW="100%"
            p="0"
            m="0"
            listStyleType="none"
            columns={{ base: 1, md: 3 }}
            gap="2.5"
            role="list"
            aria-label="Games you can play"
          >
            {GAMES_NAV_ITEMS.map((item) => {
              const canOpen = canOpenGameTile(item.to, isAuthenticated);
              const cardBody = (
                <HStack
                  w="100%"
                  align="center"
                  gap="3"
                  py="2.5"
                  px="3"
                  minH="11"
                  _hover={canOpen ? { bg: "bg.subtle" } : undefined}
                  transition="background 0.12s ease"
                  cursor={canOpen ? "pointer" : "not-allowed"}
                  opacity={canOpen ? 1 : 0.55}
                >
                  <Text as="span" fontSize="1.5rem" lineHeight="1" aria-hidden>
                    {item.emoji}
                  </Text>
                  <Text
                    as="span"
                    fontSize="md"
                    fontWeight="semibold"
                    color="fg"
                    lineClamp={2}
                    flex="1"
                    textAlign="left"
                  >
                    {item.label}
                  </Text>
                </HStack>
              );
              const content = canOpen ? (
                <RouterLink
                  to={item.to}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    display: "block",
                  }}
                >
                  {cardBody}
                </RouterLink>
              ) : (
                <Box
                  aria-label={`${item.label} (log in to open)`}
                  display="block"
                  w="100%"
                >
                  {cardBody}
                </Box>
              );
              return (
                <Box
                  as="li"
                  key={item.to}
                  w="100%"
                  listStyleType="none"
                  borderWidth="1px"
                  borderColor="border"
                  borderRadius="lg"
                  overflow="hidden"
                  boxShadow="sm"
                  bg="bg.subtle"
                >
                  {content}
                </Box>
              );
            })}
          </SimpleGrid>

          <PondButton asChild colorPalette="teal" variant="outline" size="md">
            <RouterLink to="/">← Back</RouterLink>
          </PondButton>
        </Stack>
      </Box>

      <Box
        as="footer"
        flexShrink={0}
        bg="navy.solid"
        mt="auto"
        color="navy.fg"
        {...viewPortWidthBarProps}
      >
        <Box py="2" px={{ base: "2", md: "2" }}>
          <Box
            display="flex"
            flexDirection={{ base: "column", md: "row" }}
            alignItems={{ base: "flex-end", md: "center" }}
            justifyContent="flex-end"
            flexWrap="wrap"
            columnGap={{ md: "3" }}
            rowGap="1"
          >
            <Text textAlign="right" fontSize="xs" color="inherit">
              © 2026{" "}
              <ChakraLink
                asChild
                color="inherit"
                textDecoration="none"
                _hover={{ color: "sky.solid", textDecoration: "none" }}
              >
                <RouterLink to="/about">Pond Arbor Workshop</RouterLink>
              </ChakraLink>
              . All rights reserved.
            </Text>
            <Text textAlign="right" fontSize="xs" color="inherit">
              <ChakraLink
                asChild
                color="inherit"
                textDecoration="none"
                _hover={{ color: "sky.solid", textDecoration: "none" }}
              >
                <RouterLink to="/about/terms">Terms of Service</RouterLink>
              </ChakraLink>{" "}
              |{" "}
              <ChakraLink
                asChild
                color="inherit"
                textDecoration="none"
                _hover={{ color: "sky.solid", textDecoration: "none" }}
              >
                <RouterLink to="/about/privacy">Privacy Policy</RouterLink>
              </ChakraLink>
            </Text>
          </Box>
        </Box>
      </Box>
    </Stack>
  );
}
