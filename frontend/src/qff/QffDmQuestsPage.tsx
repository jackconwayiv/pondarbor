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
import { PanelBlockSkeleton } from "../components/panelStatus";
import QffButton from "./QffButton";
import { qffGhostRowButtonProps, qffOutlineMutedButtonProps } from "./qffUi";
import {
  dmCreateQuest,
  dmCreateQuestEffect,
  dmCreateQuestState,
  dmCreateQuestTransition,
  dmDeleteQuest,
  dmDeleteQuestEffect,
  dmDeleteQuestState,
  dmDeleteQuestTransition,
  dmFetchItems,
  dmFetchQuestDetail,
  dmFetchQuests,
  dmPatchQuest,
  dmPatchQuestEffect,
  dmPatchQuestState,
  dmPatchQuestTransition,
  type DmItem,
  type DmQuestDetail,
  type DmQuestEffectRow,
  type DmQuestState,
  type DmQuestSummary,
  type DmQuestTransitionRow,
} from "./api";

const EFFECT_KINDS = [
  "grant_xp",
  "grant_gold",
  "grant_item",
  "remove_item_template",
  "realm_unlock_exit_timed",
  "character_unlock_exit",
] as const;

function parseOptInt(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

type GetToken = () => Promise<string | null>;

export default function QffDmQuestsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, sessionUser, isLoading, getApiAccessToken } = useAppSession();
  const isStaff = !!sessionUser?.user?.is_staff;
  const [rows, setRows] = useState<DmQuestSummary[]>([]);
  const [items, setItems] = useState<DmItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DmQuestDetail | null>(null);
  const [form, setForm] = useState({ slug: "", name: "", description: "" });

  const [newState, setNewState] = useState({
    slug: "",
    name: "",
    is_initial: false,
    is_terminal: false,
    sort_order: 0,
  });
  const [newTr, setNewTr] = useState({
    from_state_id: "",
    to_state_id: "",
    requires_item_id: "",
    sort_order: 0,
  });
  const [newEffectByTr, setNewEffectByTr] = useState<
    Record<number, { kind: string; amount: string; item_id: string; room_exit_id: string; sort_order: string }>
  >({});

  const loadList = useCallback(async () => {
    const token = await getApiAccessToken();
    const data = await dmFetchQuests(token);
    setRows(data);
  }, [getApiAccessToken]);

  const loadItems = useCallback(async () => {
    const token = await getApiAccessToken();
    const list = await dmFetchItems(token);
    setItems(list);
  }, [getApiAccessToken]);

  const refreshDetail = useCallback(
    async (questId: number) => {
      const token = await getApiAccessToken();
      const d = await dmFetchQuestDetail(token, questId);
      setDetail(d);
      setForm({ slug: d.slug, name: d.name, description: d.description });
    },
    [getApiAccessToken],
  );

  useEffect(() => {
    if (!isAuthenticated || !isStaff) return;
    Promise.all([loadList(), loadItems()]).catch((e) => setErr(String(e)));
  }, [isAuthenticated, isStaff, loadList, loadItems]);

  const selectQuest = async (q: DmQuestSummary) => {
    setErr(null);
    setEditingId(q.id);
    try {
      await refreshDetail(q.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
    }
  };

  const newQuest = () => {
    setErr(null);
    setEditingId(null);
    setDetail(null);
    setForm({ slug: "", name: "", description: "" });
  };

  const saveQuest = async () => {
    setErr(null);
    const token = await getApiAccessToken();
    try {
      if (!form.slug.trim() || !form.name.trim()) {
        setErr("Slug and name are required.");
        return;
      }
      if (editingId == null) {
        const d = await dmCreateQuest(token, {
          slug: form.slug.trim(),
          name: form.name.trim(),
          description: form.description,
        });
        await loadList();
        setEditingId(d.id);
        setDetail(d);
        setForm({ slug: d.slug, name: d.name, description: d.description });
      } else {
        const d = await dmPatchQuest(token, editingId, {
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

  const deleteQuest = async () => {
    if (editingId == null) return;
    if (!window.confirm("Delete this quest and all states, transitions, and effects?")) return;
    setErr(null);
    try {
      const token = await getApiAccessToken();
      await dmDeleteQuest(token, editingId);
      newQuest();
      await loadList();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const addState = async () => {
    if (editingId == null) return;
    if (!newState.slug.trim()) {
      setErr("State slug is required.");
      return;
    }
    setErr(null);
    try {
      const token = await getApiAccessToken();
      await dmCreateQuestState(token, editingId, {
        slug: newState.slug.trim(),
        name: newState.name,
        is_initial: newState.is_initial,
        is_terminal: newState.is_terminal,
        sort_order: Number(newState.sort_order) || 0,
      });
      setNewState({ slug: "", name: "", is_initial: false, is_terminal: false, sort_order: 0 });
      await refreshDetail(editingId);
      await loadList();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Add state failed");
    }
  };

  const addTransition = async () => {
    if (editingId == null) return;
    const fs = parseOptInt(newTr.from_state_id);
    const ts = parseOptInt(newTr.to_state_id);
    if (fs == null || ts == null) {
      setErr("From and to state are required.");
      return;
    }
    setErr(null);
    try {
      const token = await getApiAccessToken();
      await dmCreateQuestTransition(token, editingId, {
        from_state_id: fs,
        to_state_id: ts,
        requires_item_id: parseOptInt(newTr.requires_item_id),
        sort_order: Number(newTr.sort_order) || 0,
      });
      setNewTr({ from_state_id: "", to_state_id: "", requires_item_id: "", sort_order: 0 });
      await refreshDetail(editingId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Add transition failed");
    }
  };

  const getNewEffect = (trId: number) =>
    newEffectByTr[trId] ?? {
      kind: EFFECT_KINDS[0],
      amount: "0",
      item_id: "",
      room_exit_id: "",
      sort_order: "0",
    };

  const setNewEffectField = (
    trId: number,
    patch: Partial<{ kind: string; amount: string; item_id: string; room_exit_id: string; sort_order: string }>,
  ) => {
    setNewEffectByTr((prev) => ({
      ...prev,
      [trId]: { ...getNewEffect(trId), ...patch },
    }));
  };

  const addEffect = async (transitionId: number) => {
    const ne = getNewEffect(transitionId);
    setErr(null);
    try {
      const token = await getApiAccessToken();
      await dmCreateQuestEffect(token, transitionId, {
        kind: ne.kind,
        amount: Number(ne.amount) || 0,
        item_id: parseOptInt(ne.item_id),
        room_exit_id: parseOptInt(ne.room_exit_id),
        sort_order: Number(ne.sort_order) || 0,
      });
      setNewEffectField(transitionId, { amount: "0", item_id: "", room_exit_id: "", sort_order: "0" });
      if (editingId != null) await refreshDetail(editingId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Add effect failed");
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
        <Heading size="lg">Quests</Heading>
        <Flex gap={2} flexWrap="wrap">
          <QffButton type="button" onClick={() => navigate("/qff/dm")}>
            DM home
          </QffButton>
          <QffButton type="button" onClick={newQuest}>
            New quest
          </QffButton>
          <QffButton type="button" onClick={() => void saveQuest()}>
            Save quest
          </QffButton>
          {editingId != null && (
            <QffButton type="button" onClick={() => void deleteQuest()}>
              Delete quest
            </QffButton>
          )}
        </Flex>
      </Flex>
      <Text mb={4} color="#889977" fontSize="sm">
        Create a quest, add states (nodes), transitions (edges), and effects (XP, items, exit unlocks, etc.).
      </Text>
      {err && (
        <Text color="nautical.solid" mb={4} role="alert">
          {err}
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
          {rows.length === 0 && (
            <Text fontSize="sm" color="#888" mb={2}>
              No quests yet — use Save quest after filling slug and name.
            </Text>
          )}
          <Stack gap={1}>
            {rows.map((q) => (
              <Button
                key={q.id}
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
                bg={editingId === q.id ? "#2a3a2a" : "transparent"}
                _hover={{ bg: "#252525" }}
                onClick={() => void selectQuest(q)}
              >
                <Text fontWeight="medium">{q.name}</Text>
                <Text fontSize="xs" color="#888">
                  {q.slug} · {q.state_count} state(s)
                </Text>
              </Button>
            ))}
          </Stack>
        </Box>
        <Stack gap={4} flex="1" minW={0}>
          <Text fontSize="sm" color="#889977">
            {editingId == null ? "Creating new quest" : `Editing quest #${editingId}`}
          </Text>
          <Flex gap={2} flexWrap="wrap">
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
              rows={3}
              bg="#222"
            />
          </Field.Root>

          {editingId != null && detail && (
            <>
              <Box borderWidth="1px" borderRadius="md" borderColor="#404040" p={3} bg="#1a1a1a">
                <Text fontWeight="semibold" mb={3} fontSize="sm">
                  States
                </Text>
                <Stack gap={3}>
                  {detail.states.map((s) => (
                    <StateRow
                      key={s.id}
                      state={s}
                      getToken={getApiAccessToken}
                      onRefresh={() => refreshDetail(editingId)}
                    />
                  ))}
                  <Box borderTopWidth="1px" borderColor="#333" pt={3}>
                    <Text fontSize="xs" color="#888" mb={2}>
                      Add state
                    </Text>
                    <Flex gap={2} flexWrap="wrap" align="flex-end">
                      <Field.Root minW="120px">
                        <Field.Label fontSize="xs">Slug</Field.Label>
                        <Input
                          value={newState.slug}
                          onChange={(e) => setNewState((x) => ({ ...x, slug: e.target.value }))}
                          bg="#222"
                        />
                      </Field.Root>
                      <Field.Root minW="120px">
                        <Field.Label fontSize="xs">Name</Field.Label>
                        <Input
                          value={newState.name}
                          onChange={(e) => setNewState((x) => ({ ...x, name: e.target.value }))}
                          bg="#222"
                        />
                      </Field.Root>
                      <Field.Root w="90px">
                        <Field.Label fontSize="xs">Sort</Field.Label>
                        <Input
                          type="number"
                          value={newState.sort_order}
                          onChange={(e) =>
                            setNewState((x) => ({ ...x, sort_order: Number(e.target.value) }))
                          }
                          bg="#222"
                        />
                      </Field.Root>
                      <Field.Root>
                        <Field.Label fontSize="xs">Initial</Field.Label>
                        <NativeSelectRoot>
                          <NativeSelectField
                            value={newState.is_initial ? "1" : "0"}
                            onChange={(e) =>
                              setNewState((x) => ({ ...x, is_initial: e.target.value === "1" }))
                            }
                            bg="#222"
                          >
                            <option value="0">No</option>
                            <option value="1">Yes</option>
                          </NativeSelectField>
                        </NativeSelectRoot>
                      </Field.Root>
                      <Field.Root>
                        <Field.Label fontSize="xs">Terminal</Field.Label>
                        <NativeSelectRoot>
                          <NativeSelectField
                            value={newState.is_terminal ? "1" : "0"}
                            onChange={(e) =>
                              setNewState((x) => ({ ...x, is_terminal: e.target.value === "1" }))
                            }
                            bg="#222"
                          >
                            <option value="0">No</option>
                            <option value="1">Yes</option>
                          </NativeSelectField>
                        </NativeSelectRoot>
                      </Field.Root>
                      <QffButton type="button" onClick={() => void addState()}>
                        Add state
                      </QffButton>
                    </Flex>
                  </Box>
                </Stack>
              </Box>

              <Box borderWidth="1px" borderRadius="md" borderColor="#404040" p={3} bg="#1a1a1a">
                <Text fontWeight="semibold" mb={3} fontSize="sm">
                  Transitions &amp; effects
                </Text>
                <Stack gap={4}>
                  {detail.transitions.map((tr) => (
                    <TransitionBlock
                      key={tr.id}
                      tr={tr}
                      states={detail.states}
                      items={items}
                      newEffect={getNewEffect(tr.id)}
                      onNewEffectChange={(patch) => setNewEffectField(tr.id, patch)}
                      onAddEffect={() => void addEffect(tr.id)}
                      getToken={getApiAccessToken}
                      onRefresh={() => refreshDetail(editingId)}
                    />
                  ))}
                  <Box borderTopWidth="1px" borderColor="#333" pt={3}>
                    <Text fontSize="xs" color="#888" mb={2}>
                      Add transition
                    </Text>
                    <Flex gap={2} flexWrap="wrap" align="flex-end">
                      <Field.Root minW="140px">
                        <Field.Label fontSize="xs">From state</Field.Label>
                        <NativeSelectRoot>
                          <NativeSelectField
                            value={newTr.from_state_id}
                            onChange={(e) =>
                              setNewTr((x) => ({ ...x, from_state_id: e.target.value }))
                            }
                            bg="#222"
                          >
                            <option value="">—</option>
                            {detail.states.map((s) => (
                              <option key={s.id} value={String(s.id)}>
                                {s.slug} (#{s.id})
                              </option>
                            ))}
                          </NativeSelectField>
                        </NativeSelectRoot>
                      </Field.Root>
                      <Field.Root minW="140px">
                        <Field.Label fontSize="xs">To state</Field.Label>
                        <NativeSelectRoot>
                          <NativeSelectField
                            value={newTr.to_state_id}
                            onChange={(e) =>
                              setNewTr((x) => ({ ...x, to_state_id: e.target.value }))
                            }
                            bg="#222"
                          >
                            <option value="">—</option>
                            {detail.states.map((s) => (
                              <option key={s.id} value={String(s.id)}>
                                {s.slug} (#{s.id})
                              </option>
                            ))}
                          </NativeSelectField>
                        </NativeSelectRoot>
                      </Field.Root>
                      <Field.Root minW="140px">
                        <Field.Label fontSize="xs">Requires item (optional)</Field.Label>
                        <NativeSelectRoot>
                          <NativeSelectField
                            value={newTr.requires_item_id}
                            onChange={(e) =>
                              setNewTr((x) => ({ ...x, requires_item_id: e.target.value }))
                            }
                            bg="#222"
                          >
                            <option value="">—</option>
                            {items.map((it) => (
                              <option key={it.id} value={String(it.id)}>
                                {it.name} (#{it.id})
                              </option>
                            ))}
                          </NativeSelectField>
                        </NativeSelectRoot>
                      </Field.Root>
                      <Field.Root w="90px">
                        <Field.Label fontSize="xs">Sort</Field.Label>
                        <Input
                          type="number"
                          value={newTr.sort_order}
                          onChange={(e) =>
                            setNewTr((x) => ({ ...x, sort_order: Number(e.target.value) }))
                          }
                          bg="#222"
                        />
                      </Field.Root>
                      <QffButton type="button" onClick={() => void addTransition()}>
                        Add transition
                      </QffButton>
                    </Flex>
                  </Box>
                </Stack>
              </Box>
            </>
          )}
        </Stack>
      </Flex>
    </Box>
  );
}

function StateRow({
  state,
  getToken,
  onRefresh,
}: {
  state: DmQuestState;
  getToken: GetToken;
  onRefresh: () => Promise<void>;
}) {
  const [slug, setSlug] = useState(state.slug);
  const [name, setName] = useState(state.name);
  const [isInitial, setIsInitial] = useState(state.is_initial);
  const [isTerminal, setIsTerminal] = useState(state.is_terminal);
  const [sortOrder, setSortOrder] = useState(state.sort_order);

  useEffect(() => {
    setSlug(state.slug);
    setName(state.name);
    setIsInitial(state.is_initial);
    setIsTerminal(state.is_terminal);
    setSortOrder(state.sort_order);
  }, [state]);

  const save = async () => {
    const token = await getToken();
    await dmPatchQuestState(token, state.id, {
      slug: slug.trim(),
      name,
      is_initial: isInitial,
      is_terminal: isTerminal,
      sort_order: sortOrder,
    });
    await onRefresh();
  };

  const del = async () => {
    if (!window.confirm("Delete this state? Transitions using it may break.")) return;
    const token = await getToken();
    await dmDeleteQuestState(token, state.id);
    await onRefresh();
  };

  return (
    <Box borderWidth="1px" borderColor="#333" borderRadius="md" p={2}>
      <Flex gap={2} flexWrap="wrap" align="flex-end" mb={2}>
        <Field.Root minW="100px">
          <Field.Label fontSize="xs">Slug</Field.Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} bg="#222" />
        </Field.Root>
        <Field.Root minW="120px">
          <Field.Label fontSize="xs">Name</Field.Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} bg="#222" />
        </Field.Root>
        <Field.Root w="80px">
          <Field.Label fontSize="xs">Sort</Field.Label>
          <Input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            bg="#222"
          />
        </Field.Root>
        <Field.Root>
          <Field.Label fontSize="xs">Initial</Field.Label>
          <NativeSelectRoot>
            <NativeSelectField
              value={isInitial ? "1" : "0"}
              onChange={(e) => setIsInitial(e.target.value === "1")}
              bg="#222"
            >
              <option value="0">No</option>
              <option value="1">Yes</option>
            </NativeSelectField>
          </NativeSelectRoot>
        </Field.Root>
        <Field.Root>
          <Field.Label fontSize="xs">Terminal</Field.Label>
          <NativeSelectRoot>
            <NativeSelectField
              value={isTerminal ? "1" : "0"}
              onChange={(e) => setIsTerminal(e.target.value === "1")}
              bg="#222"
            >
              <option value="0">No</option>
              <option value="1">Yes</option>
            </NativeSelectField>
          </NativeSelectRoot>
        </Field.Root>
      </Flex>
      <Flex gap={2}>
        <QffButton type="button" onClick={() => void save()}>
          Update state
        </QffButton>
        <Button
          type="button"
          variant="outline"
          size="sm"
          {...qffOutlineMutedButtonProps}
          onClick={() => void del()}
        >
          Delete
        </Button>
      </Flex>
    </Box>
  );
}

function TransitionBlock({
  tr,
  states,
  items,
  newEffect,
  onNewEffectChange,
  onAddEffect,
  getToken,
  onRefresh,
}: {
  tr: DmQuestTransitionRow;
  states: DmQuestState[];
  items: DmItem[];
  newEffect: {
    kind: string;
    amount: string;
    item_id: string;
    room_exit_id: string;
    sort_order: string;
  };
  onNewEffectChange: (
    patch: Partial<{
      kind: string;
      amount: string;
      item_id: string;
      room_exit_id: string;
      sort_order: string;
    }>,
  ) => void;
  onAddEffect: () => void;
  getToken: GetToken;
  onRefresh: () => Promise<void>;
}) {
  const [fromId, setFromId] = useState(String(tr.from_state_id));
  const [toId, setToId] = useState(String(tr.to_state_id));
  const [reqItem, setReqItem] = useState(tr.requires_item_id != null ? String(tr.requires_item_id) : "");
  const [reqQty, setReqQty] = useState(String(tr.requires_item_quantity ?? 1));
  const [sort, setSort] = useState(tr.sort_order);

  useEffect(() => {
    setFromId(String(tr.from_state_id));
    setToId(String(tr.to_state_id));
    setReqItem(tr.requires_item_id != null ? String(tr.requires_item_id) : "");
    setReqQty(String(tr.requires_item_quantity ?? 1));
    setSort(tr.sort_order);
  }, [tr]);

  const saveTr = async () => {
    const qtyNum = Math.max(1, parseInt(reqQty, 10) || 1);
    const token = await getToken();
    await dmPatchQuestTransition(token, tr.id, {
      from_state_id: Number(fromId),
      to_state_id: Number(toId),
      requires_item_id: parseOptInt(reqItem),
      requires_item_quantity: parseOptInt(reqItem) != null ? qtyNum : 1,
      sort_order: sort,
    });
    await onRefresh();
  };

  const delTr = async () => {
    if (!window.confirm("Delete this transition and its effects?")) return;
    const token = await getToken();
    await dmDeleteQuestTransition(token, tr.id);
    await onRefresh();
  };

  const stateLabel = (id: number) => {
    const s = states.find((x) => x.id === id);
    return s ? `${s.slug} (#${id})` : `#${id}`;
  };

  return (
    <Box borderWidth="1px" borderColor="#333" borderRadius="md" p={3}>
      <Text fontSize="xs" color="#888" mb={2}>
        Transition #{tr.id}: {stateLabel(tr.from_state_id)} → {stateLabel(tr.to_state_id)}
      </Text>
      <Flex gap={2} flexWrap="wrap" align="flex-end" mb={3}>
        <Field.Root minW="130px">
          <Field.Label fontSize="xs">From</Field.Label>
          <NativeSelectRoot>
            <NativeSelectField value={fromId} onChange={(e) => setFromId(e.target.value)} bg="#222">
              {states.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.slug} (#{s.id})
                </option>
              ))}
            </NativeSelectField>
          </NativeSelectRoot>
        </Field.Root>
        <Field.Root minW="130px">
          <Field.Label fontSize="xs">To</Field.Label>
          <NativeSelectRoot>
            <NativeSelectField value={toId} onChange={(e) => setToId(e.target.value)} bg="#222">
              {states.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.slug} (#{s.id})
                </option>
              ))}
            </NativeSelectField>
          </NativeSelectRoot>
        </Field.Root>
        <Field.Root minW="140px">
          <Field.Label fontSize="xs">Requires item</Field.Label>
          <NativeSelectRoot>
            <NativeSelectField value={reqItem} onChange={(e) => setReqItem(e.target.value)} bg="#222">
              <option value="">—</option>
              {items.map((it) => (
                <option key={it.id} value={String(it.id)}>
                  {it.name} (#{it.id})
                </option>
              ))}
            </NativeSelectField>
          </NativeSelectRoot>
        </Field.Root>
        <Field.Root w="80px" opacity={reqItem ? undefined : 0.45} pointerEvents={reqItem ? undefined : "none"}>
          <Field.Label fontSize="xs">Qty</Field.Label>
          <Input
            type="number"
            min={1}
            value={reqQty}
            onChange={(e) => setReqQty(e.target.value)}
            bg="#222"
          />
        </Field.Root>
        <Field.Root w="80px">
          <Field.Label fontSize="xs">Sort</Field.Label>
          <Input
            type="number"
            value={sort}
            onChange={(e) => setSort(Number(e.target.value))}
            bg="#222"
          />
        </Field.Root>
        <QffButton type="button" onClick={() => void saveTr()}>
          Update
        </QffButton>
        <Button
          type="button"
          variant="outline"
          size="sm"
          {...qffOutlineMutedButtonProps}
          onClick={() => void delTr()}
        >
          Delete transition
        </Button>
      </Flex>
      <Text fontSize="xs" color="#888" mb={2}>
        Turn-in checks require total quantity carried (stacks + equipped).
      </Text>
      <Text fontSize="xs" color="#889977" mb={2}>
        Effects
      </Text>
      <Stack gap={2} pl={2} borderLeftWidth="2px" borderColor="#333">
        {tr.effects.map((eff) => (
          <EffectRow key={eff.id} effect={eff} items={items} getToken={getToken} onRefresh={onRefresh} />
        ))}
        <Flex gap={2} flexWrap="wrap" align="flex-end" pt={1}>
          <Field.Root minW="160px">
            <Field.Label fontSize="xs">Kind</Field.Label>
            <NativeSelectRoot>
              <NativeSelectField
                value={newEffect.kind}
                onChange={(e) => onNewEffectChange({ kind: e.target.value })}
                bg="#222"
              >
                {EFFECT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </NativeSelectField>
            </NativeSelectRoot>
          </Field.Root>
          <Field.Root w="80px">
            <Field.Label fontSize="xs">Amount</Field.Label>
            <Input
              value={newEffect.amount}
              onChange={(e) => onNewEffectChange({ amount: e.target.value })}
              bg="#222"
            />
          </Field.Root>
          <Field.Root minW="120px">
            <Field.Label fontSize="xs">Item id</Field.Label>
            <NativeSelectRoot>
              <NativeSelectField
                value={newEffect.item_id}
                onChange={(e) => onNewEffectChange({ item_id: e.target.value })}
                bg="#222"
              >
                <option value="">—</option>
                {items.map((it) => (
                  <option key={it.id} value={String(it.id)}>
                    {it.name} (#{it.id})
                  </option>
                ))}
              </NativeSelectField>
            </NativeSelectRoot>
          </Field.Root>
          <Field.Root w="100px">
            <Field.Label fontSize="xs">Room exit id</Field.Label>
            <Input
              value={newEffect.room_exit_id}
              onChange={(e) => onNewEffectChange({ room_exit_id: e.target.value })}
              bg="#222"
              placeholder="optional"
            />
          </Field.Root>
          <Field.Root w="70px">
            <Field.Label fontSize="xs">Sort</Field.Label>
            <Input
              value={newEffect.sort_order}
              onChange={(e) => onNewEffectChange({ sort_order: e.target.value })}
              bg="#222"
            />
          </Field.Root>
          <QffButton type="button" onClick={onAddEffect}>
            Add effect
          </QffButton>
        </Flex>
      </Stack>
    </Box>
  );
}

function EffectRow({
  effect,
  items,
  getToken,
  onRefresh,
}: {
  effect: DmQuestEffectRow;
  items: DmItem[];
  getToken: GetToken;
  onRefresh: () => Promise<void>;
}) {
  const [kind, setKind] = useState(effect.kind);
  const [amount, setAmount] = useState(String(effect.amount));
  const [itemId, setItemId] = useState(effect.item_id != null ? String(effect.item_id) : "");
  const [exitId, setExitId] = useState(effect.room_exit_id != null ? String(effect.room_exit_id) : "");
  const [sort, setSort] = useState(String(effect.sort_order));

  useEffect(() => {
    setKind(effect.kind);
    setAmount(String(effect.amount));
    setItemId(effect.item_id != null ? String(effect.item_id) : "");
    setExitId(effect.room_exit_id != null ? String(effect.room_exit_id) : "");
    setSort(String(effect.sort_order));
  }, [effect]);

  const save = async () => {
    const token = await getToken();
    await dmPatchQuestEffect(token, effect.id, {
      kind,
      amount: Number(amount) || 0,
      item_id: parseOptInt(itemId),
      room_exit_id: parseOptInt(exitId),
      sort_order: Number(sort) || 0,
    });
    await onRefresh();
  };

  const del = async () => {
    if (!window.confirm("Delete this effect?")) return;
    const token = await getToken();
    await dmDeleteQuestEffect(token, effect.id);
    await onRefresh();
  };

  return (
    <Box borderWidth="1px" borderColor="#2a2a2a" borderRadius="md" p={2}>
      <Flex gap={2} flexWrap="wrap" align="flex-end">
        <Field.Root minW="150px">
          <Field.Label fontSize="xs">Kind</Field.Label>
          <NativeSelectRoot>
            <NativeSelectField value={kind} onChange={(e) => setKind(e.target.value)} bg="#222">
              {EFFECT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </NativeSelectField>
          </NativeSelectRoot>
        </Field.Root>
        <Field.Root w="80px">
          <Field.Label fontSize="xs">Amount</Field.Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} bg="#222" />
        </Field.Root>
        <Field.Root minW="120px">
          <Field.Label fontSize="xs">Item</Field.Label>
          <NativeSelectRoot>
            <NativeSelectField value={itemId} onChange={(e) => setItemId(e.target.value)} bg="#222">
              <option value="">—</option>
              {items.map((it) => (
                <option key={it.id} value={String(it.id)}>
                  {it.name} (#{it.id})
                </option>
              ))}
            </NativeSelectField>
          </NativeSelectRoot>
        </Field.Root>
        <Field.Root w="100px">
          <Field.Label fontSize="xs">Exit id</Field.Label>
          <Input value={exitId} onChange={(e) => setExitId(e.target.value)} bg="#222" />
        </Field.Root>
        <Field.Root w="70px">
          <Field.Label fontSize="xs">Sort</Field.Label>
          <Input value={sort} onChange={(e) => setSort(e.target.value)} bg="#222" />
        </Field.Root>
        <QffButton type="button" onClick={() => void save()}>
          Update
        </QffButton>
        <Button
          type="button"
          variant="outline"
          size="sm"
          {...qffOutlineMutedButtonProps}
          onClick={() => void del()}
        >
          Delete
        </Button>
      </Flex>
    </Box>
  );
}
