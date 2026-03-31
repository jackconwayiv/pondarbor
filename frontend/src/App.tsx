import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";

import { auth0DefaultLoginParams } from "./auth/auth0LoginParams";
import {
  Box,
  Heading,
  HStack,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router";
import { useAppSession } from "./auth/AppSessionContext";
import PondButton from "./PondButton";
import { fetchUpcomingBirthdays, type UpcomingBirthday } from "./users/api";

const LILYPAD_WEDGE_CLIP_PATH =
  "polygon(0% 0%, 43% 0%, 46% 12%, 48% 24%, 50% 36%, 52% 24%, 54% 12%, 57% 0%, 100% 0%, 100% 100%, 0% 100%)";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function birthdayMessage(birthday: UpcomingBirthday): string {
  const monthName = MONTH_NAMES[birthday.birth_month - 1] ?? String(birthday.birth_month);
  return `${birthday.display_name}'s birthday is ${monthName} ${birthday.birth_day}!`;
}

function App() {
  const { loginWithRedirect } = useAuth0();

  const {
    isLoading,
    isAuthenticated,
    error,
    auth0User,
    sessionUser,
    getApiAccessToken,
  } =
    useAppSession();
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<UpcomingBirthday[]>([]);
  const nickname =
    sessionUser?.profile?.display_name ??
    auth0User?.nickname ??
    auth0User?.name ??
    "friend";

  useEffect(() => {
    let isCancelled = false;

    async function loadUpcomingBirthdays() {
      if (!isAuthenticated || !sessionUser?.user?.is_approved) {
        if (!isCancelled) {
          setUpcomingBirthdays([]);
        }
        return;
      }

      try {
        const token = await getApiAccessToken();
        const birthdays = await fetchUpcomingBirthdays(token);
        if (!isCancelled) {
          setUpcomingBirthdays(birthdays);
        }
      } catch {
        if (!isCancelled) {
          setUpcomingBirthdays([]);
        }
      }
    }

    void loadUpcomingBirthdays();
    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, sessionUser?.user?.is_approved, getApiAccessToken]);

  if (isLoading) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        minH="40vh"
      >
        <Text fontSize="lg">Loading…</Text>
      </Box>
    );
  }

  return (
    <Stack flex="1" minH="full" gap="0" m={{ base: "-4", md: "-6" }}>
      <Box bg="bg" px={{ base: "4", md: "6" }} py={{ base: "6", md: "6" }}>
        <Stack gap="3" maxW="3xl">
          <Heading as="h1" size={{ base: "lg", md: "xl" }}>
            {isAuthenticated ? `Welcome to Pond Arbor, ${nickname}!` : "Welcome to Pond Arbor!"}
          </Heading>

          {isAuthenticated ? (
            <Stack gap="2" width="100%">
              {sessionUser?.user?.is_approved && upcomingBirthdays.length > 0 ? (
                <Stack gap="1">
                  {upcomingBirthdays.map((birthday) => (
                    <Text
                      key={`${birthday.display_name}-${birthday.birth_month}-${birthday.birth_day}`}
                      textStyle={{ base: "sm", md: "md" }}
                    >
                      {birthdayMessage(birthday)}
                    </Text>
                  ))}
                </Stack>
              ) : null}
            </Stack>
          ) : (
            <HStack gap="3" align="center" flexWrap="wrap">
              <PondButton
                colorPalette="sky"
                onClick={() =>
                  loginWithRedirect({
                    authorizationParams: auth0DefaultLoginParams(),
                  })
                }
              >
                Log in
              </PondButton>
              <PondButton
                colorPalette="lilypad"
                onClick={() =>
                  loginWithRedirect({
                    authorizationParams: auth0DefaultLoginParams({
                      screen_hint: "signup",
                    }),
                  })
                }
              >
                Sign up
              </PondButton>
            </HStack>
          )}
          {!isAuthenticated && error && <Text color="fg">Error: {error}</Text>}
        </Stack>
      </Box>

      <Box flex="1" bg="sky.solid" px={{ base: "4", md: "6" }} py={{ base: "5", md: "6" }}>
        <Box maxW="3xl">
          <SimpleGrid columns={{ base: 2, md: 3 }} gap={{ base: "4", md: "6" }}>
            {[
              { to: "/profile", label: "Profile" },
              { to: "/quotes", label: "Quotes" },
            ].map((tile) => {
              const card = (
                <Box
                  bg={isAuthenticated ? "lilypad.solid" : "#A4B89A"}
                  borderRadius="9999px"
                  borderWidth="20px"
                  borderColor={isAuthenticated ? "lilypad.solid" : "#A4B89A"}
                  aspectRatio={1}
                  p={{ base: "4", md: "6" }}
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
                  cursor={isAuthenticated ? "pointer" : "not-allowed"}
                  _hover={
                    isAuthenticated
                      ? {
                          bg: "bg",
                          transform: "scale(1.02)",
                          boxShadow: "xl",
                        }
                      : undefined
                  }
                  _active={
                    isAuthenticated
                      ? {
                          bg: "bg",
                          transform: "scale(0.99)",
                          boxShadow: "lg",
                        }
                      : undefined
                  }
                >
                  <Heading
                    as="h2"
                    size={{ base: "md", md: "lg" }}
                    position="relative"
                    zIndex={2}
                    color={isAuthenticated ? "fg" : "gray.600"}
                  >
                    {tile.label}
                  </Heading>
                </Box>
              );

              if (!isAuthenticated) {
                return <Box key={tile.to}>{card}</Box>;
              }

              return (
                <RouterLink
                  key={tile.to}
                  to={tile.to}
                  style={{ textDecoration: "none", color: "inherit", display: "block" }}
                >
                  {card}
                </RouterLink>
              );
            })}
          </SimpleGrid>
        </Box>
      </Box>
    </Stack>
  );
}

export default App;
