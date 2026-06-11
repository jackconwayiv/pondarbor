import { Box, Heading, HStack, Stack, Tabs, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import { fullBleedStackProps } from "../responsive";
import {
  APP_SHELL_TAB_LIST_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import {
  APP_SHELL_TRAY_PROPS,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { MealDataProvider, useMealData } from "./MealDataContext";
import { MealLoading, MealSessionReconnect } from "./mealPageStates";
import { MealMaestroSetupWizard } from "./wizard/MealMaestroSetupWizard";
import { isMealWizardAutoOpenDisabled } from "./wizard/mealWizardStorage";
import type { MealWizardStepId } from "./wizard/mealWizardSteps";

/** Outer tab: Plan | Meals | Pantry | Settings. */
const MEAL_OUTER_PATH = {
  plan: "/meal/plan",
  meals: "/meal/meals",
  pantry: "/meal/pantry/inventory",
  settings: "/meal/settings",
} as const;

type MealOuterTab = keyof typeof MEAL_OUTER_PATH;

function mealOuterFromPathname(pathname: string): MealOuterTab {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p.startsWith("/meal/meals") || p.startsWith("/meal/shared")) return "meals";
  if (p.startsWith("/meal/plan")) return "plan";
  if (p.startsWith("/meal/pantry")) return "pantry";
  if (p.startsWith("/meal/settings")) return "settings";
  if (p.startsWith("/meal/today")) return "plan";
  return "plan";
}

export default function MealLayout() {
  const { sessionUser, getApiAccessToken, patchMyProfile, resyncSessionSilently } =
    useAppSession();

  return (
    <MealDataProvider sessionUser={sessionUser} getApiAccessToken={getApiAccessToken}>
      <MealLayoutShell
        sessionUser={sessionUser}
        getApiAccessToken={getApiAccessToken}
        patchMyProfile={patchMyProfile}
        resyncSessionSilently={resyncSessionSilently}
      />
    </MealDataProvider>
  );
}

type MealLayoutShellProps = {
  sessionUser: ReturnType<typeof useAppSession>["sessionUser"];
  getApiAccessToken: ReturnType<typeof useAppSession>["getApiAccessToken"];
  patchMyProfile: ReturnType<typeof useAppSession>["patchMyProfile"];
  resyncSessionSilently: ReturnType<typeof useAppSession>["resyncSessionSilently"];
};

function MealLayoutShell({
  sessionUser,
  getApiAccessToken,
  patchMyProfile,
  resyncSessionSilently,
}: MealLayoutShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const mealData = useMealData();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialStep, setWizardInitialStep] = useState<MealWizardStepId | undefined>();
  const autoOpenAttemptedRef = useRef(false);

  const outer = mealOuterFromPathname(pathname);
  const approved = sessionUser?.user.is_approved ?? false;

  useEffect(() => {
    if (!sessionUser?.user.is_approved) return;
    if (!mealData.ready) return;
    if (autoOpenAttemptedRef.current) return;
    if (sessionUser.profile.meal_maestro_setup_completed) return;
    if (isMealWizardAutoOpenDisabled(sessionUser.user.id)) return;

    autoOpenAttemptedRef.current = true;
    if (mealData.meals.length > 0) return;
    setWizardInitialStep(
      sessionUser.profile.meal_partner_incoming_pending ? "partner" : undefined,
    );
    setWizardOpen(true);
  }, [mealData.meals.length, mealData.ready, sessionUser]);

  const outlet =
    approved && mealData.loading && !mealData.ready ? (
      <MealLoading />
    ) : approved && mealData.error && !mealData.ready ? (
      <MealSessionReconnect onRetry={() => void mealData.retry()} />
    ) : (
      <Outlet />
    );

  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box flex="1" bg="bg" px={0} py={{ base: "2", md: "2" }}>
        <Box data-meal-panel-content="" {...APP_SHELL_TRAY_PROPS}>
          <Stack
            gap={{ base: "4", md: "4" }}
            px={{ base: "2", md: "2" }}
            pt={{ base: "2", md: "2" }}
            pb="2"
          >
            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Heading as="h1" size={{ base: "lg", md: "xl" }} mb="0">
                <HStack as="span" display="inline-flex" gap="2" alignItems="center">
                  <Text as="span" aria-hidden="true">
                    🧑‍🍳
                  </Text>
                  <Text as="span">Meal Maestro</Text>
                </HStack>
              </Heading>
            </Box>
          </Stack>

          <Tabs.Root
            variant="plain"
            value={outer}
            onValueChange={(details) => {
              const v = details.value as MealOuterTab;
              const path = MEAL_OUTER_PATH[v];
              if (path) navigate(path);
            }}
          >
            <Tabs.List {...APP_SHELL_TAB_LIST_PROPS} data-meal-shell-tabs="">
              <Tabs.Trigger value="plan" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                Plan
              </Tabs.Trigger>
              <Tabs.Trigger value="meals" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                Meals
              </Tabs.Trigger>
              <Tabs.Trigger value="pantry" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                Pantry
              </Tabs.Trigger>
              <Tabs.Trigger value="settings" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                Settings
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>

          <Box px={{ base: "2", md: "2" }} py={{ base: "2", md: "2" }}>
            <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>{outlet}</Stack>
          </Box>
        </Box>
      </Box>

      {sessionUser ? (
        <MealMaestroSetupWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          sessionUser={sessionUser}
          getApiAccessToken={getApiAccessToken}
          patchMyProfile={patchMyProfile}
          resyncSessionSilently={resyncSessionSilently}
          markAutoOpenDisabledOnClose
          initialStep={wizardInitialStep}
        />
      ) : null}
    </Stack>
  );
}
