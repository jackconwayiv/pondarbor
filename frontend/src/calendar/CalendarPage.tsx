import {
  Box,
  HStack,
  Heading,
  Stack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { fullBleedStackProps, useIsMobile } from "../responsive";
import { APP_TEXT_SIZES } from "../theme/typography";
import {
  createCalendarEvent,
  createCalendarSource,
  deleteCalendarEvent,
  deleteCalendarSource,
  fetchApprovedUsers,
  fetchCalendarEvents,
  fetchCalendarSources,
  syncCalendarSource,
  updateCalendarEvent,
} from "./api";
import EventFormDialog from "./EventFormDialog";
import ImportIcalDialog from "./ImportIcalDialog";
import MonthGrid from "./MonthGrid";
import {
  addMonths,
  formatMonthLabel,
  isoDateForLocalDay,
  monthAnchorFromDate,
  monthGridDateRange,
  type MonthAnchor,
} from "./monthMath";
import type {
  CalendarEvent,
  CalendarOwnerRow,
  CalendarSource,
  EventWritePayload,
  SourceCreatePayload,
} from "./types";
import UserCheckboxList from "./UserCheckboxList";
import { buildUsersQueryFragment, useCheckedUsers } from "./useCheckedUsers";

type CalendarTab = "month" | "sources";

const ENTRY_CARD_PROPS = {
  bg: "white",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "xl",
  p: { base: "2", md: "2" },
} as const;

function parseTab(value: string | null): CalendarTab {
  return value === "sources" ? "sources" : "month";
}

export default function CalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const {
    isAuthenticated,
    isLoading,
    sessionUser,
    getApiAccessToken,
    refreshSession,
    error: sessionError,
  } = useAppSession();

  const [anchor, setAnchor] = useState<MonthAnchor>(() =>
    monthAnchorFromDate(new Date()),
  );
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<CalendarOwnerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [eventDialog, setEventDialog] = useState<
    | { mode: "create" }
    | { mode: "edit"; event: CalendarEvent }
    | null
  >(null);
  const [importOpen, setImportOpen] = useState(false);
  const [syncingSourceId, setSyncingSourceId] = useState<number | null>(null);
  const [confirmDeleteSourceId, setConfirmDeleteSourceId] = useState<number | null>(
    null,
  );
  const hasLoadedOnceRef = useRef(false);

  const { orderedCheckedUserIds, setCheckedUserIds } =
    useCheckedUsers(approvedUsers);

  const setActiveTab = useCallback(
    (tab: CalendarTab) => {
      const next = new URLSearchParams(searchParams);
      next.set("tab", tab);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const monthRange = useMemo(() => monthGridDateRange(anchor), [anchor]);
  const ownersById = useMemo(
    () => new Map(approvedUsers.map((u) => [u.id, u])),
    [approvedUsers],
  );

  const loadEvents = useCallback(async () => {
    if (!sessionUser) return;
    const token = await getApiAccessToken();
    // We always pull every approved user's events for the visible range and
    // do client-side filtering so flipping a checkbox is instant. The set is
    // small (max 200 approved users x ~6 weeks of events).
    const result = await fetchCalendarEvents(token, {
      start_date: monthRange.start,
      end_date: monthRange.end,
      owner: "all",
    });
    setEvents(result);
  }, [getApiAccessToken, monthRange.end, monthRange.start, sessionUser]);

  const loadSources = useCallback(async () => {
    if (!sessionUser) return;
    const token = await getApiAccessToken();
    const result = await fetchCalendarSources(token);
    setSources(result);
  }, [getApiAccessToken, sessionUser]);

  const loadApprovedUsers = useCallback(async () => {
    if (!sessionUser) return;
    const token = await getApiAccessToken();
    const result = await fetchApprovedUsers(token, "");
    setApprovedUsers(result);
  }, [getApiAccessToken, sessionUser]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      loadEvents(),
      loadSources(),
      loadApprovedUsers(),
    ]);
    const labels = ["events", "sources", "approved users"] as const;
    const failures: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const message = r.reason instanceof Error ? r.reason.message : String(r.reason);
        failures.push(`${labels[i]}: ${message}`);
      }
    });
    if (failures.length > 0) {
      setError(failures.join(" · "));
    }
    hasLoadedOnceRef.current = true;
    setLoading(false);
  }, [loadApprovedUsers, loadEvents, loadSources]);

  useEffect(() => {
    if (!isAuthenticated || !sessionUser) return;
    void refreshAll();
  }, [isAuthenticated, refreshAll, sessionUser]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const handleSubmitEvent = async (payload: EventWritePayload) => {
    const token = await getApiAccessToken();
    if (eventDialog?.mode === "edit") {
      await updateCalendarEvent(token, eventDialog.event.id, payload);
      setNotice({ kind: "success", message: "Event updated." });
    } else {
      await createCalendarEvent(token, payload);
      setNotice({ kind: "success", message: "Event added." });
    }
    setEventDialog(null);
    await loadEvents();
  };

  const handleDeleteEvent = async () => {
    if (eventDialog?.mode !== "edit") return;
    const token = await getApiAccessToken();
    await deleteCalendarEvent(token, eventDialog.event.id);
    setNotice({ kind: "success", message: "Event deleted." });
    setEventDialog(null);
    await loadEvents();
  };

  const handleImport = async (payload: SourceCreatePayload) => {
    const token = await getApiAccessToken();
    const result = await createCalendarSource(token, payload);
    const synced = result.synced;
    setNotice({
      kind: "success",
      message: `Imported ${result.source.display_name} (${synced.created} event${
        synced.created === 1 ? "" : "s"
      }).`,
    });
    setImportOpen(false);
    await Promise.all([loadSources(), loadEvents()]);
    void refreshSession().catch(() => {});
  };

  const handleRefreshSource = async (source: CalendarSource) => {
    setSyncingSourceId(source.id);
    try {
      const token = await getApiAccessToken();
      const result = await syncCalendarSource(token, source.id);
      const synced = result.synced;
      const summary = synced.not_modified
        ? "no changes since last sync"
        : `${synced.created} created, ${synced.updated} updated, ${synced.deleted} removed`;
      setNotice({
        kind: "success",
        message: `Synced ${source.display_name}: ${summary}.`,
      });
      await Promise.all([loadSources(), loadEvents()]);
      void refreshSession().catch(() => {});
    } catch (err: unknown) {
      setNotice({
        kind: "error",
        message: err instanceof Error ? err.message : "Sync failed.",
      });
    } finally {
      setSyncingSourceId(null);
    }
  };

  const handleDeleteSource = async (source: CalendarSource) => {
    if (confirmDeleteSourceId !== source.id) {
      setConfirmDeleteSourceId(source.id);
      return;
    }
    try {
      const token = await getApiAccessToken();
      await deleteCalendarSource(token, source.id);
      setNotice({
        kind: "success",
        message: `Removed ${source.display_name}.`,
      });
      setConfirmDeleteSourceId(null);
      await Promise.all([loadSources(), loadEvents()]);
    } catch (err: unknown) {
      setNotice({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to delete source.",
      });
    }
  };

  const handleDayClick = useCallback(
    (date: Date) => {
      const iso = isoDateForLocalDay(date);
      const fragment = buildUsersQueryFragment(
        orderedCheckedUserIds,
        approvedUsers,
      );
      navigate(`/calendar/day/${iso}${fragment}`);
    },
    [approvedUsers, navigate, orderedCheckedUserIds],
  );

  if (isLoading) return <Text>Loading…</Text>;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser) {
    return (
      <Stack gap="4" maxW="3xl">
        <Text fontWeight="semibold">Reconnecting your API session…</Text>
        <Text fontSize={APP_TEXT_SIZES.helper}>
          {sessionError ||
            "You are authenticated, but the API session is not ready yet."}
        </Text>
        <HStack>
          <PondButton colorPalette="sky" onClick={() => void refreshSession()}>
            Retry session sync
          </PondButton>
        </HStack>
      </Stack>
    );
  }
  if (!sessionUser.user.is_approved) {
    return (
      <Stack
        flex="1"
        minH="full"
        gap="4"
        px={{ base: "2", md: "2" }}
        py={{ base: "2", md: "2" }}
        {...fullBleedStackProps}
      >
        <Text fontSize={{ base: "sm", md: "md" }}>Approval required.</Text>
      </Stack>
    );
  }

  const iCalSources = sources.filter((s) => s.source_type === "ical");

  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Tabs.Root
        value={activeTab}
        display="flex"
        flexDirection="column"
        flex="1"
        minH="full"
        lazyMount
        unmountOnExit
        onValueChange={(details) => setActiveTab(parseTab(details.value))}
        variant="plain"
      >
        <Box
          flex="1"
          bg="sky.solid"
          px={{ base: "2", md: "2" }}
          py={{ base: "2", md: "2" }}
        >
          <Box
            maxW="5xl"
            w="100%"
            mx="auto"
            bg="gray.100"
            borderWidth="1px"
            borderColor="border"
            borderRadius="xl"
            overflow="hidden"
          >
            <Stack
              gap={{ base: "4", md: "4" }}
              px={{ base: "2", md: "2" }}
              pt={{ base: "2", md: "2" }}
              pb="2"
            >
              <Box {...ENTRY_CARD_PROPS}>
                <Heading
                  as="h1"
                  size={{ base: "lg", md: "xl" }}
                  fontWeight="bold"
                  mb="2"
                >
                  <HStack as="span" display="inline-flex" gap="2" alignItems="center">
                    <Text as="span" aria-hidden="true">
                      🗓️
                    </Text>
                    <Text as="span">Calendar</Text>
                  </HStack>
                </Heading>
                <Text fontSize={APP_TEXT_SIZES.body} lineHeight="tall" color="fg">
                  See which days you and others are busy. Tick the calendars you want to see
                  on the left; click any day for the full list of busy people.
                </Text>
              </Box>
            </Stack>
            <Tabs.List
              px={{ base: "2", md: "2" }}
              pt="0"
              pb="0"
              borderBottomWidth="1px"
              borderColor="border"
              gap="1"
              w="100%"
            >
              <Tabs.Trigger
                value="month"
                bg={activeTab === "month" ? "lilypad.solid" : undefined}
                color={activeTab === "month" ? "black" : undefined}
                borderTopRadius="md"
                borderBottomRadius="0"
                px="2"
                py="2"
                fontWeight="medium"
                _hover={{
                  bg: activeTab === "month" ? "lilypad.solid" : "transparent",
                }}
                _selected={{ bg: "lilypad.solid", color: "black" }}
              >
                Month
              </Tabs.Trigger>
              <Tabs.Trigger
                value="sources"
                bg={activeTab === "sources" ? "lilypad.solid" : undefined}
                color={activeTab === "sources" ? "black" : undefined}
                borderTopRadius="md"
                borderBottomRadius="0"
                px="2"
                py="2"
                fontWeight="medium"
                _hover={{
                  bg: activeTab === "sources" ? "lilypad.solid" : "transparent",
                }}
                _selected={{ bg: "lilypad.solid", color: "black" }}
              >
                Sources
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="month" p={{ base: "2", md: "2" }}>
              <Stack gap="3">
                <HStack justify="space-between" align="center" flexWrap="wrap" gap="2">
                  <HStack gap="2" align="center">
                    <PondButton
                      size="sm"
                      colorPalette="sky"
                      variant="outline"
                      onClick={() => setAnchor((a) => addMonths(a, -1))}
                      aria-label="Previous month"
                    >
                      ←
                    </PondButton>
                    <Heading as="h2" size="md" fontWeight="semibold">
                      {formatMonthLabel(anchor)}
                    </Heading>
                    <PondButton
                      size="sm"
                      colorPalette="sky"
                      variant="outline"
                      onClick={() => setAnchor((a) => addMonths(a, 1))}
                      aria-label="Next month"
                    >
                      →
                    </PondButton>
                    <PondButton
                      size="sm"
                      colorPalette="sky"
                      variant="outline"
                      onClick={() => setAnchor(monthAnchorFromDate(new Date()))}
                    >
                      Today
                    </PondButton>
                    {loading && !hasLoadedOnceRef.current ? (
                      <Text
                        fontSize={APP_TEXT_SIZES.helper}
                        color="fg.muted"
                        fontWeight="medium"
                        aria-live="polite"
                      >
                        Loading…
                      </Text>
                    ) : null}
                  </HStack>
                  <PondButton
                    size="sm"
                    colorPalette="lilypad"
                    onClick={() => setEventDialog({ mode: "create" })}
                  >
                    Add event
                  </PondButton>
                </HStack>
                {notice ? (
                  <Text
                    fontSize={APP_TEXT_SIZES.helper}
                    color={
                      notice.kind === "success" ? "lilypad.solid" : "nautical.solid"
                    }
                    fontWeight="medium"
                  >
                    {notice.message}
                  </Text>
                ) : null}
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
                  <Box flex="1" minW="0">
                    <MonthGrid
                      anchor={anchor}
                      events={events}
                      orderedCheckedUserIds={orderedCheckedUserIds}
                      ownersById={ownersById}
                      onDayClick={handleDayClick}
                    />
                  </Box>
                </Stack>
              </Stack>
            </Tabs.Content>

            <Tabs.Content value="sources" p={{ base: "2", md: "2" }}>
              <Stack gap="3">
                <HStack justify="space-between" align="center" flexWrap="wrap" gap="2">
                  <Text fontSize={APP_TEXT_SIZES.body}>
                    Calendars you've imported. They refresh automatically every
                    ~15 minutes. Only dates are pulled — titles and descriptions
                    are never read or stored.
                  </Text>
                  <PondButton
                    size="sm"
                    colorPalette="lilypad"
                    onClick={() => setImportOpen(true)}
                  >
                    Import Google Calendar
                  </PondButton>
                </HStack>
                {notice ? (
                  <Text
                    fontSize={APP_TEXT_SIZES.helper}
                    color={
                      notice.kind === "success" ? "lilypad.solid" : "nautical.solid"
                    }
                    fontWeight="medium"
                  >
                    {notice.message}
                  </Text>
                ) : null}
                {iCalSources.length === 0 ? (
                  <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                    No imported calendars yet.
                  </Text>
                ) : null}
                {iCalSources.map((source) => (
                  <Box
                    key={source.id}
                    bg="white"
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="xl"
                    p="2"
                  >
                    <Stack gap="2">
                      <HStack justify="space-between" align="start" gap="2" flexWrap="wrap">
                        <Stack gap="0">
                          <Text fontWeight="semibold">{source.display_name}</Text>
                          <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
                            {source.last_synced_at
                              ? `Last synced ${new Date(source.last_synced_at).toLocaleString()}`
                              : "Not synced yet"}
                            {source.last_error ? (
                              <> · <Text as="span" color="nautical.solid">{source.last_error}</Text></>
                            ) : null}
                          </Text>
                        </Stack>
                        <HStack gap="2" flexWrap="wrap">
                          <PondButton
                            size="sm"
                            colorPalette="sky"
                            variant="outline"
                            loading={syncingSourceId === source.id}
                            onClick={() => void handleRefreshSource(source)}
                          >
                            Refresh
                          </PondButton>
                          <PondButton
                            size="sm"
                            colorPalette="nautical"
                            onClick={() => void handleDeleteSource(source)}
                          >
                            {confirmDeleteSourceId === source.id
                              ? "Confirm delete"
                              : "Remove"}
                          </PondButton>
                        </HStack>
                      </HStack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Tabs.Content>
          </Box>
        </Box>
      </Tabs.Root>

      <EventFormDialog
        open={eventDialog !== null}
        onOpenChange={(open) => {
          if (!open) setEventDialog(null);
        }}
        onSubmit={handleSubmitEvent}
        onDelete={eventDialog?.mode === "edit" ? handleDeleteEvent : undefined}
        title={eventDialog?.mode === "edit" ? "Edit event" : "Add event"}
        submitLabel={eventDialog?.mode === "edit" ? "Save changes" : "Add event"}
        initial={
          eventDialog?.mode === "edit"
            ? {
                title: eventDialog.event.title ?? "",
                start_date: eventDialog.event.start_date,
                end_date: eventDialog.event.end_date,
              }
            : undefined
        }
      />
      <ImportIcalDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSubmit={handleImport}
      />

      {error ? (
        <Text px="2" pb="2" color="nautical.solid" role="alert">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}
