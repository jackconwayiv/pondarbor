import { Box, Button, HStack, Heading, Text, VStack } from "@chakra-ui/react";

import { getItemCount } from "./shantiesItems";
import type { EventType, HeroType } from "./shantiesTypes";

type Props = {
  event: EventType;
  hero: HeroType;
  message: string | null;
  onUnlockWithKey: () => void;
  onForceOpen: () => void;
  onLeave: () => void;
};

export default function LockedChestPanel({
  event,
  hero,
  message,
  onUnlockWithKey,
  onForceOpen,
  onLeave,
}: Props) {
  const keyCount = getItemCount(hero.inventory, "key");
  const hasKey = keyCount > 0;

  return (
    <VStack align="start" gap={4} w="100%" maxW="md">
      <Heading size="md">🔒 {event.name}</Heading>
      <Text fontSize="lg">
        The chest is locked. Use a key, or try to break it open.
      </Text>
      <HStack gap={2} wrap="wrap">
        <Button
          colorPalette="teal"
          disabled={!hasKey}
          opacity={hasKey ? 1 : 0.5}
          onClick={onUnlockWithKey}
        >
          Use Key{hasKey ? "" : " (none)"}
        </Button>
        <Button variant="outline" onClick={onForceOpen}>
          Force open
        </Button>
        <Button variant="ghost" onClick={onLeave}>
          Leave it
        </Button>
      </HStack>
      {message ? (
        <Box w="100%">
          <Text fontSize="sm" color="fg.muted">
            {message}
          </Text>
        </Box>
      ) : null}
    </VStack>
  );
}
