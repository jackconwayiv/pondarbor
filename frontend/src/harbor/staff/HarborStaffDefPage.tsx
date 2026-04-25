/**
 * Single page that edits any of the eight Harbormaster def tables.
 *
 * Driven by the `defType` prop; the layout passes it via the route element.
 * Common fields (slug/name/stage_min/...) get typed inputs; the
 * type-specific `extra` blob is a raw JSON textarea (validated on save) so
 * we never have to ship a new editor when a key gets added in the engine.
 */

import {
  Box,
  Field,
  Heading,
  HStack,
  Input,
  NumberInput,
  Stack,
  Switch,
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
  importDefs,
  patchDef,
  type DefType,
} from "../api";
import type { CatalogDef } from "../engine/types";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<
    (Partial<EditableRow> & { extraText: string }) | null
  >(null);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      const list = await fetchDefList(token, defType);
      setRows(list as EditableRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [getApiAccessToken, defType]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startEditing = (row: EditableRow) => {
    setEditingId(row.id);
    setDraft(fromRow(row));
    setCreateOpen(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
    setCreateOpen(false);
  };

  const onCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setCreateOpen(true);
  };

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.sort_order - b.sort_order || a.slug.localeCompare(b.slug)),
    [rows],
  );

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
    if (!parsedExtra || typeof parsedExtra !== "object" || Array.isArray(parsedExtra)) {
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
      if (createOpen) {
        await createDef(token, defType, payload as Required<Pick<EditableRow, "slug" | "name">> & Partial<EditableRow>);
      } else if (editingId != null) {
        await patchDef(token, defType, editingId, payload);
      }
      cancelEdit();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }, [createOpen, defType, draft, editingId, getApiAccessToken, refresh]);

  const remove = useCallback(
    async (row: EditableRow) => {
      if (!window.confirm(`Delete ${row.slug}? Player saves referencing it will keep working but lose the link.`)) {
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const token = await getApiAccessToken();
        await deleteDef(token, defType, row.id);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed.");
      } finally {
        setBusy(false);
      }
    },
    [defType, getApiAccessToken, refresh],
  );

  const exportJson = useCallback(async () => {
    setBusy(true);
    try {
      const token = await getApiAccessToken();
      const data = await exportDefs(token, defType);
      const text = JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(text);
      window.alert(`Copied ${data.rows.length} rows to clipboard.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }, [defType, getApiAccessToken]);

  const importJson = useCallback(async () => {
    const raw = window.prompt(
      `Paste JSON for ${defType}. Expected shape: { "rows": [...] } or [...].`,
    );
    if (!raw) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      window.alert(`Invalid JSON: ${(e as Error).message}`);
      return;
    }
    let rowsToImport: Array<Record<string, unknown>>;
    if (Array.isArray(parsed)) {
      rowsToImport = parsed as Array<Record<string, unknown>>;
    } else if (parsed && typeof parsed === "object" && Array.isArray((parsed as { rows?: unknown }).rows)) {
      rowsToImport = (parsed as { rows: Array<Record<string, unknown>> }).rows;
    } else {
      window.alert(`Expected an array or { rows: [] }.`);
      return;
    }
    setBusy(true);
    try {
      const token = await getApiAccessToken();
      const result = await importDefs(
        token,
        defType,
        rowsToImport as Array<{ slug: string; name: string }>,
      );
      window.alert(
        `Imported. Created ${result.created}, updated ${result.updated}, errors ${result.errors.length}.`,
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }, [defType, getApiAccessToken, refresh]);

  return (
    <Stack gap={4}>
      <HStack justify="space-between" wrap="wrap" gap={2}>
        <Heading size="md">{title}</Heading>
        <HStack gap={2}>
          <PondButton size="xs" onClick={onCreate} disabled={busy}>
            New
          </PondButton>
          <PondButton size="xs" onClick={() => void exportJson()} disabled={busy}>
            Export JSON
          </PondButton>
          <PondButton size="xs" onClick={() => void importJson()} disabled={busy}>
            Import JSON
          </PondButton>
        </HStack>
      </HStack>
      {error && (
        <Box bg="red.subtle" color="red.fg" px={3} py={2} borderRadius="md">
          {error}
        </Box>
      )}
      {loading ? (
        <Text>Loading…</Text>
      ) : (
        <Stack gap={2}>
          {sortedRows.length === 0 && <Text color="fg.muted">No rows yet.</Text>}
          {sortedRows.map((row) => {
            const isEditing = editingId === row.id;
            return (
              <Box
                key={row.id}
                borderWidth="1px"
                borderRadius="md"
                px={3}
                py={2}
              >
                <HStack justify="space-between" wrap="wrap" gap={2}>
                  <Box>
                    <Text fontWeight="bold">
                      {row.name}{" "}
                      <Text as="span" color="fg.muted" fontWeight="normal">
                        — {row.slug}
                      </Text>
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                      Stage {row.stage_min}
                      {row.stage_max ? `–${row.stage_max}` : "+"}{" "}
                      {row.enabled ? "" : "· disabled"}
                    </Text>
                  </Box>
                  <HStack gap={2}>
                    {!isEditing && (
                      <>
                        <PondButton size="xs" onClick={() => startEditing(row)}>
                          Edit
                        </PondButton>
                        <PondButton
                          size="xs"
                          onClick={() => void remove(row)}
                          colorPalette="red"
                        >
                          Delete
                        </PondButton>
                      </>
                    )}
                  </HStack>
                </HStack>
                {isEditing && draft && (
                  <DefForm draft={draft} setDraft={setDraft} />
                )}
                {isEditing && (
                  <HStack gap={2} mt={3}>
                    <PondButton
                      size="sm"
                      onClick={() => void save()}
                      disabled={busy}
                      colorPalette="lilypad"
                    >
                      Save
                    </PondButton>
                    <PondButton size="sm" onClick={cancelEdit} disabled={busy}>
                      Cancel
                    </PondButton>
                  </HStack>
                )}
              </Box>
            );
          })}
          {createOpen && draft && (
            <Box borderWidth="1px" borderRadius="md" px={3} py={2}>
              <Heading size="sm" mb={2}>
                New {defType.slice(0, -1)}
              </Heading>
              <DefForm draft={draft} setDraft={setDraft} />
              <HStack gap={2} mt={3}>
                <PondButton
                  size="sm"
                  colorPalette="lilypad"
                  onClick={() => void save()}
                  disabled={busy}
                >
                  Create
                </PondButton>
                <PondButton size="sm" onClick={cancelEdit} disabled={busy}>
                  Cancel
                </PondButton>
              </HStack>
            </Box>
          )}
        </Stack>
      )}
    </Stack>
  );
}

function DefForm({
  draft,
  setDraft,
}: {
  draft: Partial<EditableRow> & { extraText: string };
  setDraft: (v: Partial<EditableRow> & { extraText: string }) => void;
}) {
  const update = (patch: Partial<typeof draft>) => setDraft({ ...draft, ...patch });
  return (
    <Stack gap={3} mt={3}>
      <HStack gap={3} wrap="wrap">
        <Field.Root flex="1" minW="180px">
          <Field.Label>Slug</Field.Label>
          <Input
            value={draft.slug ?? ""}
            onChange={(e) => update({ slug: e.target.value })}
            placeholder="kebab-case"
          />
        </Field.Root>
        <Field.Root flex="2" minW="220px">
          <Field.Label>Name</Field.Label>
          <Input
            value={draft.name ?? ""}
            onChange={(e) => update({ name: e.target.value })}
          />
        </Field.Root>
      </HStack>
      <Field.Root>
        <Field.Label>Description</Field.Label>
        <Textarea
          value={draft.description ?? ""}
          onChange={(e) => update({ description: e.target.value })}
          rows={2}
        />
      </Field.Root>
      <HStack gap={3} wrap="wrap">
        <Field.Root w="120px">
          <Field.Label>Stage min</Field.Label>
          <NumberInput.Root
            min={1}
            max={12}
            value={String(draft.stage_min ?? 1)}
            onValueChange={(d) => update({ stage_min: Math.max(1, Math.min(12, Math.floor(d.valueAsNumber || 1))) })}
          >
            <NumberInput.Control />
            <NumberInput.Input />
          </NumberInput.Root>
        </Field.Root>
        <Field.Root w="120px">
          <Field.Label>Stage max (opt.)</Field.Label>
          <Input
            value={draft.stage_max == null ? "" : String(draft.stage_max)}
            onChange={(e) =>
              update({
                stage_max:
                  e.target.value.trim() === ""
                    ? null
                    : Math.max(1, Math.min(12, Math.floor(Number(e.target.value) || 1))),
              })
            }
            placeholder="—"
          />
        </Field.Root>
        <Field.Root w="120px">
          <Field.Label>Sort order</Field.Label>
          <Input
            value={String(draft.sort_order ?? 0)}
            onChange={(e) =>
              update({ sort_order: Math.floor(Number(e.target.value) || 0) })
            }
          />
        </Field.Root>
        <Field.Root w="180px">
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
        <Field.Root w="120px">
          <Field.Label>Enabled</Field.Label>
          <Switch.Root
            checked={draft.enabled ?? true}
            onCheckedChange={(d) => update({ enabled: !!d.checked })}
          >
            <Switch.HiddenInput />
            <Switch.Control />
          </Switch.Root>
        </Field.Root>
      </HStack>
      <Field.Root>
        <Field.Label>Extra (JSON)</Field.Label>
        <Textarea
          value={draft.extraText}
          onChange={(e) => update({ extraText: e.target.value })}
          rows={10}
          fontFamily="mono"
          fontSize="sm"
        />
        <Field.HelperText>
          Schema follows the def type (see seed_data.py for examples).
        </Field.HelperText>
      </Field.Root>
    </Stack>
  );
}
