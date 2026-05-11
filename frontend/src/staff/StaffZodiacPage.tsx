import {
  Box,
  Button,
  Collapsible,
  Heading,
  HStack,
  Stack,
  Table,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link as RouterLink } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { AppModal } from "../components/AppModal";
import { SessionLoadingCard } from "../components/panelStatus";
import { useHomeInbox } from "../home/homeInboxContext";
import { fullBleedStackProps } from "../responsive";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FIELD_PROPS,
  PANEL_NESTED_BLOCK_PROPS,
} from "../theme/typography";
import NatalChartWheel from "../zodiac/NatalChartWheel";
import ZodiacOverviewCardsStrip from "../zodiac/ZodiacOverviewCardsStrip";
import NatalChartPositions from "../zodiac/NatalChartPositions";
import {
  fetchStaffImportedCharts,
  fetchStaffPendingCharts,
  staffClearChart,
  staffImportChart,
  type PendingChartRow,
  type StaffImportedChartRow,
} from "../zodiac/api";

export default function StaffZodiacPage() {
  const { getApiAccessToken } = useAppSession();
  const { refreshInbox } = useHomeInbox();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PendingChartRow[]>([]);
  const [importedRows, setImportedRows] = useState<StaffImportedChartRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [chartText, setChartText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [undoTarget, setUndoTarget] = useState<StaffImportedChartRow | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [expandedImportedUserId, setExpandedImportedUserId] = useState<number | null>(
    null,
  );
  const pasteSectionRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const token = await getApiAccessToken();
      const [pendingRes, importedRes] = await Promise.all([
        fetchStaffPendingCharts(token),
        fetchStaffImportedCharts(token),
      ]);
      setRows(pendingRes.pending);
      setImportedRows(importedRes.imported);
      setSelectedUserId((prev) => {
        const pendingIds = new Set(pendingRes.pending.map((r) => r.user_id));
        const importedIds = new Set(importedRes.imported.map((r) => r.user_id));
        if (prev != null && (pendingIds.has(prev) || importedIds.has(prev))) return prev;
        return pendingRes.pending[0]?.user_id ?? importedRes.imported[0]?.user_id ?? null;
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load.");
    } finally {
      setLoading(false);
    }
  }, [getApiAccessToken]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const emailForUserId = useCallback(
    (userId: number | null) => {
      if (userId == null) return null;
      const p = rows.find((r) => r.user_id === userId);
      if (p) return p.email;
      const i = importedRows.find((r) => r.user_id === userId);
      return i?.email ?? null;
    },
    [rows, importedRows],
  );

  const onImport = async () => {
    if (selectedUserId == null) return;
    setImportBusy(true);
    setImportMsg(null);
    try {
      const token = await getApiAccessToken();
      const res = await staffImportChart(token, selectedUserId, chartText);
      const warn =
        res.warnings.length > 0 ? `Warnings: ${res.warnings.slice(0, 8).join("; ")}` : "Imported.";
      setImportMsg(warn);
      setChartText("");
      await reload();
      await refreshInbox();
    } catch (e: unknown) {
      setImportMsg(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setImportBusy(false);
    }
  };

  const focusPasteForRevise = (userId: number) => {
    setSelectedUserId(userId);
    setChartText("");
    setImportMsg(null);
    queueMicrotask(() => {
      pasteSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const onConfirmUndo = async () => {
    if (undoTarget == null) return;
    const email = undoTarget.email;
    const uid = undoTarget.user_id;
    setUndoBusy(true);
    setImportMsg(null);
    try {
      const token = await getApiAccessToken();
      await staffClearChart(token, uid);
      setUndoTarget(null);
      await reload();
      await refreshInbox();
      setImportMsg(`Import removed for ${email}. They are back in the waiting queue.`);
    } catch (e: unknown) {
      setImportMsg(e instanceof Error ? e.message : "Could not remove import.");
    } finally {
      setUndoBusy(false);
    }
  };

  if (loading) {
    return <SessionLoadingCard />;
  }

  return (
    <>
      <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
        <Box flex="1" bg="bg" px={0} py={{ base: "2", md: "2" }}>
          <Box {...APP_SHELL_TRAY_PROPS}>
            <Stack
              gap={{ base: "3", md: "3" }}
              px={{ base: "2", md: "2" }}
              pt={{ base: "2", md: "2" }}
              pb="2"
            >
              <Box {...PANEL_ENTRY_CARD_PROPS}>
                <Heading as="h1" size={{ base: "lg", md: "xl" }} fontWeight="bold" mb="2">
                  Zodiackary — staff import
                </Heading>
                <Text fontSize={APP_TEXT_SIZES.body} color="fg" lineHeight="tall">
                  Paste chart exports for users who are waiting. Replace an import from the list below.
                  Undo sends the member back to the waiting queue.
                </Text>
                <RouterLink to="/staff">
                  <Text
                    fontSize={APP_TEXT_SIZES.meta}
                    textDecoration="underline"
                    color="sky.emphasized"
                    mt="2"
                  >
                    ← Back to staff home
                  </Text>
                </RouterLink>
              </Box>

              {error && (
                <Box
                  borderRadius="lg"
                  borderWidth="1px"
                  borderColor="border"
                  bg="nautical.subtle"
                  p="3"
                >
                  <Text fontSize="sm" color="fg">
                    {error}
                  </Text>
                </Box>
              )}

              <Box {...PANEL_ENTRY_CARD_PROPS}>
                <Heading as="h2" size="md" fontWeight="bold" mb="3">
                  Imported charts ({importedRows.length})
                </Heading>
                <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" mb="3">
                  Expand a row to preview positions and aspects. Revise runs the same import flow with
                  new paste text; undo clears the chart.
                </Text>
                {importedRows.length === 0 ? (
                  <Text fontSize="sm" color="fg.muted">
                    No charts imported yet.
                  </Text>
                ) : (
                  <Stack gap="3">
                    {importedRows.map((row) => {
                      const chart = row.natal_chart;
                      const ready =
                        chart &&
                        row.sun_sign &&
                        row.moon_sign &&
                        row.rising_sign;
                      const isOpen = expandedImportedUserId === row.user_id;
                      return (
                        <Box
                          key={row.user_id}
                          borderWidth="1px"
                          borderColor="border"
                          borderRadius="lg"
                          overflow="hidden"
                          bg="bg.panel"
                        >
                          <Collapsible.Root
                            open={isOpen}
                            onOpenChange={(d) =>
                              setExpandedImportedUserId(d.open ? row.user_id : null)
                            }
                          >
                            <HStack
                              px="3"
                              py="2"
                              gap="3"
                              flexWrap="wrap"
                              alignItems="center"
                              justify="space-between"
                            >
                              <Collapsible.Trigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  h="auto"
                                  py="1"
                                  fontWeight="medium"
                                >
                                  <Text
                                    as="span"
                                    display="inline-block"
                                    transform={isOpen ? "rotate(90deg)" : "rotate(0deg)"}
                                    transition="transform 0.15s ease"
                                    mr="1"
                                    color="fg.muted"
                                  >
                                    ›
                                  </Text>
                                  {row.email}
                                  <Text as="span" fontWeight="normal" color="fg.muted" ml="2">
                                    Sun {row.sun_sign ?? "—"} · Moon {row.moon_sign ?? "—"} · Rising{" "}
                                    {row.rising_sign ?? "—"}
                                  </Text>
                                </Button>
                              </Collapsible.Trigger>
                              <HStack gap="2" flexWrap="wrap">
                                <PondButton
                                  size="sm"
                                  variant="outline"
                                  colorPalette="sky"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    focusPasteForRevise(row.user_id);
                                  }}
                                >
                                  Revise import
                                </PondButton>
                                <PondButton
                                  size="sm"
                                  variant="ghost"
                                  colorPalette="nautical"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setUndoTarget(row);
                                  }}
                                >
                                  Undo import
                                </PondButton>
                              </HStack>
                            </HStack>
                            <Collapsible.Content>
                              <Box px="3" pb="3" pt="0">
                                {ready ? (
                                  <Stack gap="6" w="100%">
                                    <NatalChartWheel chart={chart!} />
                                    <ZodiacOverviewCardsStrip
                                      sunSign={row.sun_sign!}
                                      moonSign={row.moon_sign!}
                                      risingSign={row.rising_sign!}
                                      mercurySign={chart!.points.mercury?.sign}
                                      venusSign={chart!.points.venus?.sign}
                                      marsSign={chart!.points.mars?.sign}
                                      natalChart={chart!}
                                    />
                                    <NatalChartPositions
                                      chart={chart!}
                                      aspectsNote="Stored natal chart JSON (staff import)."
                                    />
                                  </Stack>
                                ) : (
                                  <Text fontSize="sm" color="fg.muted">
                                    Chart payload incomplete.
                                  </Text>
                                )}
                              </Box>
                            </Collapsible.Content>
                          </Collapsible.Root>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Box>

              <Box {...PANEL_ENTRY_CARD_PROPS}>
                <Heading as="h2" size="md" fontWeight="bold" mb="3">
                  Pending queue
                </Heading>
                <Box {...PANEL_NESTED_BLOCK_PROPS} overflowX="auto">
                  <Table.Root size="sm" variant="line">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Select</Table.ColumnHeader>
                        <Table.ColumnHeader>User</Table.ColumnHeader>
                        <Table.ColumnHeader>Birth</Table.ColumnHeader>
                        <Table.ColumnHeader>Place</Table.ColumnHeader>
                        <Table.ColumnHeader>Queued</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {rows.length === 0 ? (
                        <Table.Row>
                          <Table.Cell colSpan={5}>
                            <Text fontSize="sm" color="fg.muted">
                              No charts awaiting import.
                            </Text>
                          </Table.Cell>
                        </Table.Row>
                      ) : (
                        rows.map((r) => (
                          <Table.Row key={r.user_id}>
                            <Table.Cell>
                              <input
                                type="radio"
                                name="zodiac-user"
                                checked={selectedUserId === r.user_id}
                                onChange={() => setSelectedUserId(r.user_id)}
                                aria-label={`Select ${r.email}`}
                              />
                            </Table.Cell>
                            <Table.Cell>
                              <Text fontWeight="medium">{r.email}</Text>
                              {r.display_name ? (
                                <Text fontSize="xs" color="fg.muted">
                                  {r.display_name}
                                </Text>
                              ) : null}
                            </Table.Cell>
                            <Table.Cell fontSize="sm" verticalAlign="top">
                              <Stack gap="0.5">
                                <Text lineHeight="short">{r.birth_date ?? "—"}</Text>
                                <Text lineHeight="short" color={r.birth_time ? "fg" : "fg.muted"}>
                                  {r.birth_time ? r.birth_time.slice(0, 5) : "No birth time"}
                                </Text>
                              </Stack>
                            </Table.Cell>
                            <Table.Cell fontSize="sm" verticalAlign="top">
                              <Stack gap="0.5">
                                <Text lineHeight="short">
                                  {[r.locality, r.admin_area].filter((x) => String(x).trim()).join(", ") ||
                                    "—"}
                                </Text>
                                <Text lineHeight="short">
                                  {(r.country_code || "").trim().toUpperCase() || "—"}
                                  {(r.postal_code || "").trim()
                                    ? ` · ${(r.postal_code || "").trim()}`
                                    : ""}
                                </Text>
                              </Stack>
                            </Table.Cell>
                            <Table.Cell fontSize="xs">
                              {r.waiting_submitted_at
                                ? new Date(r.waiting_submitted_at).toLocaleString()
                                : "—"}
                            </Table.Cell>
                          </Table.Row>
                        ))
                      )}
                    </Table.Body>
                  </Table.Root>
                </Box>
              </Box>

              <Box ref={pasteSectionRef} {...PANEL_ENTRY_CARD_PROPS}>
                <Heading as="h2" size="md" fontWeight="bold" mb="3">
                  Paste chart export
                </Heading>
                <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" mb="2">
                  Target user:{" "}
                  <Text as="span" fontWeight="semibold" color="fg">
                    {selectedUserId != null && emailForUserId(selectedUserId)
                      ? emailForUserId(selectedUserId)
                      : "—"}
                  </Text>
                  {selectedUserId != null &&
                  importedRows.some((r) => r.user_id === selectedUserId) ? (
                    <Text as="span" display="block" mt="1">
                      Replacing an existing import for this member.
                    </Text>
                  ) : null}
                </Text>
                <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" mb="3">
                  Plain text from your chart software — same parser as the member-facing chart.
                </Text>
                <Textarea
                  rows={14}
                  fontFamily="mono"
                  fontSize="xs"
                  placeholder="Paste positions, houses, aspects export…"
                  value={chartText}
                  onChange={(e) => setChartText(e.target.value)}
                  {...PANEL_FIELD_PROPS}
                />
                {importMsg && (
                  <Text fontSize="sm" whiteSpace="pre-wrap" mt="3" color="fg">
                    {importMsg}
                  </Text>
                )}
                <Box mt="4">
                  <PondButton
                    colorPalette="sky"
                    onClick={() => void onImport()}
                    disabled={importBusy || selectedUserId == null}
                  >
                    {importBusy ? "Saving…" : "Import chart for selected user"}
                  </PondButton>
                </Box>
              </Box>
            </Stack>
          </Box>
        </Box>
      </Stack>

      <AppModal
        open={undoTarget != null}
        onOpenChange={(open) => {
          if (!open) setUndoTarget(null);
        }}
        title="Remove this import?"
        description={
          undoTarget
            ? `Clear the chart for ${undoTarget.email}. They will return to the waiting queue until someone imports again.`
            : ""
        }
        size="sm"
      >
        <HStack gap="2" justify="flex-end" pt="2">
          <PondButton variant="ghost" onClick={() => setUndoTarget(null)} disabled={undoBusy}>
            Cancel
          </PondButton>
          <PondButton
            colorPalette="nautical"
            onClick={() => void onConfirmUndo()}
            disabled={undoBusy}
          >
            {undoBusy ? "Removing…" : "Remove import"}
          </PondButton>
        </HStack>
      </AppModal>
    </>
  );
}
