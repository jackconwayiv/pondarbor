import {
  Box,
  Button,
  Field,
  Flex,
  Heading,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { PanelBlockSkeleton } from "../components/panelStatus";
import QffButton from "./QffButton";
import { qffGhostRowButtonProps } from "./qffUi";
import {
  dmCreateClass,
  dmDeleteClass,
  dmFetchClasses,
  dmFetchItems,
  dmPatchClass,
  type DmCharacterClass,
  type DmItem,
} from "./api";

const STATS = ["gains", "moves", "guts", "smarts", "sense", "rizz"] as const;

function emptyForm(): Partial<DmCharacterClass> & { extra_json: string } {
  return {
    slug: "",
    name: "",
    sort_order: 0,
    description: "",
    priority_stat_1: "gains",
    priority_stat_2: "guts",
    starter_chest_item_id: null,
    starter_main_hand_item_id: null,
    extra_json: "{}\n",
  };
}

function itemsForSlot(items: DmItem[], slot: string): DmItem[] {
  return items.filter((i) => i.slot === slot).sort((a, b) => a.name.localeCompare(b.name));
}

export default function QffDmClassesPage() {
  const navigate = useNavigate();
  const { isAuthenticated, sessionUser, isLoading, getApiAccessToken } = useAppSession();
  const isStaff = !!sessionUser?.user?.is_staff;
  const [classes, setClasses] = useState<DmCharacterClass[]>([]);
  const [items, setItems] = useState<DmItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<DmCharacterClass> & { extra_json: string }>(
    emptyForm(),
  );
  const [editingId, setEditingId] = useState<number | null>(null);

  const chestItems = useMemo(() => itemsForSlot(items, "chest"), [items]);
  const mainItems = useMemo(() => itemsForSlot(items, "main_hand"), [items]);

  const load = useCallback(async () => {
    const token = await getApiAccessToken();
    const [cl, it] = await Promise.all([dmFetchClasses(token), dmFetchItems(token)]);
    setClasses(cl);
    setItems(it);
  }, [getApiAccessToken]);

  useEffect(() => {
    if (!isAuthenticated || !isStaff) return;
    load().catch((e) => setErr(String(e)));
  }, [isAuthenticated, isStaff, load]);

  const selectClass = (c: DmCharacterClass) => {
    setEditingId(c.id);
    setForm({
      slug: c.slug,
      name: c.name,
      sort_order: c.sort_order,
      description: c.description,
      priority_stat_1: c.priority_stat_1,
      priority_stat_2: c.priority_stat_2,
      starter_chest_item_id: c.starter_chest_item_id,
      starter_main_hand_item_id: c.starter_main_hand_item_id,
      extra_json: JSON.stringify(c.extra_data ?? {}, null, 2),
    });
  };

  const newClass = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const save = async () => {
    setErr(null);
    const token = await getApiAccessToken();
    let extra_data: Record<string, unknown> = {};
    try {
      extra_data = JSON.parse(form.extra_json || "{}") as Record<string, unknown>;
      if (extra_data === null || typeof extra_data !== "object" || Array.isArray(extra_data)) {
        throw new Error("extra JSON must be an object");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Invalid extra JSON");
      return;
    }
    if (form.priority_stat_1 === form.priority_stat_2) {
      setErr("Priority stats must be two different stats.");
      return;
    }
    try {
      if (editingId == null) {
        if (!form.slug?.trim() || !form.name?.trim()) {
          setErr("slug and name are required.");
          return;
        }
        await dmCreateClass(token, {
          slug: form.slug!.trim(),
          name: form.name!.trim(),
          sort_order: form.sort_order ?? 0,
          description: form.description ?? "",
          priority_stat_1: form.priority_stat_1,
          priority_stat_2: form.priority_stat_2,
          starter_chest_item_id: form.starter_chest_item_id,
          starter_main_hand_item_id: form.starter_main_hand_item_id,
          extra_data,
        });
      } else {
        await dmPatchClass(token, editingId, {
          slug: form.slug,
          name: form.name,
          sort_order: form.sort_order,
          description: form.description,
          priority_stat_1: form.priority_stat_1,
          priority_stat_2: form.priority_stat_2,
          starter_chest_item_id: form.starter_chest_item_id,
          starter_main_hand_item_id: form.starter_main_hand_item_id,
          extra_data,
        });
      }
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
  };

  const del = async () => {
    if (editingId == null) return;
    if (!window.confirm("Delete this class? Fails if any characters use it.")) return;
    setErr(null);
    try {
      const token = await getApiAccessToken();
      await dmDeleteClass(token, editingId);
      setEditingId(null);
      setForm(emptyForm());
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (isLoading) {
    return (
      <Box maxW="6xl" mx="auto" px={4} py={8} color="#c8e6a8">
        <PanelBlockSkeleton lines={2} showTitleLine />
      </Box>
    );
  }

  if (!isAuthenticated || !isStaff) {
    return (
      <Box maxW="6xl" mx="auto" px={4} py={8} color="#c8e6a8">
        <Text>Staff only.</Text>
      </Box>
    );
  }

  return (
    <Box maxW="6xl" mx="auto" px={4} py={8} color="#c8e6a8">
      <Flex justify="space-between" align="center" mb={4} flexWrap="wrap" gap={2}>
        <Heading size="lg">Character classes</Heading>
        <Flex gap={2} flexWrap="wrap">
          <QffButton type="button" onClick={() => navigate("/qff/dm")}>
            DM home
          </QffButton>
          <QffButton type="button" onClick={newClass}>
            New class
          </QffButton>
          <QffButton type="button" onClick={() => save()}>
            Save
          </QffButton>
          {editingId != null && (
            <QffButton type="button" onClick={() => void del()}>
              Delete
            </QffButton>
          )}
        </Flex>
      </Flex>
      {err && (
        <Text color="nautical.solid" mb={2} role="alert">
          {err}
        </Text>
      )}
      <Flex gap={6} align="flex-start" flexDir={{ base: "column", lg: "row" }}>
        <Box flex="0 0 240px" w="100%" borderWidth="1px" borderRadius="md" borderColor="#404040" p={2} maxH="70vh" overflowY="auto">
          {classes.map((c) => (
            <Button
              key={c.id}
              type="button"
              variant="ghost"
              display="block"
              w="100%"
              h="auto"
              py={2}
              px={2}
              textAlign="left"
              borderRadius="md"
              {...qffGhostRowButtonProps}
              bg={editingId === c.id ? "#2a3a2a" : "transparent"}
              _hover={{ bg: "#252525" }}
              onClick={() => selectClass(c)}
            >
              <Text fontWeight="medium">{c.name}</Text>
              <Text fontSize="xs" color="#888">
                {c.slug}
              </Text>
            </Button>
          ))}
        </Box>
        <Stack gap={3} flex="1" minW={0}>
          <Text fontSize="sm" color="#889977">
            {editingId == null ? "Creating new class" : `Editing #${editingId}`}
          </Text>
          <Flex gap={2} flexWrap="wrap">
            <Field.Root flex="1" minW="120px">
              <Field.Label>Slug</Field.Label>
              <Input
                value={form.slug ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                bg="#222"
              />
            </Field.Root>
            <Field.Root flex="2" minW="160px">
              <Field.Label>Name</Field.Label>
              <Input
                value={form.name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                bg="#222"
              />
            </Field.Root>
            <Field.Root maxW="100px">
              <Field.Label>Sort</Field.Label>
              <Input
                type="number"
                value={form.sort_order ?? 0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))
                }
                bg="#222"
              />
            </Field.Root>
          </Flex>
          <Field.Root>
            <Field.Label>Description (character creation)</Field.Label>
            <Textarea
              value={form.description ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={4}
              bg="#222"
            />
          </Field.Root>
          <Flex gap={2} flexWrap="wrap">
            <Field.Root minW="140px">
              <Field.Label>Priority stat 1</Field.Label>
              <NativeSelectRoot>
                <NativeSelectField
                  value={form.priority_stat_1 ?? "gains"}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, priority_stat_1: e.target.value }))
                  }
                  bg="#222"
                >
                  {STATS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </NativeSelectField>
              </NativeSelectRoot>
            </Field.Root>
            <Field.Root minW="140px">
              <Field.Label>Priority stat 2</Field.Label>
              <NativeSelectRoot>
                <NativeSelectField
                  value={form.priority_stat_2 ?? "guts"}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, priority_stat_2: e.target.value }))
                  }
                  bg="#222"
                >
                  {STATS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </NativeSelectField>
              </NativeSelectRoot>
            </Field.Root>
          </Flex>
          <Text fontSize="sm" color="#889977">
            Starting equipment: chest and main hand only (no hat). Slots must match. Leave
            empty to use default denim jacket + wooden stick if those templates exist.
          </Text>
          <Flex gap={2} flexWrap="wrap">
            <Field.Root flex="1" minW="180px">
              <Field.Label>Chest</Field.Label>
              <NativeSelectRoot>
                <NativeSelectField
                  value={form.starter_chest_item_id ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((f) => ({
                      ...f,
                      starter_chest_item_id: v === "" ? null : Number(v),
                    }));
                  }}
                  bg="#222"
                >
                  <option value="">— default —</option>
                  {chestItems.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}
                    </option>
                  ))}
                </NativeSelectField>
              </NativeSelectRoot>
            </Field.Root>
            <Field.Root flex="1" minW="180px">
              <Field.Label>Main hand</Field.Label>
              <NativeSelectRoot>
                <NativeSelectField
                  value={form.starter_main_hand_item_id ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((f) => ({
                      ...f,
                      starter_main_hand_item_id: v === "" ? null : Number(v),
                    }));
                  }}
                  bg="#222"
                >
                  <option value="">— default —</option>
                  {mainItems.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}
                    </option>
                  ))}
                </NativeSelectField>
              </NativeSelectRoot>
            </Field.Root>
          </Flex>
          <Field.Root>
            <Field.Label>Extra data (JSON object — spells, flags, future use)</Field.Label>
            <Textarea
              value={form.extra_json}
              onChange={(e) => setForm((f) => ({ ...f, extra_json: e.target.value }))}
              rows={5}
              bg="#222"
              fontFamily="mono"
              fontSize="sm"
            />
          </Field.Root>
        </Stack>
      </Flex>
    </Box>
  );
}
