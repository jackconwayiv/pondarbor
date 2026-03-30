import {
  Avatar,
  Box,
  Circle,
  Float,
  Heading,
  HStack,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Separator,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { useAppSession } from "./auth/AppSessionContext";
import {
  getSortedIanaTimeZones,
  timeZoneOptionsForValue,
} from "./timezones";
import PondButton from "./PondButton";

export default function ProfilePage() {
  const {
    sessionUser,
    isAuthenticated,
    isLoading,
    error: sessionError,
    patchMyProfile,
    refreshSession,
    logout,
    switchUser,
  } = useAppSession();

  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [timezone, setTimezone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isEditingRef = useRef(false);
  isEditingRef.current = isEditing;

  const allZones = useMemo(() => getSortedIanaTimeZones(), []);

  const editTimezoneOptions = useMemo(
    () => timeZoneOptionsForValue(timezone || sessionUser?.profile.timezone, allZones),
    [timezone, sessionUser?.profile.timezone, allZones],
  );

  useEffect(() => {
    if (!sessionUser || isEditingRef.current) return;
    setDisplayName(sessionUser.profile.display_name ?? "");
    setAvatarUrl(sessionUser.profile.avatar_url ?? "");
    setTimezone(sessionUser.profile.timezone ?? "UTC");
  }, [sessionUser]);

  const beginEdit = () => {
    if (!sessionUser) return;
    setDisplayName(sessionUser.profile.display_name ?? "");
    setAvatarUrl(sessionUser.profile.avatar_url ?? "");
    setTimezone(sessionUser.profile.timezone ?? "UTC");
    setSaveError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setSaveError(null);
    setIsEditing(false);
    if (sessionUser) {
      setDisplayName(sessionUser.profile.display_name ?? "");
      setAvatarUrl(sessionUser.profile.avatar_url ?? "");
      setTimezone(sessionUser.profile.timezone ?? "UTC");
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
            <Text fontWeight="semibold" color="fg">
              Could not load your profile from the API.
            </Text>
            <Text fontSize="sm">
              {sessionError}
            </Text>
            <Text fontSize="sm">
              Check that the backend is running,{" "}
              <code>VITE_API_BASE_URL</code> points to it (e.g.{" "}
              <code>http://127.0.0.1:8000</code>), and CORS allows this origin.
            </Text>
          </>
        ) : (
          <Text>No profile loaded yet.</Text>
        )}
        <HStack gap="3" align="center" flexWrap="wrap">
          <PondButton size="sm" colorPalette="lilypad" onClick={switchUser}>
            Switch user
          </PondButton>
          <PondButton size="sm" colorPalette="nautical" onClick={logout}>
            Log out
          </PondButton>
        </HStack>
        <PondButton colorPalette="sky" onClick={() => void refreshSession()}>
          Retry
        </PondButton>
      </Stack>
    );
  }

  const { user, profile } = sessionUser;

  return (
    <Stack gap="6" maxW="lg" align="stretch">

      <Heading size="lg">Your Profile</Heading>

      {!isEditing ? (
        <Stack gap="4">
          <HStack gap="4" align="flex-start">
            <Avatar.Root size="lg">
              <Avatar.Fallback
                name={profile.display_name || user.email || "User"}
              />
              <Avatar.Image src={profile.avatar_url || undefined} />
              <Float placement="bottom-end" offsetX="1" offsetY="1">
                <Circle
                  bg={
                    user.is_approved ? "lilypad.solid" : "nautical.solid"
                  }
                  size="8px"
                  outline="0.2em solid"
                  outlineColor="bg"
                />
              </Float>
            </Avatar.Root>
            <Stack gap="1">
              <Text fontWeight="medium">
                {profile.display_name || "—"}
              </Text>
              <Text textStyle="sm">Timezone: {profile.timezone || "—"}</Text>
            </Stack>
          </HStack>
          <PondButton
            colorPalette="sky"
            alignSelf="flex-start"
            onClick={beginEdit}
          >
            Edit profile
          </PondButton>
        </Stack>
      ) : (
        <Box as="form" onSubmit={handleSave}>
          <Stack gap="4">
            <Text textStyle="sm" fontWeight="semibold">
              Edit profile
            </Text>
            {saveError && (
              <Text color="fg" role="alert">
                {saveError}
              </Text>
            )}
            <Stack gap="2">
              <Text textStyle="sm">Display name</Text>
              <Input
                colorPalette="sky"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nickname"
              />
            </Stack>
            <Stack gap="2">
              <Text textStyle="sm">Avatar URL</Text>
              <Input
                colorPalette="sky"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…"
              />
            </Stack>
            <Stack gap="2">
              <Text textStyle="sm">Timezone</Text>
              <NativeSelectRoot size="md">
                <NativeSelectField
                  colorPalette="sky"
                  value={timezone || "UTC"}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  {editTimezoneOptions.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </NativeSelectField>
              </NativeSelectRoot>
            </Stack>
            <Stack direction="row" gap="3">
              <PondButton
                type="submit"
                colorPalette="sky"
                loading={saving}
                disabled={saving}
              >
                Save
              </PondButton>
              <PondButton
                type="button"
                colorPalette="nautical"
                onClick={cancelEdit}
                disabled={saving}
              >
                Cancel
              </PondButton>
            </Stack>
          </Stack>
        </Box>
      )}
      
      <Separator />
      <Stack gap="3">
      <Heading size="lg">Your Account</Heading>
        <Stack gap="1">
          <Text>
            {user.email}
          </Text>
          <Text color={user.is_approved ? "#B7D394" : "#E9A14A"}>
            {user.is_approved ? "Approved" : "Awaiting Approval"}
          </Text>
        </Stack>
      </Stack>
      <HStack gap="3" align="center" flexWrap="wrap">
        <PondButton size="sm" colorPalette="lilypad" onClick={switchUser}>
          Switch user
        </PondButton>
        <PondButton size="sm" colorPalette="nautical" onClick={logout}>
          Log out
        </PondButton>
      </HStack>
    </Stack>
  );
}
