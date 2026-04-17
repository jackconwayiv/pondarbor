import { useAuth0 } from "@auth0/auth0-react";
import {
  Box,
  Flex,
  Heading,
  HStack,
  Link as ChakraLink,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router";

import { useAppSession } from "./auth/AppSessionContext";
import {
  auth0LoginAuthorizationParams,
  auth0SignupAuthorizationParams,
} from "./auth/auth0LoginParams";
import {
  LILYPAD_FLOAT_KEYFRAMES,
  LILYPAD_HOVER_HINT_VISIBLE,
  LILYPAD_WEDGE_CLIP_PATH,
} from "./lilypadHomeConstants";
import PondButton from "./PondButton";
import { fullBleedStackProps } from "./responsive";
import { APP_TEXT_SIZES } from "./theme/typography";

const GAMES_LILYPAD_TILES = [
  {
    to: "/",
    label: "Home",
    hoverText: "back to the main pond",
  },
  {
    to: "/clicker",
    label: "PondClicker",
    hoverText: "idle pond-growing game",
  },
  {
    to: "/whatif",
    label: "WhatIf",
    hoverText: "multiplayer party game",
  },
] as const;

const GAMES_PURPOSE_BLURB =
  "A humble selection of games to play on the pond.";

export default function GamesMenu() {
  const { loginWithRedirect } = useAuth0();
  const { isAuthenticated } = useAppSession();

  return (
    <Stack flex="1" minH="0" gap="0" align="stretch" {...fullBleedStackProps}>
      <Box
        flex="1"
        w="full"
        minH="0"
        bg="sky.solid"
        display="flex"
        flexDirection="column"
      >
        <Box
          bg="bg"
          w="full"
          px={{ base: "2", md: "2" }}
          py={{ base: "2", md: "2" }}
        >
          <Stack gap="1" w="full" mb="3">
            <Heading as="h1" size={{ base: "lg", md: "xl" }}>
              Games
            </Heading>
          </Stack>
          <Stack gap="3" w="full" maxW="3xl">
            {!isAuthenticated ? (
              <>
                <HStack gap="3" align="center" flexWrap="wrap">
                  <PondButton
                    colorPalette="sky"
                    onClick={() =>
                      loginWithRedirect({
                        authorizationParams: auth0LoginAuthorizationParams(),
                      })
                    }
                  >
                    Log in
                  </PondButton>
                  <PondButton
                    colorPalette="lilypad"
                    onClick={() =>
                      loginWithRedirect({
                        authorizationParams: auth0SignupAuthorizationParams(),
                      })
                    }
                  >
                    Sign up
                  </PondButton>
                </HStack>
                <Text
                  fontSize={APP_TEXT_SIZES.body}
                  lineHeight="tall"
                  color="fg"
                  maxW="3xl"
                >
                  {GAMES_PURPOSE_BLURB}{" "}
                  <ChakraLink
                    asChild
                    color="black"
                    textDecoration="underline"
                    _hover={{ color: "sky.solid" }}
                  >
                    <RouterLink to="/">Home</RouterLink>
                  </ChakraLink>{" "}
                  has more apps once you sign in.
                </Text>
              </>
            ) : (
              <Text fontSize={APP_TEXT_SIZES.body} lineHeight="tall" color="fg">
                {GAMES_PURPOSE_BLURB}
              </Text>
            )}
          </Stack>
        </Box>

        <Box
          flex="1"
          w="full"
          bg="transparent"
          px={{ base: "4", md: "4" }}
          py={{ base: "4", md: "4" }}
        >
          <Flex
            flexWrap="wrap"
            gap={{ base: "4", md: "6" }}
            alignItems="flex-start"
            w="100%"
          >
            {GAMES_LILYPAD_TILES.map((tile, index) => {
            const tileInteractive =
              tile.to === "/" ||
              tile.to === "/whatif" ||
              (tile.to === "/clicker" && isAuthenticated);
            const tileWrapProps = {
              flex: "0 0 auto",
              w: { base: "10.25rem", sm: "11rem", md: "12rem" },
              maxW: "100%",
              position: "relative" as const,
              animation: `${LILYPAD_FLOAT_KEYFRAMES} 5.6s ease-in-out infinite`,
              animationDelay: `${index * 0.35}s`,
              willChange: "transform",
              filter: "drop-shadow(0 8px 10px rgba(0, 0, 0, 0.16))",
              sx: {
                "@media (prefers-reduced-motion: reduce)": {
                  animation: "none",
                },
              },
            };
            const card = (
              <Box
                bg={tileInteractive ? "lilypad.solid" : "#A4B89A"}
                borderRadius="9999px"
                borderWidth="20px"
                borderColor={tileInteractive ? "lilypad.solid" : "#A4B89A"}
                aspectRatio={1}
                p={{ base: "2", md: "2" }}
                display="flex"
                alignItems="center"
                justifyContent="center"
                textAlign="center"
                position="relative"
                boxShadow="md"
                transform="translateZ(0)"
                overflow="hidden"
                clipPath={LILYPAD_WEDGE_CLIP_PATH}
                transition="background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease"
                cursor={tileInteractive ? "pointer" : "not-allowed"}
                _hover={
                  tileInteractive
                    ? {
                        bg: "bg",
                        transform: "scale(1.02)",
                        boxShadow: "xl",
                        "& .lilypad-hover-hint": LILYPAD_HOVER_HINT_VISIBLE,
                      }
                    : {
                        "& .lilypad-hover-hint": LILYPAD_HOVER_HINT_VISIBLE,
                      }
                }
                _active={
                  tileInteractive
                    ? {
                        bg: "bg",
                        transform: "scale(0.99)",
                        boxShadow: "lg",
                      }
                    : undefined
                }
              >
                <Stack
                  gap="1"
                  align="center"
                  justify="center"
                  w="full"
                  minH="0"
                  px="0.5"
                >
                  <Heading
                    as="h2"
                    size={{ base: "md", md: "lg" }}
                    position="relative"
                    zIndex={2}
                    color={tileInteractive ? "fg" : "gray.600"}
                    lineHeight="1.2"
                  >
                    {tile.label}
                  </Heading>
                  <Text
                    className="lilypad-hover-hint"
                    textAlign="center"
                    fontSize={{ base: "2xs", md: "xs" }}
                    lineHeight="1.35"
                    fontWeight="medium"
                    color={tileInteractive ? "fg" : "gray.600"}
                    opacity={0}
                    maxHeight="0"
                    overflow="hidden"
                    transitionProperty="opacity, max-height"
                    transitionDuration="0.2s"
                    transitionTimingFunction="ease"
                    px="1"
                  >
                    {tile.hoverText}
                  </Text>
                </Stack>
              </Box>
            );

            if (!tileInteractive) {
              return (
                <Box key={tile.to} {...tileWrapProps}>
                  {card}
                </Box>
              );
            }

            return (
              <Box key={tile.to} {...tileWrapProps}>
                <Box
                  asChild
                  display="block"
                  textDecoration="none"
                  color="inherit"
                  h="100%"
                  _focusVisible={{
                    "& .lilypad-hover-hint": LILYPAD_HOVER_HINT_VISIBLE,
                  }}
                >
                  <RouterLink to={tile.to}>{card}</RouterLink>
                </Box>
              </Box>
            );
            })}
          </Flex>
        </Box>
      </Box>

      <Box as="footer" w="full" flexShrink={0} bg="lilypad.solid" mt="auto">
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
            <Text textAlign="right" fontSize="xs" color="fg">
              © 2026{" "}
              <ChakraLink
                asChild
                color="black"
                textDecoration="none"
                _hover={{ color: "sky.solid", textDecoration: "none" }}
              >
                <RouterLink to="/about">Pond Arbor Workshop</RouterLink>
              </ChakraLink>
              . All rights reserved.
            </Text>
            <Text textAlign="right" fontSize="xs" color="fg">
              <ChakraLink
                asChild
                color="black"
                textDecoration="none"
                _hover={{ color: "sky.solid", textDecoration: "none" }}
              >
                <RouterLink to="/about/terms">Terms of Service</RouterLink>
              </ChakraLink>{" "}
              |{" "}
              <ChakraLink
                asChild
                color="black"
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
