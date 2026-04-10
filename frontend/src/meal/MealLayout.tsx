import { Box, Heading, Stack, Tabs, Text } from "@chakra-ui/react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { fullBleedStackProps } from "../responsive";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";

/** Outer tab: Plans | Meals | Grocery | Settings (URL segment for “Meals” is `menu`). */
const MEAL_OUTER_PATH = {
  plans: "/meal/plans/today",
  menu: "/meal/menu/meals",
  grocery: "/meal/grocery",
  settings: "/meal/settings",
} as const;

type MealOuterTab = keyof typeof MEAL_OUTER_PATH;

/** Inner tabs under Plans. */
const MEAL_PLANS_INNER_PATH = {
  today: "/meal/plans/today",
  weeks: "/meal/plans/weeks",
  templates: "/meal/plans/templates",
} as const;

type MealPlansInnerTab = keyof typeof MEAL_PLANS_INNER_PATH;

/** Inner tabs under Meals (outer `menu`). */
const MEAL_MENU_INNER_PATH = {
  meals: "/meal/menu/meals",
  recipes: "/meal/menu/recipes",
} as const;

type MealMenuInnerTab = keyof typeof MEAL_MENU_INNER_PATH;

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
  if (p.startsWith("/meal/plans")) return "plans";
  if (p.startsWith("/meal/menu")) return "menu";
  if (p.startsWith("/meal/grocery")) return "grocery";
  if (p.startsWith("/meal/settings")) return "settings";
  return "plans";
}

function mealPlansInnerFromPathname(pathname: string): MealPlansInnerTab {
  if (pathname.startsWith("/meal/plans/templates")) return "templates";
  if (pathname.startsWith("/meal/plans/weeks")) return "weeks";
  if (pathname.startsWith("/meal/plans/today")) return "today";
  return "today";
}

function mealMenuInnerFromPathname(pathname: string): MealMenuInnerTab {
  if (pathname.startsWith("/meal/menu/recipes")) return "recipes";
  return "meals";
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
  const plansInner = mealPlansInnerFromPathname(pathname);
  const menuInner = mealMenuInnerFromPathname(pathname);

  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box flex="1" bg="sky.solid" px={{ base: "2", md: "2" }} py={{ base: "2", md: "2" }}>
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
                Weekly meal templates, recipes, grocery lists, and optional sharing with one
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
            <Tabs.List {...MEAL_TAB_LIST_PROPS}>
              <Tabs.Trigger {...mealTabTriggerProps(outer, "plans")}>
                Plans
              </Tabs.Trigger>
              <Tabs.Trigger {...mealTabTriggerProps(outer, "menu")}>
                Meals
              </Tabs.Trigger>
              <Tabs.Trigger {...mealTabTriggerProps(outer, "grocery")}>
                Grocery
              </Tabs.Trigger>
              <Tabs.Trigger {...mealTabTriggerProps(outer, "settings")}>
                Settings
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>

          {outer === "plans" ? (
            <Box pt="2">
              <Tabs.Root
                variant="plain"
                value={plansInner}
                onValueChange={(details) => {
                  const v = details.value as MealPlansInnerTab;
                  const path = MEAL_PLANS_INNER_PATH[v];
                  if (path) navigate(path);
                }}
              >
                <Tabs.List {...MEAL_TAB_LIST_PROPS}>
                  <Tabs.Trigger {...mealTabTriggerProps(plansInner, "today")}>
                    Today
                  </Tabs.Trigger>
                  <Tabs.Trigger {...mealTabTriggerProps(plansInner, "weeks")}>
                    Weeks
                  </Tabs.Trigger>
                  <Tabs.Trigger {...mealTabTriggerProps(plansInner, "templates")}>
                    Templates
                  </Tabs.Trigger>
                </Tabs.List>
              </Tabs.Root>
            </Box>
          ) : null}

          {outer === "menu" ? (
            <Box pt="2">
              <Tabs.Root
                variant="plain"
                value={menuInner}
                onValueChange={(details) => {
                  const v = details.value as MealMenuInnerTab;
                  const path = MEAL_MENU_INNER_PATH[v];
                  if (path) navigate(path);
                }}
              >
                <Tabs.List {...MEAL_TAB_LIST_PROPS}>
                  <Tabs.Trigger {...mealTabTriggerProps(menuInner, "meals")}>
                    Meals
                  </Tabs.Trigger>
                  <Tabs.Trigger {...mealTabTriggerProps(menuInner, "recipes")}>
                    Recipes
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
