import { Box, Heading, HStack, Stack, Tabs, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import { fullBleedStackProps } from "../responsive";
import {
  APP_SHELL_TAB_LIST_MEAL_INNER_PROPS,
  APP_SHELL_TAB_LIST_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { fetchMeals } from "./api";
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

/** Inner tabs under Pantry. */
const MEAL_PANTRY_INNER_PATH = {
  inventory: "/meal/pantry/inventory",
  recommendations: "/meal/pantry/recommendations",
  ready: "/meal/pantry/ready",
  almost: "/meal/pantry/almost",
} as const;

type MealPantryInnerTab = keyof typeof MEAL_PANTRY_INNER_PATH;

function mealOuterFromPathname(pathname: string): MealOuterTab {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p.startsWith("/meal/meals") || p.startsWith("/meal/shared")) return "meals";
  if (p.startsWith("/meal/plan")) return "plan";
  if (p.startsWith("/meal/pantry")) return "pantry";
  if (p.startsWith("/meal/settings")) return "settings";
  if (p.startsWith("/meal/today")) return "plan";
  return "plan";
}

function mealPantryInnerFromPathname(pathname: string): MealPantryInnerTab {
  if (pathname.startsWith("/meal/pantry/recommendations")) return "recommendations";
  if (pathname.startsWith("/meal/pantry/ready")) return "ready";
  if (pathname.startsWith("/meal/pantry/almost")) return "almost";
  return "inventory";
}

export default function MealLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const {
    sessionUser,
    getApiAccessToken,
    patchMyProfile,
    resyncSessionSilently,
  } = useAppSession();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialStep, setWizardInitialStep] = useState<MealWizardStepId | undefined>();
  const autoOpenAttemptedRef = useRef(false);

  const outer = mealOuterFromPathname(pathname);
  const pantryInner = mealPantryInnerFromPathname(pathname);

  useEffect(() => {
    if (!sessionUser?.user.is_approved) return;
    if (autoOpenAttemptedRef.current) return;
    if (sessionUser.profile.meal_maestro_setup_completed) return;
    if (isMealWizardAutoOpenDisabled(sessionUser.user.id)) return;

    autoOpenAttemptedRef.current = true;
    void (async () => {
      try {
        const tok = await getApiAccessToken();
        const meals = await fetchMeals(tok);
        if (meals.length > 0) return;
        setWizardInitialStep(
          sessionUser.profile.meal_partner_incoming_pending ? "partner" : undefined,
        );
        setWizardOpen(true);
      } catch {
        /* skip auto-open on fetch failure */
      }
    })();
  }, [getApiAccessToken, sessionUser]);

  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box
        flex="1"
        bg="bg"
        px={0}
        py={{ base: "2", md: "2" }}
      >
        <Box data-meal-panel-content="" {...APP_SHELL_TRAY_PROPS}>
          <Stack
            gap={{ base: "4", md: "4" }}
            px={{ base: "2", md: "2" }}
            pt={{ base: "2", md: "2" }}
            pb="2"
          >
            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Heading
                as="h1"
                size={{ base: "lg", md: "xl" }}
                mb="2"
              >
                <HStack
                  as="span"
                  display="inline-flex"
                  gap="2"
                  alignItems="center"
                >
                  <Text as="span" aria-hidden="true">
                    🧑‍🍳
                  </Text>
                  <Text as="span">Meal Maestro</Text>
                </HStack>
              </Heading>
              <Text fontSize={APP_TEXT_SIZES.body} lineHeight="tall" color="fg">
                Weekly meal planning and grocery list generator for you and up
                to one meal partner. <u>Work in progress.</u>
              </Text>
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

          {outer === "pantry" ? (
            <Box pt="2">
              <Tabs.Root
                variant="plain"
                value={pantryInner}
                onValueChange={(details) => {
                  const v = details.value as MealPantryInnerTab;
                  const path = MEAL_PANTRY_INNER_PATH[v];
                  if (path) navigate(path);
                }}
              >
                <Tabs.List
                  {...APP_SHELL_TAB_LIST_MEAL_INNER_PROPS}
                  data-meal-shell-tabs=""
                >
                  <Tabs.Trigger value="inventory" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                    Inventory
                  </Tabs.Trigger>
                  <Tabs.Trigger value="recommendations" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                    Recommendations
                  </Tabs.Trigger>
                  <Tabs.Trigger value="ready" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                    Ready
                  </Tabs.Trigger>
                  <Tabs.Trigger value="almost" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                    Almost
                  </Tabs.Trigger>
                </Tabs.List>
              </Tabs.Root>
            </Box>
          ) : null}

          <Box px={{ base: "2", md: "2" }} py={{ base: "2", md: "2" }}>
            <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
              <Outlet />
            </Stack>
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
