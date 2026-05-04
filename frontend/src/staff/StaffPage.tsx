import {
  Box,
  Link as ChakraLink,
  Heading,
  HStack,
  NativeSelectField,
  NativeSelectRoot,
  Stack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router";

import { AchievementSummaryCard } from "../achievements/AchievementSummaryCard";
import { fetchStaffAchievementDefinitions } from "../achievements/api";
import type { AchievementSummary } from "../achievements/types";
import { useAppSession } from "../auth/AppSessionContext";
import { useHomeInbox } from "../home/homeInboxContext";
import PondButton from "../PondButton";
import { fullBleedStackProps } from "../responsive";
import {
  APP_SHELL_TAB_LIST_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  MAPPED_LIST_STACK_GAP,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import {
  acknowledgeStaffContactMessages,
  deleteStaffContactMessage,
  fetchStaffContactMessages,
  fetchStaffUsers,
  patchStaffUserAccountStatus,
  STAFF_ACCOUNT_STATUS_VALUES,
  type StaffAccountStatusValue,
  type StaffContactMessageRow,
  type StaffUserRow,
} from "../users/api";

const STATUS_LABELS: Record<StaffAccountStatusValue, string> = {
  pending: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};

function formatJoined(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Pending, then suspended, then rejected, then approved; unknown statuses before approved. */
function staffAccountStatusRank(status: string): number {
  if (status === "pending") return 0;
  if (status === "suspended") return 1;
  if (status === "rejected") return 2;
  if (status === "approved") return 3;
  return 2;
}

function compareStaffUsers(a: StaffUserRow, b: StaffUserRow): number {
  const ra = staffAccountStatusRank(a.account_status);
  const rb = staffAccountStatusRank(b.account_status);
  if (ra !== rb) return ra - rb;
  return a.email.localeCompare(b.email, undefined, { sensitivity: "base" });
}

function formatContactTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function contactReadCaption(row: StaffContactMessageRow): string {
  if (!row.read_at) return "Unread";
  const who = row.read_by?.email ?? "staff";
  return `Read by ${who} · ${formatContactTime(row.read_at)}`;
}

export default function StaffPage() {
  const { sessionUser, isAuthenticated, getApiAccessToken } = useAppSession();
  const { refreshInbox } = useHomeInbox();
  const [searchParams] = useSearchParams();

  const [users, setUsers] = useState<StaffUserRow[]>([]);
  const [listBusy, setListBusy] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [rowBusyId, setRowBusyId] = useState<number | null>(null);

  const [contactMessages, setContactMessages] = useState<StaffContactMessageRow[]>(
    [],
  );
  const [contactBusy, setContactBusy] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactDeleteBusyId, setContactDeleteBusyId] = useState<number | null>(
    null,
  );
  const [staffTab, setStaffTab] = useState<"users" | "contact" | "achievements">(
    "users",
  );

  const [achievementDefs, setAchievementDefs] = useState<AchievementSummary[]>(
    [],
  );
  const [achievementsBusy, setAchievementsBusy] = useState(false);
  const [achievementsError, setAchievementsError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const raw = searchParams.get("tab");
    if (raw === "contact") setStaffTab("contact");
    else if (raw === "users") setStaffTab("users");
    else if (raw === "achievements") setStaffTab("achievements");
  }, [searchParams]);

  const isStaff = !!sessionUser?.user?.is_staff;
  const myId = sessionUser?.user?.id;

  const sortedUsers = useMemo(
    () => [...users].sort(compareStaffUsers),
    [users],
  );

  const loadUsers = useCallback(async () => {
    if (!isAuthenticated || !isStaff) return;
    setListBusy(true);
    setListError(null);
    try {
      const token = await getApiAccessToken();
      const rows = await fetchStaffUsers(token);
      setUsers(rows);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load users");
      setUsers([]);
    } finally {
      setListBusy(false);
    }
  }, [isAuthenticated, isStaff, getApiAccessToken]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const loadContactMessages = useCallback(async () => {
    if (!isAuthenticated || !isStaff) return;
    setContactBusy(true);
    setContactError(null);
    try {
      const token = await getApiAccessToken();
      await acknowledgeStaffContactMessages(token);
      const rows = await fetchStaffContactMessages(token);
      setContactMessages(rows);
      void refreshInbox();
    } catch (e) {
      setContactError(
        e instanceof Error ? e.message : "Failed to load contact messages",
      );
      setContactMessages([]);
    } finally {
      setContactBusy(false);
    }
  }, [isAuthenticated, isStaff, getApiAccessToken, refreshInbox]);

  const onDeleteContactMessage = useCallback(
    async (row: StaffContactMessageRow) => {
      if (!isStaff) return;
      if (
        !window.confirm(
          "Delete this contact message permanently? This cannot be undone.",
        )
      ) {
        return;
      }
      setContactDeleteBusyId(row.id);
      setContactError(null);
      try {
        const token = await getApiAccessToken();
        await deleteStaffContactMessage(token, row.id);
        await loadContactMessages();
      } catch (e) {
        setContactError(
          e instanceof Error ? e.message : "Failed to delete message",
        );
      } finally {
        setContactDeleteBusyId(null);
      }
    },
    [isStaff, getApiAccessToken, loadContactMessages],
  );

  useEffect(() => {
    void loadContactMessages();
  }, [loadContactMessages]);

  const loadAchievementDefinitions = useCallback(async () => {
    if (!isAuthenticated || !isStaff) return;
    setAchievementsBusy(true);
    setAchievementsError(null);
    try {
      const token = await getApiAccessToken();
      const rows = await fetchStaffAchievementDefinitions(token);
      setAchievementDefs(rows);
    } catch (e) {
      setAchievementsError(
        e instanceof Error ? e.message : "Failed to load achievements",
      );
      setAchievementDefs([]);
    } finally {
      setAchievementsBusy(false);
    }
  }, [isAuthenticated, isStaff, getApiAccessToken]);

  useEffect(() => {
    if (staffTab !== "achievements" || !isStaff) return;
    void loadAchievementDefinitions();
  }, [staffTab, isStaff, loadAchievementDefinitions]);

  async function onStatusChange(
    row: StaffUserRow,
    next: StaffAccountStatusValue,
  ) {
    if (!isStaff || row.id === myId || next === row.account_status) return;
    setRowBusyId(row.id);
    setListError(null);
    try {
      const token = await getApiAccessToken();
      const updated = await patchStaffUserAccountStatus(token, row.id, next);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setRowBusyId(null);
    }
  }

  if (!sessionUser) {
    return null;
  }

  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Tabs.Root
        value={staffTab}
        onValueChange={(d) =>
          setStaffTab(d.value as "users" | "contact" | "achievements")
        }
        variant="plain"
        display="flex"
        flexDirection="column"
        flex="1"
        minH="full"
      >
        <Box bg="bg" px={0} py={{ base: "2", md: "2" }}>
          <Box {...APP_SHELL_TRAY_PROPS} w="100%">
            <Stack
              gap={{ base: "4", md: "4" }}
              px={{ base: "2", md: "2" }}
              pt={{ base: "2", md: "2" }}
              pb="0"
            >
              <Box {...PANEL_ENTRY_CARD_PROPS}>
                <Heading
                  as="h1"
                  size={{ base: "lg", md: "xl" }}
                  fontWeight="bold"
                  mb="2"
                >
                  Staff
                </Heading>
                <Text
                  fontSize={APP_TEXT_SIZES.meta}
                  color="fg.muted"
                  mb="3"
                >
                  Manage member approval and open admin tools.
                </Text>
                <HStack gap="4" flexWrap="wrap" align="center">
                  <ChakraLink
                    asChild
                    fontSize="sm"
                    textDecoration="underline"
                    color="fg"
                  >
                    <RouterLink to="/clicker/dev/catalog">
                      PondClicker upgrade catalog
                    </RouterLink>
                  </ChakraLink>
                  <ChakraLink
                    asChild
                    fontSize="sm"
                    textDecoration="underline"
                    color="fg"
                  >
                    <RouterLink to="/whatif/admin">
                      WhatIf question admin
                    </RouterLink>
                  </ChakraLink>
                </HStack>
              </Box>
            </Stack>
            <Tabs.List {...APP_SHELL_TAB_LIST_PROPS}>
              <Tabs.Trigger value="users" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                Users
              </Tabs.Trigger>
              <Tabs.Trigger value="contact" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                Contact messages
              </Tabs.Trigger>
              <Tabs.Trigger
                value="achievements"
                {...APP_SHELL_TAB_TRIGGER_PROPS}
              >
                Achievements
              </Tabs.Trigger>
            </Tabs.List>
          </Box>
        </Box>

        <Box flex="1" bg="bg" px={0} py={{ base: "2", md: "2" }}>
          <Box {...APP_SHELL_TRAY_PROPS}>
            <Stack
              gap={{ base: "4", md: "4" }}
              px={{ base: "2", md: "2" }}
              pt={{ base: "2", md: "2" }}
              pb="2"
            >
              <Tabs.Content value="users">
                <Stack gap="3" w="100%">
                  <HStack
                    justify="space-between"
                    align="center"
                    flexWrap="wrap"
                    gap="2"
                  >
                    <Heading as="h2" size="md">
                      Users
                    </Heading>
                    <PondButton
                      type="button"
                      size="sm"
                      colorPalette="teal"
                      loading={listBusy}
                      onClick={() => void loadUsers()}
                    >
                      Refresh
                    </PondButton>
                  </HStack>
                  {listError ? (
                    <Text
                      role="alert"
                      fontSize="sm"
                      color="nautical.solid"
                      fontWeight="medium"
                    >
                      {listError}
                    </Text>
                  ) : null}
                  {listBusy && users.length === 0 ? (
                    <Text fontSize="sm" color="fg.muted">
                      Loading users…
                    </Text>
                  ) : (
                    <Stack
                      gap="0"
                      borderWidth="1px"
                      borderColor="border"
                      borderRadius="md"
                      overflow="hidden"
                    >
                      <Box
                        display={{ base: "none", md: "grid" }}
                        gridTemplateColumns="minmax(0,1.4fr) minmax(0,1fr) minmax(0,0.5fr) minmax(0,1fr)"
                        gap="3"
                        px="2"
                        py="2"
                        bg="bg.subtle"
                        borderBottomWidth="1px"
                        borderColor="border"
                      >
                        <Text
                          fontSize="xs"
                          fontWeight="semibold"
                          color="fg.muted"
                        >
                          Email / name
                        </Text>
                        <Text
                          fontSize="xs"
                          fontWeight="semibold"
                          color="fg.muted"
                        >
                          Joined
                        </Text>
                        <Text
                          fontSize="xs"
                          fontWeight="semibold"
                          color="fg.muted"
                        >
                          Staff
                        </Text>
                        <Text
                          fontSize="xs"
                          fontWeight="semibold"
                          color="fg.muted"
                        >
                          Account status
                        </Text>
                      </Box>
                      {sortedUsers.map((row) => {
                        const disabled =
                          row.id === myId || rowBusyId === row.id;
                        const statusValue = STAFF_ACCOUNT_STATUS_VALUES.includes(
                          row.account_status as StaffAccountStatusValue,
                        )
                          ? (row.account_status as StaffAccountStatusValue)
                          : "pending";
                        return (
                          <Box
                            key={row.id}
                            px="2"
                            py="2"
                            bg="bg"
                            borderBottomWidth="1px"
                            borderColor="border"
                            _last={{ borderBottomWidth: "0" }}
                          >
                            <Stack
                              gap="3"
                              display={{ base: "flex", md: "none" }}
                            >
                              <Stack gap="1">
                                <Text
                                  fontSize="sm"
                                  fontWeight="medium"
                                  wordBreak="break-word"
                                >
                                  {row.email}
                                </Text>
                                <Text fontSize="xs" color="fg.muted">
                                  {row.display_name || "—"}
                                </Text>
                              </Stack>
                              <HStack
                                justify="space-between"
                                flexWrap="wrap"
                                gap="2"
                              >
                                <Text fontSize="xs" color="fg.muted">
                                  Joined {formatJoined(row.date_joined)}
                                </Text>
                                <Text fontSize="xs" color="fg.muted">
                                  Staff: {row.is_staff ? "yes" : "no"}
                                </Text>
                              </HStack>
                              <NativeSelectRoot size="sm" disabled={disabled}>
                                <NativeSelectField
                                  value={statusValue}
                                  onChange={(e) => {
                                    void onStatusChange(
                                      row,
                                      e.target.value as StaffAccountStatusValue,
                                    );
                                  }}
                                >
                                  {STAFF_ACCOUNT_STATUS_VALUES.map((v) => (
                                    <option key={v} value={v}>
                                      {STATUS_LABELS[v]}
                                    </option>
                                  ))}
                                </NativeSelectField>
                              </NativeSelectRoot>
                              {row.id === myId ? (
                                <Text fontSize="xs" color="fg.muted">
                                  You cannot change your own status here.
                                </Text>
                              ) : null}
                            </Stack>
                            <Box
                              display={{ base: "none", md: "grid" }}
                              gridTemplateColumns="minmax(0,1.4fr) minmax(0,1fr) minmax(0,0.5fr) minmax(0,1fr)"
                              gap="3"
                              alignItems="center"
                            >
                              <Stack gap="0" minW="0">
                                <Text
                                  fontSize="sm"
                                  fontWeight="medium"
                                  wordBreak="break-word"
                                >
                                  {row.email}
                                </Text>
                                <Text fontSize="xs" color="fg.muted">
                                  {row.display_name || "—"}
                                </Text>
                              </Stack>
                              <Text fontSize="sm" color="fg.muted">
                                {formatJoined(row.date_joined)}
                              </Text>
                              <Text fontSize="sm">
                                {row.is_staff ? "Yes" : "No"}
                              </Text>
                              <Box minW="0">
                                <NativeSelectRoot
                                  size="sm"
                                  disabled={disabled}
                                  maxW="100%"
                                >
                                  <NativeSelectField
                                    value={statusValue}
                                    onChange={(e) => {
                                      void onStatusChange(
                                        row,
                                        e.target.value as StaffAccountStatusValue,
                                      );
                                    }}
                                  >
                                    {STAFF_ACCOUNT_STATUS_VALUES.map((v) => (
                                      <option key={v} value={v}>
                                        {STATUS_LABELS[v]}
                                      </option>
                                    ))}
                                  </NativeSelectField>
                                </NativeSelectRoot>
                                {row.id === myId ? (
                                  <Text fontSize="2xs" color="fg.muted" mt="1">
                                    Your account
                                  </Text>
                                ) : null}
                              </Box>
                            </Box>
                          </Box>
                        );
                      })}
                    </Stack>
                  )}
                </Stack>
              </Tabs.Content>

              <Tabs.Content value="contact">
                <Stack gap="3" w="100%">
                  <HStack
                    justify="space-between"
                    align="center"
                    flexWrap="wrap"
                    gap="2"
                  >
                    <Heading as="h2" size="md">
                      Contact messages
                    </Heading>
                    <PondButton
                      type="button"
                      size="sm"
                      colorPalette="teal"
                      loading={contactBusy}
                      onClick={() => void loadContactMessages()}
                    >
                      Refresh
                    </PondButton>
                  </HStack>
                  {contactError ? (
                    <Text
                      role="alert"
                      fontSize="sm"
                      color="nautical.solid"
                      fontWeight="medium"
                    >
                      {contactError}
                    </Text>
                  ) : null}
                  {contactBusy && contactMessages.length === 0 ? (
                    <Text fontSize="sm" color="fg.muted">
                      Loading messages…
                    </Text>
                  ) : contactMessages.length === 0 ? (
                    <Text fontSize="sm" color="fg.muted">
                      No contact messages yet.
                    </Text>
                  ) : (
                    <Stack
                      gap="0"
                      borderWidth="1px"
                      borderColor="border"
                      borderRadius="md"
                      overflow="hidden"
                    >
                      <Box
                        display={{ base: "none", md: "grid" }}
                        gridTemplateColumns="minmax(0,8rem) minmax(0,1fr) minmax(0,2fr) auto"
                        gap="3"
                        px="2"
                        py="2"
                        bg="bg.subtle"
                        borderBottomWidth="1px"
                        borderColor="border"
                      >
                        <Text
                          fontSize="xs"
                          fontWeight="semibold"
                          color="fg.muted"
                        >
                          Time
                        </Text>
                        <Text
                          fontSize="xs"
                          fontWeight="semibold"
                          color="fg.muted"
                        >
                          From
                        </Text>
                        <Text
                          fontSize="xs"
                          fontWeight="semibold"
                          color="fg.muted"
                        >
                          Message
                        </Text>
                        <Box aria-hidden minW="4rem" />
                      </Box>
                      {contactMessages.map((row) => (
                        <Box
                          key={row.id}
                          px="2"
                          py="2"
                          bg="bg"
                          borderBottomWidth="1px"
                          borderColor="border"
                          _last={{ borderBottomWidth: "0" }}
                        >
                          <Stack gap="2" display={{ base: "flex", md: "none" }}>
                            <Text fontSize="xs" color="fg.muted">
                              {formatContactTime(row.created_at)}
                            </Text>
                            <Text
                              fontSize="2xs"
                              color={row.read_at ? "fg.muted" : "nautical.solid"}
                              fontWeight={row.read_at ? "normal" : "medium"}
                            >
                              {contactReadCaption(row)}
                            </Text>
                            <Stack gap="0">
                              <Text
                                fontSize="sm"
                                fontWeight="medium"
                                wordBreak="break-word"
                              >
                                {row.from_user.email}
                              </Text>
                              <Text fontSize="xs" color="fg.muted">
                                {row.from_user.display_name || "—"}
                              </Text>
                            </Stack>
                            <Text
                              fontSize="sm"
                              whiteSpace="pre-wrap"
                              wordBreak="break-word"
                            >
                              {row.message}
                            </Text>
                            <HStack justify="flex-end" w="100%">
                              <PondButton
                                type="button"
                                size="xs"
                                colorPalette="orange"
                                loading={contactDeleteBusyId === row.id}
                                disabled={contactBusy && contactDeleteBusyId !== row.id}
                                onClick={() => void onDeleteContactMessage(row)}
                              >
                                Delete
                              </PondButton>
                            </HStack>
                          </Stack>
                          <Box
                            display={{ base: "none", md: "grid" }}
                            gridTemplateColumns="minmax(0,8rem) minmax(0,1fr) minmax(0,2fr) auto"
                            gap="3"
                            alignItems="start"
                          >
                            <Stack gap="0">
                              <Text fontSize="sm" color="fg.muted">
                                {formatContactTime(row.created_at)}
                              </Text>
                              <Text
                                fontSize="2xs"
                                color={row.read_at ? "fg.muted" : "nautical.solid"}
                                fontWeight={row.read_at ? "normal" : "medium"}
                              >
                                {contactReadCaption(row)}
                              </Text>
                            </Stack>
                            <Stack gap="0" minW="0">
                              <Text
                                fontSize="sm"
                                fontWeight="medium"
                                wordBreak="break-word"
                              >
                                {row.from_user.email}
                              </Text>
                              <Text fontSize="xs" color="fg.muted">
                                {row.from_user.display_name || "—"}
                              </Text>
                            </Stack>
                            <Text
                              fontSize="sm"
                              whiteSpace="pre-wrap"
                              wordBreak="break-word"
                              minW="0"
                            >
                              {row.message}
                            </Text>
                            <PondButton
                              type="button"
                              size="xs"
                              colorPalette="orange"
                              loading={contactDeleteBusyId === row.id}
                              disabled={contactBusy && contactDeleteBusyId !== row.id}
                              onClick={() => void onDeleteContactMessage(row)}
                            >
                              Delete
                            </PondButton>
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </Tabs.Content>

              <Tabs.Content value="achievements">
                <Stack gap="3" w="100%">
                  <HStack
                    justify="space-between"
                    align="center"
                    flexWrap="wrap"
                    gap="2"
                  >
                    <Heading as="h2" size="md">
                      Achievements (catalog)
                    </Heading>
                    <PondButton
                      type="button"
                      size="sm"
                      colorPalette="teal"
                      loading={achievementsBusy}
                      onClick={() => void loadAchievementDefinitions()}
                    >
                      Refresh
                    </PondButton>
                  </HStack>
                  <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
                    How each badge appears on a friend&apos;s profile (titles,
                    descriptions, and medals). Unlock dates are omitted here.
                  </Text>
                  {achievementsError ? (
                    <Text
                      role="alert"
                      fontSize="sm"
                      color="nautical.solid"
                      fontWeight="medium"
                    >
                      {achievementsError}
                    </Text>
                  ) : null}
                  {achievementsBusy && achievementDefs.length === 0 ? (
                    <Text fontSize="sm" color="fg.muted">
                      Loading achievements…
                    </Text>
                  ) : achievementDefs.length === 0 ? (
                    <Text fontSize="sm" color="fg.muted">
                      No achievement definitions found.
                    </Text>
                  ) : (
                    <Stack gap={MAPPED_LIST_STACK_GAP}>
                      {achievementDefs.map((a) => (
                        <AchievementSummaryCard
                          key={a.slug}
                          achievement={a}
                          showEarnedDate={false}
                        />
                      ))}
                    </Stack>
                  )}
                </Stack>
              </Tabs.Content>
            </Stack>
          </Box>
        </Box>
      </Tabs.Root>
    </Stack>
  );
}
