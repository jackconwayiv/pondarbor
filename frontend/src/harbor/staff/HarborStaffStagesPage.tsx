/**
 * Edit cumulative stage unlock rows (12 fixed ids). PATCH merges fields server-side.
 * Desktop: stage list + detail pane (matches catalog editor pattern).
 */

import {
  Box,
  Field,
  Flex,
  Heading,
  HStack,
  Input,
  Stack,
  Switch,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppSession } from "../../auth/AppSessionContext";
import PondButton from "../../PondButton";
import { fetchStageUnlockList, patchStageUnlock } from "../api";
import type { HarborStageUnlockRow } from "../engine/types";

function staffApiErrorMessage(err: unknown): string {
  const base = err instanceof Error ? err.message : String(err);
  if (/\b403\b|\(403\)/.test(base)) {
    return `${base} Staff session expired or permission denied. Refresh the page or sign in again if your permissions changed.`;
  }
  return base;
}

export default function HarborStaffStagesPage() {
  const { getApiAccessToken } = useAppSession();
  const [rows, setRows] = useState<HarborStageUnlockRow[]>([]);
  const [selectedId, setSelectedId] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      const list = await fetchStageUnlockList(token);
      setRows(list);
    } catch (e) {
      setError(staffApiErrorMessage(e) || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [getApiAccessToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.stage_id - b.stage_id),
    [rows],
  );

  const selected = useMemo(
    () => rows.find((r) => r.stage_id === selectedId),
    [rows, selectedId],
  );

  const updateLocal = useCallback(
    (patch: Partial<HarborStageUnlockRow>) => {
      setRows((prev) =>
        prev.map((r) =>
          r.stage_id === selectedId ? { ...r, ...patch } : r,
        ),
      );
    },
    [selectedId],
  );

  const save = useCallback(async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      const updated = await patchStageUnlock(token, selected.stage_id, selected);
      setRows((prev) =>
        prev.map((r) => (r.stage_id === updated.stage_id ? updated : r)),
      );
    } catch (e) {
      setError(staffApiErrorMessage(e) || "Save failed.");
    } finally {
      setBusy(false);
    }
  }, [getApiAccessToken, selected]);

  if (loading) {
    return <Text>Loading stage unlocks…</Text>;
  }

  const formFields =
    selected &&
    (
      <Stack gap={3}>
        <Field.Root>
          <Field.Label>Title</Field.Label>
          <Input
            value={selected.title}
            onChange={(e) => updateLocal({ title: e.target.value })}
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Era</Field.Label>
          <Input
            value={selected.era}
            onChange={(e) => updateLocal({ era: e.target.value })}
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Age question</Field.Label>
          <Textarea
            value={selected.age_question}
            onChange={(e) => updateLocal({ age_question: e.target.value })}
            rows={2}
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Core tension</Field.Label>
          <Textarea
            value={selected.core_tension}
            onChange={(e) => updateLocal({ core_tension: e.target.value })}
            rows={2}
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Main lesson</Field.Label>
          <Textarea
            value={selected.main_lesson}
            onChange={(e) => updateLocal({ main_lesson: e.target.value })}
            rows={2}
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Resources (comma-separated slugs)</Field.Label>
          <Input
            value={selected.resources.join(",")}
            onChange={(e) =>
              updateLocal({
                resources: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Metrics (comma-separated)</Field.Label>
          <Input
            value={selected.metrics.join(",")}
            onChange={(e) =>
              updateLocal({
                metrics: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Voyage types (comma-separated)</Field.Label>
          <Input
            value={selected.voyage_types.join(",")}
            onChange={(e) =>
              updateLocal({
                voyage_types: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Panels (comma-separated)</Field.Label>
          <Input
            value={selected.panels.join(",")}
            onChange={(e) =>
              updateLocal({
                panels: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Content tags (comma-separated)</Field.Label>
          <Input
            value={selected.content_tags.join(",")}
            onChange={(e) =>
              updateLocal({
                content_tags: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Base command / day (empty = inherit)</Field.Label>
          <Input
            type="number"
            min={1}
            max={30}
            value={
              selected.base_command_per_day == null
                ? ""
                : String(selected.base_command_per_day)
            }
            onChange={(e) => {
              const t = e.target.value.trim();
              const n = Number(t);
              updateLocal({
                base_command_per_day:
                  t === "" || !Number.isFinite(n)
                    ? null
                    : Math.max(1, Math.min(30, Math.floor(n))),
              });
            }}
          />
        </Field.Root>
        <HStack>
          <Field.Label whiteSpace="nowrap">Doctrine unlocked</Field.Label>
          <Switch.Root
            checked={selected.doctrine_unlocked}
            onCheckedChange={(d) =>
              updateLocal({ doctrine_unlocked: !!d.checked })
            }
          >
            <Switch.HiddenInput />
            <Switch.Control />
          </Switch.Root>
        </HStack>
      </Stack>
    );

  return (
    <Stack gap={4} align="stretch" w="full">
      <Box>
        <Heading size="md">Stage unlocks</Heading>
        <Text fontSize="sm" color="fg.muted" mt={2} maxW="3xl">
          Twelve rows (one per age). Lists accumulate across stages on the
          client; changing copy here updates HUD and gates after players refresh
          catalog.
        </Text>
      </Box>

      {error ? (
        <Box color="red.fg" fontSize="sm">
          {error}
        </Box>
      ) : null}

      <Flex
        gap={4}
        align="stretch"
        flexDir={{ base: "column", lg: "row" }}
        minH={{ lg: "calc(70vh - 80px)" }}
      >
        <Box
          flex={{ base: "none", lg: "0 0 260px" }}
          borderWidth="1px"
          borderRadius="md"
          borderColor="border.subtle"
          overflow="hidden"
          display="flex"
          flexDir="column"
          maxH={{ lg: "calc(85vh - 120px)" }}
        >
          <Box
            px={3}
            py={2}
            borderBottomWidth="1px"
            borderColor="border.subtle"
            bg="bg.subtle"
          >
            <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
              Stages
            </Text>
          </Box>
          <Box flex="1" overflowY="auto">
            <Stack gap={0}>
              {sortedRows.map((r) => {
                const isSel = r.stage_id === selectedId;
                return (
                  <Box
                    key={r.stage_id}
                    px={3}
                    py={2.5}
                    cursor="pointer"
                    borderBottomWidth="1px"
                    borderColor="border.subtle"
                    bg={isSel ? "bg.muted" : "transparent"}
                    _hover={{ bg: isSel ? "bg.muted" : "bg.subtle" }}
                    onClick={() => setSelectedId(r.stage_id)}
                  >
                    <Text fontWeight="semibold" fontSize="sm">
                      {r.stage_id}. {r.title}
                    </Text>
                    <Text
                      fontSize="xs"
                      color="fg.muted"
                      lineClamp={1}
                    >
                      {r.era}
                    </Text>
                  </Box>
                );
              })}
            </Stack>
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
          maxH={{ lg: "calc(85vh - 120px)" }}
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
              <Heading size="sm">
                {selected
                  ? `Age ${selected.stage_id} · ${selected.title}`
                  : "Select a stage"}
              </Heading>
              <PondButton
                size="sm"
                colorPalette="lilypad"
                onClick={() => void save()}
                disabled={busy || !selected}
              >
                Save stage
              </PondButton>
            </HStack>
          </Box>
          <Box flex="1" overflowY="auto" px={4} py={4}>
            {formFields}
          </Box>
        </Box>
      </Flex>
    </Stack>
  );
}
