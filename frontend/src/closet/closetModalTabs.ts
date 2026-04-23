import {
  APP_SHELL_TAB_LIST_NESTED_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";

/** Modal tab bar: same pills as app shell; softer bar background. */
export const CLOSET_MODAL_TAB_LIST_PROPS = {
  ...APP_SHELL_TAB_LIST_NESTED_PROPS,
  px: { base: "1", md: "2" } as const,
  py: "2",
} as const;

export function closetModalTabTriggerProps(_activeTab: string, value: string) {
  return { value, ...APP_SHELL_TAB_TRIGGER_PROPS };
}
