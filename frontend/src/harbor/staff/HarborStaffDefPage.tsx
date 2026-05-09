/**
 * Single page that edits any of the nine Harbormaster catalog def tables.
 *
 * Desktop-first: master list + detail pane; import via dialog.
 */

import {
  Badge,
  Box,
  CloseButton,
  Dialog,
  Field,
  Flex,
  Heading,
  HStack,
  Input,
  NumberInput,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppSession } from "../../auth/AppSessionContext";
import PondButton from "../../PondButton";
import {
  createDef,
  deleteDef,
  exportDefs,
  fetchDefList,
  fetchStaffSchema,
  importDefs,
  patchDef,
  type DefType,
  type StaffSchema,
} from "../api";
import { ALL_RESOURCES, type CatalogDef } from "../engine/types";
import {
  HarborStaffBuildingExtraFields,
  HarborStaffSchemaHints,
  HarborStaffShipExtraFields,
  HarborStaffShipUpgradeExtraFields,
} from "./harborStaffExtraEditors";

function staffApiErrorMessage(err: unknown): string {
  const base = err instanceof Error ? err.message : String(err);
  if (/\b403\b|\(403\)/.test(base)) {
    return `${base} Staff session expired or permission denied. Refresh the page or sign in again if your permissions changed.`;
  }
  return base;
}

type Props = {
  defType: DefType;
  title: string;
};

type EditableRow = CatalogDef<Record<string, unknown>>;

function emptyDraft(): Partial<EditableRow> & { extraText: string } {
  return {
    slug: "",
    name: "",
    description: "",
    stage_min: 1,
    stage_max: null,
    tags: [],
    extra: {},
    enabled: true,
    sort_order: 0,
    extraText: "{}",
  };
}

function fromRow(row: EditableRow): Partial<EditableRow> & { extraText: string } {
  return {
    ...row,
    extraText: JSON.stringify(row.extra ?? {}, null, 2),
  };
}

export default function HarborStaffDefPage({ defType, title }: Props) {
  const { getApiAccessToken } = useAppSession();
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [staffSchema, setStaffSchema] = useState<StaffSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Selected catalog row id, or 'new' for create, or null for empty detail. */
  const [selection, setSelection] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<
    (Partial<EditableRow> & { extraText: string }) | null
  >(null);
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      const [list, schema] = await Promise.all([
        fetchDefList(token, defType),
        fetchStaffSchema(token).catch(() => null),
      ]);
      setRows(list as EditableRow[]);
      setStaffSchema(schema);
    } catch (e) {
      setError(staffApiErrorMessage(e) || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [getApiAccessToken, defType]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setSelection(null);
    setDraft(null);
    setSearch("");
  }, [defType]);

  const sortedRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          a.sort_order - b.sort_order || a.slug.localeCompare(b.slug),
      ),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedRows;
    return sortedRows.filter(
      (r) =>
        r.slug.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q),
    );
  }, [sortedRows, search]);

  const cancelEdit = useCallback(() => {
    setSelection(null);
    setDraft(null);
  }, []);

  const startNew = useCallback(() => {
    setSelection("new");
    setDraft(emptyDraft());
  }, []);

  const selectRow = useCallback((row: EditableRow) => {
    setSelection(row.id);
    setDraft(fromRow(row));
  }, []);

  const save = useCallback(async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    let parsedExtra: unknown;
    try {
      parsedExtra = JSON.parse(draft.extraText || "{}");
    } catch (e) {
      setError(`Invalid JSON in extra: ${(e as Error).message}`);
      setBusy(false);
      return;
    }
    if (
      !parsedExtra ||
      typeof parsedExtra !== "object" ||
      Array.isArray(parsedExtra)
    ) {
      setError("Extra must be a JSON object.");
      setBusy(false);
      return;
    }
    const payload: Partial<EditableRow> = {
      slug: (draft.slug ?? "").trim(),
      name: (draft.name ?? "").trim(),
      description: draft.description ?? "",
      stage_min: draft.stage_min ?? 1,
      stage_max: draft.stage_max ?? null,
      tags: draft.tags ?? [],
      extra: parsedExtra as Record<string, unknown>,
      enabled: draft.enabled ?? true,
      sort_order: draft.sort_order ?? 0,
    };
    if (!payload.slug || !payload.name) {
      setError("slug and name are required.");
      setBusy(false);
      return;
    }
    try {
      const token = await getApiAccessToken();
      if (selection === "new") {
        const created = await createDef(
          token,
          defType,
          payload as Required<Pick<EditableRow, "slug" | "name">> &
            Partial<EditableRow>,
        );
        await refresh();
        setSelection(created.id);
        setDraft(fromRow(created as EditableRow));
      } else if (typeof selection === "number") {
        const updated = await patchDef(token, defType, selection, payload);
        await refresh();
        setDraft(fromRow(updated as EditableRow));
      }
    } catch (e) {
      setError(staffApiErrorMessage(e) || "Save failed.");
    } finally {
      setBusy(false);
    }
  }, [defType, draft, getApiAccessToken, refresh, selection]);

  const remove = useCallback(async () => {
    if (typeof selection !== "number" || !draft?.slug) return;
    if (
      !window.confirm(
        `Delete ${draft.slug}? Player saves referencing it will keep working but lose the link.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      await deleteDef(token, defType, selection);
      cancelEdit();
      await refresh();
    } catch (e) {
      setError(staffApiErrorMessage(e) || "Delete failed.");
    } finally {
      setBusy(false);
    }
  }, [cancelEdit, defType, draft?.slug, getApiAccessToken, refresh, selection]);

  const exportJson = useCallback(async () => {
    setBusy(true);
    try {
      const token = await getApiAccessToken();
      const data = await exportDefs(token, defType);
      const text = JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(text);
      window.alert(`Copied ${data.rows.length} rows to clipboard.`);
    } catch (e) {
      setError(staffApiErrorMessage(e) || "Export failed.");
    } finally {
      setBusy(false);
    }
  }, [defType, getApiAccessToken]);

  const exportDownload = useCallback(async () => {
    setBusy(true);
    try {
      const token = await getApiAccessToken();
      const data = await exportDefs(token, defType);
      const text = JSON.stringify(data, null, 2);
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${defType}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(staffApiErrorMessage(e) || "Export failed.");
    } finally {
      setBusy(false);
    }
  }, [defType, getApiAccessToken]);

  const runImport = useCallback(async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(importText || "{}");
    } catch (e) {
      setError(`Invalid JSON: ${(e as Error).message}`);
      return;
    }
    let rowsToImport: Array<Record<string, unknown>>;
    if (Array.isArray(parsed)) {
      rowsToImport = parsed as Array<Record<string, unknown>>;
    } else if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { rows?: unknown }).rows)
    ) {
      rowsToImport = (parsed as { rows: Array<Record<string, unknown>> })
        .rows;
    } else {
      setError(`Expected an array or { rows: [] }.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      const result = await importDefs(
        token,
        defType,
        rowsToImport as Array<{ slug: string; name: string }>,
      );
      setImportOpen(false);
      setImportText("");
      window.alert(
        `Imported. Created ${result.created}, updated ${result.updated}, errors ${result.errors.length}.`,
      );
      cancelEdit();
      await refresh();
    } catch (e) {
      setError(staffApiErrorMessage(e) || "Import failed.");
    } finally {
      setBusy(false);
    }
  }, [cancelEdit, defType, getApiAccessToken, importText, refresh]);

  const detailTitle =
    selection === "new"
      ? `New ${title.replace(/s$/, "")}`
      : typeof selection === "number" && draft?.name
        ? draft.name
        : title;

  return (
    <Stack gap={4} h="full">
      <HStack justify="space-between" wrap="wrap" gap={3} align="flex-start">
        <Heading size="md">{title}</Heading>
        <HStack gap={2} flexWrap="wrap">
          <PondButton size="sm" onClick={startNew} disabled={busy}>
            New
          </PondButton>
          <PondButton
            size="sm"
            onClick={() => void exportJson()}
            disabled={busy}
          >
            Copy JSON
          </PondButton>
          <PondButton
            size="sm"
            onClick={() => void exportDownload()}
            disabled={busy}
          >
            Download JSON
          </PondButton>
          <PondButton
            size="sm"
            onClick={() => setImportOpen(true)}
            disabled={busy}
          >
            Import JSON
          </PondButton>
        </HStack>
      </HStack>

      {error && (
        <Box bg="red.subtle" color="red.fg" px={3} py={2} borderRadius="md">
          {error}
        </Box>
      )}

      <Dialog.Root
        open={importOpen}
        onOpenChange={(d: { open: boolean }) => setImportOpen(d.open)}
        lazyMount
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="lg">
            <Dialog.Header>
              <Dialog.Title>Import JSON — {defType}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text fontSize="sm" color="fg.muted" mb={2}>
                Paste an array of rows or {" "}
                <code>{`{ "rows": [ ... ] }`}</code>.
              </Text>
              <Textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={14}
                fontFamily="mono"
                fontSize="sm"
                placeholder='[ { "slug": "...", "name": "...", ... } ]'
              />
            </Dialog.Body>
            <Dialog.Footer>
              <HStack gap={2}>
                <PondButton
                  size="sm"
                  colorPalette="lilypad"
                  onClick={() => void runImport()}
                  disabled={busy}
                >
                  Import
                </PondButton>
                <PondButton
                  size="sm"
                  variant="outline"
                  onClick={() => setImportOpen(false)}
                >
                  Cancel
                </PondButton>
              </HStack>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {loading ? (
        <Text>Loading…</Text>
      ) : (
        <Flex
          gap={4}
          align="stretch"
          flexDir={{ base: "column", lg: "row" }}
          minH={{ lg: "calc(70vh - 120px)" }}
        >
          <Box
            flex={{ base: "none", lg: "0 0 42%" }}
            maxW={{ lg: "520px" }}
            display="flex"
            flexDir="column"
            minH={{ lg: "360px" }}
          >
            <Field.Root mb={3}>
              <Field.Label>Search</Field.Label>
              <Input
                placeholder="Filter by slug or name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                size="sm"
              />
            </Field.Root>
            <Box
              flex="1"
              overflowY="auto"
              borderWidth="1px"
              borderRadius="md"
              borderColor="border.subtle"
            >
              <Table.Root size="sm" variant="line" stickyHeader>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Name</Table.ColumnHeader>
                    <Table.ColumnHeader display={{ base: "none", md: "table-cell" }}>
                      Slug
                    </Table.ColumnHeader>
                    <Table.ColumnHeader w="70px">Stage</Table.ColumnHeader>
                    <Table.ColumnHeader w="72px">On</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {filteredRows.length === 0 ? (
                    <Table.Row>
                      <Table.Cell colSpan={4}>
                        <Text color="fg.muted" py={3} px={2}>
                          No matching rows.
                        </Text>
                      </Table.Cell>
                    </Table.Row>
                  ) : (
                    filteredRows.map((row) => {
                      const isSel =
                        typeof selection === "number" && selection === row.id;
                      return (
                        <Table.Row
                          key={row.id}
                          cursor="pointer"
                          bg={isSel ? "bg.muted" : undefined}
                          onClick={() => selectRow(row)}
                          _hover={{ bg: isSel ? "bg.muted" : "bg.subtle" }}
                        >
                          <Table.Cell fontWeight="medium">
                            {row.name}
                          </Table.Cell>
                          <Table.Cell
                            fontFamily="mono"
                            fontSize="xs"
                            color="fg.muted"
                            display={{ base: "none", md: "table-cell" }}
                          >
                            {row.slug}
                          </Table.Cell>
                          <Table.Cell whiteSpace="nowrap">
                            {row.stage_min}
                            {row.stage_max ? `–${row.stage_max}` : "+"}
                          </Table.Cell>
                          <Table.Cell>
                            {row.enabled ? (
                              <Badge size="sm" colorPalette="green">
                                Yes
                              </Badge>
                            ) : (
                              <Badge size="sm" colorPalette="gray">
                                Off
                              </Badge>
                            )}
                          </Table.Cell>
                        </Table.Row>
                      );
                    })
                  )}
                </Table.Body>
              </Table.Root>
            </Box>
          </Box>

          <Box
            flex="1"
            minW={0}
            borderWidth="1px"
            borderRadius="md"
            borderColor="border.subtle"
            display="flex"
            flexDir="column"
            maxH={{ lg: "calc(85vh - 100px)" }}
          >
            <Box
              px={4}
              py={3}
              borderBottomWidth="1px"
              borderColor="border.subtle"
              position="sticky"
              top={0}
              bg="bg"
              zIndex={1}
            >
              <HStack justify="space-between" wrap="wrap" gap={2}>
                <Heading size="sm">{detailTitle}</Heading>
                <HStack gap={2}>
                  {draft && (
                    <>
                      <PondButton
                        size="sm"
                        colorPalette="lilypad"
                        onClick={() => void save()}
                        disabled={busy}
                      >
                        {selection === "new" ? "Create" : "Save"}
                      </PondButton>
                      <PondButton
                        size="sm"
                        variant="outline"
                        onClick={cancelEdit}
                        disabled={busy}
                      >
                        Cancel
                      </PondButton>
                      {typeof selection === "number" ? (
                        <PondButton
                          size="sm"
                          colorPalette="red"
                          onClick={() => void remove()}
                          disabled={busy}
                        >
                          Delete
                        </PondButton>
                      ) : null}
                    </>
                  )}
                </HStack>
              </HStack>
            </Box>

            <Box flex="1" overflowY="auto" px={4} py={4}>
              {!draft ? (
                <Text color="fg.muted">
                  Select a row from the list or click New to add one.
                </Text>
              ) : (
                <DefForm
                  draft={draft}
                  setDraft={setDraft}
                  defType={defType}
                  staffSchema={staffSchema}
                />
              )}
            </Box>
          </Box>
        </Flex>
      )}
    </Stack>
  );
}

function DefForm({
  draft,
  setDraft,
  defType,
  staffSchema,
}: {
  draft: Partial<EditableRow> & { extraText: string };
  setDraft: (v: Partial<EditableRow> & { extraText: string }) => void;
  defType: DefType;
  staffSchema: StaffSchema | null;
}) {
  const update = (patch: Partial<typeof draft>) =>
    setDraft({ ...draft, ...patch });
  const setExtraText = (extraText: string) => update({ extraText });
  const shipRoles = staffSchema?.ship_roles ?? [];
  const resourceList = staffSchema?.resources?.length
    ? staffSchema.resources
    : [...ALL_RESOURCES];
  const districts = staffSchema?.building_districts ?? [];

  return (
    <Stack gap={4}>
      <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
        <Field.Root>
          <Field.Label>Slug</Field.Label>
          <Input
            value={draft.slug ?? ""}
            onChange={(e) => update({ slug: e.target.value })}
            placeholder="kebab-case"
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Name</Field.Label>
          <Input
            value={draft.name ?? ""}
            onChange={(e) => update({ name: e.target.value })}
          />
        </Field.Root>
      </SimpleGrid>

      <Field.Root>
        <Field.Label>Description</Field.Label>
        <Textarea
          value={draft.description ?? ""}
          onChange={(e) => update({ description: e.target.value })}
          rows={2}
        />
      </Field.Root>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
        <Field.Root>
          <Field.Label>Stage min</Field.Label>
          <NumberInput.Root
            min={1}
            max={12}
            value={String(draft.stage_min ?? 1)}
            onValueChange={(d) =>
              update({
                stage_min: Math.max(
                  1,
                  Math.min(12, Math.floor(d.valueAsNumber || 1)),
                ),
              })
            }
          >
            <NumberInput.Control />
            <NumberInput.Input />
          </NumberInput.Root>
        </Field.Root>
        <Field.Root>
          <Field.Label>Stage max (opt.)</Field.Label>
          <Input
            value={draft.stage_max == null ? "" : String(draft.stage_max)}
            onChange={(e) =>
              update({
                stage_max:
                  e.target.value.trim() === ""
                    ? null
                    : Math.max(
                        1,
                        Math.min(12, Math.floor(Number(e.target.value) || 1)),
                      ),
              })
            }
            placeholder="—"
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Sort order</Field.Label>
          <Input
            value={String(draft.sort_order ?? 0)}
            onChange={(e) =>
              update({ sort_order: Math.floor(Number(e.target.value) || 0) })
            }
          />
        </Field.Root>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
        <Field.Root>
          <Field.Label>Tags (comma sep)</Field.Label>
          <Input
            value={(draft.tags ?? []).join(",")}
            onChange={(e) =>
              update({
                tags: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Enabled</Field.Label>
          <Switch.Root
            checked={draft.enabled ?? true}
            onCheckedChange={(d) => update({ enabled: !!d.checked })}
          >
            <Switch.HiddenInput />
            <Switch.Control />
          </Switch.Root>
        </Field.Root>
      </SimpleGrid>

      <HarborStaffSchemaHints schema={staffSchema} />

      {defType === "ships" ? (
        <HarborStaffShipExtraFields
          extraText={draft.extraText}
          setExtraText={setExtraText}
          shipRoles={shipRoles}
          resources={resourceList}
        />
      ) : null}
      {defType === "buildings" ? (
        <HarborStaffBuildingExtraFields
          extraText={draft.extraText}
          setExtraText={setExtraText}
          districts={districts}
        />
      ) : null}
      {defType === "ship_upgrades" ? (
        <HarborStaffShipUpgradeExtraFields
          extraText={draft.extraText}
          setExtraText={setExtraText}
          resources={resourceList}
        />
      ) : null}

      <Flex
        gap={4}
        flexDir={{ base: "column", xl: "row" }}
        align="stretch"
      >
        <Field.Root flex="1" minW={0}>
          <Field.Label>Extra (JSON)</Field.Label>
          <Textarea
            value={draft.extraText}
            onChange={(e) => update({ extraText: e.target.value })}
            rows={16}
            minH={{ xl: "320px" }}
            fontFamily="mono"
            fontSize="sm"
          />
          <Field.HelperText>
            Schema follows the def type (see seed_data.py). Structured fields
            stay in sync when JSON is valid.
          </Field.HelperText>
        </Field.Root>
      </Flex>
    </Stack>
  );
}
