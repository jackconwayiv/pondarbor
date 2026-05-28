import { Heading, Text, VStack } from "@chakra-ui/react";

import HomeActionGrid from "./HomeActionGrid";
import SquallsActionCard from "./SquallsActionCard";
import { checkRest, getRestCost } from "./shantiesRest";
import type { HeroType } from "./shantiesTypes";

type Props = {
  hero: HeroType;
  restMessage: string | null;
  onRest: () => void;
  onBack: () => void;
};

export default function RestView({
  hero,
  restMessage,
  onRest,
  onBack,
}: Props) {
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
