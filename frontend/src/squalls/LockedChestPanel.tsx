import { Box, Heading, Text, VStack } from "@chakra-ui/react";

import HomeActionGrid from "./HomeActionGrid";
import SquallsActionCard, {
  type SquallsActionAccent,
} from "./SquallsActionCard";
import { heroHasLockpickEquipped } from "./shantiesEquipment";
import { getItemCount } from "./shantiesItems";
import type { EventType, HeroType } from "./shantiesTypes";

type Props = {
  event: EventType;
  hero: HeroType;
  message: string | null;
  headingEmoji?: string;
  leaveEmoji?: string;
  leaveLabel?: string;
  leaveAccent?: SquallsActionAccent;
  onUnlockWithKey: () => void;
  onPickLock: () => void;
  onForceOpen: () => void;
  forceOpenDisabled?: boolean;
  onLeave: () => void;
};

export default function LockedChestPanel({
  event,
  hero,
  message,
  headingEmoji = "🔒",
  leaveEmoji = "🚪",
  leaveLabel = "Leave it",
  leaveAccent = "gray",
  onUnlockWithKey,
  onPickLock,
  onForceOpen,
  forceOpenDisabled = false,
  onLeave,
}: Props) {
  const keyCount = getItemCount(hero.inventory, "key");
  const hasKey = keyCount > 0;
  const hasLockpick = heroHasLockpickEquipped(hero);

  return (
    <VStack align="start" gap={4} w="100%" maxW="md">
      <Heading size="md">{headingEmoji} {event.name}</Heading>
      <Text fontSize="lg">
        The chest is locked. Use a key, pick the lock, or try to break it open.
      </Text>
      <HomeActionGrid>
        {hasKey ? (
          <SquallsActionCard
            emoji="🗝️"
            label="Use Key"
            accent="teal"
            onClick={onUnlockWithKey}
          />
        ) : null}
        {hasLockpick ? (
          <SquallsActionCard
            emoji="🪝"
            label="Pick the Lock"
            accent="blue"
            onClick={onPickLock}
          />
        ) : null}
        {!forceOpenDisabled ? (
          <SquallsActionCard
            emoji="💪"
            label="Force Open"
            accent="orange"
            onClick={onForceOpen}
          />
        ) : null}
        <SquallsActionCard
          emoji={leaveEmoji}
          label={leaveLabel}
          accent={leaveAccent}
          onClick={onLeave}
        />
      </HomeActionGrid>
      {message ? (
        <Box w="100%">
          <Text fontSize="sm" color="gray.900">
            {message}
          </Text>
        </Box>
      ) : null}
    </VStack>
  );
}
