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
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import {
  dmCreateNpc,
  dmCreateNpcDialogue,
  dmDeleteNpc,
  dmDeleteNpcDialogue,
  dmFetchAllDmRooms,
  dmFetchNpcDetail,
  dmFetchNpcs,
  dmFetchQuestDetail,
  dmFetchQuests,
  dmPatchNpc,
  dmPatchNpcDialogue,
  type DmNpcDetail,
  type DmNpcDialogue,
  type DmNpcRow,
  type DmQuestState,
  type DmQuestSummary,
} from "./api";

type RoomOption = { id: number; name: string; area_id: number; area_name: string };

function roomLabel(r: RoomOption): string {
  return `${r.area_name} — ${r.name}`;
}

function parseOptInt(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function emptyForm(firstRoomId: number): {
  room_id: number;
  slug: string;
  name: string;
  description: string;
} {
  return {
    room_id: firstRoomId,
    slug: "",
    name: "",
    description: "",
  };
}

export default function QffDmNpcsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, sessionUser, isLoading, getApiAccessToken } = useAppSession();
  const isStaff = !!sessionUser?.user?.is_staff;
  const [rows, setRows] = useState<DmNpcRow[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [quests, setQuests] = useState<DmQuestSummary[]>([]);
  const [questStatesByQuestId, setQuestStatesByQuestId] = useState<Record<number, DmQuestState[]>>(
    {},
  );
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DmNpcDetail | null>(null);
  const [form, setForm] = useState(emptyForm(0));
  const [newLine, setNewLine] = useState({
    text: "",
    priority: 0,
    quest_id: "",
    quest_state_id: "",
  });

  const loadList = useCallback(async () => {
    const token = await getApiAccessToken();
    const data = await dmFetchNpcs(token);
    setRows(data);
  }, [getApiAccessToken]);

  const loadRooms = useCallback(async () => {
    const token = await getApiAccessToken();
    const list = await dmFetchAllDmRooms(token);
    setRooms(list);
    setForm((f) => ({
      ...f,
      room_id: f.room_id || list[0]?.id || 0,
    }));
  }, [getApiAccessToken]);

  const loadQuests = useCallback(async () => {
    const token = await getApiAccessToken();
    const list = await dmFetchQuests(token);
    setQuests(list);
  }, [getApiAccessToken]);

  const ensureQuestStates = useCallback(
    async (questId: number) => {
      const token = await getApiAccessToken();
      const d = await dmFetchQuestDetail(token, questId);
      setQuestStatesByQuestId((prev) => ({ ...prev, [questId]: d.states }));
    },
    [getApiAccessToken],
  );

  const refreshDetail = useCallback(
    async (npcId: number) => {
      const token = await getApiAccessToken();
      const d = await dmFetchNpcDetail(token, npcId);
      setDetail(d);
      setForm({
        room_id: d.room_id,
        slug: d.slug,
        name: d.name,
        description: d.description,
      });
    },
    [getApiAccessToken],
  );

  useEffect(() => {
    if (!isAuthenticated || !isStaff) return;
    Promise.all([loadList(), loadRooms(), loadQuests()]).catch((e) => setErr(String(e)));
  }, [isAuthenticated, isStaff, loadList, loadRooms, loadQuests]);

  useEffect(() => {
    if (!detail?.dialogues?.length) return;
    const seen = new Set<number>();
    for (const line of detail.dialogues) {
      if (line.quest_id != null && !seen.has(line.quest_id)) {
        seen.add(line.quest_id);
        void ensureQuestStates(line.quest_id);
      }
    }
  }, [detail, ensureQuestStates]);

  const selectNpc = async (n: DmNpcRow) => {
    setErr(null);
    setEditingId(n.id);
    setNewLine({ text: "", priority: 0, quest_id: "", quest_state_id: "" });
    try {
      const token = await getApiAccessToken();
      const d = await dmFetchNpcDetail(token, n.id);
      setDetail(d);
      setForm({
        room_id: d.room_id,
        slug: d.slug,
        name: d.name,
        description: d.description,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
    }
  };

  const newNpc = () => {
    setErr(null);
    setEditingId(null);
    setDetail(null);
    setForm(emptyForm(rooms[0]?.id ?? 0));
    setNewLine({ text: "", priority: 0, quest_id: "", quest_state_id: "" });
  };

  const saveNpc = async () => {
    setErr(null);
    const token = await getApiAccessToken();
    try {
      if (!form.slug.trim() || !form.name.trim() || !form.room_id) {
        setErr("Room, slug, and name are required.");
        return;
      }
      if (editingId == null) {
        const created = await dmCreateNpc(token, {
          room_id: form.room_id,
          slug: form.slug.trim(),
          name: form.name.trim(),
          description: form.description,
        });
        await loadList();
        setEditingId(created.id);
        await refreshDetail(created.id);
      } else {
        const d = await dmPatchNpc(token, editingId, {
          room_id: form.room_id,
          slug: form.slug.trim(),
          name: form.name.trim(),
          description: form.description,
        });
        setDetail(d);
        await loadList();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
  };

  const deleteNpc = async () => {
    if (editingId == null) return;
    if (
      !window.confirm(
        "Delete this NPC and all of its dialogue lines? This cannot be undone.",
      )
    ) {
      return;
    }
    setErr(null);
    try {
      const token = await getApiAccessToken();
      await dmDeleteNpc(token, editingId);
      setEditingId(null);
      setDetail(null);
      setForm(emptyForm(rooms[0]?.id ?? 0));
      await loadList();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const saveDialogue = async (d: DmNpcDialogue) => {
    if (editingId == null) return;
    setErr(null);
    try {
      const token = await getApiAccessToken();
      await dmPatchNpcDialogue(token, d.id, {
        text: d.text,
        priority: d.priority,
        quest_id: d.quest_id,
        quest_state_id: d.quest_state_id,
      });
      await refreshDetail(editingId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update dialogue failed");
    }
  };

  const deleteDialogue = async (dialogueId: number) => {
    if (!window.confirm("Delete this dialogue line?")) return;
    if (editingId == null) return;
    setErr(null);
    try {
      const token = await getApiAccessToken();
      await dmDeleteNpcDialogue(token, dialogueId);
      await refreshDetail(editingId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete dialogue failed");
    }
  };

  const addDialogue = async () => {
    if (editingId == null) return;
    const text = newLine.text.trim();
    if (!text) {
      setErr("Dialogue text is required.");
      return;
    }
    setErr(null);
    try {
      const token = await getApiAccessToken();
      await dmCreateNpcDialogue(token, editingId, {
        text,
        priority: Number(newLine.priority) || 0,
        quest_id: parseOptInt(newLine.quest_id),
        quest_state_id: parseOptInt(newLine.quest_state_id),
      });
      setNewLine({ text: "", priority: 0, quest_id: "", quest_state_id: "" });
      await refreshDetail(editingId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Add dialogue failed");
    }
  };

  if (isLoading) {
    return (
      <Box maxW="6xl" mx="auto" px={4} py={8} color="#c8e6a8">
        <Text>Loading…</Text>
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

  const roomNameById = (rid: number) => rooms.find((r) => r.id === rid);

  return (
    <Box maxW="6xl" mx="auto" px={4} py={8} color="#c8e6a8">
      <Flex justify="space-between" align="center" mb={4} flexWrap="wrap" gap={2}>
        <Heading size="lg">NPCs</Heading>
        <Flex gap={2} flexWrap="wrap">
          <PondButton type="button" onClick={() => navigate("/qff/dm")}>
            DM home
          </PondButton>
          <PondButton type="button" onClick={newNpc}>
            New NPC
          </PondButton>
          <PondButton type="button" onClick={() => void saveNpc()}>
            Save NPC
          </PondButton>
          {editingId != null && (
            <PondButton type="button" onClick={() => void deleteNpc()}>
              Delete NPC
            </PondButton>
          )}
        </Flex>
      </Flex>
      <Text mb={4} color="#889977" fontSize="sm">
        Room-scoped NPCs (slug unique per room). Dialogue lines are shown in priority order; optional quest
        and quest state tie lines to the quest engine.
      </Text>
      {err && (
        <Text color="nautical.solid" mb={4} role="alert">
          {err}
        </Text>
      )}
      {rooms.length === 0 && (
        <Text color="nautical.solid" mb={4}>
          No rooms found — create an area and rooms in the world editor first.
        </Text>
      )}
      <Flex gap={6} align="flex-start" flexDir={{ base: "column", lg: "row" }}>
        <Box
          flex="0 0 280px"
          w="100%"
          borderWidth="1px"
          borderRadius="md"
          borderColor="#404040"
          p={2}
          maxH="75vh"
          overflowY="auto"
        >
          <Stack gap={1}>
            {rows.map((n) => (
              <Button
                key={n.id}
                type="button"
                variant="ghost"
                display="block"
                w="100%"
                h="auto"
                py={2}
                px={2}
                textAlign="left"
                borderRadius="md"
                bg={editingId === n.id ? "#2a3a2a" : "transparent"}
                _hover={{ bg: "#252525" }}
                onClick={() => void selectNpc(n)}
              >
                <Text fontWeight="medium">{n.name}</Text>
                <Text fontSize="xs" color="#888">
                  {n.slug} · room {n.room_id}
                  {roomNameById(n.room_id) ? ` · ${roomLabel(roomNameById(n.room_id)!)}` : ""}
                </Text>
              </Button>
            ))}
          </Stack>
        </Box>
        <Stack gap={4} flex="1" minW={0}>
          <Text fontSize="sm" color="#889977">
            {editingId == null ? "Creating new NPC" : `Editing NPC #${editingId}`}
          </Text>
          <Flex gap={2} flexWrap="wrap">
            <Field.Root flex="1" minW="200px">
              <Field.Label>Room</Field.Label>
              <NativeSelectRoot>
                <NativeSelectField
                  value={form.room_id ? String(form.room_id) : ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, room_id: Number(e.target.value) }))
                  }
                  bg="#222"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={String(r.id)}>
                      {roomLabel(r)}
                    </option>
                  ))}
                </NativeSelectField>
              </NativeSelectRoot>
            </Field.Root>
            <Field.Root flex="1" minW="140px">
              <Field.Label>Slug</Field.Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                bg="#222"
              />
            </Field.Root>
            <Field.Root flex="1" minW="160px">
              <Field.Label>Name</Field.Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                bg="#222"
              />
            </Field.Root>
          </Flex>
          <Field.Root>
            <Field.Label>Description</Field.Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={4}
              bg="#222"
              placeholder="Shown when players look at this NPC."
            />
          </Field.Root>

          {editingId != null && detail && (
            <Box borderWidth="1px" borderRadius="md" borderColor="#404040" p={3} bg="#1a1a1a">
              <Text fontWeight="semibold" mb={3} fontSize="sm">
                Dialogue lines
              </Text>
              <Stack gap={4}>
                {detail.dialogues.map((d) => (
                  <DialogueEditor
                    key={d.id}
                    dialogue={d}
                    quests={quests}
                    questStatesByQuestId={questStatesByQuestId}
                    ensureQuestStates={ensureQuestStates}
                    onSave={(next) => void saveDialogue(next)}
                    onDelete={() => void deleteDialogue(d.id)}
                  />
                ))}
                <Box borderTopWidth="1px" borderColor="#333" pt={4}>
                  <Text fontSize="xs" color="#888" mb={2}>
                    Add line
                  </Text>
                  <Stack gap={2}>
                    <Textarea
                      value={newLine.text}
                      onChange={(e) => setNewLine((x) => ({ ...x, text: e.target.value }))}
                      bg="#222"
                      rows={2}
                      placeholder="What they say…"
                    />
                    <Flex gap={2} flexWrap="wrap" align="flex-end">
                      <Field.Root w="100px">
                        <Field.Label fontSize="xs">Priority</Field.Label>
                        <Input
                          type="number"
                          value={newLine.priority}
                          onChange={(e) =>
                            setNewLine((x) => ({ ...x, priority: Number(e.target.value) }))
                          }
                          bg="#222"
                        />
                      </Field.Root>
                    </Flex>
                    <DialogueQuestPickers
                      questIdStr={newLine.quest_id}
                      questStateIdStr={newLine.quest_state_id}
                      onQuestChange={(v) =>
                        setNewLine((x) => ({ ...x, quest_id: v, quest_state_id: "" }))
                      }
                      onQuestStateChange={(v) =>
                        setNewLine((x) => ({ ...x, quest_state_id: v }))
                      }
                      quests={quests}
                      statesForQuest={
                        newLine.quest_id
                          ? questStatesByQuestId[Number(newLine.quest_id)]
                          : undefined
                      }
                      ensureQuestStates={ensureQuestStates}
                    />
                    <PondButton type="button" onClick={() => void addDialogue()}>
                      Add dialogue line
                    </PondButton>
                  </Stack>
                </Box>
              </Stack>
            </Box>
          )}
        </Stack>
      </Flex>
    </Box>
  );
}

function DialogueQuestPickers({
  questIdStr,
  questStateIdStr,
  onQuestChange,
  onQuestStateChange,
  quests,
  statesForQuest,
  ensureQuestStates,
}: {
  questIdStr: string;
  questStateIdStr: string;
  onQuestChange: (v: string) => void;
  onQuestStateChange: (v: string) => void;
  quests: DmQuestSummary[];
  statesForQuest: DmQuestState[] | undefined;
  ensureQuestStates: (questId: number) => Promise<void>;
}) {
  useEffect(() => {
    const q = questIdStr.trim();
    if (q && /^\d+$/.test(q)) {
      void ensureQuestStates(Number(q));
    }
  }, [questIdStr, ensureQuestStates]);

  return (
    <Flex gap={2} flexWrap="wrap" align="flex-end" mb={2}>
      <Field.Root flex="1" minW="200px">
        <Field.Label fontSize="xs">Quest</Field.Label>
        <NativeSelectRoot>
          <NativeSelectField
            value={questIdStr}
            onChange={(e) => {
              const v = e.target.value;
              onQuestChange(v);
              onQuestStateChange("");
              if (v) void ensureQuestStates(Number(v));
            }}
            bg="#222"
          >
            <option value="">— none —</option>
            {quests.map((q) => (
              <option key={q.id} value={String(q.id)}>
                {q.name} ({q.slug})
              </option>
            ))}
          </NativeSelectField>
        </NativeSelectRoot>
      </Field.Root>
      <Field.Root flex="1" minW="220px">
        <Field.Label fontSize="xs">Quest state</Field.Label>
        <NativeSelectRoot>
          <NativeSelectField
            value={questStateIdStr}
            onChange={(e) => onQuestStateChange(e.target.value)}
            bg="#222"
          >
            <option value="">— none —</option>
            {(statesForQuest ?? []).map((s) => {
              const label = (s.name?.trim() || s.slug) ?? s.slug;
              return (
                <option key={s.id} value={String(s.id)}>
                  {label} (#{s.id})
                </option>
              );
            })}
          </NativeSelectField>
        </NativeSelectRoot>
      </Field.Root>
    </Flex>
  );
}

function DialogueEditor({
  dialogue,
  quests,
  questStatesByQuestId,
  ensureQuestStates,
  onSave,
  onDelete,
}: {
  dialogue: DmNpcDialogue;
  quests: DmQuestSummary[];
  questStatesByQuestId: Record<number, DmQuestState[]>;
  ensureQuestStates: (questId: number) => Promise<void>;
  onSave: (d: DmNpcDialogue) => void;
  onDelete: () => void;
}) {
  const [text, setText] = useState(dialogue.text);
  const [priority, setPriority] = useState(dialogue.priority);
  const [questIdStr, setQuestIdStr] = useState(
    dialogue.quest_id != null ? String(dialogue.quest_id) : "",
  );
  const [questStateIdStr, setQuestStateIdStr] = useState(
    dialogue.quest_state_id != null ? String(dialogue.quest_state_id) : "",
  );

  useEffect(() => {
    setText(dialogue.text);
    setPriority(dialogue.priority);
    setQuestIdStr(dialogue.quest_id != null ? String(dialogue.quest_id) : "");
    setQuestStateIdStr(dialogue.quest_state_id != null ? String(dialogue.quest_state_id) : "");
  }, [dialogue]);

  const build = (): DmNpcDialogue => ({
    ...dialogue,
    text,
    priority: Number(priority) || 0,
    quest_id: parseOptInt(questIdStr),
    quest_state_id: parseOptInt(questStateIdStr),
  });

  const statesForQuest = questIdStr
    ? questStatesByQuestId[Number(questIdStr)]
    : undefined;

  return (
    <Box borderWidth="1px" borderColor="#333" borderRadius="md" p={2}>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        bg="#222"
        rows={3}
        mb={2}
      />
      <Flex gap={2} flexWrap="wrap" align="flex-end" mb={2}>
        <Field.Root w="100px">
          <Field.Label fontSize="xs">Priority</Field.Label>
          <Input
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            bg="#222"
          />
        </Field.Root>
      </Flex>
      <DialogueQuestPickers
        questIdStr={questIdStr}
        questStateIdStr={questStateIdStr}
        onQuestChange={setQuestIdStr}
        onQuestStateChange={setQuestStateIdStr}
        quests={quests}
        statesForQuest={statesForQuest}
        ensureQuestStates={ensureQuestStates}
      />
      <Flex gap={2}>
        <PondButton type="button" onClick={() => onSave(build())}>
          Update line
        </PondButton>
        <Button type="button" variant="outline" size="sm" onClick={onDelete}>
          Delete line
        </Button>
      </Flex>
    </Box>
  );
}
