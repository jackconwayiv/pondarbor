import { HStack, Text } from "@chakra-ui/react";

import type { GoalsStripe } from "./types";
import { GOALS_THEME } from "./theme";

type GoalsProgressStripeProps = {
  stripe: GoalsStripe;
};

function fmt(actual: number, target: number): string {
  return `${actual} / ${target || "—"}`;
}

export function GoalsProgressStripe({ stripe }: GoalsProgressStripeProps) {
  const showWeek = stripe.week_target > 0;
  const showMonth = stripe.month_target > 0;

  return (
    <HStack
      width="full"
      justify={showWeek || showMonth ? "space-between" : "flex-start"}
      flexWrap="wrap"
      gap="2"
      px="2"
      py="2"
      borderRadius="md"
      bg={GOALS_THEME.lakeBlue}
      color="white"
      fontSize="sm"
      fontWeight="semibold"
    >
      <Text>Today {fmt(stripe.today_actual, stripe.today_target)}</Text>
      {showWeek ? <Text>Week {fmt(stripe.week_actual, stripe.week_target)}</Text> : null}
      {showMonth ? <Text>Month {fmt(stripe.month_actual, stripe.month_target)}</Text> : null}
    </HStack>
  );
}
