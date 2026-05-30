import { Text, VStack } from "@chakra-ui/react";

import { SquallsHeading } from "./SquallsHeading";

import {
  SquallsActionOption,
  SquallsActionSection,
  SquallsActionSheet,
} from "./SquallsActionSheet";
import { SQUALLS_TEXT_ZONE } from "./squallsTheme";
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
  leaveTone?: "retreat" | "explore";
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
  leaveTone = "retreat",
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
      <SquallsHeading size="md">{headingEmoji} {event.name}</SquallsHeading>
      <Text fontSize="sm" color={SQUALLS_TEXT_ZONE.muted}>
        The chest is locked tight. Ye can spend tools, risk brute force, or turn away.
      </Text>
      <SquallsActionSheet title="Chest Tactics">
        <SquallsActionSection label="Supplies And Services">
          {hasKey ? (
            <SquallsActionOption
              emoji="🗝️"
              title="Use key"
              detail="Guaranteed access at the cost of one key."
              tone="service"
              onClick={onUnlockWithKey}
            />
          ) : null}
          {hasLockpick ? (
            <SquallsActionOption
              emoji="🪝"
              title="Pick the lock"
              detail="Use lockpicks and skill to avoid brute force."
              tone="explore"
              onClick={onPickLock}
            />
          ) : null}
        </SquallsActionSection>
        <SquallsActionSection label="Risk And Force">
          {!forceOpenDisabled ? (
            <SquallsActionOption
              emoji="💪"
              title="Force it open"
              detail="Risk a rough entry and potential consequences."
              tone="risk"
              onClick={onForceOpen}
            />
          ) : null}
        </SquallsActionSection>
        <SquallsActionSection label="Retreat And Return">
          <SquallsActionOption
            emoji={leaveEmoji}
            title={leaveLabel}
            detail="Leave the chest and preserve resources."
            tone={leaveTone}
            onClick={onLeave}
          />
        </SquallsActionSection>
      </SquallsActionSheet>
      {message ? (
        <Text fontSize="sm" color={SQUALLS_TEXT_ZONE.muted}>
          {message}
        </Text>
      ) : null}
    </VStack>
  );
}
