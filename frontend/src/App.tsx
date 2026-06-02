import { useAuth0 } from "@auth0/auth0-react";

import {
  Box,
  Flex,
  Heading,
  HStack,
  Image,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router";
import { APP_HOME_APPS } from "./appNavConfig";
import { useAppSession } from "./auth/AppSessionContext";
import {
  auth0LoginAuthorizationParams,
  auth0SignupAuthorizationParams,
} from "./auth/auth0LoginParams";
import { canOpenGameTile, visibleGameNavItems } from "./gamesNavConfig";
import PondButton from "./PondButton";
import { pondarborProfileSrc } from "./publicAsset";
import { SessionLoadingCard } from "./components/panelStatus";
import SiteFooter from "./components/SiteFooter";
import { fullBleedStackProps } from "./responsive";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
} from "./theme/typography";

const HOME_PURPOSE_BLURB =
  "Welcome to Pond Arbor! This is a hobby project by Pond Arbor Workshop (Jack Conway) for friends and family to enjoy a variety of social and lifestyle apps and games.";

const GUEST_HOME_APPS = [
  { to: "/whatif", emoji: "🎲", label: "WhatIf" },
  { to: "/about", emoji: "🐢", label: "About" },
] as const;

const GAME_HOME_PATHS = new Set(
  visibleGameNavItems(true).map((item) => item.to),
);

function HomeAppNavList({
  isAuthenticated,
  isStaff,
}: {
  isAuthenticated: boolean;
  isStaff: boolean;
}) {
  // Hide Meal Maestro and QFF demo from non-staff while those apps are staff-only.
  const baseItems = APP_HOME_APPS.filter(
    (item) => item.to !== "/meal" || isStaff,
  );
  const gameItems = visibleGameNavItems(isStaff);
  const items = isAuthenticated
    ? [...baseItems, ...gameItems]
    : [...GUEST_HOME_APPS];
  const HOME_APP_ORDER: Record<string, number> = {
    "/songaday": 0,
    "/calendar": 1,
    "/profile": 2,
    "/closet": 3,
    "/quotes": 4,
    "/goals": 5,
    "/zodiac": 6,
    "/people": 7,
    "/meal": 8,
    "/clicker": 9,
    "/whatif": 10,
    "/about": 11,
    "/estates": 12,
    "/qff": 13,
  };
  // Home-grid-only label overrides; nav/hamburger keep the canonical labels.
  const HOME_APP_LABEL_OVERRIDES: Record<string, string> = {
    "/profile": "My Profile",
  };
  const orderedItems = [...items].sort((a, b) => {
    const ai = HOME_APP_ORDER[a.to] ?? Number.MAX_SAFE_INTEGER;
    const bi = HOME_APP_ORDER[b.to] ?? Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });
  return (
    <SimpleGrid
      as="ul"
      w="100%"
      maxW="100%"
      p="0"
      m="0"
      listStyleType="none"
      columns={{ base: 4, md: 4 }}
      gap={{ base: "3", md: "4" }}
      role="list"
      aria-label="Apps"
    >
      {orderedItems.map((item) => {
        const canOpen = GAME_HOME_PATHS.has(item.to)
          ? canOpenGameTile(item.to, isAuthenticated)
          : isAuthenticated ||
            item.to === "/about" ||
            item.to === "/whatif";
        const displayLabel = HOME_APP_LABEL_OVERRIDES[item.to] ?? item.label;
        const cardBody = (
          <Stack
            w="100%"
            align="center"
            justify="center"
            gap="1"
            py="1"
            px="1"
            minH="4.5rem"
            borderRadius="lg"
            _hover={canOpen ? { bg: "bg.subtle" } : undefined}
            transition="background 0.12s ease, transform 0.12s ease"
            cursor={canOpen ? "pointer" : "not-allowed"}
            opacity={canOpen ? 1 : 0.55}
            transform={canOpen ? "translateY(0)" : undefined}
          >
            <Text as="span" fontSize="2.2rem" lineHeight="1" aria-hidden>
              {item.emoji}
            </Text>
            <Text
              as="span"
              fontSize="sm"
              fontWeight="medium"
              color="fg"
              lineClamp={2}
              textAlign="center"
            >
              {displayLabel}
            </Text>
          </Stack>
        );
        const content = canOpen ? (
          <RouterLink
            to={item.to}
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
          >
            {cardBody}
          </RouterLink>
        ) : (
          <Box
            aria-label={`${displayLabel} (log in to open)`}
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
            display="flex"
            justifyContent="center"
          >
            {content}
          </Box>
        );
      })}
    </SimpleGrid>
  );
}

function App() {
  const { loginWithRedirect } = useAuth0();

  const { isLoading, isAuthenticated, error, sessionUser } = useAppSession();
  const welcomeName =
    (sessionUser?.profile.display_name || "").trim() ||
    (isAuthenticated ? "there" : "friend");

  if (isLoading) {
    return <SessionLoadingCard />;
  }

  return (
    <Stack flex="1" minH="full" gap="0" align="stretch" w="100%" {...fullBleedStackProps}>
      <Box flex="1" bg="bg" w="100%" px={0} py={{ base: "1", md: "1" }}>
        <Box {...APP_SHELL_TRAY_PROPS}>
          <Stack
            gap={{ base: "4", md: "3" }}
            align="stretch"
            px={{ base: "2", md: "2" }}
            pt={{ base: "2", md: "2" }}
            pb={{ base: "3", md: "3" }}
          >
            <Stack gap="1" w="100%" align="center" textAlign="center">
              <Heading as="h1" fontSize={APP_TEXT_SIZES.display} lineHeight="shorter">
                {`Welcome ${welcomeName}!`}
              </Heading>
            </Stack>

            {!isAuthenticated ? (
              <Stack gap="3" w="100%">
                <Flex
                  alignItems={{ base: "flex-start", md: "center" }}
                  width="100%"
                  flexWrap="wrap"
                  gap="3"
                >
                  <Image src={pondarborProfileSrc()} width="150px" flexShrink={0} />
                  <Stack flex="1" minW="0" gap="3">
                    <Text
                      fontSize={APP_TEXT_SIZES.body}
                      lineHeight="tall"
                      color="fg"
                    >
                      {HOME_PURPOSE_BLURB}{" "}
                    </Text>
                    <HStack gap="3" align="center" flexWrap="wrap">
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
                        colorPalette="sky"
                        onClick={() =>
                          loginWithRedirect({
                            authorizationParams: auth0SignupAuthorizationParams(),
                          })
                        }
                      >
                        Sign up
                      </PondButton>
                    </HStack>
                  </Stack>
                </Flex>
              </Stack>
            ) : null}

            {!isAuthenticated && error && <Text color="fg">Error: {error}</Text>}

            {isAuthenticated ? (
              <>
                <Box w="100%" borderTopWidth="2px" borderColor="border" />

                <Stack gap={{ base: "2", md: "2" }} align="center" w="100%" pt="0">
                  <Text
                    fontSize={APP_TEXT_SIZES.label}
                    fontWeight="semibold"
                    color="sky.emphasized"
                    textAlign="center"
                    w="100%"
                  >
                    Where will your adventure take you today?
                  </Text>
                  <HomeAppNavList
                    isAuthenticated={isAuthenticated}
                    isStaff={!!sessionUser?.user.is_staff}
                  />
                </Stack>
              </>
            ) : (
              <>
                <Box w="100%" borderTopWidth="2px" borderColor="border" />
                <Stack gap={{ base: "2", md: "2" }} align="center" w="100%">
                  <Text
                    fontSize={APP_TEXT_SIZES.label}
                    fontWeight="semibold"
                    color="fg"
                    textAlign="center"
                    w="100%"
                  >
                    Here's a taste of what awaits on the pond:
                  </Text>
                  <HomeAppNavList
                    isAuthenticated={isAuthenticated}
                    isStaff={!!sessionUser?.user.is_staff}
                  />
                </Stack>
              </>
            )}
          </Stack>
        </Box>
      </Box>

      <SiteFooter />
    </Stack>
  );
}

export default App;
