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
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
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

function emptyForm(): Partial<DmItem> {
  return {
    slug: "",
    name: "",
    item_type: "",
    slot: "",
    consumable: false,
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
    setForm({ ...it, slot: it.slot ?? "", consumable: it.consumable ?? false });
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
        });
      } else {
        await dmPatchItem(token, editingId, {
          ...form,
          slot: form.slot?.trim() ? form.slot : null,
          consumable: !!form.consumable,
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

  return (
    <Box maxW="6xl" mx="auto" px={4} py={8} color="#c8e6a8">
      <Flex justify="space-between" align="center" mb={4} flexWrap="wrap" gap={2}>
        <Heading size="lg">Item templates</Heading>
        <Flex gap={2} flexWrap="wrap">
          <PondButton type="button" onClick={() => navigate("/qff/dm")}>
            DM home
          </PondButton>
          <PondButton type="button" onClick={newItem}>
            New item
          </PondButton>
          <PondButton type="button" onClick={() => save()}>
            Save
          </PondButton>
          {editingId != null && (
            <PondButton type="button" onClick={() => void del()}>
              Delete
            </PondButton>
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
                When on, eat / drink / use work from inventory for this template.
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
          </Flex>
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
