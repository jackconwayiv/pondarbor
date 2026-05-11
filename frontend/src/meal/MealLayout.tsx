import { Box, Heading, HStack, Stack, Tabs, Text } from "@chakra-ui/react";
import { Outlet, useLocation, useNavigate } from "react-router";
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

/** Outer tab: Today | Plan | Grocery | Settings. */
const MEAL_OUTER_PATH = {
  today: "/meal/today",
  plan: "/meal/plan/plans",
  grocery: "/meal/grocery",
  settings: "/meal/settings",
} as const;

type MealOuterTab = keyof typeof MEAL_OUTER_PATH;

/** Inner tabs under Plan. */
const MEAL_PLAN_INNER_PATH = {
  plans: "/meal/plan/plans",
  templates: "/meal/plan/templates",
  meals: "/meal/plan/meals",
  shared: "/meal/plan/shared",
} as const;

type MealPlanInnerTab = keyof typeof MEAL_PLAN_INNER_PATH;

function mealOuterFromPathname(pathname: string): MealOuterTab {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p.startsWith("/meal/today")) return "today";
  if (p.startsWith("/meal/plan")) return "plan";
  if (p.startsWith("/meal/grocery")) return "grocery";
  if (p.startsWith("/meal/settings")) return "settings";
  return "today";
}

function mealPlanInnerFromPathname(pathname: string): MealPlanInnerTab {
  if (pathname.startsWith("/meal/plan/templates")) return "templates";
  if (pathname.startsWith("/meal/plan/shared")) return "shared";
  if (pathname.startsWith("/meal/plan/meals")) return "meals";
  return "plans";
}

export default function MealLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  const outer = mealOuterFromPathname(pathname);
  const planInner = mealPlanInnerFromPathname(pathname);

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
              <Tabs.Trigger value="today" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                Today
              </Tabs.Trigger>
              <Tabs.Trigger value="plan" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                Plan
              </Tabs.Trigger>
              <Tabs.Trigger value="grocery" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                Grocery
              </Tabs.Trigger>
              <Tabs.Trigger value="settings" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                Settings
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>

          {outer === "plan" ? (
            <Box pt="2">
              <Tabs.Root
                variant="plain"
                value={planInner}
                onValueChange={(details) => {
                  const v = details.value as MealPlanInnerTab;
                  const path = MEAL_PLAN_INNER_PATH[v];
                  if (path) navigate(path);
                }}
              >
                <Tabs.List
                  {...APP_SHELL_TAB_LIST_MEAL_INNER_PROPS}
                  data-meal-shell-tabs=""
                >
                  <Tabs.Trigger value="plans" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                    Weekly
                  </Tabs.Trigger>
                  <Tabs.Trigger
                    value="templates"
                    {...APP_SHELL_TAB_TRIGGER_PROPS}
                  >
                    Templates
                  </Tabs.Trigger>
                  <Tabs.Trigger value="meals" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                    Meals
                  </Tabs.Trigger>
                  <Tabs.Trigger value="shared" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                    Shared
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
    </Stack>
  );
}
