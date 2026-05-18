import { Avatar, Box, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { useAppSession } from "../auth/AppSessionContext";
import type { WhatIfPlayer } from "./types";
import { resolveWhatIfPlayerAvatarUrl } from "./whatifPlayerAvatar";
import {
  whatifAvatarEmojiBoxSize,
  whatifAvatarEmojiFontSize,
  whatifSeatRingColor,
  whatifSeatRingWidth,
  type WhatIfPlayerFaceRingSize,
} from "./whatifPlayerSeatColors";

type WhatIfPlayerFaceProps = {
  player: WhatIfPlayer;
  /** Hand UI: set to `state.state.you?.id` so your tile uses profile + Google when API omits `avatar_url`. */
  viewerPlayerId?: number | null;
  /** Join-order seat index (0-based) for colored avatar ring. */
  seatIndex?: number;
  /** Chakra `Avatar.Root` size when a profile image exists. */
  avatarSize?: WhatIfPlayerFaceRingSize;
  emojiFontSize?: string;
  flexShrink?: number;
};

function RingWrap({
  children,
  seatIndex,
  avatarSize,
}: {
  children: ReactNode;
  seatIndex?: number;
  avatarSize: WhatIfPlayerFaceRingSize;
}) {
  if (seatIndex == null || seatIndex < 0) {
    return <>{children}</>;
  }
  const color = whatifSeatRingColor(seatIndex);
  const w = whatifSeatRingWidth(avatarSize);
  return (
    <Box
      display="inline-flex"
      borderRadius="full"
      flexShrink={0}
      boxShadow={`0 0 0 ${w}px ${color}`}
    >
      {children}
    </Box>
  );
}

export function WhatIfPlayerFace({
  player,
  viewerPlayerId = null,
  seatIndex,
  avatarSize = "md",
  emojiFontSize,
  flexShrink = 0,
}: WhatIfPlayerFaceProps) {
  const { sessionUser, auth0User } = useAppSession();
  const emojiBoxSize = whatifAvatarEmojiBoxSize(avatarSize);
  const resolvedEmojiFontSize = emojiFontSize ?? whatifAvatarEmojiFontSize(avatarSize);
  const url = resolveWhatIfPlayerAvatarUrl(player, {
    viewerPlayerId,
    sessionUser,
    auth0User,
  });
  if (url) {
    return (
      <RingWrap seatIndex={seatIndex} avatarSize={avatarSize}>
        <Avatar.Root size={avatarSize} flexShrink={flexShrink}>
          <Avatar.Image src={url} alt="" />
          <Avatar.Fallback name={player.display_name}>{player.avatar_emoji}</Avatar.Fallback>
        </Avatar.Root>
      </RingWrap>
    );
  }
  return (
    <RingWrap seatIndex={seatIndex} avatarSize={avatarSize}>
      <Box
        as="span"
        display="inline-flex"
        alignItems="center"
        justifyContent="center"
        flexShrink={flexShrink}
        w={emojiBoxSize}
        h={emojiBoxSize}
        minW={emojiBoxSize}
        minH={emojiBoxSize}
        lineHeight="1"
        bg="white"
        borderRadius="full"
        style={{ width: emojiBoxSize, height: emojiBoxSize, minWidth: emojiBoxSize, minHeight: emojiBoxSize }}
      >
        <Text
          as="span"
          fontSize={resolvedEmojiFontSize}
          lineHeight="1"
          style={{ fontSize: resolvedEmojiFontSize, lineHeight: 1 }}
        >
          {player.avatar_emoji}
        </Text>
      </Box>
    </RingWrap>
  );
}
