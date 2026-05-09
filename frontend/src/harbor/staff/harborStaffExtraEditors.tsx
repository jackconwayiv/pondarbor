/**
 * Staff catalog helpers: schema hint strip + structured editors for ship/building
 * `extra` blobs (synced with the JSON textarea on HarborStaffDefPage).
 */

import {
  Box,
  Button,
  Collapsible,
  Field,
  HStack,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Stack,
  Text,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";

import type { StaffSchema } from "../api";
import type {
  BuildingDefExtra,
  ShipDefExtra,
  ShipUpgradeDefExtra,
} from "../engine/types";

export function parseExtraObject(extraText: string): Record<string, unknown> {
  try {
    const o = JSON.parse(extraText || "{}");
    if (o && typeof o === "object" && !Array.isArray(o)) {
      return o as Record<string, unknown>;
    }
  } catch {
    /* invalid JSON — structured editors stay empty until fixed */
  }
  return {};
}

export function stringifyExtra(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, null, 2);
}

function mergeExtra(
  extraText: string,
  mutator: (cur: Record<string, unknown>) => void,
): string {
  const cur = { ...parseExtraObject(extraText) };
  mutator(cur);
  return stringifyExtra(cur);
}

function numOrUndefined(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

const BUILDING_TIERS = ["wood", "stone", "reinforced"] as const;

type SchemaSection = { label: string; values: readonly string[] | readonly number[] };

function schemaSections(schema: StaffSchema): SchemaSection[] {
  return [
    { label: "Resources", values: schema.resources },
    { label: "Metrics", values: schema.metrics },
    { label: "Voyage types", values: schema.voyage_types },
    { label: "Operation kinds", values: schema.operation_kinds },
    { label: "Ship roles", values: schema.ship_roles },
    { label: "Building districts", values: schema.building_districts },
    { label: "Arrival kinds", values: schema.arrival_kinds },
    { label: "Event severities", values: schema.event_severities },
    { label: "Consequence source kinds", values: schema.consequence_source_kinds },
    { label: "Pressure bands", values: schema.pressure_bands },
    { label: "Stages", values: schema.stages.map(String) },
  ];
}

export function HarborStaffSchemaHints({ schema }: { schema: StaffSchema | null }) {
  const [open, setOpen] = useState(false);
  const sections = useMemo(
    () => (schema ? schemaSections(schema) : []),
    [schema],
  );

  if (!schema) return null;

  return (
    <Collapsible.Root open={open} onOpenChange={(d) => setOpen(d.open)}>
      <Collapsible.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          px={0}
          h="auto"
          fontWeight="normal"
          color="fg.muted"
        >
          <Text
            as="span"
            display="inline-block"
            transform={open ? "rotate(90deg)" : "rotate(0deg)"}
            transition="transform 0.15s ease"
            mr="1"
          >
            ›
          </Text>
          Allowed values (from server schema)
        </Button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <Stack gap={3} mt={2} pl={1}>
          {sections.map(({ label, values }) => (
            <Box key={label}>
              <Text fontSize="xs" fontWeight="semibold" color="fg.muted" mb={1}>
                {label}
              </Text>
              <Wrap gap="1">
                {values.map((v) => (
                  <WrapItem key={`${label}-${v}`}>
                    <Box
                      fontSize="xs"
                      px={1.5}
                      py={0.5}
                      borderRadius="sm"
                      bg="bg.subtle"
                      borderWidth="1px"
                      borderColor="border.muted"
                      fontFamily="mono"
                    >
                      {v}
                    </Box>
                  </WrapItem>
                ))}
              </Wrap>
            </Box>
          ))}
        </Stack>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

function readShipExtra(extra: Record<string, unknown>): Partial<ShipDefExtra> {
  const role =
    typeof extra.role === "string" ? extra.role : undefined;
  const capacity =
    typeof extra.capacity === "number" ? extra.capacity : undefined;
  const base_cost =
    typeof extra.base_cost === "number" ? extra.base_cost : undefined;
  const hull = typeof extra.hull === "number" ? extra.hull : undefined;
  const voyage_nights =
    typeof extra.voyage_nights === "number" ? extra.voyage_nights : undefined;
  let voyage_yield: Partial<Record<string, number>> | undefined;
  const vy = extra.voyage_yield;
  if (vy && typeof vy === "object" && !Array.isArray(vy)) {
    voyage_yield = {};
    for (const [k, val] of Object.entries(vy)) {
      if (typeof val === "number" && Number.isFinite(val)) {
        voyage_yield[k] = val;
      }
    }
    if (Object.keys(voyage_yield).length === 0) voyage_yield = undefined;
  }
  return {
    role,
    capacity,
    base_cost,
    hull,
    voyage_nights,
    voyage_yield,
  };
}

export function HarborStaffShipExtraFields({
  extraText,
  setExtraText,
  shipRoles,
  resources,
}: {
  extraText: string;
  setExtraText: (t: string) => void;
  shipRoles: string[];
  resources: string[];
}) {
  const extra = parseExtraObject(extraText);
  const ship = readShipExtra(extra);
  const vyEntries = Object.entries(ship.voyage_yield ?? {});
  const usedResources = new Set(vyEntries.map(([k]) => k));
  const addYieldRow = () => {
    const pick = resources.find((r) => !usedResources.has(r));
    if (!pick) return;
    setExtraText(
      mergeExtra(extraText, (cur) => {
        const vy =
          cur.voyage_yield &&
          typeof cur.voyage_yield === "object" &&
          !Array.isArray(cur.voyage_yield)
            ? { ...(cur.voyage_yield as Record<string, number>) }
            : {};
        vy[pick] = 1;
        cur.voyage_yield = vy;
      }),
    );
  };

  const setScalar = (key: string, raw: string, kind: "num" | "str") => {
    setExtraText(
      mergeExtra(extraText, (cur) => {
        if (kind === "str") {
          const t = raw.trim();
          if (!t) delete cur[key];
          else cur[key] = t;
          return;
        }
        const n = numOrUndefined(raw);
        if (n === undefined) delete cur[key];
        else cur[key] = n;
      }),
    );
  };

  const setRole = (value: string) => {
    setExtraText(
      mergeExtra(extraText, (cur) => {
        if (!value) delete cur.role;
        else cur.role = value;
      }),
    );
  };

  const patchYield = (resource: string, raw: string) => {
    setExtraText(
      mergeExtra(extraText, (cur) => {
        const base =
          cur.voyage_yield &&
          typeof cur.voyage_yield === "object" &&
          !Array.isArray(cur.voyage_yield)
            ? { ...(cur.voyage_yield as Record<string, number>) }
            : {};
        const n = numOrUndefined(raw);
        if (n === undefined || n === 0) delete base[resource];
        else base[resource] = n;
        if (Object.keys(base).length === 0) delete cur.voyage_yield;
        else cur.voyage_yield = base;
      }),
    );
  };

  const removeYieldRow = (resource: string) => {
    setExtraText(
      mergeExtra(extraText, (cur) => {
        const base =
          cur.voyage_yield &&
          typeof cur.voyage_yield === "object" &&
          !Array.isArray(cur.voyage_yield)
            ? { ...(cur.voyage_yield as Record<string, number>) }
            : {};
        delete base[resource];
        if (Object.keys(base).length === 0) delete cur.voyage_yield;
        else cur.voyage_yield = base;
      }),
    );
  };

  return (
    <Stack gap={3}>
      <Text fontSize="sm" fontWeight="medium">
        Ship extra (structured)
      </Text>
      <HStack gap={3} wrap="wrap" align="flex-end">
        <Field.Root maxW="220px">
          <Field.Label>Role</Field.Label>
          <NativeSelectRoot>
            <NativeSelectField value={ship.role ?? ""} onChange={(e) => setRole(e.target.value)}>
              <option value="">—</option>
              {shipRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </NativeSelectField>
          </NativeSelectRoot>
        </Field.Root>
        <Field.Root maxW="120px">
          <Field.Label>Capacity</Field.Label>
          <Input
            type="number"
            value={ship.capacity ?? ""}
            onChange={(e) => setScalar("capacity", e.target.value, "num")}
          />
        </Field.Root>
        <Field.Root maxW="120px">
          <Field.Label>Base cost</Field.Label>
          <Input
            type="number"
            value={ship.base_cost ?? ""}
            onChange={(e) => setScalar("base_cost", e.target.value, "num")}
          />
        </Field.Root>
        <Field.Root maxW="120px">
          <Field.Label>Hull</Field.Label>
          <Input
            type="number"
            value={ship.hull ?? ""}
            onChange={(e) => setScalar("hull", e.target.value, "num")}
          />
        </Field.Root>
        <Field.Root maxW="140px">
          <Field.Label>Voyage nights</Field.Label>
          <Input
            type="number"
            value={ship.voyage_nights ?? ""}
            onChange={(e) =>
              setScalar("voyage_nights", e.target.value, "num")
            }
          />
        </Field.Root>
      </HStack>

      <Box>
        <Text fontSize="xs" color="fg.muted" mb={1}>
          Voyage yield (per resource)
        </Text>
        <Stack gap={2}>
          {vyEntries.map(([res, amt]) => (
            <HStack key={res} gap={2} flexWrap="wrap">
              <NativeSelectRoot maxW="160px">
                <NativeSelectField
                  value={res}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === res) return;
                    setExtraText(
                      mergeExtra(extraText, (cur) => {
                        const base =
                          cur.voyage_yield &&
                          typeof cur.voyage_yield === "object" &&
                          !Array.isArray(cur.voyage_yield)
                            ? {
                                ...(cur.voyage_yield as Record<
                                  string,
                                  number
                                >),
                              }
                            : {};
                        const v = base[res];
                        delete base[res];
                        base[next] = v ?? 1;
                        cur.voyage_yield = base;
                      }),
                    );
                  }}
                >
                  {resources.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </NativeSelectField>
              </NativeSelectRoot>
              <Input
                type="number"
                maxW="100px"
                value={amt}
                onChange={(e) => patchYield(res, e.target.value)}
              />
              <Button
                size="xs"
                variant="ghost"
                onClick={() => removeYieldRow(res)}
              >
                Remove
              </Button>
            </HStack>
          ))}
          <Button
            size="xs"
            variant="outline"
            alignSelf="flex-start"
            onClick={addYieldRow}
            disabled={resources.every((r) => usedResources.has(r))}
          >
            Add yield row
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
}

function readBuildingExtra(extra: Record<string, unknown>): Partial<BuildingDefExtra> {
  const building_tier =
    typeof extra.building_tier === "string"
      ? (extra.building_tier as BuildingDefExtra["building_tier"])
      : undefined;
  const district =
    typeof extra.district === "string" ? extra.district : undefined;
  const max_level =
    typeof extra.max_level === "number" ? extra.max_level : undefined;
  let prerequisites: string[] | undefined;
  const pre = extra.prerequisites;
  if (Array.isArray(pre)) {
    prerequisites = pre.filter((x): x is string => typeof x === "string");
    if (prerequisites.length === 0) prerequisites = undefined;
  }
  return { building_tier, district, max_level, prerequisites };
}

export function HarborStaffBuildingExtraFields({
  extraText,
  setExtraText,
  districts,
}: {
  extraText: string;
  setExtraText: (t: string) => void;
  districts: string[];
}) {
  const extra = parseExtraObject(extraText);
  const b = readBuildingExtra(extra);
  const preText = (b.prerequisites ?? []).join(", ");

  const setTier = (raw: string) => {
    setExtraText(
      mergeExtra(extraText, (cur) => {
        if (!raw) delete cur.building_tier;
        else cur.building_tier = raw;
      }),
    );
  };

  const setDistrict = (raw: string) => {
    setExtraText(
      mergeExtra(extraText, (cur) => {
        if (!raw) delete cur.district;
        else cur.district = raw;
      }),
    );
  };

  const setMaxLevel = (raw: string) => {
    setExtraText(
      mergeExtra(extraText, (cur) => {
        const n = numOrUndefined(raw);
        if (n === undefined) delete cur.max_level;
        else cur.max_level = Math.floor(n);
      }),
    );
  };

  const setPrerequisites = (raw: string) => {
    setExtraText(
      mergeExtra(extraText, (cur) => {
        const parts = raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.length === 0) delete cur.prerequisites;
        else cur.prerequisites = parts;
      }),
    );
  };

  return (
    <Stack gap={3}>
      <Text fontSize="sm" fontWeight="medium">
        Building extra (structured)
      </Text>
      <HStack gap={3} wrap="wrap" align="flex-end">
        <Field.Root maxW="200px">
          <Field.Label>Building tier</Field.Label>
          <NativeSelectRoot>
            <NativeSelectField
              value={b.building_tier ?? ""}
              onChange={(e) => setTier(e.target.value)}
            >
              <option value="">—</option>
              {BUILDING_TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </NativeSelectField>
          </NativeSelectRoot>
        </Field.Root>
        <Field.Root maxW="220px">
          <Field.Label>District</Field.Label>
          <NativeSelectRoot>
            <NativeSelectField
              value={b.district ?? ""}
              onChange={(e) => setDistrict(e.target.value)}
            >
              <option value="">—</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </NativeSelectField>
          </NativeSelectRoot>
        </Field.Root>
        <Field.Root maxW="120px">
          <Field.Label>Max level</Field.Label>
          <Input
            type="number"
            value={b.max_level ?? ""}
            onChange={(e) => setMaxLevel(e.target.value)}
          />
        </Field.Root>
      </HStack>
      <Field.Root>
        <Field.Label>Prerequisites (building slugs, comma-separated)</Field.Label>
        <Input
          value={preText}
          onChange={(e) => setPrerequisites(e.target.value)}
          placeholder="e.g. warehouse, customs_house"
        />
      </Field.Root>
      <Text fontSize="xs" color="fg.muted">
        Complex fields (level_costs, level_effects): edit in the JSON block below.
      </Text>
    </Stack>
  );
}

function readShipUpgradeExtra(
  extra: Record<string, unknown>,
): Partial<ShipUpgradeDefExtra> {
  const yield_bonus =
    extra.yield_bonus &&
    typeof extra.yield_bonus === "object" &&
    !Array.isArray(extra.yield_bonus)
      ? (extra.yield_bonus as Partial<Record<string, number>>)
      : undefined;
  const cost =
    extra.cost &&
    typeof extra.cost === "object" &&
    !Array.isArray(extra.cost)
      ? (extra.cost as Partial<Record<string, number>>)
      : undefined;
  return { yield_bonus, cost };
}

/** Structured editors for `yield_bonus` and `cost` resource maps. */
export function HarborStaffShipUpgradeExtraFields({
  extraText,
  setExtraText,
  resources,
}: {
  extraText: string;
  setExtraText: (t: string) => void;
  resources: readonly string[];
}) {
  const extra = parseExtraObject(extraText);
  const u = readShipUpgradeExtra(extra);
  const bonusEntries = Object.entries(u.yield_bonus ?? {});
  const costEntries = Object.entries(u.cost ?? {});

  const patchBonus = (mut: (cur: Record<string, unknown>) => void) => {
    setExtraText(
      mergeExtra(extraText, (cur) => {
        mut(cur);
      }),
    );
  };

  const patchCost = (mut: (cur: Record<string, unknown>) => void) => {
    setExtraText(
      mergeExtra(extraText, (cur) => {
        mut(cur);
      }),
    );
  };

  const addBonusRow = () => {
    const free = resources.find((r) => !(u.yield_bonus && r in u.yield_bonus));
    if (!free) return;
    patchBonus((cur) => {
      const base =
        cur.yield_bonus &&
        typeof cur.yield_bonus === "object" &&
        !Array.isArray(cur.yield_bonus)
          ? { ...(cur.yield_bonus as Record<string, number>) }
          : {};
      base[free] = 1;
      cur.yield_bonus = base;
    });
  };

  const addCostRow = () => {
    const free = resources.find((r) => !u.cost || !(r in u.cost));
    if (!free) return;
    patchCost((cur) => {
      const base =
        cur.cost &&
        typeof cur.cost === "object" &&
        !Array.isArray(cur.cost)
          ? { ...(cur.cost as Record<string, number>) }
          : {};
      base[free] = 1;
      cur.cost = base;
    });
  };

  return (
    <Stack gap={4}>
      <Text fontSize="sm" fontWeight="medium">
        Ship upgrade extra (structured)
      </Text>
      <Box>
        <Text fontSize="xs" color="fg.muted" mb={1}>
          Yield bonus (per resource)
        </Text>
        <Stack gap={2}>
          {bonusEntries.map(([res, amt]) => (
            <HStack key={res} gap={2} flexWrap="wrap">
              <NativeSelectRoot maxW="160px">
                <NativeSelectField
                  value={res}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === res) return;
                    patchBonus((cur) => {
                      const base =
                        cur.yield_bonus &&
                        typeof cur.yield_bonus === "object" &&
                        !Array.isArray(cur.yield_bonus)
                          ? {
                              ...(cur.yield_bonus as Record<string, number>),
                            }
                          : {};
                      const v = base[res];
                      delete base[res];
                      base[next] = v ?? 1;
                      cur.yield_bonus = base;
                    });
                  }}
                >
                  {resources.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </NativeSelectField>
              </NativeSelectRoot>
              <Input
                type="number"
                maxW="100px"
                value={amt}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  patchBonus((cur) => {
                    const base =
                      cur.yield_bonus &&
                      typeof cur.yield_bonus === "object" &&
                      !Array.isArray(cur.yield_bonus)
                        ? {
                            ...(cur.yield_bonus as Record<string, number>),
                          }
                        : {};
                    if (!Number.isFinite(n)) delete base[res];
                    else base[res] = n;
                    cur.yield_bonus = base;
                  });
                }}
              />
              <Button
                size="xs"
                variant="ghost"
                onClick={() =>
                  patchBonus((cur) => {
                    const base =
                      cur.yield_bonus &&
                      typeof cur.yield_bonus === "object" &&
                      !Array.isArray(cur.yield_bonus)
                        ? {
                            ...(cur.yield_bonus as Record<string, number>),
                          }
                        : {};
                    delete base[res];
                    cur.yield_bonus =
                      Object.keys(base).length > 0 ? base : undefined;
                  })
                }
              >
                Remove
              </Button>
            </HStack>
          ))}
          <Button
            size="xs"
            variant="outline"
            alignSelf="flex-start"
            onClick={addBonusRow}
            disabled={resources.every(
              (r) => u.yield_bonus && r in u.yield_bonus,
            )}
          >
            Add yield row
          </Button>
        </Stack>
      </Box>

      <Box>
        <Text fontSize="xs" color="fg.muted" mb={1}>
          Cost (resources)
        </Text>
        <Stack gap={2}>
          {costEntries.map(([res, amt]) => (
            <HStack key={res} gap={2} flexWrap="wrap">
              <NativeSelectRoot maxW="160px">
                <NativeSelectField
                  value={res}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === res) return;
                    patchCost((cur) => {
                      const base =
                        cur.cost &&
                        typeof cur.cost === "object" &&
                        !Array.isArray(cur.cost)
                          ? { ...(cur.cost as Record<string, number>) }
                          : {};
                      const v = base[res];
                      delete base[res];
                      base[next] = v ?? 1;
                      cur.cost = base;
                    });
                  }}
                >
                  {resources.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </NativeSelectField>
              </NativeSelectRoot>
              <Input
                type="number"
                maxW="100px"
                value={amt}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  patchCost((cur) => {
                    const base =
                      cur.cost &&
                      typeof cur.cost === "object" &&
                      !Array.isArray(cur.cost)
                        ? { ...(cur.cost as Record<string, number>) }
                        : {};
                    if (!Number.isFinite(n)) delete base[res];
                    else base[res] = n;
                    cur.cost = base;
                  });
                }}
              />
              <Button
                size="xs"
                variant="ghost"
                onClick={() =>
                  patchCost((cur) => {
                    const base =
                      cur.cost &&
                      typeof cur.cost === "object" &&
                      !Array.isArray(cur.cost)
                        ? { ...(cur.cost as Record<string, number>) }
                        : {};
                    delete base[res];
                    cur.cost = Object.keys(base).length > 0 ? base : undefined;
                  })
                }
              >
                Remove
              </Button>
            </HStack>
          ))}
          <Button
            size="xs"
            variant="outline"
            alignSelf="flex-start"
            onClick={addCostRow}
            disabled={
              resources.every((r) => u.cost && r in u.cost)
            }
          >
            Add cost row
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
}
