import {
  Avatar,
  Box,
  HStack,
  Heading,
  Link as ChakraLink,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link as RouterLink,
  Navigate,
  useParams,
} from "react-router";

import {
  resolveAvatarUrlForUser,
  useAppSession,
} from "../auth/AppSessionContext";
import { PanelSessionReconnect, SessionLoadingCard } from "../components/panelStatus";
import { friendProfilePath } from "../friend/profilePaths";
import PondButton from "../PondButton";
import { fullBleedStackProps, useIsMobile } from "../responsive";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import {
  deleteCalendarEvent,
  fetchCalendarBootstrap,
  updateCalendarEvent,
} from "./api";
import EventFormDialog from "./EventFormDialog";
import { eventCoversDay, parseIsoDate } from "./monthMath";
import type {
  CalendarEvent,
  CalendarBirthdayRow,
  CalendarOwnerRow,
  EventWritePayload,
} from "./types";
import UserCheckboxList from "./UserCheckboxList";
import {
  USER_COLOR_HEX,
  USER_COLOR_TEXT_ON,
  colorForCheckedUser,
} from "./userColors";
import { buildUsersQueryFragment, useCheckedUsers } from "./useCheckedUsers";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function CalendarDayPage() {
  const params = useParams<{ date: string }>();
  const isMobile = useIsMobile();
  const {
    isAuthenticated,
    isLoading,
    sessionUser,
    auth0User,
    getApiAccessToken,
    refreshSession,
    error: sessionError,
  } = useAppSession();

  const dayIso = params.date ?? "";
  const dateValid = ISO_DATE_RE.test(dayIso);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [birthdays, setBirthdays] = useState<CalendarBirthdayRow[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<CalendarOwnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);

  const { orderedCheckedUserIds, setCheckedUserIds, isDefaultAll } =
    useCheckedUsers(approvedUsers);

  const ownersById = useMemo(
    () => new Map(approvedUsers.map((u) => [u.id, u])),
    [approvedUsers],
  );
  const currentUserId = sessionUser?.user.id ?? null;

  const loadAll = useCallback(async () => {
    if (!sessionUser || !dateValid) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      const data = await fetchCalendarBootstrap(token, {
        start_date: dayIso,
        end_date: dayIso,
        owner: "all",
      });
      setEvents(data.events);
      setApprovedUsers(data.approved_users);
      setBirthdays(data.birthdays);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load day.");
    } finally {
      setLoading(false);
    }
  }, [dateValid, dayIso, getApiAccessToken, sessionUser]);

  useEffect(() => {
    if (!isAuthenticated || !sessionUser) {
      setLoading(false);
      return;
    }
    if (!dateValid) {
      setLoading(false);
      return;
    }
    void loadAll();
  }, [isAuthenticated, loadAll, sessionUser, dateValid]);

  const eventsForDay = useMemo(
    () =>
      events.filter((ev) => eventCoversDay(ev.start_date, ev.end_date, dayIso)),
    [events, dayIso],
  );
  const birthdayLabelsForDay = useMemo(() => {
    const day = parseIsoDate(dayIso);
    const month = day.getMonth() + 1;
    const dayOfMonth = day.getDate();
    return birthdays
      .filter((row) => row.birth_month === month && row.birth_day === dayOfMonth)
      .map((row) => `🎂 ${row.display_name}'s Birthday`);
  }, [birthdays, dayIso]);

  /** Owner ids busy this day, restricted to checked users, in checked-order. */
  const busyOwnerIds = useMemo(() => {
    const busySet = new Set(eventsForDay.map((ev) => ev.owner.id));
    if (isDefaultAll && orderedCheckedUserIds.length === 0 && eventsForDay.length > 0) {
      const ids = Array.from(busySet);
      ids.sort((a, b) => a - b);
      return ids;
    }
    return orderedCheckedUserIds.filter((id) => busySet.has(id));
  }, [eventsForDay, isDefaultAll, orderedCheckedUserIds]);

  const handleSaveEdit = async (payload: EventWritePayload) => {
    if (!editing) return;
    const token = await getApiAccessToken();
    await updateCalendarEvent(token, editing.id, payload);
    setEditing(null);
    await loadAll();
  };

  const handleDeleteEdit = async () => {
    if (!editing) return;
    const token = await getApiAccessToken();
    await deleteCalendarEvent(token, editing.id);
    setEditing(null);
    await loadAll();
  };

  if (isLoading) {
    return <SessionLoadingCard />;
  }
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser) {
    return (
      <PanelSessionReconnect
        sessionError={sessionError}
        onRetry={() => void refreshSession()}
      />
    );
  }
  if (!sessionUser.user.is_approved) {
    return (
      <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
        <Box
          flex="1"
          bg="bg"
          px={0}
          py={{ base: "2", md: "2" }}
        >
          <Box {...APP_SHELL_TRAY_PROPS}>
            <Stack gap={{ base: "4", md: "4" }} p={{ base: "2", md: "2" }}>
              <Box {...PANEL_ENTRY_CARD_PROPS}>
                <Text fontSize={APP_TEXT_SIZES.body} color="fg">
                  Approval required.
                </Text>
              </Box>
            </Stack>
          </Box>
        </Box>
      </Stack>
    );
  }

  if (!dateValid) {
    return (
      <Stack flex="1" minH="full" gap="2" {...fullBleedStackProps} p="4">
        <Text color="nautical.solid">
          Invalid date. Use the format YYYY-MM-DD.
        </Text>
        <PondButton
          size="sm"
          colorPalette="sky"
          variant="outline"
          asChild
        >
          <RouterLink to="/calendar">Back to month</RouterLink>
        </PondButton>
      </Stack>
    );
  }

  const dayDate = parseIsoDate(dayIso);
  const dayLabel = dayDate.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const backHref = `/calendar${buildUsersQueryFragment(
    orderedCheckedUserIds,
    approvedUsers,
  )}`;

  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box
        flex="1"
        bg="bg"
        px={0}
        py={{ base: "2", md: "2" }}
      >
        <Box {...APP_SHELL_TRAY_PROPS}>
          <Stack
            gap={{ base: "4", md: "4" }}
            px={{ base: "2", md: "2" }}
            pt={{ base: "2", md: "2" }}
            pb="2"
          >
            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <HStack justify="space-between" align="center" flexWrap="wrap" gap="2">
                <Stack gap="0">
                  <Heading
                    as="h1"
                    size={{ base: "md", md: "lg" }}
                  >
                    {dayLabel}
                  </Heading>
                  <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                    {busyOwnerIds.length === 0
                      ? "No one selected is busy."
                      : `${busyOwnerIds.length} ${
                          busyOwnerIds.length === 1 ? "person" : "people"
                        } busy this day`}
                  </Text>
                </Stack>
                <PondButton size="sm" colorPalette="sky" variant="outline" asChild>
                  <RouterLink to={backHref}>Back to month</RouterLink>
                </PondButton>
              </HStack>
            </Box>
          </Stack>
          <Box p={{ base: "2", md: "2" }}>
            <Stack
              direction={isMobile ? "column" : "row"}
              gap="2"
              align="stretch"
            >
              <UserCheckboxList
                approvedUsers={approvedUsers}
                orderedCheckedUserIds={orderedCheckedUserIds}
                onChange={setCheckedUserIds}
              />
              <Stack flex="1" minW="0" gap="2">
                {loading ? (
                  <Text fontSize={APP_TEXT_SIZES.helper}>Loading…</Text>
                ) : null}
                {error ? (
                  <Text color="nautical.solid" role="alert">
                    {error}
                  </Text>
                ) : null}
                {!loading && busyOwnerIds.length === 0 ? (
                  <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                    No one is busy this day. Check more people on the left to
                    expand the view, or pick another day from the month grid.
                  </Text>
                ) : null}
                {birthdayLabelsForDay.map((label) => (
                  <Box
                    key={label}
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="md"
                    bg="white"
                    px="2"
                    py="1.5"
                  >
                    <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
                      {label}
                    </Text>
                  </Box>
                ))}
                {busyOwnerIds.map((ownerId) => {
                  const color = colorForCheckedUser(
                    ownerId,
                    orderedCheckedUserIds,
                  );
                  if (color === null) return null;
                  const owner =
                    ownersById.get(ownerId) ??
                    eventsForDay.find((ev) => ev.owner.id === ownerId)?.owner;
                  const ownerLabel =
                    owner?.display_name || owner?.email || `User ${ownerId}`;
                  const ownerAvatarUrl = resolveAvatarUrlForUser(
                    owner?.avatar_url,
                    ownerId,
                    sessionUser,
                    auth0User,
                  );
                  const ownerEvents = eventsForDay.filter(
                    (ev) => ev.owner.id === ownerId,
                  );
                  const isSelf =
                    currentUserId !== null && ownerId === currentUserId;
                  const ownerHeader = (
                    <HStack gap="2" align="center" minW="0" py="0.5">
                      <Avatar.Root size="sm" flexShrink={0}>
                        <Avatar.Fallback name={ownerLabel} />
                        {ownerAvatarUrl ? (
                          <Avatar.Image src={ownerAvatarUrl} />
                        ) : null}
                      </Avatar.Root>
                      <Text
                        fontSize={APP_TEXT_SIZES.helper}
                        fontWeight="semibold"
                        lineClamp={1}
                      >
                        {ownerLabel}
                      </Text>
                    </HStack>
                  );
                  return (
                    <Box
                      key={ownerId}
                      borderWidth="1px"
                      borderColor="border"
                      borderRadius="md"
                      bg="white"
                      overflow="hidden"
                    >
                      <Box
                        px="2"
                        py="1"
                        style={{
                          background: USER_COLOR_HEX[color],
                          color: USER_COLOR_TEXT_ON[color],
                        }}
                      >
                        {isSelf ? (
                          <Box width="100%">{ownerHeader}</Box>
                        ) : (
                          <ChakraLink
                            asChild
                            variant="plain"
                            color="inherit"
                            textDecoration="none"
                            display="block"
                            width="100%"
                            _hover={{ opacity: 0.92 }}
                            _focusVisible={{
                              outline: "2px solid",
                              outlineColor: "currentColor",
                              outlineOffset: "2px",
                            }}
                          >
                            <RouterLink
                              to={friendProfilePath(ownerId)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {ownerHeader}
                            </RouterLink>
                          </ChakraLink>
                        )}
                      </Box>
                      <Stack gap="1" p="2">
                        {ownerEvents.map((ev) => {
                          const isOwnManual =
                            ev.is_manual && ev.owner.id === currentUserId;
                          const titleText = ev.title ?? "";
                          const label = isOwnManual
                            ? titleText || "Busy"
                            : "Busy";
                          return (
                            <HStack
                              key={ev.id}
                              gap="2"
                              align="center"
                              justify="space-between"
                            >
                              <Stack gap="0">
                                <Text fontSize={APP_TEXT_SIZES.helper}>
                                  {label}
                                </Text>
                                <Text
                                  fontSize={APP_TEXT_SIZES.meta}
                                  color="fg.muted"
                                >
                                  {ev.start_date === ev.end_date
                                    ? "Single day"
                                    : `${ev.start_date} → ${ev.end_date}`}
                                  {ev.is_manual ? " · manual" : " · imported"}
                                </Text>
                              </Stack>
                              {isOwnManual ? (
                                <PondButton
                                  size="sm"
                                  colorPalette="sky"
                                  variant="outline"
                                  onClick={() => setEditing(ev)}
                                >
                                  Edit
                                </PondButton>
                              ) : null}
                            </HStack>
                          );
                        })}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </Stack>
          </Box>
        </Box>
      </Box>

      <EventFormDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSubmit={handleSaveEdit}
        onDelete={handleDeleteEdit}
        title="Edit event"
        submitLabel="Save changes"
        initial={
          editing
            ? {
                title: editing.title ?? "",
                start_date: editing.start_date,
                end_date: editing.end_date,
              }
            : undefined
        }
      />
    </Stack>
  );
}
