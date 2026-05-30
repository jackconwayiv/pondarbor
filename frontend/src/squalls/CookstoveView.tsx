import { Text, VStack } from "@chakra-ui/react";

import { SquallsHeading } from "./SquallsHeading";

import {
  canCookAtStove,
  countRawCookables,
  hasCookstoveWood,
} from "./cookstove";
import {
  SquallsActionOption,
  SquallsActionSection,
  SquallsActionSheet,
  SquallsTextZone,
} from "./SquallsActionSheet";
import { getItemCount } from "./shantiesItems";
import type { HeroType } from "./shantiesTypes";
import { SQUALLS_WORLD_PANEL } from "./squallsTheme";

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
    <VStack align="stretch" gap={4} w="100%" {...SQUALLS_WORLD_PANEL} p={{ base: 3, md: 4 }}>
      <SquallsHeading>🍳 Cookstove</SquallsHeading>
      <SquallsTextZone>
        <Text fontSize="sm" color="#5A4732">
          A sturdy stove for turning yer catch into a proper meal. Spend one wood plank
          to cook all raw fish and raw meat ye carry.
        </Text>
      </SquallsTextZone>
      {hasWood ? (
        <SquallsTextZone>
          <Text fontSize="sm" color="#5A4732">
            Raw fish: {rawFish} · Raw meat: {rawMeat}
          </Text>
        </SquallsTextZone>
      ) : null}
      <SquallsActionSheet title="Galley Orders">
        {hasWood ? (
          <SquallsActionSection label="Supplies And Services">
            <SquallsActionOption
              emoji="🔥"
              title="Cook provisions (1 wood plank)"
              detail="Convert all raw fish and meat into ready meals."
              tone="service"
              disabled={!canCook}
              onClick={onCook}
            />
          </SquallsActionSection>
        ) : null}
        <SquallsActionSection label="Retreat And Return">
          <SquallsActionOption
            emoji="⛵"
            title="Not now"
            detail="Step away from the stove and continue the journey."
            tone="retreat"
            onClick={onDismiss}
          />
        </SquallsActionSection>
      </SquallsActionSheet>
      {hasWood && rawCount === 0 ? (
        <SquallsTextZone>
          <Text fontSize="sm" color="#5A4732">
            Ye've no raw fish or meat to cook.
          </Text>
        </SquallsTextZone>
      ) : null}
      {cookMessage ? (
        <SquallsTextZone>
          <Text fontSize="sm" color="#5A4732">
            {cookMessage}
          </Text>
        </SquallsTextZone>
      ) : null}
    </VStack>
  );
}
