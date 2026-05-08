import { useAuth0 } from "@auth0/auth0-react";
import {
  Box,
  HStack,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Link as RouterLink, Navigate } from "react-router";

import { useAppSession } from "./auth/AppSessionContext";
import {
  auth0LoginAuthorizationParams,
  auth0SignupAuthorizationParams,
  // auth0SlackLoginAuthorizationParams,
  // auth0SlackSignupAuthorizationParams,
} from "./auth/auth0LoginParams";
import SiteFooter from "./components/SiteFooter";
import { canOpenGameTile, GAME_NAV_ITEMS } from "./gamesNavConfig";
import PondButton from "./PondButton";
import { fullBleedStackProps } from "./responsive";
import { APP_SHELL_TRAY_PROPS, APP_TEXT_SIZES } from "./theme/typography";

export default function GamesMenu() {
  const { loginWithRedirect } = useAuth0();
  const { isAuthenticated } = useAppSession();
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

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
        <Box {...APP_SHELL_TRAY_PROPS}>
          <Stack
            gap={{ base: "4", md: "4" }}
            align="flex-start"
            px={{ base: "2", md: "2" }}
            pt={{ base: "2", md: "2" }}
            pb="2"
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
                  colorPalette="sky"
                  onClick={() =>
                    loginWithRedirect({
                      authorizationParams: auth0SignupAuthorizationParams(),
                    })
                  }
                >
                  Sign up
                </PondButton>
                {/* {auth0SlackLoginAuthorizationParams() ? (
                  <PondButton
                    colorPalette="gray"
                    variant="outline"
                    onClick={() =>
                      loginWithRedirect({
                        authorizationParams: auth0SlackLoginAuthorizationParams()!,
                      })
                    }
                  >
                    Log in with Slack
                  </PondButton>
                ) : null}
                {auth0SlackSignupAuthorizationParams() ? (
                  <PondButton
                    colorPalette="gray"
                    variant="outline"
                    onClick={() =>
                      loginWithRedirect({
                        authorizationParams: auth0SlackSignupAuthorizationParams()!,
                      })
                    }
                  >
                    Sign up with Slack
                  </PondButton>
                ) : null} */}
              </HStack>
            ) : null}

            <Text
              fontSize={APP_TEXT_SIZES.title}
              fontWeight="semibold"
              fontFamily="heading"
              color="fg"
              w="100%"
            >
              Choose your game:
            </Text>
            <SimpleGrid
              as="ul"
              w="100%"
              maxW="100%"
              p="0"
              m="0"
              listStyleType="none"
              columns={{ base: 3, md: 3 }}
              gap={{ base: "3", md: "4" }}
              role="list"
              aria-label="Games you can play"
            >
              {GAME_NAV_ITEMS.map((item) => {
                const canOpen = canOpenGameTile(item.to, isAuthenticated);
                const cardBody = (
                  <Stack
                    w="100%"
                    align="center"
                    justify="center"
                    gap="1.5"
                    py="2"
                    px="1"
                    minH="5.5rem"
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
                    display="flex"
                    justifyContent="center"
                  >
                    {content}
                  </Box>
                );
              })}
            </SimpleGrid>
          </Stack>
        </Box>
      </Box>

      <SiteFooter />
    </Stack>
  );
}
