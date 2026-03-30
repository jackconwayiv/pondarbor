import {
  Box,
  Button,
  Heading,
  Input,
  Separator,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { useAppSession } from "./auth/AppSessionContext";

export default function ProfilePage() {
  const {
    sessionUser,
    isAuthenticated,
    isLoading,
    error: sessionError,
    patchMyProfile,
    refreshSession,
  } = useAppSession();

  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [timezone, setTimezone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isEditingRef = useRef(false);
  isEditingRef.current = isEditing;

  useEffect(() => {
    if (!sessionUser || isEditingRef.current) return;
    setDisplayName(sessionUser.profile.display_name ?? "");
    setAvatarUrl(sessionUser.profile.avatar_url ?? "");
    setTimezone(sessionUser.profile.timezone ?? "");
  }, [sessionUser]);

  const beginEdit = () => {
    if (!sessionUser) return;
    setDisplayName(sessionUser.profile.display_name ?? "");
    setAvatarUrl(sessionUser.profile.avatar_url ?? "");
    setTimezone(sessionUser.profile.timezone ?? "");
    setSaveError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setSaveError(null);
    setIsEditing(false);
    if (sessionUser) {
      setDisplayName(sessionUser.profile.display_name ?? "");
      setAvatarUrl(sessionUser.profile.avatar_url ?? "");
      setTimezone(sessionUser.profile.timezone ?? "");
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      await patchMyProfile({
        display_name: displayName,
        avatar_url: avatarUrl,
        timezone: timezone || "UTC",
      });
      await refreshSession();
      setIsEditing(false);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Box py="8">
        <Text fontSize="lg">Loading…</Text>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!sessionUser) {
    return (
      <Stack gap="4" align="start" maxW="lg">
        {sessionError ? (
          <>
            <Text fontWeight="semibold" color="red.400">
              Could not load your profile from the API.
            </Text>
            <Text color="fg.muted" fontSize="sm">
              {sessionError}
            </Text>
            <Text color="fg.muted" fontSize="sm">
              Check that the backend is running,{" "}
              <code>VITE_API_BASE_URL</code> points to it (e.g.{" "}
              <code>http://127.0.0.1:8000</code>), and CORS allows this origin.
            </Text>
          </>
        ) : (
          <Text color="fg.muted">No profile loaded yet.</Text>
        )}
        <Button onClick={() => void refreshSession()}>Retry</Button>
      </Stack>
    );
  }

  const { user, profile } = sessionUser;

  return (
    <Stack gap="6" maxW="lg" align="stretch">
      <Heading size="lg">Profile</Heading>

      <Stack gap="3">
        <Text textStyle="sm" color="fg.muted">
          Account
        </Text>
        <Stack gap="1">
          <Text>
            <Text as="span" fontWeight="semibold">
              Email:{" "}
            </Text>
            {user.email}
          </Text>
          <Text>
            <Text as="span" fontWeight="semibold">
              Account status:{" "}
            </Text>
            {user.account_status}
          </Text>
          <Text>
            <Text as="span" fontWeight="semibold">
              Approved:{" "}
            </Text>
            {user.is_approved ? "Yes" : "No"}
          </Text>
        </Stack>
      </Stack>

      <Separator />

      {!isEditing ? (
        <Stack gap="3">
          <Text textStyle="sm" color="fg.muted">
            App profile
          </Text>
          <Stack gap="1">
            <Text>
              <Text as="span" fontWeight="semibold">
                Display name:{" "}
              </Text>
              {profile.display_name || "—"}
            </Text>
            <Text>
              <Text as="span" fontWeight="semibold">
                Avatar URL:{" "}
              </Text>
              {profile.avatar_url || "—"}
            </Text>
            <Text>
              <Text as="span" fontWeight="semibold">
                Timezone:{" "}
              </Text>
              {profile.timezone || "—"}
            </Text>
          </Stack>
          <Button colorScheme="blue" alignSelf="flex-start" onClick={beginEdit}>
            Edit profile
          </Button>
        </Stack>
      ) : (
        <Box as="form" onSubmit={handleSave}>
          <Stack gap="4">
            <Text textStyle="sm" color="fg.muted">
              Edit app profile
            </Text>
            {saveError && (
              <Text color="red.500" role="alert">
                {saveError}
              </Text>
            )}
            <Stack gap="2">
              <Text textStyle="sm">Display name</Text>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nickname"
                bg="bg.subtle"
              />
            </Stack>
            <Stack gap="2">
              <Text textStyle="sm">Avatar URL</Text>
              <Input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…"
                bg="bg.subtle"
              />
            </Stack>
            <Stack gap="2">
              <Text textStyle="sm">Timezone</Text>
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="e.g. America/New_York"
                bg="bg.subtle"
              />
            </Stack>
            <Stack direction="row" gap="3">
              <Button
                type="submit"
                colorScheme="blue"
                loading={saving}
                disabled={saving}
              >
                Save
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={cancelEdit}
                disabled={saving}
              >
                Cancel
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
