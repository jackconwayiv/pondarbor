import { useAuth0 } from "@auth0/auth0-react";
import {
  Avatar,
  Box,
  Button,
  Circle,
  Float,
  Heading,
  HStack,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useEffect, useState, type FormEvent } from "react";
import { useAppSession } from "./auth/AppSessionContext";

function App() {
  const { loginWithRedirect } = useAuth0();

  const {
    isLoading,
    isAuthenticated,
    error,
    logout,
    auth0User,
    sessionUser,
    patchMyProfile,
  } = useAppSession();

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [timezone, setTimezone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionUser) return;
    setDisplayName(sessionUser.profile.display_name ?? "");
    setAvatarUrl(sessionUser.profile.avatar_url ?? "");
    setTimezone(sessionUser.profile.timezone ?? "");
  }, [sessionUser]);

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

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      await patchMyProfile({
        display_name: displayName,
        avatar_url: avatarUrl,
        timezone: timezone || "UTC",
      });
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box bg="white" minH="100vh" p={8}>
      {isAuthenticated ? (
        <Stack maxW="lg" mx="auto" align="flex-start">
          {sessionUser?.user?.email && (
            <Text fontSize="lg">
              Logged in as <b>{sessionUser.user.email}</b>
            </Text>
          )}

          <Heading color="black" as="h1" size="lg">
            User Profile
          </Heading>

          <Box
            bg="gray.50"
            p={4}
            borderRadius="md"
            width="100%"
            overflow="auto"
          >
            <Stack gap="8">
              {auth0User && (
                <HStack gap="4">
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
                          sessionUser?.user?.is_approved
                            ? "green.500"
                            : "yellow.500"
                        }
                        size="8px"
                        outline="0.2em solid"
                        outlineColor="bg"
                      />
                    </Float>
                  </Avatar.Root>

                  <Stack gap="0">
                    <Text color="fg.muted">
                      {sessionUser?.profile?.display_name ??
                        auth0User.name ??
                        "Unnamed user"}
                    </Text>
                    <Text textStyle="sm">{auth0User.nickname ?? "—"}</Text>
                    <Text textStyle="sm">{auth0User.email ?? "—"}</Text>
                  </Stack>
                </HStack>
              )}

              {sessionUser && (
                <Box as="form" onSubmit={handleProfileSubmit}>
                  <Text fontWeight="bold" mb={2}>
                    Edit app profile
                  </Text>
                  {saveError && (
                    <Text color="red.500" mb={2}>
                      {saveError}
                    </Text>
                  )}
                  <Stack gap="3">
                    <Box>
                      <Text textStyle="sm" mb={1}>
                        Display name
                      </Text>
                      <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Nickname"
                        bg="white"
                      />
                    </Box>
                    <Box>
                      <Text textStyle="sm" mb={1}>
                        Avatar URL
                      </Text>
                      <Input
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        placeholder="https://…"
                        bg="white"
                      />
                    </Box>
                    <Box>
                      <Text textStyle="sm" mb={1}>
                        Timezone
                      </Text>
                      <Input
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        placeholder="e.g. America/New_York"
                        bg="white"
                      />
                    </Box>
                    <Button
                      type="submit"
                      colorScheme="blue"
                      loading={saving}
                      alignSelf="flex-start"
                    >
                      Save profile
                    </Button>
                  </Stack>
                </Box>
              )}
            </Stack>
          </Box>

          <Button colorScheme="blue" onClick={logout}>
            Logout
          </Button>
        </Stack>
      ) : (
        <Stack maxW="md" mx="auto" align="center">
          {error && <Text color="red.500">Error: {error}</Text>}

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
