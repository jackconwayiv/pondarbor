import { Avatar, Box, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { useAppSession } from "../auth/AppSessionContext";
import type { WhatIfNpc, WhatIfPlayer } from "./types";
import { resolveWhatIfPlayerAvatarUrl } from "./whatifPlayerAvatar";
import {
  whatifAvatarEmojiBoxSize,
  whatifAvatarEmojiFontSize,
  whatifNpcRingColor,
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
  ringColor,
  avatarSize,
}: {
  children: ReactNode;
  ringColor?: string;
  avatarSize: WhatIfPlayerFaceRingSize;
}) {
  if (!ringColor) {
    return <>{children}</>;
  }
  const w = whatifSeatRingWidth(avatarSize);
  return (
    <Box
      display="inline-flex"
      borderRadius="full"
      flexShrink={0}
      boxShadow={`0 0 0 ${w}px ${ringColor}`}
    >
      {children}
    </Box>
  );
}

function EmojiAvatar({
  emoji,
  avatarSize,
  emojiFontSize,
  flexShrink,
}: {
  emoji: string;
  avatarSize: WhatIfPlayerFaceRingSize;
  emojiFontSize?: string;
  flexShrink?: number;
}) {
  const emojiBoxSize = whatifAvatarEmojiBoxSize(avatarSize);
  const resolvedEmojiFontSize = emojiFontSize ?? whatifAvatarEmojiFontSize(avatarSize);
  return (
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
        {emoji}
      </Text>
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
  const ringColor =
    seatIndex != null && seatIndex >= 0 ? whatifSeatRingColor(seatIndex) : undefined;
  const url = resolveWhatIfPlayerAvatarUrl(player, {
    viewerPlayerId,
    sessionUser,
    auth0User,
  });
  if (url) {
    return (
      <RingWrap ringColor={ringColor} avatarSize={avatarSize}>
        <Avatar.Root size={avatarSize} flexShrink={flexShrink}>
          <Avatar.Image src={url} alt="" />
          <Avatar.Fallback name={player.display_name}>{player.avatar_emoji}</Avatar.Fallback>
        </Avatar.Root>
      </RingWrap>
    );
  }
  return (
    <RingWrap ringColor={ringColor} avatarSize={avatarSize}>
      <EmojiAvatar
        emoji={player.avatar_emoji}
        avatarSize={avatarSize}
        emojiFontSize={emojiFontSize}
        flexShrink={flexShrink}
      />
    </RingWrap>
  );
}

type WhatIfNpcFaceProps = {
  npc: WhatIfNpc;
  avatarSize?: WhatIfPlayerFaceRingSize;
  emojiFontSize?: string;
  flexShrink?: number;
};

export function WhatIfNpcFace({
  npc,
  avatarSize = "md",
  emojiFontSize,
  flexShrink = 0,
}: WhatIfNpcFaceProps) {
  return (
    <RingWrap ringColor={whatifNpcRingColor()} avatarSize={avatarSize}>
      <EmojiAvatar
        emoji={npc.avatar_emoji}
        avatarSize={avatarSize}
        emojiFontSize={emojiFontSize}
        flexShrink={flexShrink}
      />
    </RingWrap>
  );
}
