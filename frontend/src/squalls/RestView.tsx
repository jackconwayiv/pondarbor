import { Text, VStack } from "@chakra-ui/react";

import { SquallsHeading } from "./SquallsHeading";

import {
  SquallsActionOption,
  SquallsActionSection,
  SquallsActionSheet,
  SquallsTextZone,
} from "./SquallsActionSheet";
import { checkRest, getRestCost, REST_COMPLETE_MESSAGE } from "./shantiesRest";
import type { HeroType } from "./shantiesTypes";
import { SQUALLS_WORLD_PANEL } from "./squallsTheme";

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
      <VStack
        align="stretch"
        gap={4}
        w="100%"
        {...SQUALLS_WORLD_PANEL}
        p={{ base: 3, md: 4 }}
      >
        <SquallsHeading>💤 Ye Be Resting</SquallsHeading>
        <SquallsTextZone>
          <Text fontSize="sm" color="#5A4732">
            {REST_COMPLETE_MESSAGE}
          </Text>
        </SquallsTextZone>
        <SquallsActionSheet title="Rest Complete">
          <SquallsActionSection label="Retreat And Return">
            <SquallsActionOption
              emoji="⛵"
              title="Wake and return to duty"
              detail="Break camp and continue the voyage."
              tone="retreat"
              onClick={onWakeUp}
            />
          </SquallsActionSection>
        </SquallsActionSheet>
      </VStack>
    );
  }

  const cost = getRestCost(hero.max_hp);
  const canRest = checkRest(hero).ok;

  return (
    <VStack
      align="stretch"
      gap={4}
      w="100%"
      {...SQUALLS_WORLD_PANEL}
      p={{ base: 3, md: 4 }}
    >
      <SquallsHeading>💤 Ye Be Resting</SquallsHeading>
      <SquallsActionSheet title="Campfire Decisions">
        <SquallsActionSection label="Supplies And Services">
          <SquallsActionOption
            emoji="🛏️"
            title={`Rest up (${cost} gold)`}
            detail="Spend coin to recover before pushing farther."
            tone="service"
            disabled={!canRest}
            onClick={onRest}
          />
        </SquallsActionSection>
        <SquallsActionSection label="Retreat And Return">
          <SquallsActionOption
            emoji="🚪"
            title="Leave the bunkhouse"
            detail="Save yer gold and head back out."
            tone="retreat"
            onClick={onBack}
          />
        </SquallsActionSection>
      </SquallsActionSheet>
      {restMessage ? (
        <SquallsTextZone>
          <Text fontSize="sm" color="#5A4732">
            {restMessage}
          </Text>
        </SquallsTextZone>
      ) : null}
    </VStack>
  );
}
