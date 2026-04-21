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
import QffButton from "./QffButton";
import { qffGhostRowButtonProps } from "./qffUi";
import {
  dmCreateMonsterTemplate,
  dmFetchItems,
  dmFetchMonsterTemplates,
  dmPatchMonsterTemplate,
  type DmItem,
  type DmMonsterLootRow,
  type DmMonsterTemplate,
} from "./api";

type LootEditorRow = { slug: string; chance: string; questOnly: boolean };

function emptyForm(): Partial<DmMonsterTemplate> {
  return {
    slug: "",
    name: "",
    spawn_cooldown_minutes: 5,
    level: 1,
    max_hp: 5,
    damage_min: 1,
    damage_max: 3,
    moves: 0,
    xp_value: 5,
    gold_min: 0,
    gold_max: 0,
    armor: 0,
    accuracy: 0,
    penetration: 0,
    crit_chance_bonus_pct: 0,
    crit_damage_bonus: 0,
    dodge_reduction: 0,
    dodge_ignore: 0,
    description: "",
    hidden_description: "",
    lore_dc: null,
    attack_weapon_label: "",
    loot_table: [],
  };
}

function lootRowsFromTable(t: DmMonsterLootRow[] | undefined): LootEditorRow[] {
  const rows = t ?? [];
  if (rows.length === 0) {
    return [{ slug: "", chance: "0", questOnly: false }];
  }
  return rows.map((r) => ({
    slug: String(r.slug || r.item_slug || ""),
    chance: String(r.chance ?? (r as { pct?: number }).pct ?? 0),
    questOnly: !!(r as { quest_only?: boolean }).quest_only,
  }));
}

function lootTableFromRows(rows: LootEditorRow[]): DmMonsterLootRow[] {
  return rows
    .filter((r) => r.slug.trim())
    .map((r) => ({
      slug: r.slug.trim(),
      chance: Math.min(100, Math.max(0, parseInt(r.chance, 10) || 0)),
      quest_only: r.questOnly,
    }));
}

export default function QffDmMonstersPage() {
  const navigate = useNavigate();
  const { isAuthenticated, sessionUser, isLoading, getApiAccessToken } = useAppSession();
  const isStaff = !!sessionUser?.user?.is_staff;
  const [rows, setRows] = useState<DmMonsterTemplate[]>([]);
  const [items, setItems] = useState<DmItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [lootRows, setLootRows] = useState<LootEditorRow[]>([{ slug: "", chance: "0", questOnly: false }]);
  const [showLootJson, setShowLootJson] = useState(false);
  const [lootJson, setLootJson] = useState("[]");
  const [form, setForm] = useState<Partial<DmMonsterTemplate>>(emptyForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loreDcInput, setLoreDcInput] = useState("");

  const load = useCallback(async () => {
    const token = await getApiAccessToken();
    const list = await dmFetchMonsterTemplates(token);
    setRows(list);
  }, [getApiAccessToken]);

  const loadItems = useCallback(async () => {
    const token = await getApiAccessToken();
    const list = await dmFetchItems(token);
    setItems(list.sort((a, b) => a.name.localeCompare(b.name)));
  }, [getApiAccessToken]);

  useEffect(() => {
    if (!isAuthenticated || !isStaff) return;
    load().catch((e) => setErr(String(e)));
    loadItems().catch(() => setItems([]));
  }, [isAuthenticated, isStaff, load, loadItems]);

  const newTemplate = () => {
    setErr(null);
    setEditingId(null);
    setIsCreating(true);
    setForm(emptyForm());
    setLootRows([{ slug: "", chance: "0", questOnly: false }]);
    setLootJson("[]");
    setShowLootJson(false);
    setLoreDcInput("");
  };

  const selectRow = (t: DmMonsterTemplate) => {
    setIsCreating(false);
    setEditingId(t.id);
    setForm({ ...t });
    setLootRows(lootRowsFromTable(t.loot_table));
    setLoreDcInput(t.lore_dc != null && t.lore_dc !== undefined ? String(t.lore_dc) : "");
    try {
      setLootJson(JSON.stringify(t.loot_table ?? [], null, 2));
    } catch {
      setLootJson("[]");
    }
    setShowLootJson(false);
  };

  const save = async () => {
    setErr(null);
    let loot_table: DmMonsterLootRow[];
    if (showLootJson) {
      try {
        const parsed = JSON.parse(lootJson || "[]");
        loot_table = Array.isArray(parsed) ? parsed : [];
      } catch {
        setErr("loot_table must be valid JSON array.");
        return;
      }
    } else {
      const sum = lootRows
        .filter((r) => r.slug.trim())
        .reduce((a, r) => a + (parseInt(r.chance, 10) || 0), 0);
      if (sum > 100) {
        setErr(`Loot chances sum to ${sum}; maximum is 100 (one d100 partition).`);
        return;
      }
      loot_table = lootTableFromRows(lootRows);
    }

    const loreRaw = loreDcInput.trim();
    let lore_dc: number | null = null;
    if (loreRaw !== "") {
      const n = parseInt(loreRaw, 10);
      if (!Number.isFinite(n) || n < 1) {
        setErr("Lore DC must be empty (use level) or an integer ≥ 1.");
        return;
      }
      lore_dc = Math.min(65535, n);
    }

    const body: Partial<DmMonsterTemplate> = {
      ...form,
      loot_table,
      lore_dc,
      attack_weapon_label: form.attack_weapon_label ?? "",
    };

    try {
      const token = await getApiAccessToken();
      if (editingId == null && isCreating) {
        if (!form.slug?.trim() || !form.name?.trim()) {
          setErr("slug and name are required to create a template.");
          return;
        }
        const created = await dmCreateMonsterTemplate(token, {
          slug: form.slug!.trim(),
          name: form.name!.trim(),
        });
        const updated = await dmPatchMonsterTemplate(token, created.id, {
          ...body,
          slug: form.slug!.trim(),
          name: form.name!.trim(),
        });
        setRows((prev) => [...prev, updated].sort((a, b) => a.name.localeCompare(b.name)));
        setEditingId(updated.id);
        setIsCreating(false);
        setForm(updated);
        setLootRows(lootRowsFromTable(updated.loot_table));
        setLoreDcInput(
          updated.lore_dc != null && updated.lore_dc !== undefined ? String(updated.lore_dc) : "",
        );
        setLootJson(JSON.stringify(updated.loot_table ?? [], null, 2));
        return;
      }
      if (editingId == null) return;
      const updated = await dmPatchMonsterTemplate(token, editingId, body);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setForm(updated);
      setLootRows(lootRowsFromTable(updated.loot_table));
      setLoreDcInput(
        updated.lore_dc != null && updated.lore_dc !== undefined ? String(updated.lore_dc) : "",
      );
      setLootJson(JSON.stringify(updated.loot_table ?? [], null, 2));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
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

  return (
    <Box maxW="6xl" mx="auto" px={4} py={8} color="#c8e6a8">
      <Flex justify="space-between" align="center" mb={4} flexWrap="wrap" gap={2}>
        <Heading size="lg">Monster templates</Heading>
        <Flex gap={2} flexWrap="wrap">
          <QffButton type="button" onClick={() => navigate("/qff/dm")}>
            DM home
          </QffButton>
          <QffButton type="button" onClick={newTemplate}>
            New monster template
          </QffButton>
        </Flex>
      </Flex>
      <Text mb={4} color="#889977" fontSize="sm">
        Loot uses one d100 roll: cumulative chance bands in list order (sum ≤ 100). At most one
        item drops per kill. Quest-only rows drop only if at least one hero in the room does not
        already carry that item template. Hidden lore uses d100 + Smarts (encumbered) vs Lore DC
        (blank = monster level).
      </Text>
      {err && (
        <Text color="nautical.solid" mb={4} role="alert">
          {err}
        </Text>
      )}
      <Flex gap={6} align="start" flexDir={{ base: "column", lg: "row" }}>
        <Box
          flex="0 0 280px"
          w="100%"
          maxH="70vh"
          overflowY="auto"
          borderWidth="1px"
          borderRadius="md"
          borderColor="#333"
          p={2}
        >
          <Stack gap={0}>
            {rows.map((t) => (
              <Box
                key={t.id}
                as="button"
                onClick={() => selectRow(t)}
                textAlign="left"
                px={2}
                py={1.5}
                borderBottomWidth="1px"
                borderColor="#333"
                bg={editingId === t.id ? "rgba(100, 140, 100, 0.15)" : "transparent"}
                cursor="pointer"
                {...qffGhostRowButtonProps}
              >
                <Text fontSize="sm" fontWeight="medium">
                  {t.name}
                </Text>
                <Text fontSize="xs" color="#888">
                  {t.slug} · L{t.level} · HP {t.max_hp}
                </Text>
              </Box>
            ))}
          </Stack>
        </Box>
        <Box flex="1" minW={0}>
          {editingId == null && !isCreating ? (
            <Text color="#888">Select a monster to edit, or click &quot;New monster template&quot;.</Text>
          ) : (
            <Stack gap={3}>
              <Text fontSize="sm" color="#889977">
                {isCreating ? "Creating new template" : `Editing #${editingId}`}
              </Text>
              <Field.Root>
                <Field.Label>Slug</Field.Label>
                <Input
                  value={form.slug ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  bg="#222"
                  disabled={editingId != null && !isCreating}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>Name</Field.Label>
                <Input
                  value={form.name ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  bg="#222"
                />
              </Field.Root>
              <Flex gap={2} flexWrap="wrap">
                {(
                  [
                    ["spawn_cooldown_minutes", "Spawn cooldown (min)"],
                    ["level", "Level"],
                    ["max_hp", "Max HP"],
                    ["damage_min", "Damage min"],
                    ["damage_max", "Damage max"],
                    ["moves", "Moves (init)"],
                    ["xp_value", "XP"],
                    ["gold_min", "Gold min"],
                    ["gold_max", "Gold max"],
                    ["armor", "Armor"],
                    ["accuracy", "Accuracy"],
                    ["penetration", "Penetration"],
                    ["crit_chance_bonus_pct", "Crit % pts"],
                    ["crit_damage_bonus", "Crit dmg+"],
                    ["dodge_reduction", "Dodge red."],
                    ["dodge_ignore", "Dodge ign."],
                  ] as const
                ).map(([key, label]) => (
                  <Field.Root key={key} maxW="140px">
                    <Field.Label fontSize="xs">{label}</Field.Label>
                    <Input
                      type="number"
                      value={String(form[key] ?? 0)}
                      onChange={(e) => {
                        if (key === "crit_damage_bonus") {
                          const n = parseFloat(e.target.value);
                          setForm((f) => ({ ...f, [key]: Number.isFinite(n) ? n : 0 }));
                        } else {
                          const n = parseInt(e.target.value, 10);
                          setForm((f) => ({ ...f, [key]: Number.isFinite(n) ? n : 0 }));
                        }
                      }}
                      bg="#222"
                    />
                  </Field.Root>
                ))}
              </Flex>
              <Field.Root>
                <Field.Label>Attack weapon (combat flavor)</Field.Label>
                <Input
                  value={form.attack_weapon_label ?? ""}
                  placeholder="e.g. rusty blade, filthy claws"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, attack_weapon_label: e.target.value }))
                  }
                  bg="#222"
                />
                <Text fontSize="xs" color="#888" mt={1}>
                  Shown in hit lines: “The Name attacks you with its …” Leave blank for generic
                  strikes.
                </Text>
              </Field.Root>
              <Field.Root>
                <Field.Label>Description (look / inspect)</Field.Label>
                <Textarea
                  value={form.description ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={4}
                  bg="#222"
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>Hidden description (lore)</Field.Label>
                <Textarea
                  value={form.hidden_description ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, hidden_description: e.target.value }))}
                  rows={4}
                  bg="#222"
                />
                <Text fontSize="xs" color="#888" mt={1}>
                  Revealed when d100 + Smarts (encumbered) ≥ Lore DC (see below).
                </Text>
              </Field.Root>
              <Field.Root maxW="160px">
                <Field.Label fontSize="xs">Lore DC (blank = use level)</Field.Label>
                <Input
                  size="sm"
                  type="number"
                  min={1}
                  max={65535}
                  placeholder={`default ${form.level ?? 1}`}
                  value={loreDcInput}
                  onChange={(e) => setLoreDcInput(e.target.value)}
                  bg="#222"
                />
              </Field.Root>

              <Text fontSize="sm" fontWeight="semibold" color="#b8c8a8" mt={2}>
                Loot table
              </Text>
              {!showLootJson ? (
                <Stack gap={2}>
                  {lootRows.map((row, idx) => (
                    <Flex key={idx} gap={2} align="flex-end" flexWrap="wrap">
                      <Field.Root flex="1" minW="180px">
                        <Field.Label fontSize="xs">Item</Field.Label>
                        <NativeSelectRoot>
                          <NativeSelectField
                            value={row.slug}
                            onChange={(e) => {
                              const v = e.target.value;
                              setLootRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, slug: v } : r)),
                              );
                            }}
                            bg="#222"
                          >
                            <option value="">—</option>
                            {items.map((it) => (
                              <option key={it.id} value={it.slug}>
                                {it.name} ({it.slug})
                              </option>
                            ))}
                          </NativeSelectField>
                        </NativeSelectRoot>
                      </Field.Root>
                      <Field.Root maxW="90px">
                        <Field.Label fontSize="xs">Chance %</Field.Label>
                        <Input
                          size="sm"
                          type="number"
                          min={0}
                          max={100}
                          value={row.chance}
                          onChange={(e) => {
                            const v = e.target.value;
                            setLootRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, chance: v } : r)),
                            );
                          }}
                          bg="#222"
                        />
                      </Field.Root>
                      <Field.Root>
                        <Field.Label fontSize="xs">Quest-only</Field.Label>
                        <Flex align="center" h="32px">
                          <input
                            type="checkbox"
                            checked={row.questOnly}
                            onChange={(e) => {
                              const c = e.target.checked;
                              setLootRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, questOnly: c } : r)),
                              );
                            }}
                          />
                        </Flex>
                      </Field.Root>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setLootRows((prev) =>
                            prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx),
                          )
                        }
                        disabled={lootRows.length <= 1}
                      >
                        Remove
                      </Button>
                    </Flex>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setLootRows((prev) => [...prev, { slug: "", chance: "0", questOnly: false }])
                    }
                  >
                    Add loot row
                  </Button>
                </Stack>
              ) : (
                <Field.Root>
                  <Field.Label>loot_table (JSON)</Field.Label>
                  <Textarea
                    value={lootJson}
                    onChange={(e) => setLootJson(e.target.value)}
                    rows={10}
                    bg="#222"
                    fontFamily="monospace"
                    fontSize="sm"
                  />
                </Field.Root>
              )}
              <Button size="xs" variant="ghost" onClick={() => setShowLootJson((v) => !v)}>
                {showLootJson ? "Use loot grid editor" : "Edit loot as JSON"}
              </Button>

              <QffButton type="button" onClick={() => void save()}>
                {isCreating ? "Create" : "Save"}
              </QffButton>
            </Stack>
          )}
        </Box>
      </Flex>
    </Box>
  );
}
