import { Box, HStack, Image, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES, MAPPED_LIST_CARD_OUTER_PROPS } from "../theme/typography";
import { songadayEntryTitleLine } from "./cleanSongLabel";
import SongadayHeartButton from "./SongadayHeartButton";
import SongadayHeartReadOnly, { SongadayHeartReadOnlyBlockLink } from "./SongadayHeartReadOnly";
import SongadayMediaBlock from "./SongadayMediaBlock";
import type { SongadayResponse } from "./types";

function UserAvatarBlock({
  avatar,
  label,
  boxSize = "48px",
}: {
  avatar: string;
  label: string;
  /** e.g. `40px` for denser list cards */
  boxSize?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [avatar]);
  const src = avatar.trim();
  const initial = label.slice(0, 1).toUpperCase();
  if (!src || failed) {
    return (
      <Stack
        boxSize={boxSize}
        borderRadius="full"
        bg="gray.200"
        alignItems="center"
        justifyContent="center"
        fontWeight="bold"
        flexShrink={0}
        fontSize={boxSize === "40px" ? "sm" : "md"}
      >
        {initial}
      </Stack>
    );
  }
  return (
    <Image
      src={src}
      alt=""
      boxSize={boxSize}
      borderRadius="full"
      objectFit="cover"
      flexShrink={0}
      onError={() => setFailed(true)}
    />
  );
}

type Props = {
  entry: SongadayResponse;
  returnTo: string;
  myUserId: number;
  /**
   * Responses list: your card starts collapsed (no embeds); tap to expand and load the player.
   * Ignored when `readOnly` or the entry is not yours.
   */
  collapseOwnMedia?: boolean;
  heartBusy?: boolean;
  onHeartToggle?: (entryId: number) => void;
  /** Non-interactive card (no link); use for inline read-only preview */
  readOnly?: boolean;
  /** Shown below the card body when `readOnly` (e.g. edit / view responses actions) */
  footer?: ReactNode;
};

export default function SongadayListCard({
  entry,
  returnTo,
  myUserId,
  collapseOwnMedia,
  heartBusy,
  onHeartToggle,
  readOnly,
  footer,
}: Props) {
  const { sessionUser, auth0User } = useAppSession();
  const isMine = entry.user.id === myUserId;
  const useCollapsibleMine = !!collapseOwnMedia && isMine && !readOnly;
  const [mediaExpanded, setMediaExpanded] = useState(false);
  /** Match navbar: profile URL, then Auth0 picture; API payload only has DB profile (often stale vs Auth0). */
  const apiAvatar = (entry.user.avatar_url || "").trim();
  const sessionId = sessionUser?.user.id;
  const avatar =
    sessionId != null && entry.user.id === sessionId
      ? (sessionUser?.profile?.avatar_url ?? "").trim() ||
        (auth0User?.picture ?? "").trim() ||
        apiAvatar
      : apiAvatar;
  const label = entry.user.nickname || entry.user.email.split("@")[0];

  const detailPath = `/songaday/entries/${entry.id}`;
  const detailState = { songadayReturnTo: returnTo };

  const headerRow = (
    <HStack gap="2" align="flex-start" w="full">
      <UserAvatarBlock avatar={avatar} label={label} boxSize="40px" />
      <Stack gap="0" flex="1" minW={0} align="stretch">
        <Text fontWeight="bold" fontSize={APP_TEXT_SIZES.label} lineClamp={1}>
          {label}
        </Text>
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" lineClamp={2}>
          {entry.prompt_snapshot}
        </Text>
      </Stack>
      <Box flexShrink={0} alignSelf="flex-start" lineHeight="1">
        {isMine ? (
          readOnly ? (
            <SongadayHeartReadOnly heartCount={entry.heart_count} />
          ) : (
            <SongadayHeartReadOnlyBlockLink heartCount={entry.heart_count} />
          )
        ) : onHeartToggle ? (
          <SongadayHeartButton
            heartCount={entry.heart_count}
            viewerHasHearted={entry.viewer_has_hearted}
            busy={heartBusy}
            onToggle={() => onHeartToggle(entry.id)}
          />
        ) : null}
      </Box>
    </HStack>
  );

  const cardBody = (
    <Stack flex="1" display="flex" flexDirection="column" gap="2">
      {useCollapsibleMine ? (
        <>
          <RouterLink
            to={detailPath}
            state={detailState}
            style={{
              textDecoration: "none",
              color: "inherit",
              display: "block",
              minHeight: 0,
            }}
          >
            {headerRow}
          </RouterLink>
          {mediaExpanded ? (
            <SongadayMediaBlock entry={entry} compact autoplayOnMount />
          ) : (
            <>
              <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.helper} lineClamp={3}>
                {songadayEntryTitleLine(entry)}
              </Text>
              <PondButton
                type="button"
                variant="outline"
                colorPalette="lilypad"
                w="full"
                onClick={() => setMediaExpanded(true)}
              >
                Show player
              </PondButton>
            </>
          )}
        </>
      ) : (
        <>
          {headerRow}
          <SongadayMediaBlock entry={entry} compact />
        </>
      )}
      {readOnly && footer ? <Box pt="2">{footer}</Box> : null}
    </Stack>
  );

  const card = (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor="border"
      borderRadius="xl"
      overflow="hidden"
      h="auto"
      cursor={readOnly ? "default" : undefined}
      {...MAPPED_LIST_CARD_OUTER_PROPS}
      _hover={readOnly ? undefined : { borderColor: "lilypad.solid" }}
    >
      {cardBody}
    </Box>
  );

  if (readOnly) {
    return card;
  }

  if (useCollapsibleMine) {
    return card;
  }

  return (
    <RouterLink
      to={detailPath}
      state={detailState}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "block",
        minHeight: 0,
      }}
    >
      {card}
    </RouterLink>
  );
}
