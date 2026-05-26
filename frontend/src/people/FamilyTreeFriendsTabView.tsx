import { Avatar, HStack, Heading, Stack, Tabs, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";

import { resolveAvatarUrlForUser, useAppSession } from "../auth/AppSessionContext";
import FriendProfileLink from "../friend/FriendProfileLink";
import PondButton from "../PondButton";
import PondNativeSelect from "../components/PondNativeSelect";
import {
  APP_SHELL_TAB_LIST_NESTED_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import { APP_TEXT_SIZES } from "../theme/typography";
import { useIsMobile } from "../responsive";
import type { FriendWithFamilyTree } from "./api";

/** Desktop friend tab grid: two rows of five. */
export const FRIEND_TREE_TABS_PER_PAGE = 10;
const FRIEND_TREE_TABS_COLUMNS = 5;

export type FamilyTreeFriendsTabViewProps = {
  friends: FriendWithFamilyTree[];
  selectedFriendId: number | null;
  onSelectFriendId: (friendId: number) => void;
  friendsLoadError?: string | null;
  friendSelectionError?: string | null;
  renderTreePanel: (friend: FriendWithFamilyTree) => ReactNode;
};

function FriendTreeOwnerHeading({ friend }: { friend: FriendWithFamilyTree }) {
  const { sessionUser, auth0User } = useAppSession();
  const avatarSrc =
    resolveAvatarUrlForUser(friend.avatar_url, friend.id, sessionUser, auth0User) ||
    friend.avatar_url ||
    undefined;

  return (
    <HStack gap="2" align="center" flexWrap="wrap">
      <FriendProfileLink userId={friend.id}>
        <Avatar.Root size="sm">
          <Avatar.Fallback name={friend.nickname} />
          {avatarSrc ? <Avatar.Image src={avatarSrc} /> : null}
        </Avatar.Root>
      </FriendProfileLink>
      <Heading as="h2" size="sm" color="fg" fontWeight="semibold">
        <FriendProfileLink userId={friend.id}>{friend.nickname}</FriendProfileLink>
        <Text as="span" fontWeight="normal" color="fg.muted">
          {" · Family tree"}
        </Text>
      </Heading>
    </HStack>
  );
}

function FriendTabLabel({ nickname }: { nickname: string }) {
  return (
    <Text
      as="span"
      lineClamp={1}
      w="100%"
      textAlign="center"
      title={nickname}
    >
      {nickname}
    </Text>
  );
}

export default function FamilyTreeFriendsTabView({
  friends,
  selectedFriendId,
  onSelectFriendId,
  friendsLoadError,
  friendSelectionError,
  renderTreePanel,
}: FamilyTreeFriendsTabViewProps) {
  const isMobile = useIsMobile();
  const [tabPage, setTabPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(friends.length / FRIEND_TREE_TABS_PER_PAGE));

  const selectedFriend = useMemo(
    () => (selectedFriendId != null ? friends.find((f) => f.id === selectedFriendId) ?? null : null),
    [friends, selectedFriendId],
  );

  useEffect(() => {
    if (selectedFriendId == null) return;
    const index = friends.findIndex((f) => f.id === selectedFriendId);
    if (index < 0) return;
    setTabPage(Math.floor(index / FRIEND_TREE_TABS_PER_PAGE));
  }, [friends, selectedFriendId]);

  useEffect(() => {
    setTabPage((p) => Math.min(p, pageCount - 1));
  }, [pageCount]);

  const pageFriends = useMemo(() => {
    const start = tabPage * FRIEND_TREE_TABS_PER_PAGE;
    return friends.slice(start, start + FRIEND_TREE_TABS_PER_PAGE);
  }, [friends, tabPage]);

  const tabValue = selectedFriendId != null ? String(selectedFriendId) : "";

  const errorMessages = (
    <>
      {friendsLoadError ? (
        <Text role="alert" fontSize={APP_TEXT_SIZES.helper} color="nautical.solid">
          {friendsLoadError}
        </Text>
      ) : null}
      {friendSelectionError ? (
        <Text role="alert" fontSize={APP_TEXT_SIZES.helper} color="nautical.solid">
          {friendSelectionError}
        </Text>
      ) : null}
    </>
  );

  if (friends.length === 0) {
    return null;
  }

  if (isMobile) {
    return (
      <Stack gap="3">
        {errorMessages}
        <PondNativeSelect
          rootProps={{ size: "sm", w: "100%" }}
          fieldProps={{
            value: selectedFriendId != null ? String(selectedFriendId) : "",
            onChange: (e: ChangeEvent<HTMLSelectElement>) => {
              const raw = e.target.value;
              if (raw !== "") onSelectFriendId(Number(raw));
            },
          }}
        >
          {selectedFriendId == null ? (
            <option value="">Select a friend&apos;s tree…</option>
          ) : null}
          {friends.map((f) => (
            <option key={f.id} value={String(f.id)}>
              {f.nickname}
            </option>
          ))}
        </PondNativeSelect>
        {selectedFriend ? (
          <Stack gap="2">
            <FriendTreeOwnerHeading friend={selectedFriend} />
            {renderTreePanel(selectedFriend)}
          </Stack>
        ) : (
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
            Select a friend to view their family tree.
          </Text>
        )}
      </Stack>
    );
  }

  return (
    <Stack gap="3">
      {errorMessages}
      <Tabs.Root
        value={tabValue}
        variant="plain"
        lazyMount
        unmountOnExit
        onValueChange={(details) => {
          const id = Number.parseInt(details.value, 10);
          if (!Number.isNaN(id)) onSelectFriendId(id);
        }}
      >
        {pageCount > 1 ? (
          <HStack justify="space-between" align="center" gap="2" flexWrap="wrap">
            <PondButton
              type="button"
              size="sm"
              variant="outline"
              colorPalette="sky"
              disabled={tabPage <= 0}
              onClick={() => setTabPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </PondButton>
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" fontWeight="medium">
              {tabPage + 1} / {pageCount}
            </Text>
            <PondButton
              type="button"
              size="sm"
              variant="outline"
              colorPalette="sky"
              disabled={tabPage >= pageCount - 1}
              onClick={() => setTabPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Next
            </PondButton>
          </HStack>
        ) : null}
        <Tabs.List
          {...APP_SHELL_TAB_LIST_NESTED_PROPS}
          bg="transparent"
          display="grid"
          gridTemplateColumns={`repeat(${FRIEND_TREE_TABS_COLUMNS}, minmax(0, 1fr))`}
          gap="2"
          flexWrap="unset"
        >
          {pageFriends.map((f) => (
            <Tabs.Trigger
              key={f.id}
              value={String(f.id)}
              {...APP_SHELL_TAB_TRIGGER_PROPS}
              w="100%"
              justifyContent="center"
              px="2"
              py="1.5"
              fontSize="sm"
              minW={0}
            >
              <FriendTabLabel nickname={f.nickname} />
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {friends.map((f) => (
          <Tabs.Content key={f.id} value={String(f.id)} p="0" pt="2">
            <Stack gap="2">
              <FriendTreeOwnerHeading friend={f} />
              {renderTreePanel(f)}
            </Stack>
          </Tabs.Content>
        ))}
      </Tabs.Root>
      {selectedFriendId == null ? (
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
          Select a friend to view their family tree.
        </Text>
      ) : null}
    </Stack>
  );
}
