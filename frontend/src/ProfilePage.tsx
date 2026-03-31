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
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router";
import { useAppSession } from "./auth/AppSessionContext";
import { APP_TEXT_SIZES } from "./theme/typography";
import {
  getSortedIanaTimeZones,
  timeZoneOptionsForValue,
} from "./timezones";
import { useIsMobile } from "./responsive";
import PondButton from "./PondButton";

function formatBirthDateForDisplay(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${month}/${day}/${year}`;
}

type EditableField = "display_name" | "avatar_url" | "timezone" | "birth_date";

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

  const [activeField, setActiveField] = useState<EditableField | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [birthDate, setBirthDate] = useState("");
  const [savingField, setSavingField] = useState<EditableField | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const allZones = useMemo(() => getSortedIanaTimeZones(), []);
  const editTimezoneOptions = useMemo(
    () => timeZoneOptionsForValue(timezone || "UTC", allZones),
    [timezone, allZones],
  );

  useEffect(() => {
    if (!sessionUser) return;
    setDisplayName(sessionUser.profile.display_name ?? "");
    setAvatarUrl(sessionUser.profile.avatar_url ?? "");
    setTimezone(sessionUser.profile.timezone ?? "UTC");
    setBirthDate(sessionUser.profile.birth_date ?? "");
  }, [sessionUser]);

  const resetFieldDraft = (field: EditableField) => {
    if (!sessionUser) return;
    if (field === "display_name") setDisplayName(sessionUser.profile.display_name ?? "");
    if (field === "avatar_url") setAvatarUrl(sessionUser.profile.avatar_url ?? "");
    if (field === "timezone") setTimezone(sessionUser.profile.timezone ?? "UTC");
    if (field === "birth_date") setBirthDate(sessionUser.profile.birth_date ?? "");
  };

  const commitField = async (field: EditableField) => {
    if (!sessionUser || savingField) return;

    const nextValue =
      field === "display_name"
        ? displayName
        : field === "avatar_url"
          ? avatarUrl
          : field === "timezone"
            ? timezone || "UTC"
            : birthDate || null;

    const currentValue =
      field === "display_name"
        ? sessionUser.profile.display_name
        : field === "avatar_url"
          ? sessionUser.profile.avatar_url
          : field === "timezone"
            ? sessionUser.profile.timezone
            : sessionUser.profile.birth_date;

    if (nextValue === currentValue) {
      setActiveField(null);
      return;
    }

    setSaveError(null);
    setSavingField(field);
    try {
      await patchMyProfile({ [field]: nextValue });
      setActiveField(null);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Update failed");
      resetFieldDraft(field);
      setActiveField(null);
    } finally {
      setSavingField(null);
    }
  };

  const cancelActiveField = () => {
    if (!activeField) return;
    resetFieldDraft(activeField);
    setSaveError(null);
    setActiveField(null);
  };

  if (isLoading) {
    return (
      <Box py="8">
        <Text fontSize={{ base: "md", md: "lg" }}>Loading…</Text>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!sessionUser) {
    return (
      <Stack gap="4" align="start" maxW="3xl">
        {sessionError ? (
          <>
            <Text fontWeight="semibold" color="fg">
              Could not load your profile from the API.
            </Text>
            <Text fontSize={APP_TEXT_SIZES.helper}>{sessionError}</Text>
            <Text fontSize={APP_TEXT_SIZES.helper}>
              Check that the backend is running, <code>VITE_API_BASE_URL</code> points to
              it (e.g. <code>http://127.0.0.1:8000</code>), and CORS allows this origin.
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
  const fieldBusy = (field: EditableField) => savingField === field;

  return (
    <Stack gap="6" maxW="3xl" align="stretch">
      <Heading size="lg">Your Profile</Heading>
      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
        Tap or click any profile field to edit. Tap away to save, or use Done/Cancel.
      </Text>

      <Stack gap="4">
        <HStack gap="4" align="flex-start">
          <Avatar.Root
            size="lg"
            cursor="pointer"
            onClick={() => {
              setSaveError(null);
              setActiveField("avatar_url");
            }}
          >
            <Avatar.Fallback name={profile.display_name || user.email || "User"} />
            <Avatar.Image src={profile.avatar_url || undefined} />
            <Float placement="bottom-end" offsetX="1" offsetY="1">
              <Circle
                bg={user.is_approved ? "lilypad.solid" : "nautical.solid"}
                size="8px"
                outline="0.2em solid"
                outlineColor="bg"
              />
            </Float>
          </Avatar.Root>

          <Stack gap="3" flex="1">
            {activeField === "avatar_url" && (
              <Stack gap="1">
                <Text fontSize={APP_TEXT_SIZES.label}>Avatar URL</Text>
                <Input
                  autoFocus
                  colorPalette="sky"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  onBlur={() => void commitField("avatar_url")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void commitField("avatar_url");
                    }
                    if (e.key === "Escape") {
                      resetFieldDraft("avatar_url");
                      setSaveError(null);
                      setActiveField(null);
                    }
                  }}
                  placeholder="https://…"
                  disabled={fieldBusy("avatar_url")}
                />
              </Stack>
            )}

            <Stack gap="1">
              <Text fontSize={APP_TEXT_SIZES.label}>Display name</Text>
              {activeField === "display_name" ? (
                <Input
                  autoFocus
                  colorPalette="sky"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onBlur={() => void commitField("display_name")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void commitField("display_name");
                    }
                    if (e.key === "Escape") {
                      resetFieldDraft("display_name");
                      setSaveError(null);
                      setActiveField(null);
                    }
                  }}
                  placeholder="Nickname"
                  disabled={fieldBusy("display_name")}
                />
              ) : (
                <Text
                  fontWeight="medium"
                  cursor="pointer"
                  textDecor="underline"
                  textUnderlineOffset="3px"
                  onClick={() => {
                    setSaveError(null);
                    setActiveField("display_name");
                  }}
                >
                  {profile.display_name || "—"}
                </Text>
              )}
            </Stack>

            <Stack gap="1">
              <Text fontSize={APP_TEXT_SIZES.label}>Timezone</Text>
              {activeField === "timezone" ? (
                <NativeSelectRoot size="md">
                  <NativeSelectField
                    autoFocus
                    colorPalette="sky"
                    value={timezone || "UTC"}
                    onChange={(e) => setTimezone(e.target.value)}
                    onBlur={() => void commitField("timezone")}
                  >
                    {editTimezoneOptions.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </NativeSelectField>
                </NativeSelectRoot>
              ) : (
                <Text
                  fontSize={APP_TEXT_SIZES.body}
                  cursor="pointer"
                  textDecor="underline"
                  textUnderlineOffset="3px"
                  onClick={() => {
                    setSaveError(null);
                    setActiveField("timezone");
                  }}
                >
                  {profile.timezone || "—"}
                </Text>
              )}
            </Stack>

            <Stack gap="1">
              <Text fontSize={APP_TEXT_SIZES.label}>Birthday</Text>
              {activeField === "birth_date" ? (
                <Input
                  autoFocus
                  colorPalette="sky"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  onBlur={() => void commitField("birth_date")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void commitField("birth_date");
                    }
                    if (e.key === "Escape") {
                      resetFieldDraft("birth_date");
                      setSaveError(null);
                      setActiveField(null);
                    }
                  }}
                  disabled={fieldBusy("birth_date")}
                />
              ) : (
                <Text
                  fontSize={APP_TEXT_SIZES.body}
                  cursor="pointer"
                  textDecor="underline"
                  textUnderlineOffset="3px"
                  onClick={() => {
                    setSaveError(null);
                    setActiveField("birth_date");
                  }}
                >
                  {formatBirthDateForDisplay(profile.birth_date)}
                </Text>
              )}
            </Stack>

            {isMobile && activeField && (
              <HStack gap="2">
                <PondButton
                  size="sm"
                  colorPalette="sky"
                  onClick={() => void commitField(activeField)}
                  loading={!!savingField}
                  disabled={!!savingField}
                >
                  Done
                </PondButton>
                <PondButton
                  size="sm"
                  colorPalette="nautical"
                  onClick={cancelActiveField}
                  disabled={!!savingField}
                >
                  Cancel
                </PondButton>
              </HStack>
            )}

            {saveError && (
              <Text color="fg" role="alert" fontSize={APP_TEXT_SIZES.helper}>
                {saveError}
              </Text>
            )}
          </Stack>
        </HStack>
      </Stack>

      <Separator />
      <Stack gap="3">
        <Heading size="lg">Your Account</Heading>
        <Stack gap="1">
          <Text>{user.email}</Text>
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
