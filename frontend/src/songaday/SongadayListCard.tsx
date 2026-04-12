import { Box, HStack, Image, Stack, Text } from "@chakra-ui/react";
import type { MouseEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES, MAPPED_LIST_CARD_OUTER_PROPS } from "../theme/typography";
import { cleanStreamingTitleLine, songadayEntryTitleLine } from "./cleanSongLabel";
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
  heartBusy?: boolean;
  onHeartToggle?: (entryId: number) => void;
  /** Non-interactive card (no link); use for inline read-only preview */
  readOnly?: boolean;
  /** Shown below the card body when `readOnly` (legacy; unused on prompt page) */
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
  const navigate = useNavigate();
  const { sessionUser, auth0User } = useAppSession();
  const isMine = entry.user.id === myUserId;
  const [mediaExpanded, setMediaExpanded] = useState(false);

  useEffect(() => {
    setMediaExpanded(false);
  }, [entry.id]);

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

  const notesText = entry.notes.trim();
  const notesBlock =
    notesText.length > 0 ? (
      <Text whiteSpace="pre-wrap" fontSize={APP_TEXT_SIZES.helper} lineHeight="tall" color="fg">
        {notesText}
      </Text>
    ) : null;

  const titleClean = cleanStreamingTitleLine(entry.title);
  const artistClean = cleanStreamingTitleLine(entry.artist);
  const showTitleArtistLines = !!(titleClean || artistClean);

  const mineCollapsedMeta = (
    <Stack gap="1" w="full">
      {showTitleArtistLines ? (
        <>
          {titleClean ? (
            <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.body} lineClamp={3}>
              {titleClean}
            </Text>
          ) : null}
          {artistClean ? (
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" lineClamp={2}>
              {artistClean}
            </Text>
          ) : null}
        </>
      ) : (
        <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.helper} lineClamp={3}>
          {songadayEntryTitleLine(entry)}
        </Text>
      )}
      {notesBlock}
    </Stack>
  );

  const stopCardNav = (e: MouseEvent) => {
    e.stopPropagation();
  };

  const heartBox = (
    <Box
      flexShrink={0}
      alignSelf="flex-start"
      lineHeight="1"
      onClick={readOnly && isMine ? stopCardNav : undefined}
    >
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
  );

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
      {heartBox}
    </HStack>
  );

  const openEditor = () => {
    navigate(detailPath, { state: detailState });
  };

  let cardBody: ReactNode;

  if (readOnly && isMine) {
    cardBody = (
      <Stack flex="1" display="flex" flexDirection="column" gap="2">
        {headerRow}
        {!mediaExpanded ? (
          <>
            {mineCollapsedMeta}
            <PondButton
              type="button"
              variant="outline"
              colorPalette="lilypad"
              w="full"
              onClick={(e) => {
                e.stopPropagation();
                setMediaExpanded(true);
              }}
            >
              Show player
            </PondButton>
          </>
        ) : (
          <Box onClick={stopCardNav}>
            <SongadayMediaBlock entry={entry} compact autoplayOnMount />
          </Box>
        )}
        {footer ? <Box pt="2">{footer}</Box> : null}
      </Stack>
    );
  } else {
    cardBody = (
      <Stack flex="1" display="flex" flexDirection="column" gap="2">
        {headerRow}
        {notesBlock}
        <SongadayMediaBlock entry={entry} compact />
      </Stack>
    );
  }

  const card = (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor="border"
      borderRadius="xl"
      overflow="hidden"
      h="auto"
      cursor={readOnly && isMine ? "pointer" : undefined}
      {...MAPPED_LIST_CARD_OUTER_PROPS}
      _hover={
        readOnly && isMine
          ? { borderColor: "lilypad.solid" }
          : readOnly
            ? undefined
            : { borderColor: "lilypad.solid" }
      }
    >
      {cardBody}
    </Box>
  );

  if (readOnly && isMine) {
    return (
      <Box onClick={openEditor} cursor="pointer" aria-label="Open submission editor">
        {card}
      </Box>
    );
  }

  return card;
}
