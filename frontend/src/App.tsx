import { useAuth0 } from "@auth0/auth0-react";
import { useEffect } from "react";

import {
  Box,
  Link as ChakraLink,
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
  auth0SlackLoginAuthorizationParams,
  auth0SlackSignupAuthorizationParams,
} from "./auth/auth0LoginParams";
import PondButton from "./PondButton";
import { pondarborProfileSrc } from "./publicAsset";
import { SessionLoadingCard } from "./components/panelStatus";
import { fullBleedStackProps, viewPortWidthBarProps } from "./responsive";
import { APP_SHELL_CONTENT_MAX_PROPS, APP_TEXT_SIZES } from "./theme/typography";

const HOME_PURPOSE_BLURB =
  "Welcome to PondArbor! This is a hobby project by Pond Arbor Workshop (Jack Conway) for friends and family to enjoy a variety of social and lifestyle apps and games.";

function HomeAppNavList({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
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
      aria-label="Apps"
    >
      {APP_HOME_APPS.map((item) => {
        const canOpen =
          isAuthenticated ||
          item.to === "/games" ||
          item.to === "/about";
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
  );
}

function App() {
  const { loginWithRedirect } = useAuth0();

  const { isLoading, isAuthenticated, error, sessionUser, resyncSessionSilently } =
    useAppSession();

  useEffect(() => {
    if (!isAuthenticated || !sessionUser) return;
    void resyncSessionSilently().catch(() => {
      /* non-fatal; inbox + route bootstrap cover most freshness */
    });
    // Intention: run when auth or user id changes, not on every `sessionUser` object update (avoids
    // a loop when resync returns fresh session). eslint wants `sessionUser` in deps; that would retrigger
    // after every silent resync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, sessionUser?.user?.id, resyncSessionSilently]);

  if (isLoading) {
    return <SessionLoadingCard />;
  }

  return (
    <Stack flex="1" minH="full" gap="0" align="stretch" w="100%" {...fullBleedStackProps}>
      <Box flex="1" bg="bg" w="100%" px={0} py={{ base: "2", md: "2" }}>
        <Stack
          gap={{ base: "4", md: "4" }}
          align="stretch"
          {...APP_SHELL_CONTENT_MAX_PROPS}
          px={{ base: "2", md: "2" }}
        >
          <Stack gap="1" w="100%">
            <Heading as="h1" fontSize={APP_TEXT_SIZES.display} lineHeight="shorter">
              PondArbor
            </Heading>
          </Stack>

          {!isAuthenticated ? (
            <Stack gap="3" w="100%">
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
                  colorPalette="teal"
                  onClick={() =>
                    loginWithRedirect({
                      authorizationParams: auth0SignupAuthorizationParams(),
                    })
                  }
                >
                  Sign up
                </PondButton>
                {auth0SlackLoginAuthorizationParams() ? (
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
                ) : null}
              </HStack>
              <Flex alignItems="center" width="100%" flexWrap="wrap" gap="3">
                <Image src={pondarborProfileSrc()} width="150px" flexShrink={0} />
                <Text
                  fontSize={APP_TEXT_SIZES.body}
                  lineHeight="tall"
                  color="fg"
                  flex="1"
                  minW="0"
                >
                  {HOME_PURPOSE_BLURB}{" "}
                </Text>
              </Flex>
            </Stack>
          ) : null}

          {!isAuthenticated && error && <Text color="fg">Error: {error}</Text>}

          <Stack gap="2" align="flex-start" w="100%" pt={{ base: "2", md: "3" }}>
            <Text
              fontSize="xs"
              fontWeight="semibold"
              textTransform="uppercase"
              letterSpacing="wider"
              color="fg.muted"
              w="100%"
            >
              Apps
            </Text>
            <HomeAppNavList isAuthenticated={isAuthenticated} />
          </Stack>
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

export default App;
