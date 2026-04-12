import { Box, HStack, Image, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { APP_TEXT_SIZES, MAPPED_LIST_CARD_OUTER_PROPS } from "../theme/typography";
import SongadayHeartButton from "./SongadayHeartButton";
import SongadayHeartReadOnly, { SongadayHeartReadOnlyBlockLink } from "./SongadayHeartReadOnly";
import SongadayMediaBlock from "./SongadayMediaBlock";
import type { SongadayResponse } from "./types";

function UserAvatarBlock({ avatar, label }: { avatar: string; label: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [avatar]);
  const src = avatar.trim();
  const initial = label.slice(0, 1).toUpperCase();
  if (!src || failed) {
    return (
      <Stack
        boxSize="48px"
        borderRadius="full"
        bg="gray.200"
        alignItems="center"
        justifyContent="center"
        fontWeight="bold"
        flexShrink={0}
      >
        {initial}
      </Stack>
    );
  }
  return (
    <Image
      src={src}
      alt=""
      boxSize="48px"
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
  heartBusy,
  onHeartToggle,
  readOnly,
  footer,
}: Props) {
  const { sessionUser, auth0User } = useAppSession();
  const isMine = entry.user.id === myUserId;
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

  const card = (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor="border"
      borderRadius="xl"
      overflow="hidden"
      h={readOnly ? "auto" : "100%"}
      cursor={readOnly ? "default" : undefined}
      {...MAPPED_LIST_CARD_OUTER_PROPS}
      _hover={readOnly ? undefined : { borderColor: "lilypad.solid" }}
    >
      <Stack flex="1" display="flex" flexDirection="column" gap="3">
        <HStack gap="3" align="flex-start">
          <UserAvatarBlock avatar={avatar} label={label} />
          <Stack gap="0" flex="1" minW={0}>
            <Text fontWeight="bold" fontSize={APP_TEXT_SIZES.label} lineClamp={2}>
              {label}
            </Text>
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" lineClamp={3}>
              {entry.prompt_snapshot}
            </Text>
          </Stack>
        </HStack>
        <SongadayMediaBlock entry={entry} />
        <HStack justify="space-between" align="center" flexWrap="wrap" gap="2" mt="auto" pt="2">
          {entry.edited ? (
            <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
              Edited
            </Text>
          ) : (
            <span />
          )}
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
          ) : (
            <span />
          )}
        </HStack>
        {readOnly && footer ? <Box pt="3">{footer}</Box> : null}
      </Stack>
    </Box>
  );

  if (readOnly) {
    return card;
  }

  return (
    <RouterLink
      to={`/songaday/entries/${entry.id}`}
      state={{ songadayReturnTo: returnTo }}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "block",
        height: "100%",
        minHeight: 0,
      }}
    >
      {card}
    </RouterLink>
  );
}
