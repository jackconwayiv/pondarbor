import { Box, HStack, Stack, Text } from "@chakra-ui/react";

import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";
import type { ScorenadoSeatInvite } from "./types";

export function scorenadoSeatInviteInboxId(playerId: string): string {
  return `scorenado-seat-invite-${playerId}`;
}

type ScorenadoSeatInviteCardProps = {
  invite: ScorenadoSeatInvite;
  unread: boolean;
  busy?: boolean;
  onAccept: () => void | Promise<void>;
  onDecline: () => void | Promise<void>;
};

export function ScorenadoSeatInviteCard({
  invite,
  unread,
  busy = false,
  onAccept,
  onDecline,
}: ScorenadoSeatInviteCardProps) {
  return (
    <Box
      bg={unread ? "bg.panel" : "bg.subtle"}
      borderWidth="1px"
      borderColor={unread ? "lilypad.muted" : "border.muted"}
      borderLeftWidth={unread ? "3px" : "1px"}
      borderLeftColor={unread ? "lilypad.solid" : undefined}
      borderRadius="xl"
      p="3"
    >
      <Stack gap="2">
        <Text
          fontSize={APP_TEXT_SIZES.body}
          fontWeight={unread ? "semibold" : "medium"}
        >
          {invite.owner_label} invited you to{" "}
          <strong>{invite.slot_display_name}</strong> in {invite.game_title}.
        </Text>
        <HStack gap="2" flexWrap="wrap">
          <PondButton
            size="sm"
            colorPalette="lilypad"
            loading={busy}
            disabled={busy}
            onClick={() => void onAccept()}
          >
            Accept
          </PondButton>
          <PondButton
            size="sm"
            variant="outline"
            colorPalette="gray"
            disabled={busy}
            onClick={() => void onDecline()}
          >
            Decline
          </PondButton>
        </HStack>
      </Stack>
    </Box>
  );
}
