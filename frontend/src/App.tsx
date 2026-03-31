import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";

import { auth0DefaultLoginParams } from "./auth/auth0LoginParams";
import {
  Avatar,
  Box,
  Circle,
  Float,
  Heading,
  HStack,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router";
import { useAppSession } from "./auth/AppSessionContext";
import PondButton from "./PondButton";
import { fetchUpcomingBirthdays, type UpcomingBirthday } from "./users/api";

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
    <Stack maxW="lg" align="flex-start" gap="6">
      {isAuthenticated ? (
        <>
          {sessionUser?.user?.email && (
            <Text fontSize="lg">
              Logged in as <b>{sessionUser.user.email}</b>
            </Text>
          )}

          <Heading as="h1" size="lg">
            Home
          </Heading>

          <Stack gap="8" width="100%">
            {auth0User && (
              <HStack gap="4" align="flex-start">
                <Avatar.Root>
                  <Avatar.Fallback
                    name={
                      sessionUser?.profile?.display_name ??
                      auth0User.name ??
                      auth0User.email ??
                      "User"
                    }
                  />
                  <Avatar.Image
                    src={sessionUser?.profile?.avatar_url ?? undefined}
                  />
                  <Float placement="bottom-end" offsetX="1" offsetY="1">
                    <Circle
                      bg={
                        sessionUser?.user?.is_approved ? "lilypad.solid" : "nautical.solid"
                      }
                      size="8px"
                      outline="0.2em solid"
                      outlineColor="bg"
                    />
                  </Float>
                </Avatar.Root>

                <Stack gap="0">
                  <Text>
                    {sessionUser?.profile?.display_name ??
                      auth0User.name ??
                      "Unnamed user"}
                  </Text>
                  <Text textStyle="sm">{auth0User.nickname ?? "—"}</Text>
                  <Text textStyle="sm">{auth0User.email ?? "—"}</Text>
                </Stack>
              </HStack>
            )}

            <RouterLink
              to="/profile"
              style={{ textDecoration: "none", color: "inherit" }}
            >
                {!sessionUser?.profile?.birth_date && (
                  <PondButton colorPalette="sky">
                    Edit Profile
                  </PondButton>
                )}
            </RouterLink>

            {sessionUser?.user?.is_approved && upcomingBirthdays.length > 0 && (
              <Stack gap="2" width="100%">
                <Heading as="h2" size="md">
                  🎉 Birthday Notice!
                </Heading>
                <Stack gap="1">
                  {upcomingBirthdays.map((birthday) => (
                    <Text key={`${birthday.display_name}-${birthday.birth_month}-${birthday.birth_day}`}>
                      {birthdayMessage(birthday)}
                    </Text>
                  ))}
                </Stack>
              </Stack>
            )}
          </Stack>
        </>
      ) : (
        <>
          {error && <Text color="fg">Error: {error}</Text>}

          <Heading as="h1" size="lg">
            Welcome to PondArbor
          </Heading>

          <HStack gap="3" align="center" flexWrap="wrap">
            <PondButton
              colorPalette="pond"
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
        </>
      )}
    </Stack>
  );
}

export default App;
