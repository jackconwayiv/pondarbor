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
  Stack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router";
import { useAppSession } from "./auth/AppSessionContext";
import { fullBleedStackProps } from "./responsive";
import { APP_TEXT_SIZES } from "./theme/typography";
import {
  getSortedIanaTimeZones,
  timeZoneOptionsForValue,
} from "./timezones";
import PondButton from "./PondButton";

function formatBirthDateForDisplay(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${month}/${day}/${year}`;
}

type EditableField = "display_name" | "avatar_url" | "timezone" | "birth_date";
type SavingState = Partial<Record<EditableField, boolean>>;

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
  const [timezone, setTimezone] = useState("UTC");
  const [birthDate, setBirthDate] = useState("");
  const [savingFields, setSavingFields] = useState<SavingState>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "account">("profile");
  const profileEditorRef = useRef<HTMLDivElement | null>(null);

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

  const commitField = useCallback(async (field: EditableField) => {
    if (!sessionUser || savingFields[field]) return;

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
      return;
    }

    setSaveError(null);
    setSavingFields((prev) => ({ ...prev, [field]: true }));
    try {
      await patchMyProfile({ [field]: nextValue });
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Update failed");
      if (field === "display_name") setDisplayName(sessionUser.profile.display_name ?? "");
      if (field === "avatar_url") setAvatarUrl(sessionUser.profile.avatar_url ?? "");
      if (field === "timezone") setTimezone(sessionUser.profile.timezone ?? "UTC");
      if (field === "birth_date") setBirthDate(sessionUser.profile.birth_date ?? "");
    } finally {
      setSavingFields((prev) => ({ ...prev, [field]: false }));
    }
  }, [
    sessionUser,
    savingFields,
    displayName,
    avatarUrl,
    timezone,
    birthDate,
    patchMyProfile,
  ]);

  const commitAllFields = useCallback(async () => {
    await commitField("display_name");
    await commitField("avatar_url");
    await commitField("timezone");
    await commitField("birth_date");
    setIsEditing(false);
  }, [commitField]);

  useEffect(() => {
    if (!isEditing) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (profileEditorRef.current?.contains(target)) return;
      void commitAllFields();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [isEditing, commitAllFields]);

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

  const { user, profile, achievements } = sessionUser;
  const fieldBusy = (field: EditableField) => !!savingFields[field];
  const isSavingAny = Object.values(savingFields).some(Boolean);
  const profileFieldLabelProps = isEditing
    ? { fontSize: APP_TEXT_SIZES.label }
    : {
        fontSize: { base: "12px", md: "14px" },
        color: "#5c5c5c",
      };

  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Tabs.Root
        value={activeTab}
        display="flex"
        flexDirection="column"
        flex="1"
        minH="full"
        onValueChange={(details) =>
          setActiveTab(details.value === "account" ? "account" : "profile")
        }
        variant="plain"
      >
        <Box flex="1" bg="sky.solid" px={{ base: "4", md: "6" }} py={{ base: "5", md: "6" }}>
          <Box maxW="3xl" bg="bg" borderWidth="1px" borderColor="border" borderRadius="xl" p={{ base: "4", md: "6" }}>
            <Tabs.List borderBottomWidth="1px" borderColor="border" gap="1" w="100%">
              <Tabs.Trigger
                value="profile"
                bg={activeTab === "profile" ? "lilypad.solid" : undefined}
                color={activeTab === "profile" ? "black" : undefined}
                borderTopRadius="md"
                borderBottomRadius="0"
                px="4"
                py="2"
                fontWeight="medium"
                _hover={{ bg: activeTab === "profile" ? "lilypad.solid" : "transparent" }}
                _selected={{ bg: "lilypad.solid", color: "black" }}
              >
                Profile
              </Tabs.Trigger>
              <Tabs.Trigger
                value="account"
                bg={activeTab === "account" ? "lilypad.solid" : undefined}
                color={activeTab === "account" ? "black" : undefined}
                borderTopRadius="md"
                borderBottomRadius="0"
                px="4"
                py="2"
                fontWeight="medium"
                _hover={{ bg: activeTab === "account" ? "lilypad.solid" : "transparent" }}
                _selected={{ bg: "lilypad.solid", color: "black" }}
              >
                Account
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="profile">
              <Stack gap="4" pt="4">
                <HStack gap="4" align="flex-start" justify="space-between">
                  <HStack gap="4" align="flex-start" flex="1">
                    <Avatar.Root size="lg">
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

                    <Stack gap="3" flex="1" ref={profileEditorRef}>
                      {isEditing && (
                        <Stack gap="1">
                          <Text {...profileFieldLabelProps}>Avatar URL</Text>
                          <Input
                            colorPalette="sky"
                            value={avatarUrl}
                            onChange={(e) => setAvatarUrl(e.target.value)}
                            onBlur={() => void commitField("avatar_url")}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void commitField("avatar_url");
                              }
                            }}
                            placeholder="https://…"
                            disabled={fieldBusy("avatar_url")}
                          />
                        </Stack>
                      )}

                      <Stack gap="1">
                        <Text {...profileFieldLabelProps}>Name</Text>
                        {isEditing ? (
                          <Input
                            colorPalette="sky"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            onBlur={() => void commitField("display_name")}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void commitField("display_name");
                              }
                            }}
                            placeholder="Your name"
                            disabled={fieldBusy("display_name")}
                          />
                        ) : (
                          <Text fontSize={APP_TEXT_SIZES.body}>{profile.display_name || "—"}</Text>
                        )}
                      </Stack>

                      <Stack gap="1">
                        <Text {...profileFieldLabelProps}>Timezone</Text>
                        {isEditing ? (
                          <NativeSelectRoot size="md" disabled={fieldBusy("timezone")}>
                            <NativeSelectField
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
                          <Text fontSize={APP_TEXT_SIZES.body}>{profile.timezone || "—"}</Text>
                        )}
                      </Stack>

                      <Stack gap="1">
                        <Text {...profileFieldLabelProps}>Birthday</Text>
                        {isEditing ? (
                          <Input
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
                            }}
                            disabled={fieldBusy("birth_date")}
                          />
                        ) : (
                          <Text fontSize={APP_TEXT_SIZES.body}>
                            {formatBirthDateForDisplay(profile.birth_date)}
                          </Text>
                        )}
                      </Stack>

                      {isEditing ? (
                        <HStack gap="2" pt="2">
                          <PondButton
                            size="sm"
                            colorPalette="lilypad"
                            onClick={() => void commitAllFields()}
                            loading={isSavingAny}
                            disabled={isSavingAny}
                          >
                            Save
                          </PondButton>
                        </HStack>
                      ) : null}

                      {!isEditing && achievements && achievements.length > 0 ? (
                        <Stack gap="2" pt="2">
                          <Text {...profileFieldLabelProps}>Achievements</Text>
                          <Stack gap="2">
                            {achievements.map((a) => (
                              <Stack key={a.slug} gap="0">
                                <Text fontSize={APP_TEXT_SIZES.body}>{a.title}</Text>
                                {a.description ? (
                                  <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                                    {a.description}
                                  </Text>
                                ) : null}
                              </Stack>
                            ))}
                          </Stack>
                        </Stack>
                      ) : null}

                      {saveError && (
                        <Text color="fg" role="alert" fontSize={APP_TEXT_SIZES.helper}>
                          {saveError}
                        </Text>
                      )}
                    </Stack>
                  </HStack>
                  {!isEditing ? (
                    <PondButton
                      size="sm"
                      colorPalette="lilypad"
                      onClick={() => {
                        setSaveError(null);
                        setIsEditing(true);
                      }}
                    >
                      Edit profile
                    </PondButton>
                  ) : null}
                </HStack>
              </Stack>
            </Tabs.Content>

            <Tabs.Content value="account">
              <Stack gap="4" pt="4">
                <HStack align="center" justify="space-between" gap="4" flexWrap="wrap">
                  <Heading size="lg">Account Details</Heading>
                  <HStack gap="3" align="center" flexShrink={0}>
                    <PondButton size="sm" colorPalette="lilypad" onClick={switchUser}>
                      Switch user
                    </PondButton>
                    <PondButton size="sm" colorPalette="nautical" onClick={logout}>
                      Log out
                    </PondButton>
                  </HStack>
                </HStack>
                <Stack gap="1">
                  <Text>{user.email}</Text>
                  {!user.is_approved ? (
                    <Text color="#E9A14A">
                      {user.account_status === "pending"
                        ? "Awaiting Approval"
                        : user.account_status === "rejected"
                          ? "Rejected"
                          : user.account_status === "suspended"
                            ? "Suspended"
                            : "Pending"}
                    </Text>
                  ) : null}
                </Stack>
              </Stack>
            </Tabs.Content>
          </Box>
        </Box>
      </Tabs.Root>
    </Stack>
  );
}
