import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { achievementSlugFromInboxId } from "../achievements/achievementInboxNotice";
import { useHomeInbox } from "../home/homeInboxContext";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";

type UnreadPrompt = { id: string; text: string; to: string };
type UnreadNotice = { id: string; text: string };

function isAchievementInboxId(id: string): boolean {
  return id.startsWith("achievement-");
}

export default function ActivityCenterPage() {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const {
    homePrompts,
    homeNoticeItems,
    unreadCount,
    refreshInbox,
    markInboxViewed,
    markAchievementNoticesRead,
    isInboxItemRead,
  } = useHomeInbox();

  const unreadPrompts: UnreadPrompt[] = useMemo(
    () => homePrompts.filter((p) => !isInboxItemRead(p.id)),
    [homePrompts, isInboxItemRead],
  );
  const unreadNotices: UnreadNotice[] = useMemo(
    () => homeNoticeItems.filter((n) => !isInboxItemRead(n.id)),
    [homeNoticeItems, isInboxItemRead],
  );

  const markAllRead = async () => {
    const localIds: string[] = [];
    const achievementSlugs: string[] = [];
    for (const p of unreadPrompts) localIds.push(p.id);
    for (const n of unreadNotices) {
      const slug = achievementSlugFromInboxId(n.id);
      if (slug) achievementSlugs.push(slug);
      else localIds.push(n.id);
    }
    if (localIds.length > 0) markInboxViewed(localIds);
    if (achievementSlugs.length > 0) await markAchievementNoticesRead(achievementSlugs);
  };

  return (
    <Box w="100%">
      <Stack gap="4" w="100%" maxW="48rem" mx="auto" px={{ base: 3, md: 4 }} py={{ base: 4, md: 6 }}>
        <Stack gap="2" w="100%">
          <HStack justify="space-between" align="center" gap="3">
            <Text fontFamily="heading" fontWeight="normal" fontSize="xl" lineHeight="short">
              🔔 Notifications Center
            </Text>
            <PondButton
              type="button"
              colorPalette="lilypad"
              fontWeight="bold"
              onClick={() => {
                void navigate("/");
              }}
            >
              Home
            </PondButton>
          </HStack>

          <HStack justify="space-between" align="center" gap="3" flexWrap="wrap">
            <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
              Unread notifications: {unreadCount}
            </Text>
            <HStack gap="2" justify="flex-end" flexWrap="wrap">
              <PondButton
                type="button"
                variant="outline"
                colorPalette="sky"
                loading={refreshing}
                loadingText="Refreshing"
                disabled={refreshing}
                onClick={() => {
                  setRefreshing(true);
                  refreshInbox()
                    .catch(() => {
                      /* ignore */
                    })
                    .finally(() => {
                      setRefreshing(false);
                    });
                }}
              >
                Refresh
              </PondButton>
              <PondButton
                type="button"
                colorPalette="sky"
                onClick={() => {
                  void markAllRead();
                }}
                disabled={unreadCount === 0}
              >
                Mark all read
              </PondButton>
            </HStack>
          </HStack>
        </Stack>

        {unreadCount === 0 ? (
          <Box bg="bg.panel" borderWidth="1px" borderColor="border" borderRadius="xl" p="4">
            <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
              You’re all caught up.
            </Text>
          </Box>
        ) : null}

        {unreadPrompts.length > 0 ? (
          <Stack gap="2" w="100%">
            <Text fontWeight="bold" fontSize="sm" textTransform="uppercase" letterSpacing="wider" color="fg.muted">
              Prompts
            </Text>
            {unreadPrompts.map((p) => (
              <Box
                key={p.id}
                bg="bg.panel"
                borderWidth="1px"
                borderColor="border"
                borderRadius="xl"
                p="3"
              >
                <Stack gap="2">
                  <Text fontSize={APP_TEXT_SIZES.body} color="fg" fontWeight="medium">
                    {p.text}
                  </Text>
                  <HStack gap="2" flexWrap="wrap">
                    <PondButton
                      type="button"
                      colorPalette="lilypad"
                      fontWeight="bold"
                      onClick={() => {
                        markInboxViewed([p.id]);
                        void navigate(p.to);
                      }}
                    >
                      Open
                    </PondButton>
                    <PondButton
                      type="button"
                      variant="outline"
                      colorPalette="gray"
                      onClick={() => {
                        markInboxViewed([p.id]);
                      }}
                    >
                      Dismiss
                    </PondButton>
                  </HStack>
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : null}

        {unreadNotices.length > 0 ? (
          <Stack gap="2" w="100%">
            <Text fontWeight="bold" fontSize="sm" textTransform="uppercase" letterSpacing="wider" color="fg.muted">
              Notices
            </Text>
            {unreadNotices.map((n) => (
              <Box
                key={n.id}
                bg={isAchievementInboxId(n.id) ? "lilypad.subtle" : "bg.panel"}
                color="fg"
                borderWidth="1px"
                borderColor={isAchievementInboxId(n.id) ? "lilypad.border" : "border"}
                borderRadius="xl"
                p="3"
              >
                <Stack gap="2">
                  <Text fontSize={APP_TEXT_SIZES.body} fontWeight="medium">
                    {n.text}
                  </Text>
                  <HStack gap="2" flexWrap="wrap">
                    <PondButton
                      type="button"
                      variant={isAchievementInboxId(n.id) ? "solid" : "outline"}
                      colorPalette={isAchievementInboxId(n.id) ? "lilypad" : "gray"}
                      onClick={async () => {
                        const slug = achievementSlugFromInboxId(n.id);
                        if (slug) {
                          await markAchievementNoticesRead([slug]);
                        } else {
                          markInboxViewed([n.id]);
                        }
                      }}
                    >
                      Dismiss
                    </PondButton>
                  </HStack>
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}

