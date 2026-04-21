import {
  Box,
  Field,
  Heading,
  HStack,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import QffButton from "./QffButton";
import {
  dmCreateInteractable,
  dmFetchAllDmRooms,
  dmFetchAreaExits,
  dmFetchInteractables,
  dmPatchInteractable,
  type DmAreaExit,
  type DmInteractableRow,
} from "./api";

type RoomOption = { id: number; name: string; area_id: number; area_name: string };

function roomLabel(r: RoomOption): string {
  return `${r.area_name} — ${r.name}`;
}

function exitPickLabel(ex: DmAreaExit, roomList: RoomOption[]): string {
  const from = roomList.find((r) => r.id === ex.from_room_id);
  const fromName = from?.name ?? `room ${ex.from_room_id}`;
  return `#${ex.id} · ${fromName} · ${ex.direction} → ${ex.to_room_name}`;
}

const KIND_OPTIONS = [
  "sign",
  "tome",
  "chest",
  "barrel",
  "crate",
  "sack",
  "button",
  "lever",
  "switch",
  "pulley",
  "sconce",
  "map",
  "other",
] as const;

const emptyForm = () => ({
  room_id: "",
  slug: "",
  name: "",
  kind: "sign" as string,
  inspect_text: "",
  read_text: "",
  map_reveal_minutes: "",
  quest_transition_id: "",
  unlocks_exit_id: "",
});

export default function QffDmInteractablesPage() {
  const navigate = useNavigate();
  const { isAuthenticated, sessionUser, isLoading, getApiAccessToken } = useAppSession();
  const isStaff = !!sessionUser?.user?.is_staff;
  const [rows, setRows] = useState<DmInteractableRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [roomFilter, setRoomFilter] = useState("");
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [createAreaExits, setCreateAreaExits] = useState<DmAreaExit[]>([]);
  const [editAreaExits, setEditAreaExits] = useState<DmAreaExit[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);

  const loadRooms = useCallback(async () => {
    const token = await getApiAccessToken();
    const list = await dmFetchAllDmRooms(token);
    setRooms(list);
    setCreateForm((f) => ({
      ...f,
      room_id: f.room_id || (list[0] ? String(list[0].id) : ""),
    }));
  }, [getApiAccessToken]);

  const load = useCallback(async () => {
    const token = await getApiAccessToken();
    const trimmed = roomFilter.trim();
    let roomId: number | undefined;
    if (trimmed) {
      const n = parseInt(trimmed, 10);
      roomId = Number.isFinite(n) ? n : undefined;
    }
    const data = await dmFetchInteractables(token, roomId);
    setRows(data);
  }, [getApiAccessToken, roomFilter]);

  const loadExitsForRoomId = useCallback(
    async (roomIdStr: string, which: "create" | "edit") => {
      const rid = parseInt(roomIdStr.trim(), 10);
      if (!Number.isFinite(rid)) {
        if (which === "create") setCreateAreaExits([]);
        else setEditAreaExits([]);
        return;
      }
      const room = rooms.find((r) => r.id === rid);
      if (!room) {
        if (which === "create") setCreateAreaExits([]);
        else setEditAreaExits([]);
        return;
      }
      const token = await getApiAccessToken();
      const exits = await dmFetchAreaExits(token, room.area_id);
      if (which === "create") {
        setCreateAreaExits(exits);
        setCreateForm((f) => {
          if (!f.unlocks_exit_id.trim()) return f;
          const eid = parseInt(f.unlocks_exit_id, 10);
          if (Number.isFinite(eid) && exits.some((e) => e.id === eid)) return f;
          return { ...f, unlocks_exit_id: "" };
        });
      } else {
        setEditAreaExits(exits);
        setEditForm((f) => {
          if (!f.unlocks_exit_id.trim()) return f;
          const eid = parseInt(f.unlocks_exit_id, 10);
          if (Number.isFinite(eid) && exits.some((e) => e.id === eid)) return f;
          return { ...f, unlocks_exit_id: "" };
        });
      }
    },
    [getApiAccessToken, rooms],
  );

  useEffect(() => {
    if (!isAuthenticated || !isStaff || rooms.length === 0) return;
    loadExitsForRoomId(createForm.room_id, "create").catch((e) => setErr(String(e)));
  }, [isAuthenticated, isStaff, rooms, createForm.room_id, loadExitsForRoomId]);

  useEffect(() => {
    if (!isAuthenticated || !isStaff || rooms.length === 0) return;
    loadExitsForRoomId(editForm.room_id, "edit").catch((e) => setErr(String(e)));
  }, [isAuthenticated, isStaff, rooms, editForm.room_id, loadExitsForRoomId]);

  useEffect(() => {
    if (!isAuthenticated || !isStaff) return;
    loadRooms().catch((e) => setErr(String(e)));
  }, [isAuthenticated, isStaff, loadRooms]);

  useEffect(() => {
    if (!isAuthenticated || !isStaff) return;
    load().catch((e) => setErr(String(e)));
  }, [isAuthenticated, isStaff, load]);

  const selected = selectedId != null ? rows.find((r) => r.id === selectedId) : undefined;

  useEffect(() => {
    if (!selected) {
      setEditForm(emptyForm());
      return;
    }
    setEditForm({
      room_id: String(selected.room_id),
      slug: selected.slug,
      name: selected.name,
      kind: selected.kind,
      inspect_text: selected.inspect_text,
      read_text: selected.read_text ?? "",
      map_reveal_minutes:
        selected.map_reveal_minutes != null ? String(selected.map_reveal_minutes) : "",
      quest_transition_id:
        selected.quest_transition_id != null ? String(selected.quest_transition_id) : "",
      unlocks_exit_id: selected.unlocks_exit_id != null ? String(selected.unlocks_exit_id) : "",
    });
  }, [selected]);

  const onCreate = async () => {
    setErr(null);
    try {
      const token = await getApiAccessToken();
      const rid = parseInt(createForm.room_id.trim(), 10);
      if (!Number.isFinite(rid)) {
        setErr("Create: choose a room.");
        return;
      }
      const body: Record<string, unknown> = {
        room_id: rid,
        slug: createForm.slug.trim(),
        name: createForm.name.trim(),
        kind: createForm.kind,
        inspect_text: createForm.inspect_text,
        read_text: createForm.read_text,
      };
      if (createForm.map_reveal_minutes.trim()) {
        body.map_reveal_minutes = parseInt(createForm.map_reveal_minutes, 10);
      }
      if (createForm.quest_transition_id.trim()) {
        body.quest_transition_id = parseInt(createForm.quest_transition_id, 10);
      }
      if (createForm.unlocks_exit_id.trim()) {
        body.unlocks_exit_id = parseInt(createForm.unlocks_exit_id, 10);
      }
      await dmCreateInteractable(token, body);
      setCreateForm(emptyForm());
      await load();
    } catch (e) {
      setErr(String(e));
    }
  };

  const onSaveEdit = async () => {
    if (!selectedId) return;
    setErr(null);
    try {
      const token = await getApiAccessToken();
      const body: Record<string, unknown> = {
        room_id: parseInt(editForm.room_id, 10),
        slug: editForm.slug.trim(),
        name: editForm.name.trim(),
        kind: editForm.kind,
        inspect_text: editForm.inspect_text,
        read_text: editForm.read_text,
        map_reveal_minutes: editForm.map_reveal_minutes.trim()
          ? parseInt(editForm.map_reveal_minutes, 10)
          : null,
        quest_transition_id: editForm.quest_transition_id.trim()
          ? parseInt(editForm.quest_transition_id, 10)
          : null,
        unlocks_exit_id: editForm.unlocks_exit_id.trim()
          ? parseInt(editForm.unlocks_exit_id, 10)
          : null,
      };
      await dmPatchInteractable(token, selectedId, body);
      await load();
    } catch (e) {
      setErr(String(e));
    }
  };

  if (isLoading) {
    return (
      <Box maxW="4xl" mx="auto" px={4} py={8} color="#c8e6a8">
        <Text>Loading…</Text>
      </Box>
    );
  }

  if (!isAuthenticated || !isStaff) {
    return (
      <Box maxW="4xl" mx="auto" px={4} py={8} color="#c8e6a8">
        <Text>Staff only.</Text>
      </Box>
    );
  }

  const roomById = (rid: number) => rooms.find((r) => r.id === rid);

  return (
    <Box maxW="4xl" mx="auto" px={4} py={8} color="#c8e6a8">
      <Heading size="lg" mb={2}>
        Interactables
      </Heading>
      <Text mb={4} color="#889977" fontSize="sm">
        Signs, tomes, containers, levers. Use <strong>read</strong> in play for sign/tome text.
        Kind <strong>sconce</strong> and <strong>map</strong>: players <strong>use</strong> to toggle
        permanent room light and full-map reveal (timed) in dark areas—prefer these over the room
        &quot;permanent minimap light&quot; checkbox. Link unlocks_exit_id or quest_transition_id as
        needed.
      </Text>
      {err && (
        <Text color="nautical.solid" mb={4} role="alert">
          {err}
        </Text>
      )}
      <QffButton onClick={() => navigate("/qff/dm")} mb={6}>
        ← DM home
      </QffButton>

      {rooms.length === 0 && (
        <Text color="nautical.solid" mb={4} fontSize="sm">
          No rooms found — create an area and rooms in the world editor first.
        </Text>
      )}

      <HStack gap={4} mb={4} alignItems="flex-end" flexWrap="wrap">
        <Field.Root flex="1" minW="220px" maxW="360px">
          <Field.Label fontSize="sm">Filter by room</Field.Label>
          <NativeSelectRoot size="sm">
            <NativeSelectField
              value={roomFilter}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setRoomFilter(e.target.value)}
              bg="#222"
            >
              <option value="">All rooms</option>
              {rooms.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {roomLabel(r)}
                </option>
              ))}
            </NativeSelectField>
          </NativeSelectRoot>
        </Field.Root>
      </HStack>

      <Stack gap={6}>
        <Box borderWidth="1px" borderRadius="md" p={4} borderColor="whiteAlpha.300">
          <Heading size="sm" mb={3}>
            Create
          </Heading>
          <Stack gap={2}>
            <HStack flexWrap="wrap" gap={2}>
              <Field.Root flex="1" minW="200px" maxW="320px">
                <Field.Label fontSize="xs">Room</Field.Label>
                <NativeSelectRoot size="sm">
                  <NativeSelectField
                    value={createForm.room_id}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      setCreateForm((f) => ({ ...f, room_id: e.target.value }))
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
              <Field.Root maxW="160px">
                <Field.Label fontSize="xs">slug</Field.Label>
                <Input
                  size="sm"
                  value={createForm.slug}
                  onChange={(e) => setCreateForm((f) => ({ ...f, slug: e.target.value }))}
                />
              </Field.Root>
              <Field.Root maxW="200px">
                <Field.Label fontSize="xs">name</Field.Label>
                <Input
                  size="sm"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                />
              </Field.Root>
              <Field.Root maxW="160px">
                <Field.Label fontSize="xs">kind</Field.Label>
                <NativeSelectRoot size="sm">
                  <NativeSelectField
                    value={createForm.kind}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      setCreateForm((f) => ({ ...f, kind: e.target.value }))
                    }
                    bg="#222"
                  >
                    {KIND_OPTIONS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </NativeSelectField>
                </NativeSelectRoot>
              </Field.Root>
            </HStack>
            <Field.Root>
              <Field.Label fontSize="xs">inspect_text</Field.Label>
              <Textarea
                size="sm"
                rows={2}
                value={createForm.inspect_text}
                onChange={(e) => setCreateForm((f) => ({ ...f, inspect_text: e.target.value }))}
              />
            </Field.Root>
            <Field.Root>
              <Field.Label fontSize="xs">read_text (tome / long read)</Field.Label>
              <Textarea
                size="sm"
                rows={2}
                value={createForm.read_text}
                onChange={(e) => setCreateForm((f) => ({ ...f, read_text: e.target.value }))}
              />
            </Field.Root>
            <HStack gap={4} flexWrap="wrap">
              <Field.Root maxW="140px">
                <Field.Label fontSize="xs">map_reveal_minutes (kind=map)</Field.Label>
                <Input
                  type="number"
                  size="sm"
                  value={createForm.map_reveal_minutes}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, map_reveal_minutes: e.target.value }))
                  }
                />
              </Field.Root>
              <Field.Root maxW="140px">
                <Field.Label fontSize="xs">quest_transition_id</Field.Label>
                <Input
                  size="sm"
                  value={createForm.quest_transition_id}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, quest_transition_id: e.target.value }))
                  }
                />
              </Field.Root>
              <Field.Root flex="1" minW="280px" maxW="520px">
                <Field.Label fontSize="xs">unlocks_exit (same area as room)</Field.Label>
                <NativeSelectRoot size="sm">
                  <NativeSelectField
                    value={createForm.unlocks_exit_id}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      setCreateForm((f) => ({ ...f, unlocks_exit_id: e.target.value }))
                    }
                    bg="#222"
                  >
                    <option value="">(none)</option>
                    {createAreaExits.map((ex) => (
                      <option key={ex.id} value={String(ex.id)}>
                        {exitPickLabel(ex, rooms)}
                      </option>
                    ))}
                  </NativeSelectField>
                </NativeSelectRoot>
              </Field.Root>
            </HStack>
            <QffButton onClick={() => onCreate()}>Create interactable</QffButton>
          </Stack>
        </Box>

        <Box borderWidth="1px" borderRadius="md" p={4} borderColor="whiteAlpha.300">
          <Heading size="sm" mb={3}>
            Existing (click to edit)
          </Heading>
          <Stack gap={2} fontSize="sm" maxH="240px" overflowY="auto">
            {rows.map((o) => (
              <Box
                key={o.id}
                borderWidth="1px"
                borderRadius="md"
                p={2}
                borderColor={selectedId === o.id ? "green.400" : "whiteAlpha.300"}
                cursor="pointer"
                onClick={() => setSelectedId(o.id)}
              >
                <Text fontWeight="medium">
                  {o.name}{" "}
                  <Text as="span" color="#889977" fontWeight="normal">
                    ({o.kind})
                  </Text>
                </Text>
                <Text color="#889977">
                  id {o.id} · room {o.room_id}
                  {roomById(o.room_id) ? ` · ${roomLabel(roomById(o.room_id)!)}` : ""} · {o.slug}
                </Text>
              </Box>
            ))}
          </Stack>
        </Box>

        {selected && (
          <Box borderWidth="1px" borderRadius="md" p={4} borderColor="whiteAlpha.300">
            <Heading size="sm" mb={3}>
              Edit #{selected.id}
            </Heading>
            <Stack gap={2}>
              <HStack flexWrap="wrap" gap={2}>
                <Field.Root flex="1" minW="200px" maxW="320px">
                  <Field.Label fontSize="xs">Room</Field.Label>
                  <NativeSelectRoot size="sm">
                    <NativeSelectField
                      value={editForm.room_id}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                        setEditForm((f) => ({ ...f, room_id: e.target.value }))
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
                <Field.Root maxW="160px">
                  <Field.Label fontSize="xs">slug</Field.Label>
                  <Input
                    size="sm"
                    value={editForm.slug}
                    onChange={(e) => setEditForm((f) => ({ ...f, slug: e.target.value }))}
                  />
                </Field.Root>
                <Field.Root maxW="200px">
                  <Field.Label fontSize="xs">name</Field.Label>
                  <Input
                    size="sm"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </Field.Root>
                <Field.Root maxW="160px">
                  <Field.Label fontSize="xs">kind</Field.Label>
                  <NativeSelectRoot size="sm">
                    <NativeSelectField
                      value={editForm.kind}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                        setEditForm((f) => ({ ...f, kind: e.target.value }))
                      }
                      bg="#222"
                    >
                      {KIND_OPTIONS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </NativeSelectField>
                  </NativeSelectRoot>
                </Field.Root>
              </HStack>
              <Field.Root>
                <Field.Label fontSize="xs">inspect_text</Field.Label>
                <Textarea
                  size="sm"
                  rows={2}
                  value={editForm.inspect_text}
                  onChange={(e) => setEditForm((f) => ({ ...f, inspect_text: e.target.value }))}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label fontSize="xs">read_text</Field.Label>
                <Textarea
                  size="sm"
                  rows={2}
                  value={editForm.read_text}
                  onChange={(e) => setEditForm((f) => ({ ...f, read_text: e.target.value }))}
                />
              </Field.Root>
              <HStack gap={4} flexWrap="wrap">
                <Field.Root maxW="140px">
                  <Field.Label fontSize="xs">map_reveal_minutes</Field.Label>
                  <Input
                    type="number"
                    size="sm"
                    value={editForm.map_reveal_minutes}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, map_reveal_minutes: e.target.value }))
                    }
                  />
                </Field.Root>
                <Field.Root maxW="140px">
                  <Field.Label fontSize="xs">quest_transition_id</Field.Label>
                  <Input
                    size="sm"
                    value={editForm.quest_transition_id}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, quest_transition_id: e.target.value }))
                    }
                  />
                </Field.Root>
                <Field.Root flex="1" minW="280px" maxW="520px">
                  <Field.Label fontSize="xs">unlocks_exit (same area as room)</Field.Label>
                  <NativeSelectRoot size="sm">
                    <NativeSelectField
                      value={editForm.unlocks_exit_id}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                        setEditForm((f) => ({ ...f, unlocks_exit_id: e.target.value }))
                      }
                      bg="#222"
                    >
                      <option value="">(none)</option>
                      {editAreaExits.map((ex) => (
                        <option key={ex.id} value={String(ex.id)}>
                          {exitPickLabel(ex, rooms)}
                        </option>
                      ))}
                    </NativeSelectField>
                  </NativeSelectRoot>
                </Field.Root>
              </HStack>
              <QffButton onClick={() => onSaveEdit()}>Save changes</QffButton>
            </Stack>
          </Box>
        )}
      </Stack>
    </Box>
  );
}
