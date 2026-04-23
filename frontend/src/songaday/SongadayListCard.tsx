import { Box, HStack, Image, Stack, Text } from "@chakra-ui/react";
import type { MouseEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { APP_TEXT_SIZES, MAPPED_LIST_CARD_OUTER_PROPS } from "../theme/typography";
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
  myUserId: number;
  heartBusy?: boolean;
  onHeartToggle?: (entryId: number) => void;
  /** Non-interactive card (no link); use for inline read-only preview */
  readOnly?: boolean;
  /** Shown below the card body (owner read-only card or friend card with inline comments). */
  footer?: ReactNode;
  /** Own card: toggle inline submission editor (parent renders editor). */
  onMineCardClick?: () => void;
  /** Highlights own card while submission editor is open. */
  submissionEditOpen?: boolean;
};

export default function SongadayListCard({
  entry,
  myUserId,
  heartBusy,
  onHeartToggle,
  readOnly,
  footer,
  onMineCardClick,
  submissionEditOpen,
}: Props) {
  const { sessionUser, auth0User } = useAppSession();
  const isMine = entry.user.id === myUserId;

  const apiAvatar = (entry.user.avatar_url || "").trim();
  const sessionId = sessionUser?.user.id;
  const avatar =
    sessionId != null && entry.user.id === sessionId
      ? (sessionUser?.profile?.avatar_url ?? "").trim() ||
        (auth0User?.picture ?? "").trim() ||
        apiAvatar
      : apiAvatar;
  const label = entry.user.nickname || entry.user.email.split("@")[0];

  const notesText = entry.notes.trim();
  const notesBlock =
    notesText.length > 0 ? (
      <Text whiteSpace="pre-wrap" fontSize={APP_TEXT_SIZES.helper} lineHeight="tall" color="fg">
        {notesText}
      </Text>
    ) : null;

  const stopCardNav = (e: MouseEvent) => {
    e.stopPropagation();
  };

  const heartBox = (
    <HStack
      gap="2"
      flexShrink={0}
      alignSelf="flex-start"
      onClick={readOnly && isMine ? stopCardNav : undefined}
    >
      {isMine ? (
        readOnly ? (
          <SongadayHeartReadOnly heartCount={entry.heart_count} plain />
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
    </HStack>
  );

  const avatarEl = <UserAvatarBlock avatar={avatar} label={label} boxSize="40px" />;

  const headerRow = (
    <HStack gap="2" align="flex-start" w="full">
      {!isMine ? (
        <RouterLink
          to={`/friend/${entry.user.id}`}
          onClick={(e) => {
            e.stopPropagation();
          }}
          style={{ flexShrink: 0, textDecoration: "none", color: "inherit" }}
        >
          {avatarEl}
        </RouterLink>
      ) : (
        avatarEl
      )}
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

  const cardBody =
    readOnly && isMine ? (
      <Stack flex="1" display="flex" flexDirection="column" gap="2">
        {headerRow}
        {notesBlock}
        <Box onClick={stopCardNav}>
          <SongadayMediaBlock entry={entry} compact />
        </Box>
        {footer ? <Box onClick={stopCardNav}>{footer}</Box> : null}
      </Stack>
    ) : (
      <Stack flex="1" display="flex" flexDirection="column" gap="2">
        {headerRow}
        {notesBlock}
        <Box onClick={footer ? stopCardNav : undefined}>
          <SongadayMediaBlock entry={entry} compact />
        </Box>
        {footer ? (
          <Box onClick={stopCardNav}>
            {footer}
          </Box>
        ) : null}
      </Stack>
    );

  const card = (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor={submissionEditOpen && isMine ? "teal.solid" : "border"}
      borderRadius="xl"
      overflow="hidden"
      cursor={readOnly && isMine ? "pointer" : undefined}
      {...MAPPED_LIST_CARD_OUTER_PROPS}
      _hover={
        readOnly && isMine
          ? { borderColor: "teal.solid" }
          : readOnly
            ? undefined
            : { borderColor: "teal.solid" }
      }
    >
      {cardBody}
    </Box>
  );

  if (readOnly && isMine) {
    return (
      <Box
        onClick={() => onMineCardClick?.()}
        cursor="pointer"
        aria-label="Toggle submission editor"
        role="button"
      >
        {card}
      </Box>
    );
  }

  return card;
}
