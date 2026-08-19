import {
  Box,
  Collapsible,
  HStack,
  Heading,
  Input,
  Stack,
  Switch,
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
import { APP_SHELL_TRAY_PROPS, APP_TEXT_SIZES, PANEL_ENTRY_CARD_PROPS, PANEL_FIELD_PROPS } from "../theme/typography";
import {
  createCalendarEvent,
  createCalendarSource,
  deleteCalendarEvent,
  deleteCalendarSource,
  fetchApprovedUsers,
  fetchCalendarBootstrap,
  fetchCalendarEvents,
  fetchCalendarSources,
  syncCalendarRefresh,
  syncCalendarSource,
  updateCalendarSource,
  updateCalendarEvent,
} from "./api";
import EventFormDialog from "./EventFormDialog";
import CalendarExportDialog from "./CalendarExportDialog";
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
  CalendarBirthdayRow,
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
    patchMyProfile,
    error: sessionError,
  } = useAppSession();

  const [anchor, setAnchor] = useState<MonthAnchor>(() =>
    monthAnchorFromDate(new Date()),
  );
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [birthdays, setBirthdays] = useState<CalendarBirthdayRow[]>([]);
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<CalendarOwnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
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
  const [exportOpen, setExportOpen] = useState(false);
  const [syncingSourceId, setSyncingSourceId] = useState<number | null>(null);
  const [confirmDeleteSourceId, setConfirmDeleteSourceId] = useState<number | null>(
    null,
  );
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [calendarDisplaySaving, setCalendarDisplaySaving] = useState(false);
  const [savingLabelSourceId, setSavingLabelSourceId] = useState<number | null>(null);
  const [editingLabelSourceId, setEditingLabelSourceId] = useState<number | null>(null);
  const [labelDrafts, setLabelDrafts] = useState<Record<number, string>>({});
  const hasLoadedOnceRef = useRef(false);
  const syncRunRef = useRef(0);

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
  useEffect(() => {
    setPeopleOpen(!isMobile);
  }, [isMobile]);

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

  const eventOverlapsVisibleRange = useCallback(
    (event: CalendarEvent) =>
      !(event.end_date < monthRange.start || event.start_date > monthRange.end),
    [monthRange.end, monthRange.start],
  );

  const applySavedEvent = useCallback(
    (savedEvent: CalendarEvent) => {
      setEvents((prev) => {
        const withoutCurrent = prev.filter((ev) => ev.id !== savedEvent.id);
        if (!eventOverlapsVisibleRange(savedEvent)) {
          return withoutCurrent;
        }
        const next = [...withoutCurrent, savedEvent];
        next.sort((a, b) =>
          a.start_date === b.start_date
            ? a.id - b.id
            : a.start_date.localeCompare(b.start_date),
        );
        return next;
      });
    },
    [eventOverlapsVisibleRange],
  );

  const refreshAll = useCallback(async () => {
    if (!sessionUser) return;
    const runId = Date.now();
    syncRunRef.current = runId;
    setLoading(true);
    setIsSyncing(false);
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
      setBirthdays(data.birthdays);

      hasLoadedOnceRef.current = true;
      setLoading(false);

      if (data.sync_pending_sources <= 0) {
        setIsSyncing(false);
        return;
      }

      setIsSyncing(true);
      void (async () => {
        try {
          const refreshed = await syncCalendarRefresh(token, {
            start_date: monthRange.start,
            end_date: monthRange.end,
            owner: "all",
          });
          if (syncRunRef.current !== runId) return;
          setEvents(refreshed.events);
          setBirthdays(refreshed.birthdays);
        } catch {
          // Keep current data rendered; syncing is best-effort.
        } finally {
          if (syncRunRef.current === runId) {
            setIsSyncing(false);
          }
        }
      })();
      return;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load calendar.";
      setEventsError(msg);
      setSourcesError(msg);
      setApprovedUsersError(msg);
      setEvents([]);
      setBirthdays([]);
      setSources([]);
      setApprovedUsers([]);
    }
    hasLoadedOnceRef.current = true;
    setLoading(false);
  }, [getApiAccessToken, monthRange.end, monthRange.start, sessionUser]);

  useEffect(() => {
    if (!isAuthenticated || !sessionUser) {
      setLoading(false);
      return;
    }
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
      const updated = await updateCalendarEvent(token, eventDialog.event.id, payload);
      applySavedEvent(updated);
      setNotice({ kind: "success", message: "Event updated." });
    } else {
      const created = await createCalendarEvent(token, payload);
      applySavedEvent(created);
      setNotice({ kind: "success", message: "Event added." });
    }
    setEventDialog(null);
  };

  const handleDeleteEvent = async () => {
    if (eventDialog?.mode !== "edit") return;
    const token = await getApiAccessToken();
    await deleteCalendarEvent(token, eventDialog.event.id);
    setNotice({ kind: "success", message: "Event deleted." });
    setEvents((prev) => prev.filter((ev) => ev.id !== eventDialog.event.id));
    setEventDialog(null);
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
      setLabelDrafts((prev) => {
        const next = { ...prev };
        delete next[source.id];
        return next;
      });
      await Promise.all([loadSources(), loadEvents()]);
    } catch (err: unknown) {
      setNotice({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to delete source.",
      });
    }
  };

  const beginEditSourceLabel = (source: CalendarSource) => {
    setEditingLabelSourceId(source.id);
    setLabelDrafts((prev) => ({ ...prev, [source.id]: source.display_name }));
  };

  const cancelEditSourceLabel = (source: CalendarSource) => {
    setEditingLabelSourceId((current) => (current === source.id ? null : current));
    setLabelDrafts((prev) => {
      const next = { ...prev };
      delete next[source.id];
      return next;
    });
  };

  const handleSaveSourceLabel = async (source: CalendarSource) => {
    const draft = (labelDrafts[source.id] ?? source.display_name).trim();
    setEditingLabelSourceId((current) => (current === source.id ? null : current));
    if (!draft || draft === source.display_name) {
      setLabelDrafts((prev) => {
        const next = { ...prev };
        delete next[source.id];
        return next;
      });
      return;
    }

    setSavingLabelSourceId(source.id);
    try {
      const token = await getApiAccessToken();
      const updated = await updateCalendarSource(token, source.id, {
        display_name: draft,
      });
      setSources((prev) =>
        prev.map((row) => (row.id === updated.id ? updated : row)),
      );
      setEvents((prev) =>
        prev.map((ev) =>
          ev.source_id === updated.id
            ? { ...ev, source_display_name: updated.display_name }
            : ev,
        ),
      );
    } catch (err: unknown) {
      setNotice({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to save label.",
      });
    } finally {
      setSavingLabelSourceId(null);
      setLabelDrafts((prev) => {
        const next = { ...prev };
        delete next[source.id];
        return next;
      });
    }
  };

  const handleCalendarDisplayToggle = async (checked: boolean) => {
    setCalendarDisplaySaving(true);
    try {
      await patchMyProfile({ calendar_display_source_names: checked });
      await loadEvents();
    } catch (err: unknown) {
      setNotice({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to save setting.",
      });
    } finally {
      setCalendarDisplaySaving(false);
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
            <Stack
              gap={{ base: "4", md: "4" }}
              px={{ base: "2", md: "2" }}
              pt={{ base: "2", md: "2" }}
              pb="2"
            >
              <Box {...PANEL_ENTRY_CARD_PROPS}>
                <Heading as="h1" size={{ base: "lg", md: "xl" }} mb="2">
                  <HStack as="span" display="inline-flex" gap="2" alignItems="center" flexWrap="wrap">
                    <Text as="span" aria-hidden="true">
                      🗓️
                    </Text>
                    <Text as="span">Calendar</Text>
                    {loading && !hasLoadedOnceRef.current ? (
                      <Text
                        as="span"
                        fontSize={APP_TEXT_SIZES.helper}
                        color="fg.muted"
                        fontWeight="medium"
                        aria-live="polite"
                      >
                        Loading…
                      </Text>
                    ) : null}
                  </HStack>
                </Heading>
                <Text fontSize={APP_TEXT_SIZES.body} lineHeight="tall" color="fg">
                  Track your plans, import Google calendars, and quickly scan shared availability.
                </Text>
              </Box>
            </Stack>
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
                    <Heading as="h2" size="md">
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
                    {loading ? (
                      <Text
                        fontSize={APP_TEXT_SIZES.helper}
                        color="fg.muted"
                        fontWeight="medium"
                        aria-live="polite"
                      >
                        Loading…
                      </Text>
                    ) : isSyncing ? (
                      <Text
                        fontSize={APP_TEXT_SIZES.helper}
                        color="fg.muted"
                        fontWeight="medium"
                        aria-live="polite"
                      >
                        Syncing…
                      </Text>
                    ) : null}
                  </HStack>
                  <PondButton
                    size="sm"
                    colorPalette="lilypad"
                    onClick={() => setEventDialog({ mode: "create" })}
                    display={{ base: "none", md: "inline-flex" }}
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
                  {isMobile ? (
                    <Collapsible.Root
                      open={peopleOpen}
                      onOpenChange={(details) => setPeopleOpen(details.open)}
                    >
                      <Stack gap="2">
                        <HStack gap="2" align="stretch">
                          <PondButton
                            size="sm"
                            colorPalette="lilypad"
                            onClick={() => setEventDialog({ mode: "create" })}
                            flex="1"
                          >
                            Add event
                          </PondButton>
                          <Collapsible.Trigger asChild>
                            <PondButton
                              size="sm"
                              uiClass="filter"
                              uiActive={peopleOpen}
                              justifyContent="center"
                              flex="1"
                            >
                              Filter People
                            </PondButton>
                          </Collapsible.Trigger>
                          <PondButton
                            size="sm"
                            colorPalette="sky"
                            variant="outline"
                            onClick={() => setExportOpen(true)}
                            flex="1"
                          >
                            Export
                          </PondButton>
                        </HStack>
                        <Collapsible.Content>
                          <UserCheckboxList
                            approvedUsers={approvedUsers}
                            loading={loading && !hasLoadedOnceRef.current}
                            error={approvedUsersError}
                            onRefresh={() => void loadApprovedUsers()}
                            orderedCheckedUserIds={orderedCheckedUserIds}
                            onChange={setCheckedUserIds}
                          />
                        </Collapsible.Content>
                      </Stack>
                    </Collapsible.Root>
                  ) : (
                    <UserCheckboxList
                      approvedUsers={approvedUsers}
                      loading={loading && !hasLoadedOnceRef.current}
                      error={approvedUsersError}
                      onRefresh={() => void loadApprovedUsers()}
                      orderedCheckedUserIds={orderedCheckedUserIds}
                      onChange={setCheckedUserIds}
                      onExport={() => setExportOpen(true)}
                    />
                  )}
                  <Box flex="1" minW="0">
                    <MonthGrid
                      anchor={anchor}
                      events={events}
                      birthdays={birthdays}
                      orderedCheckedUserIds={orderedCheckedUserIds}
                      colorUserIds={approvedUsers.map((u) => u.id)}
                      isDefaultAll={isDefaultAll}
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
                <HStack gap="3" align="center" flexWrap="wrap">
                  <Switch.Root
                    checked={
                      sessionUser.profile.calendar_display_source_names ?? false
                    }
                    onCheckedChange={(details) =>
                      void handleCalendarDisplayToggle(!!details.checked)
                    }
                    disabled={calendarDisplaySaving}
                    colorPalette="teal"
                  >
                    <Switch.HiddenInput />
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Root>
                  <Text fontSize={APP_TEXT_SIZES.helper}>
                    Display my calendars with custom labels.
                  </Text>
                </HStack>
                <HStack justify="space-between" align="center" flexWrap="wrap" gap="2">
                  <Text fontSize={APP_TEXT_SIZES.body}>
                    Your imported calendars auto-refresh every
                    ~15 minutes. Titles and descriptions
                    are never read or stored, only dates.
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
                    bg="bg.panel"
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="xl"
                    p="2"
                  >
                    <Stack gap="2">
                      <HStack justify="space-between" align="start" gap="2" flexWrap="wrap">
                        <Stack gap="0" flex="1" minW="0">
                          {editingLabelSourceId === source.id ? (
                            <Input
                              autoFocus
                              value={labelDrafts[source.id] ?? source.display_name}
                              onChange={(e) =>
                                setLabelDrafts((prev) => ({
                                  ...prev,
                                  [source.id]: e.target.value,
                                }))
                              }
                              onBlur={() => void handleSaveSourceLabel(source)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.currentTarget.blur();
                                } else if (e.key === "Escape") {
                                  cancelEditSourceLabel(source);
                                }
                              }}
                              maxLength={120}
                              disabled={savingLabelSourceId === source.id}
                              {...PANEL_FIELD_PROPS}
                            />
                          ) : (
                            <Text
                              fontWeight="semibold"
                              cursor="pointer"
                              lineClamp={1}
                              onClick={() => beginEditSourceLabel(source)}
                              _hover={{ textDecoration: "underline" }}
                            >
                              {source.display_name}
                            </Text>
                          )}
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
      <CalendarExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        orderedCheckedUserIds={orderedCheckedUserIds}
        getApiAccessToken={getApiAccessToken}
      />

      {sourcesError && activeTab === "sources" ? (
        <Text px="2" pb="2" color="nautical.solid" role="alert" fontSize={APP_TEXT_SIZES.helper}>
          {sourcesError}
        </Text>
      ) : null}
    </Stack>
  );
}
