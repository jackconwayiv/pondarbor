import { useAuth0 } from "@auth0/auth0-react";
import { Box, Button, Heading, Stack, Text } from "@chakra-ui/react";
import { useEffect, useRef } from "react";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "";
}

function isConsentRequiredError(err: unknown): boolean {
  const message = getErrorMessage(err);
  return message.includes("Consent required");
}

function App() {
  const {
    isLoading,
    isAuthenticated,
    error,
    loginWithRedirect,
    logout: auth0Logout,
    user,
    getAccessTokenSilently,
    getAccessTokenWithPopup,
  } = useAuth0();

  const hasSynced = useRef(false);

  useEffect(() => {
    const syncProfile = async () => {
      if (!isAuthenticated || !user || hasSynced.current) return;

      hasSynced.current = true;

      try {
        const token = await (async (): Promise<string> => {
          try {
            return await getAccessTokenSilently({
              authorizationParams: {
                audience: import.meta.env.VITE_AUTH0_API_AUDIENCE,
                scope: "openid profile email",
              },
            });
          } catch (err: unknown) {
            if (isConsentRequiredError(err)) {
              const popupToken = await getAccessTokenWithPopup({
                authorizationParams: {
                  audience: import.meta.env.VITE_AUTH0_API_AUDIENCE,
                  scope: "openid profile email",
                },
              });

              if (!popupToken) {
                throw new Error("No access token returned from popup auth.");
              }

              return popupToken;
            }

            throw err;
          }
        })();

        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL ?? ""}/users/sync-profile/`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(user),
          },
        );

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Sync failed (${response.status}): ${text}`);
        }
      } catch (err: unknown) {
        hasSynced.current = false;
        console.error("Profile sync failed:", err);
      }
    };

    syncProfile().catch((err: unknown) => console.error(err));
  }, [isAuthenticated, user, getAccessTokenSilently, getAccessTokenWithPopup]);

  if (isLoading) {
    return (
      <Box
        bg="white"
        minH="100vh"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Text fontSize="lg">Loading…</Text>
      </Box>
    );
  }

  return (
    <Box bg="white" minH="100vh" p={8}>
      {isAuthenticated ? (
        <Stack maxW="lg" mx="auto" align="flex-start">
          {user && (
            <Text fontSize="lg">
              Logged in as <b>{user.email}</b>
            </Text>
          )}
          <Heading color="black" as="h1" size="lg">
            User Profile
          </Heading>
          <pre
            style={{
              background: "#f7fafc",
              padding: "1rem",
              borderRadius: "0.375rem",
              width: "100%",
              overflow: "auto",
            }}
          >
            {JSON.stringify(user, null, 2)}
          </pre>
          <Button
            colorScheme="blue"
            onClick={() =>
              auth0Logout({
                logoutParams: { returnTo: window.location.origin },
              })
            }
          >
            Logout
          </Button>
        </Stack>
      ) : (
        <Stack maxW="md" mx="auto" align="center">
          {error && <Text color="red.500">Error: {error.message}</Text>}
          <Heading as="h1" size="lg" color="black">
            Welcome to PondArbor
          </Heading>
          <Button
            colorScheme="blue"
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
          </Button>
          <Button
            variant="outline"
            colorScheme="blue"
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
          </Button>
        </Stack>
      )}
    </Box>
  );
}

export default App;
