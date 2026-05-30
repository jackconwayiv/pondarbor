import { Heading, Text, VStack } from "@chakra-ui/react";

import {
  canCookAtStove,
  countRawCookables,
  hasCookstoveWood,
} from "./cookstove";
import HomeActionGrid from "./HomeActionGrid";
import SquallsActionCard from "./SquallsActionCard";
import { getItemCount } from "./shantiesItems";
import type { HeroType } from "./shantiesTypes";

type Props = {
  hero: HeroType;
  cookMessage: string | null;
  onCook: () => void;
  onDismiss: () => void;
};

export default function CookstoveView({
  hero,
  cookMessage,
  onCook,
  onDismiss,
}: Props) {
  const hasWood = hasCookstoveWood(hero.inventory);
  const rawCount = countRawCookables(hero.inventory);
  const canCook = canCookAtStove(hero);
  const rawFish = getItemCount(hero.inventory, "raw_fish");
  const rawMeat = getItemCount(hero.inventory, "raw_meat");

  return (
    <VStack align="stretch" gap={4} w="100%">
      <Heading>🍳 Cookstove</Heading>
      <Text fontSize="sm" color="gray.900">
        A sturdy stove for turning yer catch into a proper meal. Spend 1 wood plank
        to cook all raw fish and raw meat ye carry.
      </Text>
      {hasWood ? (
        <Text fontSize="sm" color="gray.900">
          Raw fish: {rawFish} · Raw meat: {rawMeat}
        </Text>
      ) : null}
      <HomeActionGrid>
        {hasWood ? (
          <>
            <SquallsActionCard
              emoji="🔥"
              label="Cook (1 Wood Plank)"
              accent="orange"
              disabled={!canCook}
              onClick={onCook}
            />
            <SquallsActionCard
              emoji="⛵"
              label="Not Now"
              accent="blue"
              onClick={onDismiss}
            />
          </>
        ) : (
          <SquallsActionCard
            emoji="⛵"
            label="Not Now"
            accent="blue"
            onClick={onDismiss}
          />
        )}
      </HomeActionGrid>
      {hasWood && rawCount === 0 ? (
        <Text fontSize="sm" color="gray.900">
          Ye've no raw fish or meat to cook.
        </Text>
      ) : null}
      {cookMessage ? (
        <Text fontSize="sm" color="gray.900">
          {cookMessage}
        </Text>
      ) : null}
    </VStack>
  );
}
