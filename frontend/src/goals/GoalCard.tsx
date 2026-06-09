import { Badge, Box, HStack, Stack, Text } from "@chakra-ui/react";

import type { Goal } from "./types";
import {
  frequencyLabel,
  goalCompletedMedalLabel,
  goalContinuousPeriodStreakLabel,
  goalHoldProgressDisabled,
  goalLastProgressLabel,
  goalPatchIsComplete,
  goalPatchShellStyle,
  isOngoingKind,
} from "./goalCardLabels";
import { GOALS_THEME } from "./theme";
import { GoalLongPressRing } from "./GoalLongPressRing";
import { GoalPatchCircle } from "./GoalPatchCircle";
import { GoalPatchOverdueHeader } from "./GoalPatchOverdueHeader";
import { GoalPeriodSockets, periodSlotsForGoal, type PeriodSlots } from "./GoalPeriodSockets";

/** Circle badge on desktop; card body overlaps ~half the patch width. */
const DESKTOP_PATCH_SIZE = "6.75rem";
const DESKTOP_CARD_OVERLAP = "3.5rem";
const DESKTOP_CARD_INSET_PL = "3.75rem";

type GoalCardProps = {
  goal: Goal;
  onTap: () => void;
  onHoldComplete: () => void;
  /** Active tab: compact patch on mobile, badge row on desktop. */
  compact?: boolean;
  goldShimmerAnimate?: boolean;
  holdDisabled?: boolean;
};

const patchPadding = { px: "2", py: "2", textAlign: "center" as const };

function goalKindCornerEmoji(kind: Goal["kind"]): string {
  if (kind === "chore") return "🧹";
  return kind === "continuous" ? "♻️" : "🎯";
}

function GoalPatchPeriodLine({ goal, compact }: { goal: Goal; compact: boolean }) {
  if (goal.status === "completed") {
    return (
      <Text fontSize="xs" color={GOALS_THEME.textMuted} textAlign="center">
        {goalCompletedMedalLabel(goal)}
      </Text>
    );
  }
  if (compact && isOngoingKind(goal) && goalPatchIsComplete(goal)) {
    const streak = goalContinuousPeriodStreakLabel(goal);
    return streak ? (
      <Text fontSize="xs" color={GOALS_THEME.textMuted} textAlign="center">
        {streak}
      </Text>
    ) : null;
  }
  if (compact) {
    return <GoalPeriodSockets slots={periodSlotsForGoal(goal)} size="sm" />;
  }
  return null;
}

function GoalCardMobileCircle({
  goal,
  compact,
  goldShimmerAnimate,
}: {
  goal: Goal;
  compact: boolean;
  goldShimmerAnimate: boolean;
}) {
  const complete = goalPatchIsComplete(goal);
  const patchStyle = goalPatchShellStyle(goal);

  if (compact) {
    return (
      <GoalPatchCircle
        goldShimmer={complete}
        goldShimmerAnimate={goldShimmerAnimate}
        patchStyle={patchStyle}
        width="100%"
        height="100%"
        {...patchPadding}
      >
        <Stack gap="1.5" align="center" width="full" maxW="full">
          <GoalPatchOverdueHeader goal={goal} />
          <Text
            fontWeight="bold"
            color={GOALS_THEME.textOnLight}
            fontSize="xs"
            lineClamp={3}
            lineHeight="short"
            width="full"
          >
            {goal.title}
          </Text>
          <GoalPatchPeriodLine goal={goal} compact={compact} />
        </Stack>
      </GoalPatchCircle>
    );
  }

  return (
    <GoalPatchCircle
      goldShimmer={complete}
      goldShimmerAnimate={goldShimmerAnimate}
      patchStyle={patchStyle}
      width="100%"
      height="100%"
      {...patchPadding}
    >
      <Stack gap="1" align="center" width="full">
        <GoalPatchOverdueHeader goal={goal} />
        <Text
          fontWeight="bold"
          color={GOALS_THEME.textOnLight}
          fontSize="xs"
          lineClamp={3}
          lineHeight="short"
        >
          {goal.title}
        </Text>
        {goal.status === "completed" ? (
          <Text fontSize="xs" color={GOALS_THEME.textMuted}>
            {goalCompletedMedalLabel(goal)}
          </Text>
        ) : (
          <Text fontSize="xs" color={GOALS_THEME.textMuted} textTransform="capitalize">
            {goal.status}
          </Text>
        )}
      </Stack>
    </GoalPatchCircle>
  );
}

function GoalCardDesktopBadge({
  goal,
  compact,
  goldShimmerAnimate,
}: {
  goal: Goal;
  compact: boolean;
  goldShimmerAnimate: boolean;
}) {
  const complete = goalPatchIsComplete(goal);
  const patchStyle = goalPatchShellStyle(goal);

  return (
    <HStack align="center" gap="0" width="full">
      <GoalPatchCircle
        goldShimmer={complete}
        goldShimmerAnimate={goldShimmerAnimate}
        patchStyle={patchStyle}
        position="relative"
        zIndex={1}
        flexShrink={0}
        w={DESKTOP_PATCH_SIZE}
        h={DESKTOP_PATCH_SIZE}
        aspectRatio={1}
        px="2"
        py="2"
      >
        <Stack gap="1" align="center" width="full">
          <GoalPatchOverdueHeader goal={goal} />
          <Text
            fontWeight="bold"
            color={GOALS_THEME.textOnLight}
            fontSize="xs"
            lineClamp={2}
            lineHeight="short"
            textAlign="center"
          >
            {goal.title}
          </Text>
          {goal.status === "completed" ? (
            <Text fontSize="xs" color={GOALS_THEME.textMuted} textAlign="center">
              {goalCompletedMedalLabel(goal)}
            </Text>
          ) : compact && isOngoingKind(goal) && complete ? (
            <Text fontSize="xs" color={GOALS_THEME.textMuted} textAlign="center">
              {goalContinuousPeriodStreakLabel(goal)}
            </Text>
          ) : compact ? (
            <GoalPeriodSockets slots={periodSlotsForGoal(goal)} size="sm" />
          ) : null}
        </Stack>
      </GoalPatchCircle>
      <Box
        flex="1"
        alignSelf="stretch"
        minH={DESKTOP_PATCH_SIZE}
        ml={`-${DESKTOP_CARD_OVERLAP}`}
        pl={DESKTOP_CARD_INSET_PL}
        pr="3"
        py="2"
        border="2px solid"
        borderColor={GOALS_THEME.cardBodyBorder}
        borderRadius="lg"
        bg={GOALS_THEME.cardBodyBg}
        boxShadow="sm"
        display="flex"
        flexDirection="column"
        justifyContent="center"
        position="relative"
        _hover={{ borderColor: GOALS_THEME.lakeBlue }}
      >
        <Text
          position="absolute"
          top="2"
          right="3"
          fontSize="lg"
          lineHeight="1"
          aria-hidden
        >
          {goalKindCornerEmoji(goal.kind)}
        </Text>
        <Stack gap="1.5" align="stretch" pr="7">
          {compact && isOngoingKind(goal) ? (
            <HStack justify="space-between" align="center" gap="2" width="full">
              <Text fontSize="xs" color={GOALS_THEME.textMuted}>
                {frequencyLabel(goal)}
              </Text>
              <Text fontSize="xs" color={GOALS_THEME.textMuted} flexShrink={0}>
                Streak {goal.stats.streak_current}
              </Text>
            </HStack>
          ) : (
            <Text fontSize="xs" color={GOALS_THEME.textMuted}>
              {frequencyLabel(goal)}
              {!compact
                ? goal.status === "completed"
                  ? goalCompletedMedalLabel(goal)
                    ? ` · ${goalCompletedMedalLabel(goal)}`
                    : ""
                  : ` · ${goal.status}`
                : ""}
            </Text>
          )}
          <Text fontSize="xs" color={GOALS_THEME.textMuted}>
            Last progress {goalLastProgressLabel(goal) ?? "—"}
          </Text>
          {compact ? (
            <>
              {isOngoingKind(goal) ? (
                <Text fontSize="xs" color={GOALS_THEME.textMuted}>
                  Today {goal.stats.today_actual}/{goal.stats.today_target || "—"}
                  {goal.stats.week_target > 0
                    ? ` · Week ${goal.stats.week_actual}/${goal.stats.week_target}`
                    : ""}
                </Text>
              ) : (() => {
                const slots: PeriodSlots = periodSlotsForGoal(goal);
                const remaining = slots.total - slots.filled;
                const completedLabel = goalCompletedMedalLabel(goal);
                const subtitle =
                  goal.status === "completed"
                    ? completedLabel
                    : remaining > 0
                      ? `${remaining} left to finish`
                      : null;
                return subtitle ? (
                  <Text fontSize="xs" color={GOALS_THEME.textMuted}>
                    {subtitle}
                  </Text>
                ) : null;
              })()}
              <HStack gap="2" flexWrap="wrap">
                <Badge size="sm" bg={GOALS_THEME.pineLight} color={GOALS_THEME.pineGreen}>
                  {Math.round(goal.stats.pct_lifetime)}% overall
                </Badge>
                <Badge size="sm" bg={GOALS_THEME.lakeLight} color={GOALS_THEME.lakeBlue}>
                  {Math.round(goal.stats.pct_last_30_days)}% 30d
                </Badge>
                {goal.stats.days_since_last_progress > 0 ? (
                  <Badge size="sm" variant="outline" borderColor={GOALS_THEME.textMuted}>
                    {goal.stats.days_since_last_progress}d quiet
                  </Badge>
                ) : null}
              </HStack>
            </>
          ) : null}
        </Stack>
      </Box>
    </HStack>
  );
}

export function GoalCard({
  goal,
  onTap,
  onHoldComplete,
  compact = false,
  goldShimmerAnimate = false,
  holdDisabled: holdDisabledProp,
}: GoalCardProps) {
  const holdDisabled = holdDisabledProp ?? goalHoldProgressDisabled(goal);

  return (
    <>
      <Box display={{ base: "block", md: "none" }} width="full">
        <GoalLongPressRing
          layout="circle"
          onTap={onTap}
          onHoldComplete={onHoldComplete}
          holdDisabled={holdDisabled}
        >
          <GoalCardMobileCircle
            goal={goal}
            compact={compact}
            goldShimmerAnimate={goldShimmerAnimate}
          />
        </GoalLongPressRing>
      </Box>
      <Box display={{ base: "none", md: "block" }} width="full">
        <GoalLongPressRing
          layout="badge"
          onTap={onTap}
          onHoldComplete={onHoldComplete}
          holdDisabled={holdDisabled}
        >
          <GoalCardDesktopBadge
            goal={goal}
            compact={compact}
            goldShimmerAnimate={goldShimmerAnimate}
          />
        </GoalLongPressRing>
      </Box>
    </>
  );
}
