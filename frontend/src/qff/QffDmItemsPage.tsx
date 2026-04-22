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
  Switch,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import QffButton from "./QffButton";
import { qffGhostRowButtonProps } from "./qffUi";
import {
  dmCreateItem,
  dmDeleteItem,
  dmFetchItems,
  dmPatchItem,
  type DmItem,
} from "./api";

const SLOTS = [
  "",
  "head",
  "main_hand",
  "off_hand",
  "chest",
  "feet",
  "ring",
  "amulet",
] as const;

const RARITIES = ["common", "rare", "legendary", "unique"] as const;
const DMG = ["physical", "magic"] as const;
const HIDDEN = ["none", "crit_chain", "lifesteal", "mana_on_hit"] as const;
const HIDDEN_BONUS_STAT = ["", "gains", "moves", "guts", "smarts", "sense", "rizz"] as const;

type EffectPresetId =
  | "none"
  | "advanced"
  | "heal_hp"
  | "restore_mana"
  | "light_x3"
  | "light_x5"
  | "teleport_spawn";

function currentEffectPreset(extra: Record<string, unknown> | undefined): {
  id: EffectPresetId;
  amount?: number;
} {
  const raw = extra?.consume_effects;
  if (!Array.isArray(raw) || raw.length === 0) return { id: "none" };
  if (raw.length > 1) return { id: "advanced" };
  const e = raw[0] as Record<string, unknown>;
  const k = String(e.kind || "").trim();
  if (k === "heal_hp") return { id: "heal_hp", amount: Number(e.amount) || 1 };
  if (k === "restore_mana") return { id: "restore_mana", amount: Number(e.amount) || 1 };
  if (k === "dark_minimap_light") {
    const r = Number(e.radius);
    if (r === 3) return { id: "light_x3" };
    if (r === 5) return { id: "light_x5" };
    return { id: "advanced" };
  }
  if (k === "teleport_spawn") return { id: "teleport_spawn" };
  return { id: "advanced" };
}

function emptyForm(): Partial<DmItem> {
  return {
    slug: "",
    name: "",
    item_type: "",
    slot: "",
    consumable: false,
    consume_verb: "",
    stackable: false,
    max_stack: 99,
    extra_data: {} as Record<string, unknown>,
    cost: 0,
    description: "",
    lore: "",
    lore_chance: null,
    rarity: "common",
    damage: 0,
    dmg_type: "physical",
    armor: 0,
    element: "",
    hidden_special_effect: "none",
    hidden_bonus_stat: "",
    hidden_bonus_value: 0,
    two_handed: false,
    unsellable: false,
    vendor_refuses_buy: false,
    req_gains: null,
    req_moves: null,
    req_guts: null,
    req_smarts: null,
    req_sense: null,
    req_rizz: null,
    bonus_gains: 0,
    bonus_moves: 0,
    bonus_guts: 0,
    bonus_smarts: 0,
    bonus_sense: 0,
    bonus_rizz: 0,
    weapon_accuracy: 0,
    crit_chance_bonus_pct: 0,
    crit_damage_bonus: 0,
    penetration: 0,
    dodge_bonus: 0,
    dodge_reduction: 0,
    dodge_ignore: 0,
  };
}

export default function QffDmItemsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, sessionUser, isLoading, getApiAccessToken } = useAppSession();
  const isStaff = !!sessionUser?.user?.is_staff;
  const [items, setItems] = useState<DmItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<DmItem>>(emptyForm());
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const token = await getApiAccessToken();
    const rows = await dmFetchItems(token);
    setItems(rows);
  }, [getApiAccessToken]);

  useEffect(() => {
    if (!isAuthenticated || !isStaff) return;
    load().catch((e) => setErr(String(e)));
  }, [isAuthenticated, isStaff, load]);

  const selectItem = (it: DmItem) => {
    setEditingId(it.id);
    setForm({
      ...it,
      slot: it.slot ?? "",
      consumable: it.consumable ?? false,
      consume_verb: it.consume_verb ?? "",
      stackable: it.stackable ?? false,
      max_stack: it.max_stack ?? 99,
      extra_data: (it.extra_data ?? {}) as Record<string, unknown>,
    });
  };

  const newItem = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const save = async () => {
    setErr(null);
    const token = await getApiAccessToken();
    try {
      if (editingId == null) {
        if (!form.slug?.trim() || !form.name?.trim()) {
          setErr("slug and name are required.");
          return;
        }
        await dmCreateItem(token, {
          ...form,
          slug: form.slug!.trim(),
          name: form.name!.trim(),
          slot: form.slot?.trim() ? form.slot : null,
          consumable: !!form.consumable,
          stackable: !!form.stackable,
          max_stack: form.max_stack ?? 99,
          extra_data: form.extra_data ?? {},
        });
      } else {
        await dmPatchItem(token, editingId, {
          ...form,
          slot: form.slot?.trim() ? form.slot : null,
          consumable: !!form.consumable,
          stackable: !!form.stackable,
          max_stack: form.max_stack ?? 99,
          extra_data: form.extra_data ?? {},
        });
      }
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
  };

  const del = async () => {
    if (editingId == null) return;
    if (
      !window.confirm(
        "Delete this item template? Every spawned instance of this item will be removed. " +
          "Equipment on characters will clear; inventory lists may still contain stale instance IDs until cleaned up.",
      )
    )
      return;
    setErr(null);
    try {
      const token = await getApiAccessToken();
      await dmDeleteItem(token, editingId);
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

  const effectPreset = currentEffectPreset(form.extra_data as Record<string, unknown> | undefined);

  return (
    <Box maxW="6xl" mx="auto" px={4} py={8} color="#c8e6a8">
      <Flex justify="space-between" align="center" mb={4} flexWrap="wrap" gap={2}>
        <Heading size="lg">Item templates</Heading>
        <Flex gap={2} flexWrap="wrap">
          <QffButton type="button" onClick={() => navigate("/qff/dm")}>
            DM home
          </QffButton>
          <QffButton type="button" onClick={newItem}>
            New item
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
          {items.map((it) => (
            <Button
              key={it.id}
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
              bg={editingId === it.id ? "#2a3a2a" : "transparent"}
              _hover={{ bg: "#252525" }}
              onClick={() => selectItem(it)}
            >
              <Text fontWeight="medium">{it.name}</Text>
              <Text fontSize="xs" color="#888">
                {it.slug} · {it.slot ?? "—"}
              </Text>
            </Button>
          ))}
        </Box>
        <Stack gap={3} flex="1" minW={0}>
          <Text fontSize="sm" color="#889977">
            {editingId == null ? "Creating new item" : `Editing #${editingId}`}
          </Text>
          <Flex gap={2} flexWrap="wrap">
            <Field.Root flex="1" minW="120px">
              <Field.Label>Slug</Field.Label>
              <Input
                value={form.slug ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                bg="#222"
                disabled={editingId != null}
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
          </Flex>
          <Flex
            gap={6}
            flexWrap="wrap"
            align="flex-end"
            borderWidth="1px"
            borderRadius="md"
            borderColor="#404040"
            p={3}
            bg="#1a1a1a"
          >
            <Field.Root flex="0 1 220px" minW="180px">
              <Field.Label>Equip slot</Field.Label>
              <Text fontSize="xs" color="#888" mb={1}>
                None = not equippable (quest items, inventory-only gear, etc.).
              </Text>
              <NativeSelectRoot>
                <NativeSelectField
                  value={form.slot ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, slot: e.target.value }))}
                  bg="#222"
                >
                  {SLOTS.map((s) => (
                    <option key={s || "none"} value={s}>
                      {s === "" ? "None — not equippable" : s}
                    </option>
                  ))}
                </NativeSelectField>
              </NativeSelectRoot>
            </Field.Root>
            <Field.Root flex="1" minW="200px">
              <Field.Label>Consumable</Field.Label>
              <Text fontSize="xs" color="#888" mb={1}>
                When on, eat / drink / use / read from inventory work. With a set consume
                verb, <Text as="code">/use</Text> is also accepted (e.g. use + eat).
              </Text>
              <Switch.Root
                checked={!!form.consumable}
                onCheckedChange={(d) => setForm((f) => ({ ...f, consumable: d.checked }))}
                colorPalette="green"
              >
                <Switch.HiddenInput />
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Switch.Label fontSize="sm">
                  {form.consumable ? "Yes — can be consumed" : "No — not consumable"}
                </Switch.Label>
              </Switch.Root>
            </Field.Root>
            <Field.Root flex="1" minW="200px">
              <Field.Label>Consume verb</Field.Label>
              <Text fontSize="xs" color="#888" mb={1}>
                Required base verb when set; players may still type <Text as="code">/use</Text> for
                eat / drink / read. Leave &quot;Any&quot; for legacy items.
              </Text>
              <NativeSelectRoot
                opacity={form.consumable ? undefined : 0.45}
                pointerEvents={form.consumable ? undefined : "none"}
              >
                <NativeSelectField
                  value={form.consume_verb ?? ""}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                    if (!form.consumable) return;
                    setForm((f) => ({ ...f, consume_verb: e.target.value }));
                  }}
                  bg="#222"
                >
                  <option value="">Any (eat / drink / use / read)</option>
                  <option value="eat">Eat</option>
                  <option value="drink">Drink</option>
                  <option value="use">Use</option>
                  <option value="read">Read</option>
                </NativeSelectField>
              </NativeSelectRoot>
            </Field.Root>
            <Field.Root flex="1" minW="200px">
              <Field.Label>Stackable</Field.Label>
              <Text fontSize="xs" color="#888" mb={1}>
                Same template merges in inventory up to max stack (one encumbrance slot per inventory row; equipped items don’t count).
              </Text>
              <Switch.Root
                checked={!!form.stackable}
                onCheckedChange={(d) => setForm((f) => ({ ...f, stackable: d.checked }))}
                colorPalette="green"
              >
                <Switch.HiddenInput />
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Switch.Label fontSize="sm">
                  {form.stackable ? "Yes — stacks" : "No — one unit per instance"}
                </Switch.Label>
              </Switch.Root>
            </Field.Root>
            <Field.Root minW="100px">
              <Field.Label>Max stack</Field.Label>
              <Input
                type="number"
                value={form.max_stack ?? 99}
                onChange={(e) =>
                  setForm((f) => ({ ...f, max_stack: Math.max(1, Number(e.target.value) || 99) }))
                }
                bg="#222"
                w="100px"
              />
            </Field.Root>
          </Flex>
          <Field.Root>
            <Field.Label>Consumable effect preset</Field.Label>
            <Text fontSize="xs" color="#888" mb={1}>
              Quick picks write <Text as="code">consume_effects</Text>. Use JSON below for combos or
              custom fields.
            </Text>
            <Flex gap={2} flexWrap="wrap" alignItems="flex-end">
              <NativeSelectRoot
                maxW="280px"
                opacity={form.consumable ? undefined : 0.45}
                pointerEvents={form.consumable ? undefined : "none"}
              >
                <NativeSelectField
                  value={effectPreset.id === "advanced" ? "advanced" : effectPreset.id}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                    if (!form.consumable) return;
                    const v = e.target.value as EffectPresetId | "advanced";
                    if (v === "advanced") return;
                    setForm((f) => {
                      const data = { ...(f.extra_data ?? {}) } as Record<string, unknown>;
                      if (v === "none") {
                        delete data.consume_effects;
                        return { ...f, extra_data: data };
                      }
                      if (v === "heal_hp") {
                        data.consume_effects = [{ kind: "heal_hp", amount: 10 }];
                      } else if (v === "restore_mana") {
                        data.consume_effects = [{ kind: "restore_mana", amount: 10 }];
                      } else if (v === "light_x3") {
                        data.consume_effects = [{ kind: "dark_minimap_light", radius: 3 }];
                      } else if (v === "light_x5") {
                        data.consume_effects = [{ kind: "dark_minimap_light", radius: 5 }];
                      } else if (v === "teleport_spawn") {
                        data.consume_effects = [{ kind: "teleport_spawn" }];
                      }
                      return { ...f, extra_data: data };
                    });
                  }}
                  bg="#222"
                >
                  <option value="none">None</option>
                  <option value="heal_hp">Healing (HP)</option>
                  <option value="restore_mana">Restore mana</option>
                  <option value="light_x3">Dark minimap light — radius 3</option>
                  <option value="light_x5">Dark minimap light — radius 5</option>
                  <option value="teleport_spawn">Teleport to spawn (scroll)</option>
                  {effectPreset.id === "advanced" && (
                    <option value="advanced" disabled>
                      Advanced (edit JSON below)
                    </option>
                  )}
                </NativeSelectField>
              </NativeSelectRoot>
              {(effectPreset.id === "heal_hp" || effectPreset.id === "restore_mana") && (
                <Field.Root maxW="100px">
                  <Field.Label fontSize="xs">Amount</Field.Label>
                  <Input
                    type="number"
                    min={1}
                    value={effectPreset.amount ?? 10}
                    onChange={(e) => {
                      if (!form.consumable) return;
                      const n = Math.max(1, parseInt(e.target.value, 10) || 1);
                      const kind = effectPreset.id;
                      setForm((f) => {
                        const data = { ...(f.extra_data ?? {}) } as Record<string, unknown>;
                        data.consume_effects = [{ kind, amount: n }];
                        return { ...f, extra_data: data };
                      });
                    }}
                    bg="#222"
                  />
                </Field.Root>
              )}
            </Flex>
          </Field.Root>
          <Field.Root>
            <Field.Label>Consumable effects (extra_data JSON)</Field.Label>
            <Text fontSize="xs" color="#888" mb={1}>
              Optional. For multi-effect or experimental data. Preset above is enough for common
              items.
            </Text>
            <Textarea
              value={JSON.stringify(form.extra_data ?? {}, null, 2)}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (!raw) {
                  setForm((f) => ({ ...f, extra_data: {} }));
                  return;
                }
                try {
                  const o = JSON.parse(raw) as Record<string, unknown>;
                  if (o && typeof o === "object" && !Array.isArray(o)) {
                    setForm((f) => ({ ...f, extra_data: o }));
                  }
                } catch {
                  /* keep typing */
                }
              }}
              bg="#222"
              fontFamily="mono"
              fontSize="sm"
              minH="100px"
            />
          </Field.Root>
          <Field.Root>
            <Field.Label>Type</Field.Label>
            <Input
              value={form.item_type ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, item_type: e.target.value }))}
              bg="#222"
            />
          </Field.Root>
          <Flex gap={2} flexWrap="wrap">
            <Field.Root>
              <Field.Label>Cost</Field.Label>
              <Input
                type="number"
                value={form.cost ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, cost: Number(e.target.value) }))}
                bg="#222"
                w="100px"
              />
            </Field.Root>
            <Field.Root>
              <Field.Label>Damage</Field.Label>
              <Input
                type="number"
                value={form.damage ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, damage: Number(e.target.value) }))}
                bg="#222"
                w="100px"
              />
            </Field.Root>
            <Field.Root>
              <Field.Label>Dmg type</Field.Label>
              <NativeSelectRoot>
                <NativeSelectField
                  value={form.dmg_type ?? "physical"}
                  onChange={(e) => setForm((f) => ({ ...f, dmg_type: e.target.value }))}
                  bg="#222"
                >
                  {DMG.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </NativeSelectField>
              </NativeSelectRoot>
            </Field.Root>
            <Field.Root>
              <Field.Label>Armor</Field.Label>
              <Input
                type="number"
                value={form.armor ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, armor: Number(e.target.value) }))}
                bg="#222"
                w="100px"
              />
            </Field.Root>
            <Field.Root>
              <Field.Label>Rarity</Field.Label>
              <NativeSelectRoot>
                <NativeSelectField
                  value={form.rarity ?? "common"}
                  onChange={(e) => setForm((f) => ({ ...f, rarity: e.target.value }))}
                  bg="#222"
                >
                  {RARITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </NativeSelectField>
              </NativeSelectRoot>
            </Field.Root>
          </Flex>
          <Field.Root>
            <Field.Label>Element</Field.Label>
            <Input
              value={form.element ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, element: e.target.value }))}
              bg="#222"
            />
          </Field.Root>
          <Text fontWeight="bold" fontSize="sm" color="#889977">
            Combat (physical formulas)
          </Text>
          <Flex gap={2} flexWrap="wrap">
            <Field.Root minW="100px">
              <Field.Label>Wpn accuracy</Field.Label>
              <Input
                type="number"
                value={form.weapon_accuracy ?? 0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, weapon_accuracy: Number(e.target.value) }))
                }
                bg="#222"
                w="100px"
              />
            </Field.Root>
            <Field.Root minW="100px">
              <Field.Label>Crit % bonus</Field.Label>
              <Input
                type="number"
                value={form.crit_chance_bonus_pct ?? 0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, crit_chance_bonus_pct: Number(e.target.value) }))
                }
                bg="#222"
                w="100px"
              />
            </Field.Root>
            <Field.Root minW="100px">
              <Field.Label>Crit dmg +</Field.Label>
              <Input
                type="number"
                step="any"
                value={form.crit_damage_bonus ?? 0}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    crit_damage_bonus: Number(e.target.value),
                  }))
                }
                bg="#222"
                w="100px"
              />
            </Field.Root>
            <Field.Root minW="100px">
              <Field.Label>Penetration</Field.Label>
              <Input
                type="number"
                value={form.penetration ?? 0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, penetration: Number(e.target.value) }))
                }
                bg="#222"
                w="100px"
              />
            </Field.Root>
            <Field.Root minW="100px">
              <Field.Label>Dodge bonus</Field.Label>
              <Input
                type="number"
                value={form.dodge_bonus ?? 0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dodge_bonus: Number(e.target.value) }))
                }
                bg="#222"
                w="100px"
              />
            </Field.Root>
            <Field.Root minW="100px">
              <Field.Label>Dodge reduce</Field.Label>
              <Input
                type="number"
                value={form.dodge_reduction ?? 0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dodge_reduction: Number(e.target.value) }))
                }
                bg="#222"
                w="100px"
              />
            </Field.Root>
            <Field.Root minW="100px">
              <Field.Label>Dodge ignore</Field.Label>
              <Input
                type="number"
                value={form.dodge_ignore ?? 0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dodge_ignore: Number(e.target.value) }))
                }
                bg="#222"
                w="100px"
              />
            </Field.Root>
          </Flex>
          <Field.Root>
            <Field.Label>Hidden special</Field.Label>
            <NativeSelectRoot>
              <NativeSelectField
                value={form.hidden_special_effect ?? "none"}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hidden_special_effect: e.target.value }))
                }
                bg="#222"
              >
                {HIDDEN.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </NativeSelectField>
            </NativeSelectRoot>
          </Field.Root>
          <Flex gap={2} flexWrap="wrap">
            <Field.Root flex="1" minW="140px">
              <Field.Label>Hidden bonus stat (lore)</Field.Label>
              <NativeSelectRoot>
                <NativeSelectField
                  value={form.hidden_bonus_stat ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, hidden_bonus_stat: e.target.value }))
                  }
                  bg="#222"
                >
                  {HIDDEN_BONUS_STAT.map((s) => (
                    <option key={s || "none"} value={s}>
                      {s === "" ? "none" : s}
                    </option>
                  ))}
                </NativeSelectField>
              </NativeSelectRoot>
            </Field.Root>
            <Field.Root minW="100px">
              <Field.Label>Hidden bonus value</Field.Label>
              <Input
                type="number"
                value={form.hidden_bonus_value ?? 0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hidden_bonus_value: Number(e.target.value) }))
                }
                bg="#222"
                w="100px"
              />
            </Field.Root>
          </Flex>
          <Field.Root>
            <Field.Label>Description</Field.Label>
            <Textarea
              value={form.description ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              bg="#222"
            />
          </Field.Root>
          <Field.Root>
            <Field.Label>Lore</Field.Label>
            <Textarea
              value={form.lore ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, lore: e.target.value }))}
              rows={2}
              bg="#222"
            />
          </Field.Root>
          <Field.Root>
            <Field.Label>Lore chance (1–100, empty = no roll)</Field.Label>
            <Input
              value={form.lore_chance ?? ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                setForm((f) => ({
                  ...f,
                  lore_chance: v === "" ? null : Number(v),
                }));
              }}
              bg="#222"
              w="120px"
            />
          </Field.Root>
          <Field.Root>
            <Field.Label>Two-handed</Field.Label>
            <NativeSelectRoot>
              <NativeSelectField
                value={form.two_handed ? "1" : "0"}
                onChange={(e) =>
                  setForm((f) => ({ ...f, two_handed: e.target.value === "1" }))
                }
                bg="#222"
                w="100px"
              >
                <option value="0">No</option>
                <option value="1">Yes</option>
              </NativeSelectField>
            </NativeSelectRoot>
          </Field.Root>
          <Field.Root>
            <Field.Label>Unsellable</Field.Label>
            <NativeSelectRoot>
              <NativeSelectField
                value={form.unsellable ? "1" : "0"}
                onChange={(e) =>
                  setForm((f) => ({ ...f, unsellable: e.target.value === "1" }))
                }
                bg="#222"
                w="100px"
              >
                <option value="0">No</option>
                <option value="1">Yes</option>
              </NativeSelectField>
            </NativeSelectRoot>
          </Field.Root>
          <Field.Root>
            <Field.Label>Vendor refuses buy (junk)</Field.Label>
            <NativeSelectRoot>
              <NativeSelectField
                value={form.vendor_refuses_buy ? "1" : "0"}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    vendor_refuses_buy: e.target.value === "1",
                  }))
                }
                bg="#222"
                w="100px"
              >
                <option value="0">No</option>
                <option value="1">Yes</option>
              </NativeSelectField>
            </NativeSelectRoot>
          </Field.Root>
          <Text fontSize="sm" color="#889977">
            Requirements (empty = none)
          </Text>
          <Flex gap={2} flexWrap="wrap">
            {(
              [
                "req_gains",
                "req_moves",
                "req_guts",
                "req_smarts",
                "req_sense",
                "req_rizz",
              ] as const
            ).map((k) => (
              <Field.Root key={k} minW="80px">
                <Field.Label>{k}</Field.Label>
                <Input
                  value={form[k] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setForm((f) => ({ ...f, [k]: v === "" ? null : Number(v) }));
                  }}
                  bg="#222"
                />
              </Field.Root>
            ))}
          </Flex>
          <Text fontSize="sm" color="#889977">
            Stat bonuses (equipped)
          </Text>
          <Flex gap={2} flexWrap="wrap">
            {(
              [
                "bonus_gains",
                "bonus_moves",
                "bonus_guts",
                "bonus_smarts",
                "bonus_sense",
                "bonus_rizz",
              ] as const
            ).map((k) => (
              <Field.Root key={k} minW="80px">
                <Field.Label>{k}</Field.Label>
                <Input
                  type="number"
                  value={form[k] ?? 0}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [k]: Number(e.target.value) }))
                  }
                  bg="#222"
                />
              </Field.Root>
            ))}
          </Flex>
        </Stack>
      </Flex>
    </Box>
  );
}
