import { Tabs, type TabsListProps, type TabsRootProps, type TabsTriggerProps } from "@chakra-ui/react";

import {
  APP_SHELL_TAB_LIST_INSET_PROPS,
  APP_SHELL_TAB_LIST_MEAL_INNER_PROPS,
  APP_SHELL_TAB_LIST_NESTED_PROPS,
  APP_SHELL_TAB_LIST_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
  APP_SHELL_TABS_ROOT_PROPS,
} from "./appShellTabs";

export type AppShellTabsListVariant = "shell" | "nested" | "inset" | "mealInner";

const LIST_BY_VARIANT = {
  shell: APP_SHELL_TAB_LIST_PROPS,
  nested: APP_SHELL_TAB_LIST_NESTED_PROPS,
  inset: APP_SHELL_TAB_LIST_INSET_PROPS,
  mealInner: APP_SHELL_TAB_LIST_MEAL_INNER_PROPS,
} as const;

/** Page / modal tab root with Closet-aligned `plain` variant. */
export function AppShellTabsRoot(props: TabsRootProps) {
  return <Tabs.Root {...APP_SHELL_TABS_ROOT_PROPS} {...props} />;
}

/** Tab list row; defaults to the sticky shell bar under the intro card. */
export function AppShellTabsList({
  listVariant = "shell",
  ...props
}: TabsListProps & { listVariant?: AppShellTabsListVariant }) {
  return <Tabs.List {...LIST_BY_VARIANT[listVariant]} {...props} />;
}

/** Pill tab trigger with teal selected state. */
export function AppShellTabsTrigger(props: TabsTriggerProps) {
  return <Tabs.Trigger {...APP_SHELL_TAB_TRIGGER_PROPS} {...props} />;
}
