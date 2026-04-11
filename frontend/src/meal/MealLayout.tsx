import { Box, Heading, Stack, Tabs, Text } from "@chakra-ui/react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { fullBleedStackProps } from "../responsive";
import {
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

const MEAL_TAB_LIST_PROPS = {
  px: { base: "2", md: "2" } as const,
  pt: "0",
  pb: "0",
  borderBottomWidth: "1px",
  borderColor: "border",
  gap: "1",
  w: "100%",
};

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

/** Same trigger props as `ClosetPage` main `Tabs.List` / `Tabs.Trigger` (Community Closet). */
function mealTabTriggerProps(activeTab: string, value: string) {
  return {
    value,
    bg: activeTab === value ? "lilypad.solid" : undefined,
    color: activeTab === value ? "black" : undefined,
    borderTopRadius: "md" as const,
    borderBottomRadius: "0" as const,
    px: "2",
    py: "2",
    fontWeight: "medium" as const,
    _hover: {
      bg: activeTab === value ? "lilypad.solid" : "transparent",
    },
    _selected: { bg: "lilypad.solid", color: "black" },
  };
}

export default function MealLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  const outer = mealOuterFromPathname(pathname);
  const planInner = mealPlanInnerFromPathname(pathname);

  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box flex="1" bg="sky.solid" px={{ base: "2", md: "2" }} py={{ base: "2", md: "2" }}>
        <Box
          data-meal-panel-content=""
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
            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Heading
                as="h1"
                size={{ base: "lg", md: "xl" }}
                fontWeight="bold"
                mb="2"
              >
                Meal Maestro
              </Heading>
              <Text
                fontSize={APP_TEXT_SIZES.body}
                lineHeight="tall"
                color="fg"
              >
                Weekly meal templates, meals, grocery lists, and optional sharing with one
                friend when you both choose each other.
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
            <Tabs.List {...MEAL_TAB_LIST_PROPS} data-meal-shell-tabs="">
              <Tabs.Trigger {...mealTabTriggerProps(outer, "today")}>
                Today
              </Tabs.Trigger>
              <Tabs.Trigger {...mealTabTriggerProps(outer, "plan")}>
                Plan
              </Tabs.Trigger>
              <Tabs.Trigger {...mealTabTriggerProps(outer, "grocery")}>
                Grocery
              </Tabs.Trigger>
              <Tabs.Trigger {...mealTabTriggerProps(outer, "settings")}>
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
                <Tabs.List {...MEAL_TAB_LIST_PROPS} data-meal-shell-tabs="">
                  <Tabs.Trigger {...mealTabTriggerProps(planInner, "plans")}>
                    Weekly
                  </Tabs.Trigger>
                  <Tabs.Trigger {...mealTabTriggerProps(planInner, "templates")}>
                    Templates
                  </Tabs.Trigger>
                  <Tabs.Trigger {...mealTabTriggerProps(planInner, "meals")}>
                    Meals
                  </Tabs.Trigger>
                  <Tabs.Trigger {...mealTabTriggerProps(planInner, "shared")}>
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
