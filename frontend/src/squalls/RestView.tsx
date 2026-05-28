import { Heading, Text, VStack } from "@chakra-ui/react";

import HomeActionGrid from "./HomeActionGrid";
import SquallsActionCard from "./SquallsActionCard";
import { checkRest, getRestCost, REST_COMPLETE_MESSAGE } from "./shantiesRest";
import type { HeroType } from "./shantiesTypes";

type Props = {
  hero: HeroType;
  restComplete: boolean;
  restMessage: string | null;
  onRest: () => void;
  onWakeUp: () => void;
  onBack: () => void;
};

export default function RestView({
  hero,
  restComplete,
  restMessage,
  onRest,
  onWakeUp,
  onBack,
}: Props) {
  if (restComplete) {
    return (
      <VStack align="stretch" gap={4} w="100%">
        <Heading>💤 Ye Be Resting</Heading>
        <Text fontSize="sm">{REST_COMPLETE_MESSAGE}</Text>
        <SquallsActionCard
          emoji="⛵"
          label="Wake Up"
          accent="blue"
          onClick={onWakeUp}
        />
      </VStack>
    );
  }

  const cost = getRestCost(hero.level);
  const canRest = checkRest(hero).ok;

  return (
    <VStack align="stretch" gap={4} w="100%">
      <Heading>💤 Ye Be Resting</Heading>
      <HomeActionGrid>
        <SquallsActionCard
          emoji="🛏️"
          label={`Rest Up (costs: ${cost} gold)`}
          accent="purple"
          disabled={!canRest}
          onClick={onRest}
        />
        <SquallsActionCard
          emoji="🚪"
          label="Leave"
          accent="gray"
          onClick={onBack}
        />
      </HomeActionGrid>
      {restMessage ? (
        <Text fontSize="sm" color="fg.muted">
          {restMessage}
        </Text>
      ) : null}
    </VStack>
  );
}
