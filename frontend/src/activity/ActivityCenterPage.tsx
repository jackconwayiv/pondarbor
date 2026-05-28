import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { achievementSlugFromInboxId } from "../achievements/achievementInboxNotice";
import { useHomeInbox } from "../home/homeInboxContext";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";

type NotificationRow =
  | { kind: "prompt"; id: string; text: string; to: string; unread: boolean }
  | { kind: "notice"; id: string; text: string; unread: boolean };

function isAchievementInboxId(id: string): boolean {
  return id.startsWith("achievement-");
}

function NotificationCard({
  row,
  onOpen,
  onDismiss,
}: {
  row: NotificationRow;
  onOpen?: () => void;
  onDismiss?: () => void;
}) {
  const achievement = row.kind === "notice" && isAchievementInboxId(row.id);
  const unread = row.unread;

  return (
    <Box
      bg={
        unread
          ? achievement
            ? "lilypad.subtle"
            : "bg.panel"
          : "bg.subtle"
      }
      color={unread ? "fg" : "fg.muted"}
      borderWidth="1px"
      borderColor={
        unread
          ? achievement
            ? "lilypad.border"
            : "lilypad.muted"
          : "border.muted"
      }
      borderLeftWidth={unread ? "3px" : "1px"}
      borderLeftColor={unread ? "lilypad.solid" : undefined}
      borderRadius="xl"
      p="3"
      opacity={unread ? 1 : 0.92}
    >
      <Stack gap="2">
        <Text
          fontSize={APP_TEXT_SIZES.body}
          fontWeight={unread ? "semibold" : "medium"}
        >
          {row.text}
        </Text>
        {row.kind === "prompt" || (unread && row.kind === "notice") ? (
          <HStack gap="2" flexWrap="wrap">
            {row.kind === "prompt" && onOpen ? (
              <PondButton
                type="button"
                colorPalette={unread ? "lilypad" : "sky"}
                variant={unread ? "solid" : "outline"}
                fontWeight="bold"
                onClick={onOpen}
              >
                Open
              </PondButton>
            ) : null}
            {unread && onDismiss ? (
              <PondButton
                type="button"
                variant="outline"
                colorPalette="gray"
                onClick={onDismiss}
              >
                Dismiss
              </PondButton>
            ) : null}
          </HStack>
        ) : null}
      </Stack>
    </Box>
  );
}

export default function ActivityCenterPage() {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const {
    homePrompts,
    homeNoticeItems,
    unreadCount,
    inboxStatus,
    inboxError,
    inboxInitialSyncComplete,
    refreshInbox,
    markInboxViewed,
    markAchievementNoticesRead,
    isInboxItemRead,
  } = useHomeInbox();

  const didMountRefresh = useRef(false);
  useEffect(() => {
    if (didMountRefresh.current) return;
    didMountRefresh.current = true;
    void refreshInbox();
  }, [refreshInbox]);

  const notifications: NotificationRow[] = useMemo(() => {
    const rows: NotificationRow[] = [];
    for (const p of homePrompts) {
      rows.push({
        kind: "prompt",
        id: p.id,
        text: p.text,
        to: p.to,
        unread: !isInboxItemRead(p.id),
      });
    }
    for (const n of homeNoticeItems) {
      rows.push({
        kind: "notice",
        id: n.id,
        text: n.text,
        unread: !isInboxItemRead(n.id),
      });
    }
    rows.sort((a, b) => {
      if (a.unread !== b.unread) return a.unread ? -1 : 1;
      if (a.kind !== b.kind) return a.kind === "prompt" ? -1 : 1;
      return 0;
    });
    return rows;
  }, [homePrompts, homeNoticeItems, isInboxItemRead]);

  const markAllRead = async () => {
    const localIds: string[] = [];
    const achievementSlugs: string[] = [];
    for (const row of notifications) {
      if (!row.unread) continue;
      if (row.kind === "prompt") localIds.push(row.id);
      else {
        const slug = achievementSlugFromInboxId(row.id);
        if (slug) achievementSlugs.push(slug);
        else localIds.push(row.id);
      }
    }
    if (localIds.length > 0) markInboxViewed(localIds);
    if (achievementSlugs.length > 0) await markAchievementNoticesRead(achievementSlugs);
  };

  const dismissRow = async (row: NotificationRow) => {
    if (row.kind === "prompt") {
      markInboxViewed([row.id]);
      return;
    }
    const slug = achievementSlugFromInboxId(row.id);
    if (slug) await markAchievementNoticesRead([slug]);
    else markInboxViewed([row.id]);
  };

  return (
    <Box w="100%">
      <Stack
        gap="4"
        w="100%"
        maxW="48rem"
        mx="auto"
        px={{ base: 3, md: 4 }}
        py={{ base: 4, md: 6 }}
      >
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
              {notifications.length === 0
                ? "No notifications"
                : `${notifications.length} notification${notifications.length === 1 ? "" : "s"}`}
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

        {inboxError ? (
          <Box
            bg="bg.panel"
            borderWidth="1px"
            borderColor="orange.border"
            borderRadius="xl"
            p="4"
          >
            <Text fontSize={APP_TEXT_SIZES.body} color="orange.solid" fontWeight="medium">
              {inboxError}
            </Text>
          </Box>
        ) : null}

        {inboxStatus === "loading" && !inboxError ? (
          <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
            Loading notifications…
          </Text>
        ) : null}

        {!inboxError && inboxInitialSyncComplete && notifications.length === 0 ? (
          <Box bg="bg.panel" borderWidth="1px" borderColor="border" borderRadius="xl" p="4">
            <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
              You’re all caught up.
            </Text>
          </Box>
        ) : null}

        {unreadCount > 0 && notifications.every((n) => !n.unread) ? (
          <Box bg="bg.panel" borderWidth="1px" borderColor="border" borderRadius="xl" p="4">
            <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
              Notifications could not be displayed. Try Refresh.
            </Text>
          </Box>
        ) : null}

        {notifications.length > 0 ? (
          <Stack gap="2" w="100%" role="list" aria-label="Notifications">
            {notifications.map((row) => (
              <NotificationCard
                key={row.id}
                row={row}
                onOpen={
                  row.kind === "prompt"
                    ? () => {
                        if (row.unread) markInboxViewed([row.id]);
                        void navigate(row.to);
                      }
                    : undefined
                }
                onDismiss={
                  row.unread
                    ? () => {
                        void dismissRow(row);
                      }
                    : undefined
                }
              />
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}
