import {
  Avatar,
  Box,
  Circle,
  Float,
  Heading,
  HStack,
  Image,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Stack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router";
import PondButton from "./PondButton";
import { AchievementSummaryCard } from "./achievements/AchievementSummaryCard";
import { fetchPublicAchievementsByUserId } from "./achievements/api";
import { sortAchievementsNewestFirst } from "./achievements/sortAchievements";
import type { AchievementSummary } from "./achievements/types";
import { useAppSession } from "./auth/AppSessionContext";
import { fetchMyImageInventory } from "./closet/api";
import { uploadClosetImageViaPresign } from "./closet/imageUpload";
import type { ClosetImageInventoryRow } from "./closet/types";
import { fullBleedStackProps } from "./responsive";
import {
  APP_TEXT_SIZES,
  MAPPED_LIST_STACK_GAP,
  PANEL_FIELD_PROPS,
} from "./theme/typography";
import { getSortedIanaTimeZones, timeZoneOptionsForValue } from "./timezones";

function formatBirthDateForDisplay(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${month}/${day}/${year}`;
}

function formatMemberSince(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

type EditableField = "display_name" | "avatar_url" | "timezone" | "birth_date";
type SavingState = Partial<Record<EditableField, boolean>>;

const ENTRY_CARD_PROPS = {
  bg: "white",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "xl",
  p: { base: "2", md: "2" },
  maxW: "100%",
  overflowX: "hidden" as const,
} as const;

function avatarUrlFromClosetImageKey(imageKey: string): string {
  const trimmedKey = imageKey.trim();
  if (!trimmedKey) return "";
  const base = (
    import.meta.env.VITE_CLOSET_R2_PUBLIC_BASE_URL ??
    import.meta.env.VITE_CLOSET_IMAGE_PUBLIC_BASE_URL ??
    import.meta.env.VITE_API_CLOSET_IMAGE_PUBLIC_BASE_URL ??
    ""
  ).trim();
  if (!base) return "";
  return `${base.replace(/\/+$/, "")}/${trimmedKey}`;
}

export default function ProfilePage() {
  const {
    sessionUser,
    isAuthenticated,
    isLoading,
    error: sessionError,
    patchMyProfile,
    patchAchievementVisibility,
    getApiAccessToken,
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
  const [profileAchievements, setProfileAchievements] = useState<
    AchievementSummary[]
  >([]);
  const [activeTab, setActiveTab] = useState<"profile" | "account">("profile");
  const profileEditorRef = useRef<HTMLDivElement | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isImagePickerLoading, setIsImagePickerLoading] = useState(false);
  const [uploadedImageRows, setUploadedImageRows] = useState<
    ClosetImageInventoryRow[]
  >([]);
  const [selectedUploadedImageKey, setSelectedUploadedImageKey] = useState("");
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

  useEffect(() => {
    const run = async () => {
      if (!sessionUser?.user?.id || !isAuthenticated) return;
      try {
        const token = await getApiAccessToken();
        const rows = await fetchPublicAchievementsByUserId(
          sessionUser.user.id,
          token,
        );
        setProfileAchievements(sortAchievementsNewestFirst(rows));
      } catch {
        // Keep existing session payload if explicit fetch fails.
      }
    };
    void run();
  }, [getApiAccessToken, isAuthenticated, sessionUser?.user?.id]);

  const onAchievementVisibilityChange = useCallback(
    async (slug: string, visibleToFriends: boolean) => {
      if (!sessionUser) return;
      setSaveError(null);
      let snapshot: AchievementSummary[] = [];
      setProfileAchievements((prev) => {
        snapshot = prev;
        return prev.map((x) =>
          x.slug === slug
            ? { ...x, visible_to_friends: visibleToFriends ? null : false }
            : x,
        );
      });
      try {
        await patchAchievementVisibility(slug, visibleToFriends);
        const token = await getApiAccessToken();
        const rows = await fetchPublicAchievementsByUserId(
          sessionUser.user.id,
          token,
        );
        setProfileAchievements(sortAchievementsNewestFirst(rows));
      } catch (err: unknown) {
        setProfileAchievements(snapshot);
        setSaveError(
          err instanceof Error
            ? err.message
            : "Could not update achievement visibility.",
        );
      }
    },
    [sessionUser, patchAchievementVisibility, getApiAccessToken],
  );

  const commitField = useCallback(
    async (field: EditableField) => {
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
        if (field === "display_name")
          setDisplayName(sessionUser.profile.display_name ?? "");
        if (field === "avatar_url")
          setAvatarUrl(sessionUser.profile.avatar_url ?? "");
        if (field === "timezone")
          setTimezone(sessionUser.profile.timezone ?? "UTC");
        if (field === "birth_date")
          setBirthDate(sessionUser.profile.birth_date ?? "");
      } finally {
        setSavingFields((prev) => ({ ...prev, [field]: false }));
      }
    },
    [
      sessionUser,
      savingFields,
      displayName,
      avatarUrl,
      timezone,
      birthDate,
      patchMyProfile,
    ],
  );

  const commitAllFields = useCallback(async () => {
    await commitField("display_name");
    await commitField("avatar_url");
    await commitField("timezone");
    await commitField("birth_date");
    setIsEditing(false);
  }, [commitField]);

  const onChooseAvatarFile = useCallback(
    async (file: File | null) => {
      if (!file || !sessionUser) return;
      setSaveError(null);
      setIsAvatarUploading(true);
      try {
        const key = await uploadClosetImageViaPresign(getApiAccessToken, file);
        const uploadedUrl = avatarUrlFromClosetImageKey(key);
        if (uploadedUrl) {
          setAvatarUrl(uploadedUrl);
        }
        await patchMyProfile({ avatar_image_key: key });
      } catch (err: unknown) {
        setSaveError(
          err instanceof Error ? err.message : "Avatar upload failed",
        );
        setAvatarUrl(sessionUser.profile.avatar_url ?? "");
      } finally {
        setIsAvatarUploading(false);
      }
    },
    [getApiAccessToken, patchMyProfile, sessionUser],
  );

  const loadUploadedImages = useCallback(async () => {
    setIsImagePickerLoading(true);
    setSaveError(null);
    try {
      const token = await getApiAccessToken();
      const payload = await fetchMyImageInventory(token);
      const usableRows = payload.results.filter(
        (row) => (row.image_url ?? "").trim().length > 0,
      );
      setUploadedImageRows(usableRows);
      setSelectedUploadedImageKey((prev) => {
        if (prev && usableRows.some((row) => row.image_key === prev))
          return prev;
        return usableRows[0]?.image_key ?? "";
      });
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to load uploaded images",
      );
    } finally {
      setIsImagePickerLoading(false);
    }
  }, [getApiAccessToken]);

  const onApplyUploadedImage = useCallback(async () => {
    if (!selectedUploadedImageKey || !sessionUser) return;
    setSaveError(null);
    setIsAvatarUploading(true);
    try {
      const selectedRow = uploadedImageRows.find(
        (row) => row.image_key === selectedUploadedImageKey,
      );
      if (selectedRow?.image_url) {
        setAvatarUrl(selectedRow.image_url);
      }
      await patchMyProfile({ avatar_image_key: selectedUploadedImageKey });
      setIsImagePickerOpen(false);
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to select uploaded image",
      );
      setAvatarUrl(sessionUser.profile.avatar_url ?? "");
    } finally {
      setIsAvatarUploading(false);
    }
  }, [
    patchMyProfile,
    selectedUploadedImageKey,
    sessionUser,
    uploadedImageRows,
  ]);

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
      <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
        <Box
          flex="1"
          bg="sky.solid"
          px={{ base: "2", md: "2" }}
          py={{ base: "2", md: "2" }}
        >
          <Box
            maxW="4xl"
            w="100%"
            mx="auto"
            bg="gray.100"
            borderWidth="1px"
            borderColor="border"
            borderRadius="xl"
            overflow="hidden"
          >
            <Stack gap={{ base: "4", md: "4" }} p={{ base: "2", md: "2" }}>
              <Box {...ENTRY_CARD_PROPS}>
                <Text fontSize={APP_TEXT_SIZES.body} color="fg">
                  Loading…
                </Text>
              </Box>
            </Stack>
          </Box>
        </Box>
      </Stack>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!sessionUser) {
    return (
      <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
        <Box
          flex="1"
          bg="sky.solid"
          px={{ base: "2", md: "2" }}
          py={{ base: "2", md: "2" }}
        >
          <Box
            maxW="4xl"
            w="100%"
            mx="auto"
            bg="gray.100"
            borderWidth="1px"
            borderColor="border"
            borderRadius="xl"
            overflow="hidden"
          >
            <Stack gap={{ base: "4", md: "4" }} p={{ base: "2", md: "2" }}>
              <Box {...ENTRY_CARD_PROPS}>
                <Heading
                  as="h1"
                  size={{ base: "lg", md: "xl" }}
                  fontWeight="bold"
                  mb="2"
                >
                  Profile
                </Heading>
                {sessionError ? (
                  <Stack gap="3" align="flex-start">
                    <Text
                      fontSize={APP_TEXT_SIZES.body}
                      lineHeight="tall"
                      color="fg"
                      fontWeight="semibold"
                    >
                      Could not load your profile from the API.
                    </Text>
                    <Text fontSize={APP_TEXT_SIZES.helper} color="fg">
                      {sessionError}
                    </Text>
                    <Text
                      fontSize={APP_TEXT_SIZES.helper}
                      color="gray.600"
                      lineHeight="tall"
                    >
                      Check that the backend is running,{" "}
                      <code>VITE_API_BASE_URL</code> points to it (e.g.{" "}
                      <code>http://127.0.0.1:8000</code>), and CORS allows this
                      origin.
                    </Text>
                  </Stack>
                ) : (
                  <Text
                    fontSize={APP_TEXT_SIZES.body}
                    lineHeight="tall"
                    color="fg"
                  >
                    No profile loaded yet.
                  </Text>
                )}
              </Box>
              <Box {...ENTRY_CARD_PROPS}>
                <HStack gap="3" align="center" flexWrap="wrap">
                  <PondButton
                    size="sm"
                    colorPalette="lilypad"
                    onClick={switchUser}
                  >
                    Switch user
                  </PondButton>
                  <PondButton
                    size="sm"
                    colorPalette="nautical"
                    onClick={logout}
                  >
                    Log out
                  </PondButton>
                  <PondButton
                    colorPalette="sky"
                    size="sm"
                    onClick={() => void refreshSession()}
                  >
                    Retry
                  </PondButton>
                </HStack>
              </Box>
            </Stack>
          </Box>
        </Box>
      </Stack>
    );
  }

  const { user, profile } = sessionUser;
  const headerDisplayName = (
    isEditing ? displayName : profile.display_name || ""
  ).trim();
  const fieldBusy = (field: EditableField) => !!savingFields[field];
  const isSavingAny = Object.values(savingFields).some(Boolean);
  const profileFieldLabelProps = isEditing
    ? {
        fontSize: APP_TEXT_SIZES.label,
        fontWeight: "medium" as const,
        color: "fg" as const,
      }
    : { fontSize: APP_TEXT_SIZES.label, color: "gray.600" as const };

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
        <Box
          flex="1"
          bg="sky.solid"
          px={{ base: "2", md: "2" }}
          py={{ base: "2", md: "2" }}
        >
          <Box
            maxW="4xl"
            w="100%"
            mx="auto"
            bg="gray.100"
            borderWidth="1px"
            borderColor="border"
            borderRadius="xl"
            overflow="hidden"
          >
            <Stack
              gap={{ base: "4", md: "4" }}
              px={{ base: "2", md: "2" }}
              pt={{ base: "2", md: "2" }}
              pb="2"
            >
              <Box {...ENTRY_CARD_PROPS}>
                <Heading
                  as="h1"
                  size={{ base: "lg", md: "xl" }}
                  fontWeight="bold"
                  mb="2"
                >
                  Profile
                </Heading>
                <Text
                  fontSize={APP_TEXT_SIZES.body}
                  lineHeight="tall"
                  color="fg"
                >
                  Update how you appear to friends in this app and set your
                  timezone and birthday.
                </Text>
              </Box>
            </Stack>
            <Tabs.List
              px={{ base: "2", md: "2" }}
              pt="0"
              pb="0"
              borderBottomWidth="1px"
              borderColor="border"
              gap="1"
              w="100%"
            >
              <Tabs.Trigger
                value="profile"
                bg={activeTab === "profile" ? "lilypad.solid" : undefined}
                color={activeTab === "profile" ? "black" : undefined}
                borderTopRadius="md"
                borderBottomRadius="0"
                px="2"
                py="2"
                fontWeight="medium"
                _hover={{
                  bg: activeTab === "profile" ? "lilypad.solid" : "transparent",
                }}
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
                px="2"
                py="2"
                fontWeight="medium"
                _hover={{
                  bg: activeTab === "account" ? "lilypad.solid" : "transparent",
                }}
                _selected={{ bg: "lilypad.solid", color: "black" }}
              >
                Account
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="profile" p={{ base: "2", md: "2" }}>
              <Box {...ENTRY_CARD_PROPS}>
                <Stack gap="4" w="100%" minW={0} ref={profileEditorRef}>
                  <HStack gap="4" align="flex-start" flexWrap="wrap" w="100%">
                    <Avatar.Root size="lg">
                      <Avatar.Fallback
                        name={profile.display_name || user.email || "User"}
                      />
                      <Avatar.Image src={profile.avatar_url || undefined} />
                      <Float placement="bottom-end" offsetX="1" offsetY="1">
                        <Circle
                          bg={
                            user.is_approved
                              ? "lilypad.solid"
                              : "nautical.solid"
                          }
                          size="8px"
                          outline="0.2em solid"
                          outlineColor="bg"
                        />
                      </Float>
                    </Avatar.Root>
                    <Stack gap="1" flex="1" minW={0}>
                      <Text
                        fontWeight="semibold"
                        fontSize={APP_TEXT_SIZES.body}
                      >
                        {headerDisplayName || "—"}
                      </Text>
                      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                        {user.email}
                      </Text>
                    </Stack>
                  </HStack>

                  {!isEditing ? (
                    <PondButton
                      size="sm"
                      colorPalette="lilypad"
                      alignSelf="flex-start"
                      onClick={() => {
                        setSaveError(null);
                        setIsEditing(true);
                      }}
                    >
                      Edit profile
                    </PondButton>
                  ) : null}

                  <Stack gap="3">
                    {isEditing ? (
                      <Stack gap="1">
                        <Text {...profileFieldLabelProps}>Name</Text>
                        <Input
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
                          {...PANEL_FIELD_PROPS}
                        />
                      </Stack>
                    ) : null}

                    {isEditing ? (
                      <Stack gap="1">
                        <Text {...profileFieldLabelProps}>Avatar URL</Text>
                        <Stack gap="2">
                          <Input
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
                            disabled={
                              fieldBusy("avatar_url") || isAvatarUploading
                            }
                            {...PANEL_FIELD_PROPS}
                          />
                          <input
                            ref={avatarFileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const file = e.target.files?.[0] ?? null;
                              void onChooseAvatarFile(file);
                              e.currentTarget.value = "";
                            }}
                          />
                          <HStack flexWrap="wrap" gap="2">
                            <PondButton
                              size="sm"
                              colorPalette="sky"
                              loading={isAvatarUploading}
                              disabled={
                                fieldBusy("avatar_url") || isAvatarUploading
                              }
                              onClick={() =>
                                avatarFileInputRef.current?.click()
                              }
                            >
                              Upload new avatar image
                            </PondButton>
                            <PondButton
                              size="sm"
                              colorPalette="lilypad"
                              loading={isImagePickerLoading}
                              disabled={
                                fieldBusy("avatar_url") || isAvatarUploading
                              }
                              onClick={() => {
                                setIsImagePickerOpen((prev) => !prev);
                                if (!isImagePickerOpen) {
                                  void loadUploadedImages();
                                }
                              }}
                            >
                              Select uploaded image
                            </PondButton>
                          </HStack>
                          {isImagePickerOpen ? (
                            <Stack
                              gap="2"
                              borderWidth="1px"
                              borderColor="border"
                              borderRadius="md"
                              p="2"
                            >
                              <Text
                                fontSize={APP_TEXT_SIZES.helper}
                                color="fg.muted"
                              >
                                Choose from your uploaded images.
                              </Text>
                              {uploadedImageRows.length === 0 ? (
                                <Text
                                  fontSize={APP_TEXT_SIZES.helper}
                                  color="gray.600"
                                >
                                  No uploaded images available
                                </Text>
                              ) : (
                                <HStack
                                  flexWrap="wrap"
                                  gap="2"
                                  align="stretch"
                                >
                                  {uploadedImageRows.map((row) => {
                                    const isSelected =
                                      selectedUploadedImageKey === row.image_key;
                                    return (
                                      <Box
                                        key={row.image_key}
                                        as="button"
                                        borderWidth="2px"
                                        borderColor={
                                          isSelected
                                            ? "black"
                                            : "lilypad.solid"
                                        }
                                        borderRadius="md"
                                        overflow="hidden"
                                        onClick={() =>
                                          setSelectedUploadedImageKey(
                                            row.image_key,
                                          )
                                        }
                                      >
                                        <Image
                                          src={row.image_url}
                                          alt=""
                                          aria-hidden
                                          w="84px"
                                          h="84px"
                                          objectFit="cover"
                                          draggable={false}
                                        />
                                      </Box>
                                    );
                                  })}
                                </HStack>
                              )}
                              <HStack>
                                <PondButton
                                  size="sm"
                                  colorPalette="lilypad"
                                  loading={isAvatarUploading}
                                  disabled={
                                    isAvatarUploading ||
                                    !selectedUploadedImageKey
                                  }
                                  onClick={() => void onApplyUploadedImage()}
                                >
                                  Use selected image
                                </PondButton>
                              </HStack>
                            </Stack>
                          ) : null}
                        </Stack>
                      </Stack>
                    ) : null}

                    <HStack
                      align="flex-start"
                      gap={{ base: "3", md: "8" }}
                      w="100%"
                    >
                      <Stack gap="1" flex="1" minW={0}>
                        <Text {...profileFieldLabelProps}>Birthday</Text>
                        {isEditing ? (
                          <Input
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
                            {...PANEL_FIELD_PROPS}
                          />
                        ) : (
                          <Text fontSize={APP_TEXT_SIZES.body}>
                            {formatBirthDateForDisplay(profile.birth_date)}
                          </Text>
                        )}
                      </Stack>
                      <Stack gap="1" flex="1" minW={0}>
                        <Text {...profileFieldLabelProps}>Timezone</Text>
                        {isEditing ? (
                          <NativeSelectRoot
                            size="md"
                            disabled={fieldBusy("timezone")}
                          >
                            <NativeSelectField
                              value={timezone || "UTC"}
                              onChange={(e) => setTimezone(e.target.value)}
                              onBlur={() => void commitField("timezone")}
                              {...PANEL_FIELD_PROPS}
                            >
                              {editTimezoneOptions.map((tz) => (
                                <option key={tz} value={tz}>
                                  {tz}
                                </option>
                              ))}
                            </NativeSelectField>
                          </NativeSelectRoot>
                        ) : (
                          <Text fontSize={APP_TEXT_SIZES.body}>
                            {profile.timezone || "—"}
                          </Text>
                        )}
                      </Stack>
                    </HStack>

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

                    {!isEditing && profileAchievements.length > 0 ? (
                      <Stack gap="2" pt="2">
                        <Text {...profileFieldLabelProps}>Achievements</Text>
                        <Stack gap={MAPPED_LIST_STACK_GAP}>
                          {profileAchievements.map((a) => (
                            <AchievementSummaryCard
                              key={a.slug}
                              achievement={a}
                              visibilityToggle={{
                                checked: a.visible_to_friends !== false,
                                onCheckedChange: (v) =>
                                  void onAchievementVisibilityChange(
                                    a.slug,
                                    v,
                                  ),
                              }}
                            />
                          ))}
                        </Stack>
                      </Stack>
                    ) : null}

                    {saveError ? (
                      <Text
                        color="nautical.solid"
                        role="alert"
                        fontSize={APP_TEXT_SIZES.helper}
                        fontWeight="medium"
                      >
                        {saveError}
                      </Text>
                    ) : null}
                  </Stack>
                </Stack>
              </Box>
            </Tabs.Content>

            <Tabs.Content value="account" p={{ base: "2", md: "2" }}>
              <Box {...ENTRY_CARD_PROPS}>
                <Stack gap="4">
                  <HStack
                    align="center"
                    justify="space-between"
                    gap="4"
                    flexWrap="wrap"
                  >
                    <Heading as="h2" size="md" fontWeight="semibold">
                      Account details
                    </Heading>
                    <HStack gap="3" align="center" flexShrink={0}>
                      <PondButton
                        size="sm"
                        colorPalette="lilypad"
                        onClick={switchUser}
                      >
                        Switch user
                      </PondButton>
                      <PondButton
                        size="sm"
                        colorPalette="nautical"
                        onClick={logout}
                      >
                        Log out
                      </PondButton>
                    </HStack>
                  </HStack>
                  <Stack gap="1">
                    <Text fontSize={APP_TEXT_SIZES.body} color="fg">
                      {user.email}
                    </Text>
                    <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
                      Member since: {formatMemberSince(user.date_joined)}
                    </Text>
                    {!user.is_approved ? (
                      <Text
                        fontSize={APP_TEXT_SIZES.body}
                        color="orange.solid"
                        fontWeight="medium"
                      >
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
              </Box>
            </Tabs.Content>
          </Box>
        </Box>
      </Tabs.Root>
    </Stack>
  );
}
