import {
  Box,
  Link as ChakraLink,
  Heading,
  HStack,
  NativeSelectField,
  NativeSelectRoot,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { fullBleedStackProps } from "../responsive";
import { APP_TEXT_SIZES } from "../theme/typography";
import {
  fetchStaffUsers,
  patchStaffUserAccountStatus,
  STAFF_ACCOUNT_STATUS_VALUES,
  type StaffAccountStatusValue,
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

/** Pending first, then rejected/suspended/unknown, then approved (active). */
function staffUsersSortRank(status: string): number {
  if (status === "pending") return 0;
  if (status === "approved") return 2;
  return 1;
}

/** Within the non-pending, non-approved tier: rejected, suspended, then anything else. */
function staffUsersMidTierOrder(status: string): number {
  if (status === "rejected") return 0;
  if (status === "suspended") return 1;
  return 2;
}

function compareStaffUsers(a: StaffUserRow, b: StaffUserRow): number {
  const ra = staffUsersSortRank(a.account_status);
  const rb = staffUsersSortRank(b.account_status);
  if (ra !== rb) return ra - rb;
  if (ra === 1) {
    const ma = staffUsersMidTierOrder(a.account_status);
    const mb = staffUsersMidTierOrder(b.account_status);
    if (ma !== mb) return ma - mb;
  }
  return a.email.localeCompare(b.email, undefined, { sensitivity: "base" });
}

export default function StaffPage() {
  const { sessionUser, isAuthenticated, getApiAccessToken } = useAppSession();

  const [users, setUsers] = useState<StaffUserRow[]>([]);
  const [listBusy, setListBusy] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [rowBusyId, setRowBusyId] = useState<number | null>(null);

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
    <Stack
      flex="1"
      minH="full"
      gap="6"
      px={{ base: "2", md: "2" }}
      py={{ base: "2", md: "2" }}
      {...fullBleedStackProps}
    >
      <Stack gap="2" maxW="4xl">
        <Heading as="h1" size={{ base: "lg", md: "xl" }}>
          Staff
        </Heading>
        <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
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
            <RouterLink to="/whatif/admin">WhatIf question admin</RouterLink>
          </ChakraLink>
        </HStack>
      </Stack>

      <Stack gap="3" maxW="4xl" w="100%">
        <HStack justify="space-between" align="center" flexWrap="wrap" gap="2">
          <Heading as="h2" size="md">
            Users
          </Heading>
          <PondButton
            type="button"
            size="sm"
            colorPalette="lilypad"
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
              <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
                Email / name
              </Text>
              <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
                Joined
              </Text>
              <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
                Staff
              </Text>
              <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
                Account status
              </Text>
            </Box>
            {sortedUsers.map((row) => {
              const disabled = row.id === myId || rowBusyId === row.id;
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
                  bg="white"
                  borderBottomWidth="1px"
                  borderColor="border"
                  _last={{ borderBottomWidth: "0" }}
                >
                  <Stack gap="3" display={{ base: "flex", md: "none" }}>
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
                    <HStack justify="space-between" flexWrap="wrap" gap="2">
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
                    <Text fontSize="sm">{row.is_staff ? "Yes" : "No"}</Text>
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
    </Stack>
  );
}
