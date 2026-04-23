import {
  Box,
  Field,
  Flex,
  Grid,
  HStack,
  Heading,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { AppModal } from "../components/AppModal";
import { useAppSession } from "../auth/AppSessionContext";
import { PanelBlockSkeleton } from "../components/panelStatus";
import QffButton from "./QffButton";
import QffDmCollapsibleSection from "./QffDmCollapsibleSection";
import {
  dmCreateItem,
  dmCreateMonsterTemplate,
  dmFetchItems,
  dmFetchMonsterTemplates,
  dmPostCombatSimPreview,
  type DmCombatSimPreviewRequest,
  type DmCombatSimPreviewResponse,
  type DmItem,
  type DmMonsterTemplate,
} from "./api";

const SLOTS: { key: string; label: string }[] = [
  { key: "head", label: "Head" },
  { key: "main_hand", label: "Main hand" },
  { key: "off_hand", label: "Off hand" },
  { key: "chest", label: "Chest" },
  { key: "feet", label: "Feet" },
  { key: "ring", label: "Ring" },
  { key: "amulet", label: "Amulet" },
];

function num(v: string, def = 0): number {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

function fnum(v: string, def = 0): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : def;
}

function itemFromTemplate(it: DmItem): Partial<DmItem> {
  return {
    damage: it.damage,
    armor: it.armor,
    bonus_gains: it.bonus_gains,
    bonus_moves: it.bonus_moves,
    bonus_guts: it.bonus_guts,
    bonus_smarts: it.bonus_smarts,
    bonus_sense: it.bonus_sense,
    bonus_rizz: it.bonus_rizz,
    weapon_accuracy: it.weapon_accuracy,
    crit_chance_bonus_pct: it.crit_chance_bonus_pct,
    crit_damage_bonus: it.crit_damage_bonus,
    penetration: it.penetration,
    dodge_bonus: it.dodge_bonus,
    dodge_reduction: it.dodge_reduction,
    dodge_ignore: it.dodge_ignore,
  };
}

const HERO_BASE_STAT_KEYS = [
  "base_gains",
  "base_moves",
  "base_sense",
  "base_guts",
  "base_smarts",
  "base_rizz",
] as const;

const HERO_LEVEL_PRESETS = [5, 10, 20, 30, 50, 75, 100] as const;

type HeroStatAlloc = "balanced" | "combat_heavy";

/** Base 1 each, plus `3 * (level - 1)` points split as evenly as possible (remainder to first stats). */
function heroBaseStatsForLevel(level: number) {
  const P = 3 * Math.max(0, level - 1);
  const q = Math.floor(P / 6);
  const r = P % 6;
  return {
    base_gains: 1 + q + (0 < r ? 1 : 0),
    base_moves: 1 + q + (1 < r ? 1 : 0),
    base_sense: 1 + q + (2 < r ? 1 : 0),
    base_guts: 1 + q + (3 < r ? 1 : 0),
    base_smarts: 1 + q + (4 < r ? 1 : 0),
    base_rizz: 1 + q + (5 < r ? 1 : 0),
  };
}

/** All `3 * (level - 1)` extra points go to gains, moves, and sense only, split as evenly as possible. */
function heroCombatHeavyStatsForLevel(level: number) {
  const P = 3 * Math.max(0, level - 1);
  const q = Math.floor(P / 3);
  const r = P % 3;
  return {
    base_gains: 1 + q + (0 < r ? 1 : 0),
    base_moves: 1 + q + (1 < r ? 1 : 0),
    base_sense: 1 + q + (2 < r ? 1 : 0),
    base_guts: 1,
    base_smarts: 1,
    base_rizz: 1,
  };
}

function heroStatsForLevel(level: number, alloc: HeroStatAlloc) {
  return alloc === "combat_heavy" ? heroCombatHeavyStatsForLevel(level) : heroBaseStatsForLevel(level);
}

function fmtPreviewVal(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return String(v);
    if (Number.isInteger(v)) return String(v);
    if (v >= 1000 || (v > 0 && v < 0.0001)) return v.toExponential(4);
    const t = v.toFixed(4).replace(/\.?0+$/, "");
    return t || "0";
  }
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return JSON.stringify(v);
  return JSON.stringify(v);
}

function fmtPreviewPct01(v: unknown): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return fmtPreviewVal(v);
  return `${(v * 100).toFixed(2)}% (raw ${v.toFixed(4)})`;
}

function recordUnknown(obj: unknown): obj is Record<string, unknown> {
  return obj !== null && typeof obj === "object" && !Array.isArray(obj);
}

/** Human-readable readout; unknown extra keys on the response are tacked on at the end. */
function combatSimPreviewReadout(p: DmCombatSimPreviewResponse): string {
  const lines: string[] = [];
  const modeLabel = p.mode === "hero_attacks" ? "Hero attacks monster" : "Monster attacks hero";
  lines.push("Combat sim — " + modeLabel);
  lines.push("");

  const paper = p.monster_paper;
  if (recordUnknown(paper) && (paper.damage_min != null || paper.damage_max != null)) {
    lines.push("Monster weapon roll (template)");
    lines.push(
      "  " +
        (paper.damage_min != null && paper.damage_max != null
          ? `Uniform [${fmtPreviewVal(paper.damage_min)}, ${fmtPreviewVal(paper.damage_max)}]`
          : fmtPreviewVal(paper)),
    );
    lines.push("");
  }

  const att = p.attacker;
  const def = p.defender;
  if (recordUnknown(att) && att.role) {
    lines.push(`Attacker (${String(att.role)})`);
    for (const [k, lab] of [
      ["level", "Level"],
      ["hit_chance_base", "To-hit table base (50 dark / 75 lit for hero; else 75)"],
      ["atk_moves", "Moves (attack)"],
      ["weapon_accuracy", "Weapon accuracy (from items)"],
      ["weapon", "Weapon damage rating (0 = n/a for monster)"],
      ["gains", "Gains (attack)"],
      ["is_unarmed", "Unarmed (hero)"],
      ["sense", "Sense (for crit, hero)"],
      ["crit_chance_bonus_pct", "Crit % bonus (item, percentage points)"],
      ["crit_damage_bonus", "Crit damage bonus (item)"],
      ["penetration", "Penetration"],
      ["dodge_reduction_pct", "Dodge reduction % (attacker)"],
      ["dodge_ignore_active", "Dodge ignore active (attacker)"],
    ] as [string, string][]) {
      if (k in att && k !== "role") {
        lines.push("  " + lab + ": " + fmtPreviewVal((att as Record<string, unknown>)[k]));
      }
    }
    lines.push("");
  }

  if (recordUnknown(def) && def.role) {
    lines.push(`Defender (${String(def.role)})`);
    for (const [k, lab] of [
      ["level", "Level"],
      ["def_moves", "Moves (defense)"],
      ["dodge_bonus", "Dodge bonus (items + hero)"],
      ["effective_armor", "Effective armor (for mitigation)"],
    ] as [string, string][]) {
      if (k in def && k !== "role") {
        lines.push("  " + lab + ": " + fmtPreviewVal((def as Record<string, unknown>)[k]));
      }
    }
    lines.push("");
  }

  const hit = p.hit;
  if (recordUnknown(hit)) {
    lines.push("To hit");
    for (const [k, lab] of [
      ["moves_scale_attacker", "Moves scale (attacker level)"],
      ["moves_scale_defender", "Moves scale (defender level)"],
      ["accuracy_budget", "Accuracy budget (level table)"],
      ["dodge_budget", "Dodge budget (level table)"],
      ["accuracy_modifier", "Accuracy modifier (total from moves + wpn + level)"],
      ["dodge_total", "Dodge total (defender)"],
      ["dodge_modifier_effective", "Dodge modifier (after reduction/ignore)"],
      ["hit_base", "Hit base (table before acc/dodge math)"],
      ["raw_before_clamp", "Raw % before 5–95 clamp"],
      ["hit_chance", "Hit chance (final %, int)"],
    ] as [string, string][]) {
      if (k in hit) {
        const v = hit[k];
        if (k === "hit_chance" || k === "hit_base" || k === "raw_before_clamp") {
          const n = v as number;
          lines.push("  " + lab + ": " + (typeof n === "number" ? String(n) + (k === "hit_chance" ? "%" : "") : fmtPreviewVal(v)));
        } else {
          lines.push("  " + lab + ": " + fmtPreviewVal(v));
        }
      }
    }
    lines.push("");
  }

  const dmg = p.damage;
  if (recordUnknown(dmg) && dmg.kind) {
    lines.push("Base damage (paper, before crit/mitigation example)");
    if (dmg.kind === "hero_weapon") {
      if ("paper_base" in dmg) lines.push("  Paper base: " + fmtPreviewVal(dmg.paper_base));
      if ("swing_L" in dmg) lines.push("  Swing half-width L: " + fmtPreviewVal(dmg.swing_L));
      if ("level_factor" in dmg) lines.push("  Level factor: " + fmtPreviewVal(dmg.level_factor));
      if ("swing_note" in dmg) lines.push("  Note: " + String(dmg.swing_note));
    } else {
      if ("paper_uniform_min" in dmg) lines.push("  Paper min: " + fmtPreviewVal(dmg.paper_uniform_min));
      if ("paper_uniform_max" in dmg) lines.push("  Paper max: " + fmtPreviewVal(dmg.paper_uniform_max));
      if ("paper_example_mid" in dmg) lines.push("  Example mid: " + fmtPreviewVal(dmg.paper_example_mid));
      if ("swing_L" in dmg) lines.push("  Swing half-width L: " + fmtPreviewVal(dmg.swing_L));
    }
    lines.push("");
  }

  const crit = p.crit;
  if (recordUnknown(crit)) {
    lines.push("Critical hit");
    if ("crit_chance" in crit) lines.push("  Crit chance: " + fmtPreviewPct01(crit.crit_chance));
    if ("crit_chance_cap" in crit) lines.push("  Crit chance (level cap): " + fmtPreviewPct01(crit.crit_chance_cap));
    if ("crit_stat_term" in crit) lines.push("  Stat term (uncapped): " + fmtPreviewVal(crit.crit_stat_term));
    if ("crit_multiplier" in crit) lines.push("  Crit multiplier (after item): " + fmtPreviewVal(crit.crit_multiplier));
    if ("crit_multiplier_cap" in crit) lines.push("  Crit mult (level cap): " + fmtPreviewVal(crit.crit_multiplier_cap));
    if ("crit_multiplier_stat_term" in crit)
      lines.push("  Crit mult stat term: " + fmtPreviewVal(crit.crit_multiplier_stat_term));
    lines.push("");
  }

  const mit = p.mitigation;
  if (recordUnknown(mit)) {
    lines.push("Mitigation (armor / penetration → reduction)");
    for (const [k, lab] of [
      ["effective_armor", "Effective armor"],
      ["mitigation_scale", "Mitigation scale (100 + 2×pen)"],
      ["penetration", "Penetration (used here)"],
      ["damage_reduction", "Damage reduction factor"],
    ] as [string, string][]) {
      if (k in mit) lines.push("  " + lab + ": " + fmtPreviewVal(mit[k]));
    }
    lines.push("");
  }

  const ex = p.example_final_damage;
  if (recordUnknown(ex)) {
    lines.push("Example (using paper from above, after mitigation factor)");
    if ("using_paper" in ex) lines.push("  Paper used: " + fmtPreviewVal(ex.using_paper));
    if ("non_crit" in ex) lines.push("  Non-crit: " + fmtPreviewVal(ex.non_crit));
    if ("crit" in ex) lines.push("  If crit: " + fmtPreviewVal(ex.crit) + " (from paper×crit mult, then mitigation)");
    lines.push("");
  }

  const used = new Set(
    "mode monster_paper attacker defender hit crit mitigation damage example_final_damage"
      .split(" ")
      .filter(Boolean),
  );
  const extra: string[] = [];
  for (const key of Object.keys(p)) {
    if (used.has(key)) continue;
    extra.push("  " + key + ": " + fmtPreviewVal(p[key]));
  }
  if (extra.length) {
    lines.push("Other fields");
    lines.push(...extra);
  }

  return lines.join("\n").trim();
}

function hitChancePct(p: DmCombatSimPreviewResponse): number | null {
  const h = p.hit;
  if (!recordUnknown(h) || typeof h.hit_chance !== "number") return null;
  return h.hit_chance;
}

function critChance01(p: DmCombatSimPreviewResponse): number {
  const c = p.crit;
  if (!recordUnknown(c) || typeof c.crit_chance !== "number") return 0;
  return Math.min(1, Math.max(0, c.crit_chance));
}

function exampleDmgPair(p: DmCombatSimPreviewResponse): { nc: number; cr: number } {
  const ex = p.example_final_damage;
  if (!recordUnknown(ex)) return { nc: 0, cr: 0 };
  const nc = typeof ex.non_crit === "number" ? ex.non_crit : 0;
  const cr = typeof ex.crit === "number" ? ex.crit : 0;
  return { nc, cr };
}

/** Expected damage per attack (misses count as 0). */
function expectedDamagePerAttack(p: DmCombatSimPreviewResponse): number {
  const hp = hitChancePct(p);
  if (hp === null) return 0;
  const pHit = hp / 100;
  const pC = critChance01(p);
  const { nc, cr } = exampleDmgPair(p);
  return pHit * ((1 - pC) * nc + pC * cr);
}

function damageCeiling(p: DmCombatSimPreviewResponse): number {
  const { nc, cr } = exampleDmgPair(p);
  return Math.max(nc, cr);
}

function formatTtk(hp: number, avgDmg: number): string {
  if (hp <= 0) return "0";
  if (avgDmg <= 0) return "∞";
  return String(Math.ceil(hp / avgDmg));
}

const DEFAULT_MONSTER: Partial<DmMonsterTemplate> & {
  level: number;
  damage_min: number;
  damage_max: number;
} = {
  level: 1,
  max_hp: 10,
  damage_min: 1,
  damage_max: 3,
  moves: 0,
  armor: 0,
  accuracy: 0,
  xp_value: 5,
  gold_min: 0,
  gold_max: 2,
  penetration: 0,
  crit_chance_bonus_pct: 0,
  crit_damage_bonus: 0,
  dodge_reduction: 0,
  dodge_ignore: 0,
  spawn_cooldown_minutes: 5,
  loot_table: [],
};

export default function QffDmCombatSimPage() {
  const navigate = useNavigate();
  const { isAuthenticated, sessionUser, isLoading, getApiAccessToken } = useAppSession();
  const isStaff = !!sessionUser?.user?.is_staff;

  const [items, setItems] = useState<DmItem[]>([]);
  const [monsters, setMonsters] = useState<DmMonsterTemplate[]>([]);
  const [hero, setHero] = useState({
    level: 1,
    ...heroBaseStatsForLevel(1),
  });
  const [heroMaxHp, setHeroMaxHp] = useState(30);
  const [heroSlots, setHeroSlots] = useState<Record<string, Partial<DmItem> | null>>({});
  const [monster, setMonster] = useState(DEFAULT_MONSTER);
  const [previewPair, setPreviewPair] = useState<{
    heroAttacks: DmCombatSimPreviewResponse;
    monsterAttacks: DmCombatSimPreviewResponse;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importMonsterId, setImportMonsterId] = useState<string>("");
  const [slotItemPick, setSlotItemPick] = useState<Record<string, string>>({});
  const [exportMonSlug, setExportMonSlug] = useState("");
  const [exportMonName, setExportMonName] = useState("");
  const [exportItemSlug, setExportItemSlug] = useState("");
  const [exportItemName, setExportItemName] = useState("");
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exportMonsterModalOpen, setExportMonsterModalOpen] = useState(false);
  const [itemExportModalOpen, setItemExportModalOpen] = useState(false);
  const [itemExportTargetSlot, setItemExportTargetSlot] = useState("");
  const [exportMonXp, setExportMonXp] = useState("5");
  const [exportMonGoldMin, setExportMonGoldMin] = useState("0");
  const [exportMonGoldMax, setExportMonGoldMax] = useState("2");
  const [slotOpen, setSlotOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SLOTS.map((s) => [s.key, false])),
  );
  const [heroBaseOpen, setHeroBaseOpen] = useState(true);
  const [monsterOpen, setMonsterOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [statAlloc, setStatAlloc] = useState<HeroStatAlloc>("balanced");

  const setStatAllocAndApply = useCallback((alloc: HeroStatAlloc) => {
    setStatAlloc(alloc);
    setHero((h) => ({ ...h, ...heroStatsForLevel(h.level, alloc) }));
  }, []);

  const loadCatalog = useCallback(async () => {
    const t = await getApiAccessToken();
    const [it, mo] = await Promise.all([dmFetchItems(t), dmFetchMonsterTemplates(t)]);
    setItems(it);
    setMonsters(mo);
  }, [getApiAccessToken]);

  useEffect(() => {
    if (!isAuthenticated || !isStaff) return;
    loadCatalog().catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [isAuthenticated, isStaff, loadCatalog]);

  const itemOptions = useMemo(
    () => items.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  );

  const atAGlance = useMemo(() => {
    if (!previewPair) return null;
    const { heroAttacks: ha, monsterAttacks: ma } = previewPair;
    const hHit = hitChancePct(ha);
    const mHit = hitChancePct(ma);
    const hCrit = critChance01(ha);
    const mCrit = critChance01(ma);
    const avgH = expectedDamagePerAttack(ha);
    const avgM = expectedDamagePerAttack(ma);
    const ceilH = damageCeiling(ha);
    const ceilM = damageCeiling(ma);
    const monHp = Math.max(0, num(String(monster.max_hp), 0));
    const ttkM = formatTtk(monHp, avgH);
    const ttkH = formatTtk(heroMaxHp, avgM);
    return (
      <Box
        borderWidth="1px"
        borderColor="whiteAlpha.400"
        borderRadius="md"
        p={3}
        bg="blackAlpha.300"
      >
        <Text fontSize="sm" fontWeight="semibold" color="#c8e6a8" mb={2}>
          At a glance
        </Text>
        <Text fontSize="xs" color="#889977" mb={3}>
          Avg damage = P(hit) × ((1 − P(crit)) × non-crit + P(crit) × crit) per attack. Ceil = max
          of the mitigated non-crit / crit example. TTK needs max HPs (monster in its panel, hero
          here).
        </Text>
        <Grid
          templateColumns={{ base: "1fr", md: "14rem 1fr" }}
          gap={1.5}
          fontSize="sm"
          rowGap={2}
        >
          <Text color="#889977">Hit chance (hero → monster)</Text>
          <Text>
            {hHit != null ? `${hHit}%` : "—"}{" "}
            <Text as="span" fontSize="xs" color="#666">
              (on hero&apos;s turn)
            </Text>
          </Text>
          <Text color="#889977">Hit chance (monster → hero)</Text>
          <Text>
            {mHit != null ? `${mHit}%` : "—"}{" "}
            <Text as="span" fontSize="xs" color="#666">
              (on monster&apos;s turn)
            </Text>
          </Text>
          <Text color="#889977">Crit chance (hero)</Text>
          <Text>{(hCrit * 100).toFixed(1)}%</Text>
          <Text color="#889977">Crit chance (monster)</Text>
          <Text>{(mCrit * 100).toFixed(1)}%</Text>
          <Text color="#889977">Avg damage (hero attacking)</Text>
          <Text>{avgH > 0 ? avgH.toFixed(2) : "0"}</Text>
          <Text color="#889977">Avg damage (monster attacking)</Text>
          <Text>{avgM > 0 ? avgM.toFixed(2) : "0"}</Text>
          <Text color="#889977">Damage ceiling (hero hit)</Text>
          <Text>{ceilH}</Text>
          <Text color="#889977">Damage ceiling (monster hit)</Text>
          <Text>{ceilM}</Text>
          <Text color="#889977">Turns to kill monster</Text>
          <Text>
            {ttkM}
            {monHp > 0 && avgH > 0 ? (
              <Text as="span" fontSize="xs" color="#666" ml={1}>
                (HP {monHp} ÷ avg {avgH.toFixed(2)})
              </Text>
            ) : null}
          </Text>
          <Text color="#889977">Turns to kill hero</Text>
          <Text>
            {ttkH}
            {heroMaxHp > 0 && avgM > 0 ? (
              <Text as="span" fontSize="xs" color="#666" ml={1}>
                (HP {heroMaxHp} ÷ avg {avgM.toFixed(2)})
              </Text>
            ) : null}
          </Text>
        </Grid>
      </Box>
    );
  }, [previewPair, monster.max_hp, heroMaxHp]);

  function updateSlot(
    key: string,
    field: keyof DmItem,
    value: string,
    isFloat = false,
  ) {
    setHeroSlots((prev) => {
      const cur = { ...(prev[key] || {}) };
      (cur as Record<string, unknown>)[field] = isFloat ? fnum(value) : num(value);
      return { ...prev, [key]: cur };
    });
  }

  function importItemToSlot(slotKey: string, itemId: string) {
    if (!itemId) return;
    const it = items.find((i) => String(i.id) === itemId);
    if (!it) return;
    setHeroSlots((prev) => ({ ...prev, [slotKey]: itemFromTemplate(it) }));
    setSlotItemPick((p) => ({ ...p, [slotKey]: itemId }));
  }

  function importMonsterTemplate(id: string) {
    if (!id) return;
    const m = monsters.find((x) => String(x.id) === id);
    if (!m) return;
    setMonster({
      level: m.level,
      max_hp: m.max_hp,
      damage_min: m.damage_min,
      damage_max: m.damage_max,
      moves: m.moves,
      armor: m.armor,
      accuracy: m.accuracy,
      xp_value: m.xp_value,
      gold_min: m.gold_min,
      gold_max: m.gold_max,
      penetration: m.penetration ?? 0,
      crit_chance_bonus_pct: m.crit_chance_bonus_pct ?? 0,
      crit_damage_bonus: m.crit_damage_bonus ?? 0,
      dodge_reduction: m.dodge_reduction ?? 0,
      dodge_ignore: m.dodge_ignore ?? 0,
      spawn_cooldown_minutes: m.spawn_cooldown_minutes,
      loot_table: m.loot_table || [],
    });
  }

  const previewRequestBody: Omit<DmCombatSimPreviewRequest, "mode"> = useMemo(
    () => ({
      hero: {
        level: hero.level,
        base_gains: hero.base_gains,
        base_moves: hero.base_moves,
        base_sense: hero.base_sense,
        base_guts: hero.base_guts,
        base_smarts: hero.base_smarts,
        base_rizz: hero.base_rizz,
      },
      hero_slots: Object.keys(heroSlots).length ? heroSlots : undefined,
      monster: {
        ...monster,
        level: num(String(monster.level), 1),
        damage_min: Math.max(1, num(String(monster.damage_min), 1)),
        damage_max: Math.max(1, num(String(monster.damage_max), 1)),
      },
    }),
    [hero, heroSlots, monster],
  );

  async function runPreview() {
    setErr(null);
    setBusy(true);
    setPreviewPair(null);
    try {
      const t = await getApiAccessToken();
      const [ha, ma] = await Promise.all([
        dmPostCombatSimPreview(t, { ...previewRequestBody, mode: "hero_attacks" }),
        dmPostCombatSimPreview(t, { ...previewRequestBody, mode: "monster_attacks" }),
      ]);
      setPreviewPair({ heroAttacks: ha, monsterAttacks: ma });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function openExportMonsterModal() {
    setExportMsg(null);
    setErr(null);
    setExportMonXp(String(monster.xp_value ?? 5));
    setExportMonGoldMin(String(monster.gold_min ?? 0));
    setExportMonGoldMax(String(monster.gold_max ?? 0));
    setExportMonsterModalOpen(true);
  }

  async function confirmExportMonster() {
    setExportMsg(null);
    setErr(null);
    if (!exportMonSlug.trim() || !exportMonName.trim()) {
      setExportMsg("Enter slug and name for the new template.");
      return;
    }
    setBusy(true);
    try {
      const t = await getApiAccessToken();
      const created = await dmCreateMonsterTemplate(t, {
        slug: exportMonSlug.trim().slice(0, 80),
        name: exportMonName.trim().slice(0, 200),
        level: num(String(monster.level), 1),
        max_hp: num(String(monster.max_hp), 5),
        damage_min: num(String(monster.damage_min), 1),
        damage_max: num(String(monster.damage_max), 1),
        moves: num(String(monster.moves), 0),
        armor: num(String(monster.armor), 0),
        accuracy: num(String(monster.accuracy), 0),
        xp_value: num(exportMonXp, 5),
        gold_min: num(exportMonGoldMin, 0),
        gold_max: num(exportMonGoldMax, 0),
        penetration: num(String(monster.penetration), 0),
        crit_chance_bonus_pct: num(String(monster.crit_chance_bonus_pct), 0),
        crit_damage_bonus: fnum(String(monster.crit_damage_bonus ?? 0), 0),
        dodge_reduction: num(String(monster.dodge_reduction), 0),
        dodge_ignore: num(String(monster.dodge_ignore), 0),
        spawn_cooldown_minutes: num(String(monster.spawn_cooldown_minutes), 5),
        loot_table: monster.loot_table || [],
      });
      setExportMsg(`Created monster template #${created.id} (${created.slug}).`);
      setExportMonsterModalOpen(false);
      await loadCatalog();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function openItemExportModal(slotKey: string) {
    setExportMsg(null);
    setErr(null);
    setItemExportTargetSlot(slotKey);
    setItemExportModalOpen(true);
  }

  async function exportItem() {
    setExportMsg(null);
    setErr(null);
    if (!itemExportTargetSlot) {
      setExportMsg("No slot selected.");
      return;
    }
    if (!exportItemSlug.trim() || !exportItemName.trim()) {
      setExportMsg("Enter slug and name for the new item.");
      return;
    }
    const slotData = heroSlots[itemExportTargetSlot] || {};
    setBusy(true);
    try {
      const t = await getApiAccessToken();
      const slotMap: Record<string, string> = {
        head: "head",
        main_hand: "main_hand",
        off_hand: "off_hand",
        chest: "chest",
        feet: "feet",
        ring: "ring",
        amulet: "amulet",
      };
      const itType =
        itemExportTargetSlot === "main_hand" || itemExportTargetSlot === "off_hand"
          ? "weapon"
          : itemExportTargetSlot === "head" || itemExportTargetSlot === "chest" || itemExportTargetSlot === "feet"
            ? "armor"
            : "";
      const created = await dmCreateItem(t, {
        slug: exportItemSlug.trim().slice(0, 80),
        name: exportItemName.trim().slice(0, 200),
        item_type: itType,
        slot: slotMap[itemExportTargetSlot] || "main_hand",
        damage: num(String(slotData.damage ?? 0), 0),
        armor: num(String(slotData.armor ?? 0), 0),
        bonus_gains: num(String(slotData.bonus_gains ?? 0), 0),
        bonus_moves: num(String(slotData.bonus_moves ?? 0), 0),
        bonus_guts: num(String(slotData.bonus_guts ?? 0), 0),
        bonus_smarts: num(String(slotData.bonus_smarts ?? 0), 0),
        bonus_sense: num(String(slotData.bonus_sense ?? 0), 0),
        bonus_rizz: num(String(slotData.bonus_rizz ?? 0), 0),
        weapon_accuracy: num(String(slotData.weapon_accuracy ?? 0), 0),
        crit_chance_bonus_pct: num(String(slotData.crit_chance_bonus_pct ?? 0), 0),
        crit_damage_bonus: fnum(String(slotData.crit_damage_bonus ?? 0), 0),
        penetration: num(String(slotData.penetration ?? 0), 0),
        dodge_bonus: num(String(slotData.dodge_bonus ?? 0), 0),
        dodge_reduction: num(String(slotData.dodge_reduction ?? 0), 0),
        dodge_ignore: num(String(slotData.dodge_ignore ?? 0), 0),
        consumable: false,
        stackable: false,
        cost: 0,
        description: "",
        lore: "",
      });
      setExportMsg(`Created item #${created.id} (${created.slug}).`);
      setItemExportModalOpen(false);
      setItemExportTargetSlot("");
      await loadCatalog();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

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
      <Heading size="lg" mb={2}>
        Combat simulator
      </Heading>
      <Text mb={4} color="#889977" fontSize="sm">
        Previews use live server math for both attack directions. Edits do not change the database
        until you <strong>Export</strong> from a panel. Use monster max HP and hero max HP (below) for
        TTK. Import copies into the form only.
      </Text>
      {err && (
        <Text color="red.300" mb={4} role="alert">
          {err}
        </Text>
      )}
      {exportMsg && !err && (
        <Text color="#a0c090" mb={4}>
          {exportMsg}
        </Text>
      )}
      <QffButton onClick={() => navigate("/qff/dm")} mb={4}>
        ← DM home
      </QffButton>

      <Box
        borderWidth="1px"
        borderColor="whiteAlpha.300"
        borderRadius="md"
        p={3}
        mb={4}
      >
        <Stack gap={3}>
          <QffButton
            onClick={runPreview}
            disabled={busy}
            w={{ base: "100%", sm: "fit-content" }}
          >
            {busy ? "…" : "Compute preview"}
          </QffButton>

          {atAGlance}

          <QffDmCollapsibleSection
            title="Full math breakdown (both directions)"
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
          >
            {previewPair ? (
              <Stack gap={3}>
                <Text
                  as="pre"
                  fontFamily="mono"
                  fontSize="xs"
                  whiteSpace="pre-wrap"
                  wordBreak="break-word"
                  p={2}
                  maxH="16rem"
                  overflowY="auto"
                  bg="blackAlpha.400"
                  color="gray.200"
                >
                  {combatSimPreviewReadout(previewPair.heroAttacks)}
                </Text>
                <Text
                  as="pre"
                  fontFamily="mono"
                  fontSize="xs"
                  whiteSpace="pre-wrap"
                  wordBreak="break-word"
                  p={2}
                  maxH="16rem"
                  overflowY="auto"
                  bg="blackAlpha.400"
                  color="gray.200"
                >
                  {combatSimPreviewReadout(previewPair.monsterAttacks)}
                </Text>
              </Stack>
            ) : (
              <Text fontSize="sm" color="#666">
                Run <strong>Compute preview</strong> to load server-side steps for both directions.
              </Text>
            )}
          </QffDmCollapsibleSection>
          <Text fontSize="xs" color="#666">
            Set loadouts in the sections below, then run preview. Collapsed sections there keep
            their values. Use <strong>Export</strong> in a panel to create new database rows.
          </Text>
        </Stack>
      </Box>

      <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={4} mb={4}>
        <Box borderWidth="1px" borderColor="whiteAlpha.300" borderRadius="md" p={3}>
          <Text fontSize="sm" fontWeight="semibold" color="#c8e6a8" mb={2}>
            Hero
          </Text>
          <Box
            position="relative"
            borderWidth="1px"
            borderColor="whiteAlpha.300"
            borderRadius="md"
            overflow="hidden"
            mb={2}
          >
            <HStack
              flexWrap="wrap"
              justify="space-between"
              gap={2}
              py={1.5}
              px={2}
              bg="blackAlpha.400"
              borderBottomWidth="1px"
              borderColor="whiteAlpha.200"
            >
              <Text fontSize="xs" color="#889977">
                Point allocation (level buttons use this; changing mode reapplies to current level)
              </Text>
              <HStack flexShrink={0} gap={1}>
                <QffButton
                  type="button"
                  size="xs"
                  onClick={() => setStatAllocAndApply("balanced")}
                  disabled={busy}
                  variant={statAlloc === "balanced" ? "subtle" : "outline"}
                  colorPalette="green"
                  borderWidth={statAlloc === "balanced" ? "1px" : "0"}
                >
                  Balanced
                </QffButton>
                <QffButton
                  type="button"
                  size="xs"
                  onClick={() => setStatAllocAndApply("combat_heavy")}
                  disabled={busy}
                  variant={statAlloc === "combat_heavy" ? "subtle" : "outline"}
                  colorPalette="green"
                  borderWidth={statAlloc === "combat_heavy" ? "1px" : "0"}
                >
                  Combat-heavy
                </QffButton>
              </HStack>
            </HStack>
            <Flex flexWrap="wrap" gap={2} p={2} pt={2}>
              {HERO_LEVEL_PRESETS.map((lvl) => (
                <QffButton
                  key={lvl}
                  type="button"
                  size="sm"
                  onClick={() =>
                    setHero((h) => ({
                      ...h,
                      level: lvl,
                      ...heroStatsForLevel(lvl, statAlloc),
                    }))
                  }
                  disabled={busy}
                >
                  Level {lvl}
                </QffButton>
              ))}
            </Flex>
          </Box>
          <Stack gap={3}>
            <QffDmCollapsibleSection
              title="Base stats"
              open={heroBaseOpen}
              onOpenChange={setHeroBaseOpen}
            >
            <Stack gap={3}>
            <Field.Root>
              <Field.Label>Level</Field.Label>
              <Input
                type="number"
                value={hero.level}
                onChange={(e) => setHero((h) => ({ ...h, level: num(e.target.value, 1) }))}
                bg="#222"
              />
            </Field.Root>
            <Field.Root>
              <Field.Label>Max HP (turns to kill you)</Field.Label>
              <Text fontSize="xs" color="#888" mb={1}>
                Used for “turns to kill hero” in the summary. Set to match a real build if needed.
              </Text>
              <Input
                type="number"
                min={0}
                value={heroMaxHp}
                onChange={(e) => setHeroMaxHp(Math.max(0, num(e.target.value, 0)))}
                bg="#222"
                w="120px"
              />
            </Field.Root>
            {HERO_BASE_STAT_KEYS.map((k) => (
              <Field.Root key={k}>
                <Field.Label>{k.replace("base_", "")}</Field.Label>
                <Input
                  type="number"
                  value={hero[k]}
                  onChange={(e) => setHero((h) => ({ ...h, [k]: num(e.target.value, 0) }))}
                  bg="#222"
                />
              </Field.Root>
            ))}
            </Stack>
            </QffDmCollapsibleSection>

            {SLOTS.map(({ key, label }) => (
              <QffDmCollapsibleSection
                key={key}
                title={`${label} (scratch)`}
                open={!!slotOpen[key]}
                onOpenChange={(o) => setSlotOpen((p) => ({ ...p, [key]: o }))}
              >
                <Field.Root mb={2}>
                  <Field.Label>Import item</Field.Label>
                  <NativeSelectRoot>
                    <NativeSelectField
                      value={slotItemPick[key] || ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) importItemToSlot(key, v);
                      }}
                      bg="#222"
                    >
                      <option value="">— pick to copy —</option>
                      {itemOptions.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name}
                        </option>
                      ))}
                    </NativeSelectField>
                  </NativeSelectRoot>
                </Field.Root>
                <Grid templateColumns="1fr 1fr" gap={2} fontSize="sm">
                  <Field.Root>
                    <Field.Label>damage</Field.Label>
                    <Input
                      value={String(heroSlots[key]?.damage ?? 0)}
                      onChange={(e) => updateSlot(key, "damage", e.target.value)}
                      bg="#222"
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>armor</Field.Label>
                    <Input
                      value={String(heroSlots[key]?.armor ?? 0)}
                      onChange={(e) => updateSlot(key, "armor", e.target.value)}
                      bg="#222"
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>weapon_accuracy</Field.Label>
                    <Input
                      value={String(heroSlots[key]?.weapon_accuracy ?? 0)}
                      onChange={(e) => updateSlot(key, "weapon_accuracy", e.target.value)}
                      bg="#222"
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>dodge_bonus</Field.Label>
                    <Input
                      value={String(heroSlots[key]?.dodge_bonus ?? 0)}
                      onChange={(e) => updateSlot(key, "dodge_bonus", e.target.value)}
                      bg="#222"
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>crit_chance_bonus_pct</Field.Label>
                    <Input
                      value={String(heroSlots[key]?.crit_chance_bonus_pct ?? 0)}
                      onChange={(e) => updateSlot(key, "crit_chance_bonus_pct", e.target.value)}
                      bg="#222"
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>crit_damage_bonus</Field.Label>
                    <Input
                      value={String(heroSlots[key]?.crit_damage_bonus ?? 0)}
                      onChange={(e) => updateSlot(key, "crit_damage_bonus", e.target.value, true)}
                      bg="#222"
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>penetration</Field.Label>
                    <Input
                      value={String(heroSlots[key]?.penetration ?? 0)}
                      onChange={(e) => updateSlot(key, "penetration", e.target.value)}
                      bg="#222"
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>bonus_moves</Field.Label>
                    <Input
                      value={String(heroSlots[key]?.bonus_moves ?? 0)}
                      onChange={(e) => updateSlot(key, "bonus_moves", e.target.value)}
                      bg="#222"
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>bonus_gains</Field.Label>
                    <Input
                      value={String(heroSlots[key]?.bonus_gains ?? 0)}
                      onChange={(e) => updateSlot(key, "bonus_gains", e.target.value)}
                      bg="#222"
                    />
                  </Field.Root>
                </Grid>
                <QffButton
                  type="button"
                  size="sm"
                  mt={2}
                  onClick={() => openItemExportModal(key)}
                  disabled={busy}
                >
                  Export
                </QffButton>
              </QffDmCollapsibleSection>
            ))}
          </Stack>
        </Box>

        <Box borderWidth="1px" borderColor="whiteAlpha.300" borderRadius="md" p={3}>
          <Flex justify="space-between" align="center" gap={2} mb={2} flexWrap="wrap">
            <Text fontSize="sm" fontWeight="semibold" color="#c8e6a8">
              Monster
            </Text>
            <QffButton
              type="button"
              size="sm"
              onClick={openExportMonsterModal}
              disabled={busy}
            >
              Export
            </QffButton>
          </Flex>
          <QffDmCollapsibleSection
            title="Monster template & stats"
            open={monsterOpen}
            onOpenChange={setMonsterOpen}
          >
            <Field.Root mb={3}>
              <Field.Label>Import template</Field.Label>
              <NativeSelectRoot>
                <NativeSelectField
                  value={importMonsterId}
                  onChange={(e) => {
                    setImportMonsterId(e.target.value);
                    importMonsterTemplate(e.target.value);
                  }}
                  bg="#222"
                >
                  <option value="">—</option>
                  {monsters.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.slug})
                    </option>
                  ))}
                </NativeSelectField>
              </NativeSelectRoot>
            </Field.Root>
          {(
            [
              "level",
              "max_hp",
              "moves",
              "armor",
              "accuracy",
              "penetration",
              "damage_min",
              "damage_max",
              "crit_chance_bonus_pct",
              "crit_damage_bonus",
              "dodge_reduction",
              "dodge_ignore",
            ] as const
          ).map((f) => (
            <Field.Root key={f} mb={2}>
              <Field.Label>{f}</Field.Label>
              <Input
                value={String((monster as Record<string, unknown>)[f] ?? "")}
                onChange={(e) => {
                  const v = e.target.value;
                  setMonster((m) => {
                    const n = { ...m };
                    if (f === "crit_damage_bonus") (n as Record<string, unknown>)[f] = fnum(v);
                    else (n as Record<string, unknown>)[f] = num(v, 0);
                    return n;
                  });
                }}
                bg="#222"
              />
            </Field.Root>
          ))}
          </QffDmCollapsibleSection>
        </Box>
      </Grid>

      <AppModal
        open={exportMonsterModalOpen}
        onOpenChange={setExportMonsterModalOpen}
        title="Export monster template"
        description="Does not update existing rows. Use a unique slug. Combat stats are taken from the monster panel. XP and gold are stored on the template for play."
        size="md"
        contentProps={{
          bg: "#1a1a1a",
          borderColor: "#404040",
          color: "#c8e6a8",
        }}
        descriptionProps={{ color: "#889977" }}
        headerProps={{ color: "#c8e6a8" }}
      >
        <Stack gap={3}>
          <Field.Root>
            <Field.Label>Slug</Field.Label>
            <Input
              value={exportMonSlug}
              onChange={(e) => setExportMonSlug(e.target.value)}
              bg="#222"
            />
          </Field.Root>
          <Field.Root>
            <Field.Label>Name</Field.Label>
            <Input
              value={exportMonName}
              onChange={(e) => setExportMonName(e.target.value)}
              bg="#222"
            />
          </Field.Root>
          <Field.Root>
            <Field.Label>XP value</Field.Label>
            <Input
              type="number"
              min={0}
              value={exportMonXp}
              onChange={(e) => setExportMonXp(e.target.value)}
              bg="#222"
            />
          </Field.Root>
          <Field.Root>
            <Field.Label>Gold min</Field.Label>
            <Input
              type="number"
              min={0}
              value={exportMonGoldMin}
              onChange={(e) => setExportMonGoldMin(e.target.value)}
              bg="#222"
            />
          </Field.Root>
          <Field.Root>
            <Field.Label>Gold max</Field.Label>
            <Input
              type="number"
              min={0}
              value={exportMonGoldMax}
              onChange={(e) => setExportMonGoldMax(e.target.value)}
              bg="#222"
            />
          </Field.Root>
          <HStack gap={2} justify="flex-end" flexWrap="wrap" pt={1}>
            <QffButton
              type="button"
              onClick={() => setExportMonsterModalOpen(false)}
            >
              Cancel
            </QffButton>
            <QffButton
              type="button"
              onClick={() => void confirmExportMonster()}
              disabled={busy}
            >
              {busy ? "…" : "Create template"}
            </QffButton>
          </HStack>
        </Stack>
      </AppModal>

      <AppModal
        open={itemExportModalOpen}
        onOpenChange={(open) => {
          setItemExportModalOpen(open);
          if (!open) setItemExportTargetSlot("");
        }}
        title={`Export as new item — ${
          SLOTS.find((s) => s.key === itemExportTargetSlot)?.label ?? "slot"
        }`}
        description="Does not update existing items. The scratch values for this slot are written to the new row. Use a unique slug."
        size="md"
        contentProps={{
          bg: "#1a1a1a",
          borderColor: "#404040",
          color: "#c8e6a8",
        }}
        descriptionProps={{ color: "#889977" }}
        headerProps={{ color: "#c8e6a8" }}
      >
        <Stack gap={3}>
          <Field.Root>
            <Field.Label>Slug</Field.Label>
            <Input
              value={exportItemSlug}
              onChange={(e) => setExportItemSlug(e.target.value)}
              bg="#222"
            />
          </Field.Root>
          <Field.Root>
            <Field.Label>Name</Field.Label>
            <Input
              value={exportItemName}
              onChange={(e) => setExportItemName(e.target.value)}
              bg="#222"
            />
          </Field.Root>
          <HStack gap={2} justify="flex-end" flexWrap="wrap" pt={1}>
            <QffButton type="button" onClick={() => setItemExportModalOpen(false)}>
              Cancel
            </QffButton>
            <QffButton
              type="button"
              onClick={() => void exportItem()}
              disabled={busy}
            >
              {busy ? "…" : "Create item"}
            </QffButton>
          </HStack>
        </Stack>
      </AppModal>
    </Box>
  );
}
