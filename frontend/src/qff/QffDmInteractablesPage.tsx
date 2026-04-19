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
  dmFetchInteractables,
  dmPatchInteractable,
  type DmInteractableRow,
} from "./api";

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
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);

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
        setErr("Create: room_id must be a number.");
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

  return (
    <Box maxW="4xl" mx="auto" px={4} py={8} color="#c8e6a8">
      <Heading size="lg" mb={2}>
        Interactables
      </Heading>
      <Text mb={4} color="#889977" fontSize="sm">
        Signs, tomes, containers, map/sconce, levers. Use <strong>read</strong> in play for sign/tome text.
        Link unlocks_exit_id or quest_transition_id as needed.
      </Text>
      {err && (
        <Text color="nautical.solid" mb={4} role="alert">
          {err}
        </Text>
      )}
      <QffButton onClick={() => navigate("/qff/dm")} mb={6}>
        ← DM home
      </QffButton>

      <HStack gap={4} mb={4} alignItems="flex-end" flexWrap="wrap">
        <Field.Root maxW="200px">
          <Field.Label fontSize="sm">Filter by room_id</Field.Label>
          <Input
            size="sm"
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            placeholder="e.g. 12"
          />
        </Field.Root>
        <QffButton onClick={() => load().catch((e) => setErr(String(e)))}>Apply filter</QffButton>
      </HStack>

      <Stack gap={6}>
        <Box borderWidth="1px" borderRadius="md" p={4} borderColor="whiteAlpha.300">
          <Heading size="sm" mb={3}>
            Create
          </Heading>
          <Stack gap={2}>
            <HStack flexWrap="wrap" gap={2}>
              <Field.Root maxW="120px">
                <Field.Label fontSize="xs">room_id</Field.Label>
                <Input
                  size="sm"
                  value={createForm.room_id}
                  onChange={(e) => setCreateForm((f) => ({ ...f, room_id: e.target.value }))}
                />
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
              <Field.Root maxW="140px">
                <Field.Label fontSize="xs">unlocks_exit_id</Field.Label>
                <Input
                  size="sm"
                  value={createForm.unlocks_exit_id}
                  onChange={(e) => setCreateForm((f) => ({ ...f, unlocks_exit_id: e.target.value }))}
                />
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
                  id {o.id} · room {o.room_id} · {o.slug}
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
                <Field.Root maxW="120px">
                  <Field.Label fontSize="xs">room_id</Field.Label>
                  <Input
                    size="sm"
                    value={editForm.room_id}
                    onChange={(e) => setEditForm((f) => ({ ...f, room_id: e.target.value }))}
                  />
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
                <Field.Root maxW="140px">
                  <Field.Label fontSize="xs">unlocks_exit_id</Field.Label>
                  <Input
                    size="sm"
                    value={editForm.unlocks_exit_id}
                    onChange={(e) => setEditForm((f) => ({ ...f, unlocks_exit_id: e.target.value }))}
                  />
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
