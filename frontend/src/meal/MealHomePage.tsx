import { Heading, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { Navigate } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import { MAPPED_CLOSET_TAB_STACK_GAP, APP_TEXT_SIZES } from "../theme/typography";
import type { MealPartnerPickerNotice } from "./MealPartnerPicker";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import { MealSettingsGettingStarted } from "./settings/MealSettingsGettingStarted";
import { MealSettingsPantrySection } from "./settings/MealSettingsPantrySection";
import { MealSettingsPartnerSection } from "./settings/MealSettingsPartnerSection";
import { MealSettingsPlanSection } from "./settings/MealSettingsPlanSection";
import { MealSettingsPreferencesSection } from "./settings/MealSettingsPreferencesSection";
import { MealMaestroSetupWizard } from "./wizard/MealMaestroSetupWizard";

export default function MealHomePage() {
  const {
    isAuthenticated,
    isLoading,
    sessionUser,
    getApiAccessToken,
    patchMyProfile,
    refreshSession,
    resyncSessionSilently,
  } = useAppSession();
  const [notice, setNotice] = useState<MealPartnerPickerNotice | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  if (isLoading) return <MealLoading />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser) {
    return <MealSessionReconnect onRetry={() => void refreshSession()} />;
  }
  if (!sessionUser.user.is_approved || !sessionUser.profile) {
    return <MealApprovalRequired />;
  }

  const profile = sessionUser.profile;
  const onError = (text: string) => setNotice({ tone: "error", text });

  return (
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
      <Heading as="h2" size="md">
        Settings
      </Heading>

      <MealSettingsGettingStarted
        setupCompleted={profile.meal_maestro_setup_completed ?? false}
        onRunWizard={() => setWizardOpen(true)}
      />

      <MealSettingsPlanSection
        profile={profile}
        patchMyProfile={patchMyProfile}
        resyncSessionSilently={resyncSessionSilently}
        onError={onError}
      />

      <MealSettingsPantrySection
        profile={profile}
        patchMyProfile={patchMyProfile}
        onError={onError}
      />

      <MealSettingsPreferencesSection
        profile={profile}
        getApiAccessToken={getApiAccessToken}
        patchMyProfile={patchMyProfile}
        resyncSessionSilently={resyncSessionSilently}
        onError={onError}
      />

      <MealSettingsPartnerSection
        userId={sessionUser.user.id}
        profile={profile}
        getApiAccessToken={getApiAccessToken}
        patchMyProfile={patchMyProfile}
        resyncSessionSilently={resyncSessionSilently}
        onNotice={setNotice}
      />

      {notice ? (
        <Text
          fontSize={APP_TEXT_SIZES.helper}
          fontWeight="medium"
          color={notice.tone === "success" ? "lilypad.solid" : "nautical.solid"}
          role={notice.tone === "success" ? "status" : "alert"}
        >
          {notice.text}
        </Text>
      ) : null}

      <MealMaestroSetupWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        sessionUser={sessionUser}
        getApiAccessToken={getApiAccessToken}
        patchMyProfile={patchMyProfile}
        resyncSessionSilently={resyncSessionSilently}
        startAtBeginning
      />
    </Stack>
  );
}
