import {
  Avatar,
  Box,
  HStack,
  Input,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";

import {
  getOnboardingStarableApps,
  isPathStarred,
  toggleHomeStarredPath,
  type AppNavAccess,
} from "../appNavConfig";
import {
  resolveCurrentUserAvatarUrl,
  useAppSession,
  type Profile,
  type ProfilePatch,
} from "../auth/AppSessionContext";
import { MONTH_NAMES } from "../calendar/monthMath";
import { uploadClosetImageBlobForField } from "../closet/imageUpload";
import PondButton from "../PondButton";
import PondNativeSelect from "../components/PondNativeSelect";
import { SessionLoadingCard } from "../components/panelStatus";
import SiteFooter from "../components/SiteFooter";
import { GOALS_THEME } from "../goals/theme";
import { useR2ImageUpload } from "../lib/useR2ImageUpload";
import { fullBleedStackProps } from "../responsive";
import {
  formatCurrentTimeInTimeZone,
  getSortedIanaTimeZones,
  timeZoneOptionsForValue,
} from "../timezones";
import { APP_SHELL_TRAY_PROPS, APP_TEXT_SIZES } from "../theme/typography";
import {
  birthDateMeetsMinAge,
  composeIsoBirthDate,
  maxDaysInBirthMonth,
  parseIsoBirthDate,
  POND_ARBOR_MIN_AGE_ERROR,
} from "./birthDateFields";
import { OnboardingNavCard } from "./OnboardingNavCard";
import { OnboardingStepShell } from "./OnboardingStepShell";
import {
  isOnboardingStep,
  nextOnboardingStep,
  normalizeOnboardingStep,
  priorOnboardingStep,
  resolveOnboardingStep,
  type OnboardingStepNumber,
} from "./onboardingSteps";
import { isUsTimeZone, US_TIME_ZONE_OPTIONS } from "./usTimeZoneGroups";

function profileForStars(
  profile: Profile,
  homeStarredAppPaths: string[] | null,
): Profile {
  return { ...profile, home_starred_app_paths: homeStarredAppPaths };
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { step: stepParam } = useParams();
  const parsedStep = Number.parseInt(stepParam ?? "1", 10);
  const {
    isLoading,
    isAuthenticated,
    sessionUser,
    auth0User,
    patchMyProfile,
    homeStarredAppPaths,
    patchHomeStarredAppPaths,
    getApiAccessToken,
    refreshSession,
  } = useAppSession();

  const profile = sessionUser?.profile;
  const access: AppNavAccess = useMemo(
    () => ({
      isAuthenticated: true,
      isApproved: !!sessionUser?.user.is_approved,
      isStaff: !!sessionUser?.user.is_staff,
    }),
    [sessionUser?.user.is_approved, sessionUser?.user.is_staff],
  );

  const resolvedStep = profile ? resolveOnboardingStep(profile) : 1;
  const routeStep = isOnboardingStep(parsedStep)
    ? normalizeOnboardingStep(parsedStep, profile)
    : resolvedStep;

  const [displayName, setDisplayName] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [timezone, setTimezone] = useState("America/Phoenix");
  const [socialReadScope, setSocialReadScope] = useState<
    "approved_users" | "friends_only"
  >("approved_users");
  const [socialPublishVisibility, setSocialPublishVisibility] = useState<
    "all_approved" | "friends_only"
  >("all_approved");
  const [zoneClock, setZoneClock] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (routeStep !== 3) return;
    setZoneClock(new Date());
    const id = window.setInterval(() => setZoneClock(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [routeStep]);

  const birthDate = useMemo(
    () =>
      composeIsoBirthDate({
        month: birthMonth,
        day: birthDay,
        year: birthYear,
      }) ?? "",
    [birthMonth, birthDay, birthYear],
  );

  const birthDateTooYoung = Boolean(birthDate) && !birthDateMeetsMinAge(birthDate);

  const maxBirthDay = useMemo(
    () => maxDaysInBirthMonth(birthMonth, birthYear),
    [birthMonth, birthYear],
  );

  const currentBirthYear = new Date().getFullYear();

  useEffect(() => {
    if (!birthDay) return;
    if (Number(birthDay) > maxBirthDay) {
      setBirthDay(String(maxBirthDay));
    }
  }, [birthDay, maxBirthDay]);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    const parts = parseIsoBirthDate(profile.birth_date);
    setBirthMonth(parts.month);
    setBirthDay(parts.day);
    setBirthYear(parts.year);
    setTimezone(profile.timezone || "America/Phoenix");
    setSocialReadScope(profile.social_read_scope ?? "approved_users");
    setSocialPublishVisibility(profile.social_publish_visibility ?? "all_approved");
  }, [profile]);

  const savePatch = useCallback(
    async (patch: ProfilePatch, options?: { replaceSession?: boolean }) => {
      setError(null);
      try {
        await patchMyProfile(patch, options);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Save failed");
        throw err;
      }
    },
    [patchMyProfile],
  );

  const trySaveBirthDate = useCallback(() => {
    const iso = composeIsoBirthDate({
      month: birthMonth,
      day: birthDay,
      year: birthYear,
    });
    if (!iso || !birthDateMeetsMinAge(iso) || iso === (profile?.birth_date ?? "")) {
      return;
    }
    void savePatch({ birth_date: iso }, { replaceSession: false });
  }, [birthMonth, birthDay, birthYear, profile?.birth_date, savePatch]);

  const avatarUpload = useR2ImageUpload({
    getApiAccessToken,
    onKeyChange: () => {},
    uploadFromBlob: uploadClosetImageBlobForField,
    successMessage: "",
    onUploadSuccess: async (key) => {
      await savePatch({ avatar_image_key: key }, { replaceSession: false });
      await refreshSession();
    },
  });

  const avatarUrl = resolveCurrentUserAvatarUrl(sessionUser, auth0User);
  const hasUploadedAvatar = Boolean((profile?.avatar_image_key ?? "").trim());
  const avatarDisplayUrl =
    avatarUpload.localPreviewUrl ||
    (avatarUpload.uploadedViewUrl ?? "").trim() ||
    (hasUploadedAvatar ? avatarUrl : "");

  const extraTimeZones = useMemo(() => {
    const zones = timeZoneOptionsForValue(timezone, getSortedIanaTimeZones());
    return zones.filter((z) => !isUsTimeZone(z));
  }, [timezone]);

  const goToStep = useCallback(
    (step: OnboardingStepNumber) => {
      navigate(`/onboarding/${step}`);
    },
    [navigate],
  );

  const advanceStep = useCallback(
    async (patch: ProfilePatch = {}) => {
      if (!profile) return;
      const current = routeStep;
      const next = nextOnboardingStep(current, profile);
      setBusy(true);
      try {
        await savePatch({ ...patch, onboarding_step: next });
        if (next > current) {
          goToStep(next);
        }
      } finally {
        setBusy(false);
      }
    },
    [profile, routeStep, savePatch, goToStep],
  );

  if (isLoading) {
    return <SessionLoadingCard />;
  }

  if (!isAuthenticated || !sessionUser || !profile) {
    return <Navigate to="/" replace />;
  }

  if (profile.onboarding_completed) {
    return <Navigate to="/" replace />;
  }

  if (!isOnboardingStep(parsedStep) || routeStep !== parsedStep) {
    return <Navigate to={`/onboarding/${routeStep}`} replace />;
  }

  const step = routeStep;
  const starredProfile = profileForStars(profile, homeStarredAppPaths);
  const prior = priorOnboardingStep(step, profile);

  async function finishOnboarding() {
    setBusy(true);
    setError(null);
    try {
      await patchMyProfile({
        onboarding_completed: true,
        onboarding_step: 7,
      });
      navigate("/", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not finish onboarding");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack flex="1" minH="full" gap="0" align="stretch" w="100%" {...fullBleedStackProps}>
      <Box flex="1" bg="bg" w="100%" px={0} py={{ base: "2", md: "2" }}>
        <Box {...APP_SHELL_TRAY_PROPS}>
          <Stack
            gap="4"
            px={{ base: "3", md: "4" }}
            py={{ base: "3", md: "4" }}
            maxW="lg"
            mx="auto"
            w="100%"
          >
            {error ? (
              <Text color="red.fg" fontSize={APP_TEXT_SIZES.body}>
                {error}
              </Text>
            ) : null}

            {step === 1 ? (
              <OnboardingStepShell step={1} title={`Welcome, ${sessionUser.user.email}!`}>
                <Stack gap="4">
                  <Text fontSize={APP_TEXT_SIZES.body}>What should we call you?</Text>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onBlur={() => {
                      const trimmed = displayName.trim();
                      if (trimmed && trimmed !== (profile.display_name ?? "").trim()) {
                        void savePatch(
                          { display_name: trimmed },
                          { replaceSession: false },
                        );
                      }
                    }}
                  />
                  <PondButton
                    type="button"
                    colorPalette="lilypad"
                    w="100%"
                    disabled={busy || !displayName.trim()}
                    onClick={() => {
                      void advanceStep({ display_name: displayName.trim() });
                    }}
                  >
                    Continue
                  </PondButton>
                </Stack>
              </OnboardingStepShell>
            ) : null}

            {step === 2 ? (
              <OnboardingStepShell
                step={2}
                title="Tell us your birthday so we can celebrate with you!"
              >
                <Stack gap="4">
                  <HStack gap="3" align="flex-start" w="100%">
                    <Stack gap="1" flex="1.4" minW={0}>
                      <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium">
                        Month
                      </Text>
                      <PondNativeSelect
                        rootProps={{ size: "md", disabled: busy }}
                        fieldProps={{
                          value: birthMonth,
                          onChange: (e) => {
                            setBirthMonth(e.target.value);
                          },
                          onBlur: trySaveBirthDate,
                        }}
                      >
                        <option value="">—</option>
                        {MONTH_NAMES.map((name, index) => (
                          <option key={name} value={String(index + 1)}>
                            {name}
                          </option>
                        ))}
                      </PondNativeSelect>
                    </Stack>
                    <Stack gap="1" flex="0.8" minW={0}>
                      <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium">
                        Day
                      </Text>
                      <PondNativeSelect
                        rootProps={{ size: "md", disabled: busy }}
                        fieldProps={{
                          value: birthDay,
                          onChange: (e) => {
                            setBirthDay(e.target.value);
                          },
                          onBlur: trySaveBirthDate,
                        }}
                      >
                        <option value="">—</option>
                        {Array.from({ length: maxBirthDay }, (_, index) => {
                          const day = String(index + 1);
                          return (
                            <option key={day} value={day}>
                              {day}
                            </option>
                          );
                        })}
                      </PondNativeSelect>
                    </Stack>
                    <Stack gap="1" flex="1" minW={0}>
                      <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium">
                        Year
                      </Text>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1900}
                        max={currentBirthYear}
                        placeholder="Year"
                        value={birthYear}
                        disabled={busy}
                        onChange={(e) => {
                          setBirthYear(e.target.value);
                        }}
                        onBlur={trySaveBirthDate}
                      />
                    </Stack>
                  </HStack>
                  {birthDateTooYoung ? (
                    <Text color="red.fg" fontSize={APP_TEXT_SIZES.body}>
                      {POND_ARBOR_MIN_AGE_ERROR}
                    </Text>
                  ) : null}
                  <HStack gap="3" w="100%" align="stretch">
                    {prior != null ? (
                      <PondButton
                        type="button"
                        variant="ghost"
                        flex="1"
                        disabled={busy}
                        onClick={() => {
                          goToStep(prior);
                        }}
                      >
                        Back
                      </PondButton>
                    ) : null}
                    <PondButton
                      type="button"
                      variant="outline"
                      colorPalette="gray"
                      flex="1"
                      disabled={busy}
                      onClick={() => {
                        void advanceStep();
                      }}
                    >
                      Skip
                    </PondButton>
                    <PondButton
                      type="button"
                      colorPalette="lilypad"
                      flex="1"
                      disabled={busy || !birthDate || birthDateTooYoung}
                      onClick={() => {
                        void advanceStep(
                          birthDate ? { birth_date: birthDate } : {},
                        );
                      }}
                    >
                      Continue
                    </PondButton>
                  </HStack>
                </Stack>
              </OnboardingStepShell>
            ) : null}

            {step === 3 ? (
              <OnboardingStepShell step={3} title="Which time zone are you in?">
                <Stack gap="4">
                  <SimpleGrid columns={3} gap="3">
                    {US_TIME_ZONE_OPTIONS.map((opt) => (
                      <OnboardingNavCard
                        key={opt.id}
                        selected={timezone === opt.iana}
                        detail={formatCurrentTimeInTimeZone(opt.iana, zoneClock)}
                        onClick={() => {
                          setTimezone(opt.iana);
                          void savePatch({ timezone: opt.iana }, { replaceSession: false });
                        }}
                      >
                        {opt.label}
                      </OnboardingNavCard>
                    ))}
                  </SimpleGrid>
                  <Stack gap="2">
                    <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium">
                      More time zones
                    </Text>
                    <PondNativeSelect
                      rootProps={{ size: "md", disabled: busy }}
                      fieldProps={{
                        value: isUsTimeZone(timezone) ? "" : timezone,
                        onChange: (e) => {
                          const value = e.target.value;
                          if (!value) return;
                          setTimezone(value);
                          void savePatch({ timezone: value }, { replaceSession: false });
                        },
                      }}
                    >
                      <option value="">Choose a time zone…</option>
                      {extraTimeZones.map((z) => (
                        <option key={z} value={z}>
                          {`${z.replace(/_/g, " ")} (${formatCurrentTimeInTimeZone(z, zoneClock)})`}
                        </option>
                      ))}
                    </PondNativeSelect>
                  </Stack>
                  <HStack gap="3" w="100%" align="stretch">
                    {prior != null ? (
                      <PondButton
                        type="button"
                        variant="ghost"
                        flex="1"
                        disabled={busy}
                        onClick={() => {
                          goToStep(prior);
                        }}
                      >
                        Back
                      </PondButton>
                    ) : null}
                    <PondButton
                      type="button"
                      colorPalette="lilypad"
                      flex="1"
                      disabled={busy}
                      onClick={() => {
                        void advanceStep({ timezone });
                      }}
                    >
                      Continue
                    </PondButton>
                  </HStack>
                </Stack>
              </OnboardingStepShell>
            ) : null}

            {step === 4 ? (
              <OnboardingStepShell
                step={4}
                title="Would you like to upload an avatar photo?"
              >
                <Stack gap="4" align="center">
                  <Avatar.Root size="2xl">
                    <Avatar.Fallback name={displayName || sessionUser.user.email} />
                    {avatarDisplayUrl ? (
                      <Avatar.Image src={avatarDisplayUrl} />
                    ) : null}
                  </Avatar.Root>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void avatarUpload.uploadFile(file);
                      }
                    }}
                  />
                  <HStack gap="3" w="100%" align="stretch">
                    {prior != null ? (
                      <PondButton
                        type="button"
                        variant="ghost"
                        flex="1"
                        disabled={busy}
                        onClick={() => {
                          goToStep(prior);
                        }}
                      >
                        Back
                      </PondButton>
                    ) : null}
                    <PondButton
                      type="button"
                      variant="outline"
                      colorPalette="gray"
                      flex="1"
                      disabled={busy}
                      onClick={() => {
                        void advanceStep();
                      }}
                    >
                      Skip
                    </PondButton>
                    <PondButton
                      type="button"
                      colorPalette="lilypad"
                      flex="1"
                      disabled={busy || !hasUploadedAvatar}
                      onClick={() => {
                        void advanceStep();
                      }}
                    >
                      Continue
                    </PondButton>
                  </HStack>
                </Stack>
              </OnboardingStepShell>
            ) : null}

            {step === 5 ? (
              <OnboardingStepShell step={5} title="Who do you want to see around the site?">
                <Stack gap="4">
                  <Text fontSize={APP_TEXT_SIZES.body}>Show me...</Text>
                  <SimpleGrid columns={1} gap="3">
                    <OnboardingNavCard
                      selected={socialReadScope === "approved_users"}
                      onClick={() => {
                        setSocialReadScope("approved_users");
                        void savePatch(
                          { social_read_scope: "approved_users" },
                          { replaceSession: false },
                        );
                      }}
                    >
                      All Approved Users ➡️
                    </OnboardingNavCard>
                    <OnboardingNavCard
                      selected={socialReadScope === "friends_only"}
                      onClick={() => {
                        setSocialReadScope("friends_only");
                        void savePatch(
                          { social_read_scope: "friends_only" },
                          { replaceSession: false },
                        );
                      }}
                    >
                      Only My Friends ➡️
                    </OnboardingNavCard>
                  </SimpleGrid>
                  <HStack gap="3" w="100%" align="stretch">
                    {prior != null ? (
                      <PondButton
                        type="button"
                        variant="ghost"
                        flex="1"
                        disabled={busy}
                        onClick={() => {
                          goToStep(prior);
                        }}
                      >
                        Back
                      </PondButton>
                    ) : null}
                    <PondButton
                      type="button"
                      colorPalette="lilypad"
                      flex="1"
                      disabled={busy}
                      onClick={() => {
                        void advanceStep({ social_read_scope: socialReadScope });
                      }}
                    >
                      Continue
                    </PondButton>
                  </HStack>
                </Stack>
              </OnboardingStepShell>
            ) : null}

            {step === 6 ? (
              <OnboardingStepShell step={6} title="Who do you want to be able to see you?">
                <Stack gap="4">
                  <Text fontSize={APP_TEXT_SIZES.body}>Share me with...</Text>
                  <SimpleGrid columns={1} gap="3">
                    <OnboardingNavCard
                      selected={socialPublishVisibility === "all_approved"}
                      onClick={() => {
                        setSocialPublishVisibility("all_approved");
                        void savePatch(
                          { social_publish_visibility: "all_approved" },
                          { replaceSession: false },
                        );
                      }}
                    >
                      ➡️ All Approved Users
                    </OnboardingNavCard>
                    <OnboardingNavCard
                      selected={socialPublishVisibility === "friends_only"}
                      onClick={() => {
                        setSocialPublishVisibility("friends_only");
                        void savePatch(
                          { social_publish_visibility: "friends_only" },
                          { replaceSession: false },
                        );
                      }}
                    >
                      ➡️ Only My Friends
                    </OnboardingNavCard>
                  </SimpleGrid>
                  <HStack gap="3" w="100%" align="stretch">
                    {prior != null ? (
                      <PondButton
                        type="button"
                        variant="ghost"
                        flex="1"
                        disabled={busy}
                        onClick={() => {
                          goToStep(prior);
                        }}
                      >
                        Back
                      </PondButton>
                    ) : null}
                    <PondButton
                      type="button"
                      colorPalette="lilypad"
                      flex="1"
                      disabled={busy}
                      onClick={() => {
                        void advanceStep({
                          social_publish_visibility: socialPublishVisibility,
                        });
                      }}
                    >
                      Continue
                    </PondButton>
                  </HStack>
                </Stack>
              </OnboardingStepShell>
            ) : null}

            {step === 7 ? (
              <OnboardingStepShell step={7} title="Which apps are you interested in?">
                <Stack gap="4">
                  <Text fontSize={APP_TEXT_SIZES.body}>
                    Star the apps you want to see on your Pond Arbor homepage. (You will be able to change this later.)
                  </Text>
                  <Stack gap="1">
                    {getOnboardingStarableApps(access).map((item) => {
                      const starred = isPathStarred(item.to, starredProfile);
                      return (
                        <Box
                          key={item.to}
                          w="100%"
                          p="1"
                          borderRadius="md"
                          borderWidth="1px"
                          borderColor="border"
                          bg={starred ? "lilypad.subtle" : "bg"}
                          transition="background 0.12s ease"
                          _hover={{
                            bg: starred ? "lilypad.subtle" : "bg.subtle",
                          }}
                        >
                          <Box
                            asChild
                            w="100%"
                            cursor="pointer"
                            textAlign="left"
                          >
                            <button
                              type="button"
                              aria-label={
                                starred ? `Unstar ${item.label}` : `Star ${item.label}`
                              }
                              aria-pressed={starred}
                              onClick={() => {
                                const next = toggleHomeStarredPath(
                                  item.to,
                                  starredProfile,
                                );
                                void patchHomeStarredAppPaths(next);
                              }}
                              style={{
                                width: "100%",
                                background: "transparent",
                                border: "none",
                                padding: 0,
                                cursor: "pointer",
                                textAlign: "left",
                              }}
                            >
                              <HStack gap="1.5" align="flex-start" w="100%">
                                <Text fontSize="xl" aria-hidden>
                                  {item.emoji}
                                </Text>
                                <Stack gap="0.5" flex="1" minW={0}>
                                  <Text fontWeight="semibold">{item.label}</Text>
                                  {item.blurb ? (
                                    <Text fontSize="sm" color="fg.muted">
                                      {item.blurb}
                                    </Text>
                                  ) : null}
                                </Stack>
                                <Text
                                  fontSize="lg"
                                  lineHeight="1"
                                  color={starred ? GOALS_THEME.gold : "black"}
                                  aria-hidden
                                >
                                  {starred ? "★" : "☆"}
                                </Text>
                              </HStack>
                            </button>
                          </Box>
                        </Box>
                      );
                    })}
                  </Stack>
                  <HStack gap="3" w="100%" align="stretch">
                    {prior != null ? (
                      <PondButton
                        type="button"
                        variant="ghost"
                        flex="1"
                        disabled={busy}
                        onClick={() => {
                          goToStep(prior);
                        }}
                      >
                        Back
                      </PondButton>
                    ) : null}
                    <PondButton
                      type="button"
                      colorPalette="lilypad"
                      flex="1"
                      disabled={busy}
                      onClick={() => {
                        void finishOnboarding();
                      }}
                    >
                      Finish
                    </PondButton>
                  </HStack>
                </Stack>
              </OnboardingStepShell>
            ) : null}

            {prior != null &&
            step !== 2 &&
            step !== 3 &&
            step !== 4 &&
            step !== 5 &&
            step !== 6 &&
            step !== 7 ? (
              <PondButton
                type="button"
                variant="ghost"
                alignSelf="flex-start"
                disabled={busy}
                onClick={() => {
                  goToStep(prior);
                }}
              >
                Back
              </PondButton>
            ) : null}
          </Stack>
        </Box>
      </Box>
      <SiteFooter />
    </Stack>
  );
}
