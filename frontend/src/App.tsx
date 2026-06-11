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
import {
  getExploreGridItems,
  getHomeGridItems,
  type AppNavItem,
} from "./appNavConfig";
import { useAppSession } from "./auth/AppSessionContext";
import {
  auth0LoginAuthorizationParams,
  auth0SignupAuthorizationParams,
} from "./auth/auth0LoginParams";
import { canOpenGameTile } from "./gamesNavConfig";
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

const GUEST_HOME_APPS: AppNavItem[] = [
  { to: "/whatif", emoji: "🎲", label: "WhatIf", blurb: "" },
  { to: "/about", emoji: "🐢", label: "About", blurb: "" },
];

const GAME_HOME_PATHS = new Set([
  "/clicker",
  "/whatif",
  "/estates",
  "/qff",
  "/harbor",
  "/squalls",
]);

export function HomeAppNavList({
  isAuthenticated,
  isApproved,
  isStaff,
  mode = "home",
  onStarAll,
}: {
  isAuthenticated: boolean;
  isApproved: boolean;
  isStaff: boolean;
  mode?: "home" | "explore";
  onStarAll?: () => void | Promise<void>;
}) {
  const { sessionUser, homeStarredAppPaths } = useAppSession();
  const access = { isAuthenticated, isApproved, isStaff };
  const profile = sessionUser
    ? { ...sessionUser.profile, home_starred_app_paths: homeStarredAppPaths }
    : undefined;
  const items: AppNavItem[] = isAuthenticated
    ? mode === "explore"
      ? getExploreGridItems(access, profile)
      : getHomeGridItems(access, profile)
    : [...GUEST_HOME_APPS];

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
      {items.map((item) => {
        const canOpen = GAME_HOME_PATHS.has(item.to)
          ? canOpenGameTile(item.to, isAuthenticated)
          : isAuthenticated ||
            item.to === "/about" ||
            item.to === "/whatif";
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
              {item.label}
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
            display="flex"
            justifyContent="center"
          >
            {content}
          </Box>
        );
      })}
      {onStarAll ? (
        <Box
          as="li"
          w="100%"
          listStyleType="none"
          display="flex"
          justifyContent="center"
        >
          <Box asChild w="100%">
            <button
              type="button"
              onClick={() => {
                void onStarAll();
              }}
              aria-label="Star all apps and go to home"
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            >
              <Stack
                w="100%"
                align="center"
                justify="center"
                gap="1"
                py="1"
                px="1"
                minH="4.5rem"
                borderRadius="lg"
                _hover={{ bg: "bg.subtle" }}
                transition="background 0.12s ease, transform 0.12s ease"
              >
                <Text as="span" fontSize="2.2rem" lineHeight="1" aria-hidden>
                  ⭐
                </Text>
                <Text
                  as="span"
                  fontSize="sm"
                  fontWeight="medium"
                  color="fg"
                  lineClamp={2}
                  textAlign="center"
                >
                  Star All Apps
                </Text>
              </Stack>
            </button>
          </Box>
        </Box>
      ) : null}
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
                    isApproved={!!sessionUser?.user.is_approved}
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
                    isApproved={!!sessionUser?.user.is_approved}
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
