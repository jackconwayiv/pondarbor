import { useAuth0 } from "@auth0/auth0-react";
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

function App() {
  const { loginWithRedirect } = useAuth0();

  const { isLoading, isAuthenticated, error, auth0User, sessionUser } =
    useAppSession();

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
                <PondButton colorPalette="sky">
                  View profile
                </PondButton>
            </RouterLink>
          </Stack>
        </>
      ) : (
        <>
          {error && <Text color="fg">Error: {error}</Text>}

          <Heading as="h1" size="lg">
            Welcome to PondArbor
          </Heading>

          <PondButton
            colorPalette="lilypad"
            onClick={() =>
              loginWithRedirect({
                authorizationParams: {
                  screen_hint: "signup",
                  audience: import.meta.env.VITE_AUTH0_API_AUDIENCE,
                  scope: "openid profile email",
                },
              })
            }
          >
            Sign up
          </PondButton>

          <PondButton
            colorPalette="pond"
            onClick={() =>
              loginWithRedirect({
                authorizationParams: {
                  audience: import.meta.env.VITE_AUTH0_API_AUDIENCE,
                  scope: "openid profile email",
                },
              })
            }
          >
            Log in
          </PondButton>
        </>
      )}
    </Stack>
  );
}

export default App;
