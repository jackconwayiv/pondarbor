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
import { PanelSessionReconnect, SessionLoadingCard } from "../components/panelStatus";
import PondButton from "../PondButton";
import { fullBleedStackProps, useIsMobile } from "../responsive";
import {
  APP_SHELL_TAB_LIST_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import { APP_SHELL_TRAY_PROPS, APP_TEXT_SIZES, PANEL_ENTRY_CARD_PROPS } from "../theme/typography";
import {
  createCalendarEvent,
  createCalendarSource,
  deleteCalendarEvent,
  deleteCalendarSource,
  fetchApprovedUsers,
  fetchCalendarBootstrap,
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
    resyncSessionSilently,
    error: sessionError,
  } = useAppSession();

  const [anchor, setAnchor] = useState<MonthAnchor>(() =>
    monthAnchorFromDate(new Date()),
  );
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<CalendarOwnerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [approvedUsersError, setApprovedUsersError] = useState<string | null>(
    null,
  );
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

  const { orderedCheckedUserIds, setCheckedUserIds, isDefaultAll } =
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
    setEventsError(null);
    try {
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
    } catch (err: unknown) {
      setEventsError(err instanceof Error ? err.message : "Failed to load events.");
      setEvents([]);
    }
  }, [getApiAccessToken, monthRange.end, monthRange.start, sessionUser]);

  const loadSources = useCallback(async () => {
    if (!sessionUser) return;
    setSourcesError(null);
    try {
      const token = await getApiAccessToken();
      const result = await fetchCalendarSources(token);
      setSources(result);
    } catch (err: unknown) {
      setSourcesError(err instanceof Error ? err.message : "Failed to load sources.");
      setSources([]);
    }
  }, [getApiAccessToken, sessionUser]);

  const loadApprovedUsers = useCallback(async () => {
    if (!sessionUser) return;
    setApprovedUsersError(null);
    try {
      const token = await getApiAccessToken();
      const result = await fetchApprovedUsers(token, "");
      setApprovedUsers(result);
    } catch (err: unknown) {
      setApprovedUsersError(
        err instanceof Error ? err.message : "Failed to load people.",
      );
      setApprovedUsers([]);
    }
  }, [getApiAccessToken, sessionUser]);

  const refreshAll = useCallback(async () => {
    if (!sessionUser) return;
    setLoading(true);
    setEventsError(null);
    setSourcesError(null);
    setApprovedUsersError(null);
    try {
      const token = await getApiAccessToken();
      const data = await fetchCalendarBootstrap(token, {
        start_date: monthRange.start,
        end_date: monthRange.end,
        owner: "all",
        approvedUsersQuery: "",
      });
      setEvents(data.events);
      setSources(data.sources);
      setApprovedUsers(data.approved_users);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load calendar.";
      setEventsError(msg);
      setSourcesError(msg);
      setApprovedUsersError(msg);
      setEvents([]);
      setSources([]);
      setApprovedUsers([]);
    }
    hasLoadedOnceRef.current = true;
    setLoading(false);
  }, [getApiAccessToken, monthRange.end, monthRange.start, sessionUser]);

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
    void resyncSessionSilently().catch(() => {});
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
      void resyncSessionSilently().catch(() => {});
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
          bg="bg"
          px={0}
          py={{ base: "2", md: "2" }}
        >
          <Box {...APP_SHELL_TRAY_PROPS}>
            <Tabs.List {...APP_SHELL_TAB_LIST_PROPS}>
              <Tabs.Trigger value="month" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                Month
              </Tabs.Trigger>
              <Tabs.Trigger value="sources" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                Import
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
                    colorPalette="teal"
                    onClick={() => setEventDialog({ mode: "create" })}
                  >
                    Add event
                  </PondButton>
                </HStack>
                {notice ? (
                  <Text
                    fontSize={APP_TEXT_SIZES.helper}
                    color={
                      notice.kind === "success" ? "forest.solid" : "nautical.solid"
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
                    loading={loading && !hasLoadedOnceRef.current}
                    error={approvedUsersError}
                    onRefresh={() => void loadApprovedUsers()}
                    orderedCheckedUserIds={orderedCheckedUserIds}
                    onChange={setCheckedUserIds}
                  />
                  <Box flex="1" minW="0">
                    <MonthGrid
                      anchor={anchor}
                      events={events}
                      orderedCheckedUserIds={orderedCheckedUserIds}
                      isDefaultAll={isDefaultAll}
                      ownersById={ownersById}
                      onDayClick={handleDayClick}
                    />
                    {eventsError ? (
                      <Text pt="2" fontSize={APP_TEXT_SIZES.helper} color="nautical.solid" role="alert">
                        {eventsError}
                      </Text>
                    ) : null}
                  </Box>
                </Stack>
              </Stack>
            </Tabs.Content>

            <Tabs.Content value="sources" p={{ base: "2", md: "2" }}>
              <Stack gap="3">
                <HStack justify="space-between" align="center" flexWrap="wrap" gap="2">
                  <Text fontSize={APP_TEXT_SIZES.body}>
                    Your imported calendars auto-refresh every
                    ~15 minutes. Titles and descriptions
                    are never read or stored, only dates.
                  </Text>
                  <PondButton
                    size="sm"
                    colorPalette="teal"
                    onClick={() => setImportOpen(true)}
                  >
                    Import Google Calendar
                  </PondButton>
                </HStack>
                {notice ? (
                  <Text
                    fontSize={APP_TEXT_SIZES.helper}
                    color={
                      notice.kind === "success" ? "forest.solid" : "nautical.solid"
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
                    bg="bg.panel"
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

      {sourcesError && activeTab === "sources" ? (
        <Text px="2" pb="2" color="nautical.solid" role="alert" fontSize={APP_TEXT_SIZES.helper}>
          {sourcesError}
        </Text>
      ) : null}
    </Stack>
  );
}
