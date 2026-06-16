import { Heading, HStack, Stack, Tabs, Text } from "@chakra-ui/react";
import { useCallback } from "react";
import { useSearchParams } from "react-router";
import PondButton from "../PondButton";
import { useAppSession } from "../auth/AppSessionContext";
import { PanelSessionReconnect, SessionLoadingCard } from "../components/panelStatus";
import {
  APP_SHELL_TABS_ROOT_PROPS,
  APP_SHELL_TAB_LIST_INSET_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import {
  CATEGORY_GROUPS,
  defaultCategorySlugForGroup,
  type CategoryGroupId,
} from "./categoryGroups";
import RecommendationsGroupPanel from "./RecommendationsGroupPanel";
import { useRecommendationsAdd } from "./recommendationsAddContext";

function parseGroup(value: string | null): CategoryGroupId {
  if (value === "media") return "media";
  if (value === "links") return "links";
  return "places";
}

export default function RecommendationsHomePage() {
  const { isLoading, error: sessionError, refreshSession } = useAppSession();
  const { openAddModal } = useRecommendationsAdd();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeGroup = parseGroup(searchParams.get("group"));

  const setActiveGroup = useCallback(
    (group: CategoryGroupId) => {
      const next = new URLSearchParams(searchParams);
      if (group === "places") {
        next.delete("group");
      } else {
        next.set("group", group);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  if (isLoading) return <SessionLoadingCard />;
  if (sessionError) {
    return (
      <PanelSessionReconnect sessionError={sessionError} onRetry={() => void refreshSession()} />
    );
  }

  return (
    <Stack gap={6} maxW="4xl" mx="auto">
      <Stack gap={2}>
        <HStack justify="space-between" align="start" flexWrap="wrap" gap={3} w="100%">
          <Heading size="lg">🧭 Recommendations</Heading>
          <PondButton
            size="sm"
            flexShrink={0}
            onClick={() =>
              openAddModal({ defaultCategorySlug: defaultCategorySlugForGroup(activeGroup) })
            }
          >
            Add recommendation
          </PondButton>
        </HStack>
        <Text color="fg.muted" w="100%">
          Share places, media, and links with friends. All recommendations are visible to all approved
          members.
        </Text>
      </Stack>

      <Tabs.Root
        {...APP_SHELL_TABS_ROOT_PROPS}
        value={activeGroup}
        lazyMount
        unmountOnExit
        onValueChange={(details) => setActiveGroup(parseGroup(details.value))}
      >
        <Tabs.List {...APP_SHELL_TAB_LIST_INSET_PROPS}>
          {CATEGORY_GROUPS.map((group) => (
            <Tabs.Trigger
              key={group.id}
              value={group.id}
              {...APP_SHELL_TAB_TRIGGER_PROPS}
            >
              {group.emoji} {group.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {CATEGORY_GROUPS.map((group) => (
          <Tabs.Content key={group.id} value={group.id} pt={4}>
            <RecommendationsGroupPanel groupId={group.id} />
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </Stack>
  );
}
