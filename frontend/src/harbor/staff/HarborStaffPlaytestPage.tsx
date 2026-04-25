/**
 * Headless engine runner for staff. Loads the live catalog, builds a fresh
 * default state for the chosen stage, and lets you tick days and take any
 * player action (start an operation, accept/decline arrivals, resolve events,
 * upgrade buildings, toggle policies, move ships). Never persists to the
 * server — useful for catalog-tuning and balance work.
 */

import {
  Badge,
  Box,
  Code,
  Field,
  HStack,
  Heading,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppSession } from "../../auth/AppSessionContext";
import PondButton from "../../PondButton";
import { fetchHarborCatalog } from "../api";
import {
  EngineError,
  acceptArrival,
  advanceDay,
  createDefaultHarborState,
  declineArrival,
  reassignShipBerth,
  resolveEvent,
  startOperation,
  togglePolicy,
  upgradeBuilding,
} from "../engine/rules";
import type {
  HarborCatalog,
  HarborState,
  StageId,
} from "../engine/types";
import { STAGE_IDS, getStageDef } from "../stages";

export default function HarborStaffPlaytestPage() {
  const { getApiAccessToken } = useAppSession();
  const [catalog, setCatalog] = useState<HarborCatalog | null>(null);
  const [state, setState] = useState<HarborState | null>(null);
  const [stageId, setStageId] = useState<StageId>(1);
  const [error, setError] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [selectedShipId, setSelectedShipId] = useState<string>("");

  const reload = useCallback(async () => {
    try {
      const token = await getApiAccessToken();
      const cat = await fetchHarborCatalog(token);
      setCatalog(cat);
      const fresh = createDefaultHarborState(stageId, cat);
      setState(fresh);
      setSelectedShipId(fresh.ships[0]?.id ?? "");
      setEventLog([`reset · stage ${stageId}`]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load catalog.");
    }
  }, [getApiAccessToken, stageId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const pushLog = useCallback(
    (line: string) =>
      setEventLog((prev) => [`day ${state?.day ?? "?"}: ${line}`, ...prev].slice(0, 200)),
    [state?.day],
  );

  const run = useCallback(
    (
      label: string,
      mutate: (s: HarborState, c: HarborCatalog) => HarborState,
    ) => {
      if (!state || !catalog) return;
      try {
        const next = mutate(state, catalog);
        setState(next);
        pushLog(label);
        setError(null);
      } catch (e) {
        setError(
          e instanceof EngineError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Action failed.",
        );
      }
    },
    [state, catalog, pushLog],
  );

  const tick = useCallback(() => {
    if (!state || !catalog) return;
    try {
      const result = advanceDay(state, catalog);
      setState(result.state);
      const newLines: string[] = [];
      newLines.push(`--- end of day ${state.day} → day ${result.state.day} ---`);
      for (const op of result.resolvedOperations) {
        newLines.push(
          `op ${op.op.defSlug} ${op.success ? "succeeded" : "failed"}`,
        );
      }
      for (const ev of result.newEvents) newLines.push(`event: ${ev.name}`);
      for (const ar of result.newArrivals) newLines.push(`arrival: ${ar.name}`);
      setEventLog((prev) => [...newLines, ...prev].slice(0, 200));
      setError(null);
    } catch (e) {
      setError(
        e instanceof EngineError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Tick failed.",
      );
    }
  }, [state, catalog]);

  const stage = useMemo(() => getStageDef(stageId), [stageId]);

  // Keep the selected ship valid when state mutates.
  useEffect(() => {
    if (!state) return;
    if (!state.ships.find((s) => s.id === selectedShipId)) {
      setSelectedShipId(state.ships[0]?.id ?? "");
    }
  }, [state, selectedShipId]);

  if (!state || !catalog) {
    return (
      <Stack gap={4}>
        <Heading size="md">Playtest</Heading>
        {error ? (
          <Box bg="red.subtle" color="red.fg" px={3} py={2} borderRadius="md">
            {error}
          </Box>
        ) : (
          <Text color="fg.muted">Loading catalog…</Text>
        )}
      </Stack>
    );
  }

  const availableOps = catalog.operations.filter(
    (op) =>
      op.stage_min <= state.stageId &&
      (op.stage_max == null || op.stage_max >= state.stageId) &&
      op.enabled,
  );
  const availableBuildings = catalog.buildings.filter(
    (b) =>
      b.stage_min <= state.stageId &&
      (b.stage_max == null || b.stage_max >= state.stageId) &&
      b.enabled,
  );
  const availablePolicies = catalog.policies.filter(
    (p) =>
      p.stage_min <= state.stageId &&
      (p.stage_max == null || p.stage_max >= state.stageId) &&
      p.enabled,
  );

  return (
    <Stack gap={4}>
      <Heading size="md">Playtest</Heading>
      <Text color="fg.muted">
        Runs the engine against the live catalog without saving. Every button
        here calls the same engine functions the game uses — use this to
        sanity-check content and balance.
      </Text>

      {/* Controls */}
      <HStack gap={3} wrap="wrap">
        <Field.Root w="180px">
          <Field.Label>Stage</Field.Label>
          <NativeSelect.Root>
            <NativeSelect.Field
              value={String(stageId)}
              onChange={(e) =>
                setStageId(Number(e.target.value) as StageId)
              }
            >
              {STAGE_IDS.map((id) => (
                <option key={id} value={id}>
                  {id} · {getStageDef(id).title}
                </option>
              ))}
            </NativeSelect.Field>
          </NativeSelect.Root>
        </Field.Root>
        <Box pt={6}>
          <PondButton size="sm" onClick={() => void reload()}>
            Reset
          </PondButton>
        </Box>
        <Box pt={6}>
          <PondButton size="sm" colorPalette="lilypad" onClick={tick}>
            End day →
          </PondButton>
        </Box>
      </HStack>

      {error && (
        <Box bg="red.subtle" color="red.fg" px={3} py={2} borderRadius="md">
          {error}
        </Box>
      )}

      {/* Summary */}
      <Box borderWidth="1px" borderRadius="md" p={3}>
        <Text fontSize="sm" color="fg.muted">
          Day {state.day} · Stage {state.stageId} · {stage.title} · Command{" "}
          {state.command}/{state.commandPerDay} · Berths {stage.berthCap}
        </Text>
        <Text fontSize="sm" color="fg.muted">
          Ships: {state.ships.length} · Pending arrivals:{" "}
          {state.pendingArrivals.length} · Active events:{" "}
          {state.activeEvents.length} · Active ops:{" "}
          {state.activeOperations.length}
        </Text>
      </Box>

      {/* Ships */}
      {state.ships.length > 0 && (
        <Box borderWidth="1px" borderRadius="md" p={3}>
          <Heading size="sm" mb={2}>
            Ships
          </Heading>
          <Stack gap={2}>
            {state.ships.map((ship) => {
              const def = catalog.ships.find((s) => s.slug === ship.defSlug);
              return (
                <HStack key={ship.id} gap={2} wrap="wrap">
                  <Badge
                    colorPalette={
                      ship.id === selectedShipId ? "lilypad" : "gray"
                    }
                    cursor="pointer"
                    onClick={() => setSelectedShipId(ship.id)}
                  >
                    {def?.name ?? ship.defSlug} · {ship.status}
                    {ship.status === "berthed" && ship.berthIndex != null
                      ? ` @${ship.berthIndex + 1}`
                      : ""}
                  </Badge>
                  {ship.status !== "voyage" && ship.status !== "repair" ? (
                    <>
                      <PondButton
                        size="xs"
                        variant="outline"
                        onClick={() =>
                          run(
                            `reassign ${def?.name ?? ship.defSlug} → reserve`,
                            (s) => reassignShipBerth(s, ship.id, null),
                          )
                        }
                      >
                        → reserve
                      </PondButton>
                      {Array.from({ length: stage.berthCap }).map((_, idx) => (
                        <PondButton
                          key={idx}
                          size="xs"
                          variant="outline"
                          onClick={() =>
                            run(
                              `reassign ${def?.name ?? ship.defSlug} → berth ${idx + 1}`,
                              (s) => reassignShipBerth(s, ship.id, idx),
                            )
                          }
                        >
                          → B{idx + 1}
                        </PondButton>
                      ))}
                    </>
                  ) : null}
                </HStack>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* Operations */}
      {availableOps.length > 0 && (
        <Box borderWidth="1px" borderRadius="md" p={3}>
          <Heading size="sm" mb={2}>
            Operations
          </Heading>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={2}>
            {availableOps.map((op) => {
              const needsShip =
                op.extra.kind === "voyage" || op.extra.kind === "repair";
              return (
                <HStack
                  key={op.slug}
                  justify="space-between"
                  borderWidth="1px"
                  borderRadius="sm"
                  px={2}
                  py={1}
                >
                  <Box>
                    <Text fontWeight="semibold" fontSize="sm">
                      {op.name}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                      {op.extra.kind} · cmd {op.extra.command_cost ?? 0} ·{" "}
                      {op.extra.duration_days ?? 1}d
                    </Text>
                  </Box>
                  <PondButton
                    size="xs"
                    colorPalette="lilypad"
                    onClick={() =>
                      run(`start ${op.slug}`, (s, c) =>
                        startOperation(
                          s,
                          c,
                          op.slug,
                          needsShip ? selectedShipId || null : null,
                        ),
                      )
                    }
                  >
                    Start
                  </PondButton>
                </HStack>
              );
            })}
          </SimpleGrid>
        </Box>
      )}

      {/* Arrivals */}
      {state.pendingArrivals.length > 0 && (
        <Box borderWidth="1px" borderRadius="md" p={3}>
          <Heading size="sm" mb={2}>
            Arrivals
          </Heading>
          <Stack gap={2}>
            {state.pendingArrivals.map((arr) => (
              <HStack key={arr.id} justify="space-between" wrap="wrap">
                <Box>
                  <Text fontWeight="semibold" fontSize="sm">
                    {arr.name}
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    cmd {arr.commandCost} · offer{" "}
                    {JSON.stringify(arr.offer)} · request{" "}
                    {JSON.stringify(arr.request)}
                  </Text>
                </Box>
                <HStack gap={2}>
                  <PondButton
                    size="xs"
                    colorPalette="lilypad"
                    onClick={() =>
                      run(`accept ${arr.name}`, (s, c) =>
                        acceptArrival(s, c, arr.id),
                      )
                    }
                  >
                    Accept
                  </PondButton>
                  <PondButton
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      run(`decline ${arr.name}`, (s) =>
                        declineArrival(s, arr.id),
                      )
                    }
                  >
                    Decline
                  </PondButton>
                </HStack>
              </HStack>
            ))}
          </Stack>
        </Box>
      )}

      {/* Events */}
      {state.activeEvents.length > 0 && (
        <Box borderWidth="1px" borderRadius="md" p={3}>
          <Heading size="sm" mb={2}>
            Active events
          </Heading>
          <Stack gap={2}>
            {state.activeEvents.map((ev) => (
              <HStack key={ev.id} justify="space-between" wrap="wrap">
                <Box>
                  <Text fontWeight="semibold" fontSize="sm">
                    {ev.name}{" "}
                    <Badge colorPalette="orange">{ev.severity}</Badge>
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    cmd {ev.commandCost} · cost {JSON.stringify(ev.cost)}
                  </Text>
                </Box>
                <PondButton
                  size="xs"
                  colorPalette="lilypad"
                  onClick={() =>
                    run(`resolve ${ev.name}`, (s) => resolveEvent(s, ev.id))
                  }
                >
                  Resolve
                </PondButton>
              </HStack>
            ))}
          </Stack>
        </Box>
      )}

      {/* Buildings */}
      {availableBuildings.length > 0 && (
        <Box borderWidth="1px" borderRadius="md" p={3}>
          <Heading size="sm" mb={2}>
            Buildings
          </Heading>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={2}>
            {availableBuildings.map((bd) => {
              const owned = state.buildings.find((b) => b.slug === bd.slug);
              const level = owned?.level ?? 0;
              const maxLevel =
                bd.extra.max_level ?? (bd.extra.level_costs?.length ?? 0);
              return (
                <HStack
                  key={bd.slug}
                  justify="space-between"
                  borderWidth="1px"
                  borderRadius="sm"
                  px={2}
                  py={1}
                >
                  <Box>
                    <Text fontWeight="semibold" fontSize="sm">
                      {bd.name} · L{level}/{maxLevel}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                      next:{" "}
                      {JSON.stringify(bd.extra.level_costs?.[level] ?? {})}
                    </Text>
                  </Box>
                  <PondButton
                    size="xs"
                    colorPalette="lilypad"
                    disabled={level >= maxLevel}
                    onClick={() =>
                      run(`upgrade ${bd.slug} → L${level + 1}`, (s, c) =>
                        upgradeBuilding(s, c, bd.slug),
                      )
                    }
                  >
                    {level === 0 ? "Build" : "Upgrade"}
                  </PondButton>
                </HStack>
              );
            })}
          </SimpleGrid>
        </Box>
      )}

      {/* Policies */}
      {availablePolicies.length > 0 && (
        <Box borderWidth="1px" borderRadius="md" p={3}>
          <Heading size="sm" mb={2}>
            Policies
          </Heading>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={2}>
            {availablePolicies.map((p) => {
              const active = state.activePolicies.includes(p.slug);
              return (
                <HStack
                  key={p.slug}
                  justify="space-between"
                  borderWidth="1px"
                  borderRadius="sm"
                  px={2}
                  py={1}
                >
                  <Box>
                    <Text fontWeight="semibold" fontSize="sm">
                      {p.name}
                      {active ? (
                        <Badge ml={2} colorPalette="green">
                          active
                        </Badge>
                      ) : null}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                      group: {p.extra.exclusive_group ?? "(solo)"}
                    </Text>
                  </Box>
                  <PondButton
                    size="xs"
                    colorPalette={active ? "gray" : "lilypad"}
                    variant={active ? "outline" : "solid"}
                    onClick={() =>
                      run(`toggle ${p.slug}`, (s, c) =>
                        togglePolicy(s, c, p.slug),
                      )
                    }
                  >
                    {active ? "Lift" : "Enact"}
                  </PondButton>
                </HStack>
              );
            })}
          </SimpleGrid>
        </Box>
      )}

      {/* Log + state */}
      <Field.Root>
        <Field.Label>Tick log</Field.Label>
        <Textarea
          readOnly
          value={eventLog.join("\n")}
          rows={10}
          fontFamily="mono"
          fontSize="sm"
        />
      </Field.Root>
      <Field.Root>
        <Field.Label>State JSON</Field.Label>
        <Code as="pre" w="full" p={3} fontSize="xs" overflowX="auto">
          {JSON.stringify(state, null, 2)}
        </Code>
      </Field.Root>
    </Stack>
  );
}
