import { Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { AppModal } from "../components/AppModal";
import { APP_TEXT_SIZES } from "../theme/typography";
import type { FriendWithZodiac } from "./api";
import FriendZodiacPlacementsRow from "./FriendZodiacPlacementsRow";
import { signCardAccent } from "./signCardAccent";
import ZodiacPlacementBodyContent from "./ZodiacPlacementBodyContent";
import type { ZodiacSignCardTile } from "./ZodiacSignCardsStrip";

export type ZodiacFriendsTabPanelProps = {
  friends: FriendWithZodiac[];
  friendsLoadError?: string | null;
  highlightUserId?: number | null;
};

export default function ZodiacFriendsTabPanel({
  friends,
  friendsLoadError,
  highlightUserId = null,
}: ZodiacFriendsTabPanelProps) {
  const [activeTile, setActiveTile] = useState<ZodiacSignCardTile | null>(null);
  const modalAccent = activeTile ? signCardAccent(activeTile.sign) : null;

  useEffect(() => {
    if (highlightUserId == null) return;
    const el = document.getElementById(`friend-zodiac-${highlightUserId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [highlightUserId, friends]);

  if (friends.length === 0 && !friendsLoadError) {
    return (
      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
        No friends with zodiac charts to show yet.
      </Text>
    );
  }

  return (
    <>
      {friendsLoadError ? (
        <Text role="alert" fontSize={APP_TEXT_SIZES.helper} color="nautical.solid">
          {friendsLoadError}
        </Text>
      ) : null}
      <Stack gap={{ base: "4", md: "5" }} w="100%">
        {friends.map((friend) => (
          <FriendZodiacPlacementsRow
            key={friend.id}
            friend={friend}
            highlight={highlightUserId != null && friend.id === highlightUserId}
            onPlacementOpen={setActiveTile}
          />
        ))}
      </Stack>
      <AppModal
        open={activeTile != null}
        onOpenChange={(open) => {
          if (!open) setActiveTile(null);
        }}
        showHeader={false}
        size="lg"
        contentProps={{
          bg: modalAccent?.bg ?? "bg.panel",
          cursor: "pointer",
          onClick: () => setActiveTile(null),
          p: { base: "4", md: "5" },
        }}
      >
        {activeTile && modalAccent ? (
          <ZodiacPlacementBodyContent tile={activeTile} />
        ) : null}
      </AppModal>
    </>
  );
}
