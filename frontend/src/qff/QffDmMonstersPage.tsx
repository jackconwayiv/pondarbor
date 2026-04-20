import {
  Box,
  Field,
  Flex,
  Heading,
  Input,
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
  dmFetchMonsterTemplates,
  dmPatchMonsterTemplate,
  type DmMonsterTemplate,
} from "./api";

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
    loot_table: [],
  };
}

export default function QffDmMonstersPage() {
  const navigate = useNavigate();
  const { isAuthenticated, sessionUser, isLoading, getApiAccessToken } = useAppSession();
  const isStaff = !!sessionUser?.user?.is_staff;
  const [rows, setRows] = useState<DmMonsterTemplate[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [lootJson, setLootJson] = useState("[]");
  const [form, setForm] = useState<Partial<DmMonsterTemplate>>(emptyForm());
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const token = await getApiAccessToken();
    const list = await dmFetchMonsterTemplates(token);
    setRows(list);
  }, [getApiAccessToken]);

  useEffect(() => {
    if (!isAuthenticated || !isStaff) return;
    load().catch((e) => setErr(String(e)));
  }, [isAuthenticated, isStaff, load]);

  const selectRow = (t: DmMonsterTemplate) => {
    setEditingId(t.id);
    setForm({ ...t });
    try {
      setLootJson(JSON.stringify(t.loot_table ?? [], null, 2));
    } catch {
      setLootJson("[]");
    }
  };

  const save = async () => {
    if (editingId == null) return;
    setErr(null);
    let loot_table: unknown[] = [];
    try {
      const parsed = JSON.parse(lootJson || "[]");
      loot_table = Array.isArray(parsed) ? parsed : [];
    } catch {
      setErr("loot_table must be valid JSON array.");
      return;
    }
    try {
      const token = await getApiAccessToken();
      const updated = await dmPatchMonsterTemplate(token, editingId, {
        ...form,
        loot_table,
      });
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setForm(updated);
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
        <QffButton type="button" onClick={() => navigate("/qff/dm")}>
          DM home
        </QffButton>
      </Flex>
      <Text mb={4} color="#889977" fontSize="sm">
        Edit stats, armor, accuracy, penetration/crit/dodge mods, and loot JSON. Each loot row
        may include chance (1–100); rows sort ascending by chance; first successful d100 wins one
        drop. New templates: API or Django admin.
      </Text>
      {err && (
        <Text color="nautical.solid" mb={4} role="alert">
          {err}
        </Text>
      )}
      <Flex gap={6} align="start" flexDir={{ base: "column", lg: "row" }}>
        <Box flex="0 0 280px" w="100%" maxH="70vh" overflowY="auto" borderWidth="1px" borderRadius="md" borderColor="#333" p={2}>
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
          {editingId == null ? (
            <Text color="#888">Select a monster to edit.</Text>
          ) : (
            <Stack gap={3}>
              <Field.Root>
                <Field.Label>Slug</Field.Label>
                <Input
                  value={form.slug ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  bg="#222"
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
                <Field.Label>loot_table (JSON array)</Field.Label>
                <Textarea
                  value={lootJson}
                  onChange={(e) => setLootJson(e.target.value)}
                  rows={10}
                  bg="#222"
                  fontFamily="monospace"
                  fontSize="sm"
                />
              </Field.Root>
              <QffButton type="button" onClick={() => void save()}>
                Save
              </QffButton>
            </Stack>
          )}
        </Box>
      </Flex>
    </Box>
  );
}
