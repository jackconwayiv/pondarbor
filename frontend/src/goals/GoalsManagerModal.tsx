import { Box, HStack, Stack, Tabs, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";

import { AppModal } from "../components/AppModal";
import { CLOSET_MODAL_TAB_LIST_PROPS } from "../closet/closetModalTabs";
import { APP_SHELL_TAB_TRIGGER_PROPS } from "../theme/appShellTabs";
import { APP_TEXT_SIZES, MAPPED_LIST_STACK_GAP } from "../theme/typography";
import { frequencyLabel } from "./goalCardLabels";
import {
  GOAL_KIND_CHORE_LABEL,
  GOAL_KIND_CONTINUOUS_LABEL,
  GOAL_KIND_ONE_TIME_LABEL,
} from "./goalCopy";
import { useGoalsStore } from "./goalsStore";
import type { Goal, GoalKind } from "./types";
import { GOALS_THEME } from "./theme";

const MANAGER_KIND_TABS: { value: GoalKind; label: string }[] = [
  { value: "chore", label: GOAL_KIND_CHORE_LABEL },
  { value: "continuous", label: GOAL_KIND_CONTINUOUS_LABEL },
  { value: "one_time", label: GOAL_KIND_ONE_TIME_LABEL },
];

type GoalsManagerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditGoal: (goal: Goal) => void;
};

function statusLabel(goal: Goal): string | null {
  if (goal.status === "paused") return "Paused";
  if (goal.status === "completed") return "Completed";
  return null;
}

function GoalsManagerRow({ goal, onEdit }: { goal: Goal; onEdit: () => void }) {
  const pill = statusLabel(goal);
  const notDue = goal.status === "active" && !goal.due_today;

  return (
    <Box
      as="button"
      width="full"
      textAlign="left"
      borderWidth="1px"
      borderColor="border"
      borderRadius="lg"
      px="3"
      py="2.5"
      bg="bg"
      cursor="pointer"
      _hover={{ borderColor: GOALS_THEME.lakeBlue }}
      onClick={onEdit}
    >
      <HStack justify="space-between" align="start" gap="2">
        <Stack gap="0.5" flex="1" minW="0">
          <Text fontWeight="semibold" color={GOALS_THEME.textOnLight} lineClamp={1}>
            {goal.title}
          </Text>
          <Text fontSize={APP_TEXT_SIZES.helper} color={GOALS_THEME.textMuted} lineClamp={1}>
            {frequencyLabel(goal)}
            {notDue ? " · Not due today" : ""}
          </Text>
        </Stack>
        {pill ? (
          <Text
            fontSize="xs"
            fontWeight="medium"
            color={GOALS_THEME.textMuted}
            flexShrink={0}
          >
            {pill}
          </Text>
        ) : null}
      </HStack>
    </Box>
  );
}

export function GoalsManagerModal({
  open,
  onOpenChange,
  onEditGoal,
}: GoalsManagerModalProps) {
  const { workspace, goalsByKind } = useGoalsStore();
  const totals = workspace?.kind_totals;

  const defaultTab = useMemo((): GoalKind => {
    if ((totals?.chore ?? 0) > 0) return "chore";
    if ((totals?.continuous ?? 0) > 0) return "continuous";
    return "one_time";
  }, [totals]);

  const [kindTab, setKindTab] = useState<GoalKind>(defaultTab);

  useEffect(() => {
    if (open) setKindTab(defaultTab);
  }, [defaultTab, open]);

  const list = goalsByKind(kindTab);

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title="Goals Manager"
      size="lg"
    >
      <Tabs.Root
        value={kindTab}
        onValueChange={(d) => {
          const next = d.value as GoalKind | undefined;
          if (next) setKindTab(next);
        }}
        variant="plain"
        w="100%"
      >
        <Tabs.List {...CLOSET_MODAL_TAB_LIST_PROPS}>
          {MANAGER_KIND_TABS.map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              {...APP_SHELL_TAB_TRIGGER_PROPS}
            >
              {tab.label}
              {totals ? ` (${totals[tab.value]})` : ""}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {MANAGER_KIND_TABS.map((tab) => (
          <Tabs.Content key={tab.value} value={tab.value} pt="3">
            <Stack gap={MAPPED_LIST_STACK_GAP} maxH="24rem" overflowY="auto">
              {list.length === 0 ? (
                <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
                  No {tab.label.toLowerCase()} yet.
                </Text>
              ) : (
                list.map((goal) => (
                  <GoalsManagerRow
                    key={goal.id}
                    goal={goal}
                    onEdit={() => onEditGoal(goal)}
                  />
                ))
              )}
            </Stack>
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </AppModal>
  );
}
