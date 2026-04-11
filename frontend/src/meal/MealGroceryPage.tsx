import {
  Box,
  Card,
  Checkbox,
  Collapsible,
  Heading,
  HStack,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, Navigate } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FIELD_PROPS,
} from "../theme/typography";
import {
  addGroceryManualItem,
  deleteSavedGroceryList,
  fetchInstances,
  fetchPantryInventory,
  fetchGrocery,
  fetchGroceryForInstance,
  fetchPantrySuggestions,
  fetchSavedGroceryLists,
  generateGrocery,
  patchGroceryList,
  patchGroceryItem,
  saveGrocerySnapshot,
  fetchIngredientVocab,
  upsertPantryInventory,
} from "./api";
import { formatWeekStartShort } from "./mealPlanDates";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import type { GroceryList, GroceryListItem, MealPlanInstance, PantryInventoryRow, SavedGroceryList } from "./types";

function groceryToPlaintext(items: GroceryListItem[], hideChecked: boolean): string {
  const lines: string[] = [];
  for (const it of items) {
    if (hideChecked && it.is_checked) continue;
    const mark = it.is_checked ? "[x]" : "[ ]";
    lines.push(`${mark} ${it.display_text}`);
    const c = it.contributions ?? [];
    if (c.length > 1) {
      for (const row of c) {
        lines.push(`    — ${row.meal_title}: ${row.display}`);
      }
    }
  }
  return lines.join("\n");
}

export default function MealGroceryPage() {
  const { isAuthenticated, isLoading, sessionUser, getApiAccessToken, refreshSession, patchMyProfile } =
    useAppSession();
  const [instances, setInstances] = useState<MealPlanInstance[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [grocery, setGrocery] = useState<GroceryList | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [groceryErr, setGroceryErr] = useState<string | null>(null);
  const [hideChecked, setHideChecked] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [manualLine, setManualLine] = useState("");
  const [saved, setSaved] = useState<SavedGroceryList[]>([]);
  const [pantryRows, setPantryRows] = useState<PantryInventoryRow[]>([]);
  const [pantryBusy, setPantryBusy] = useState(false);
  const [pantrySearch, setPantrySearch] = useState("");
  const [pantryPickId, setPantryPickId] = useState<number | "">("");
  const [pantryQty, setPantryQty] = useState("1");
  const [pantryOpts, setPantryOpts] = useState<{ id: number; name: string }[]>([]);
  const [hints, setHints] = useState<
    { ingredient_id: number; ingredient_name: string; recommended_meals: { id: number; title: string }[] }[]
  >([]);
  const [planToolsOpen, setPlanToolsOpen] = useState(false);
  const [copyListNotice, setCopyListNotice] = useState(false);

  const sortedInstances = useMemo(
    () => [...instances].sort((a, b) => a.week_start.localeCompare(b.week_start)),
    [instances],
  );

  const refreshInstances = useCallback(async () => {
    const t = await getApiAccessToken();
    setInstances(await fetchInstances(t));
  }, [getApiAccessToken]);

  const loadGroceryForInstance = useCallback(
    async (instanceId: number) => {
      setGrocery(null);
      setGroceryErr(null);
      const t = await getApiAccessToken();
      let g = await fetchGroceryForInstance(t, instanceId);
      if (!g) {
        g = await generateGrocery(t, instanceId);
      }
      setGrocery(g);
      setHideChecked(g.hide_checked ?? false);
    },
    [getApiAccessToken],
  );

  const resolvedSelection = useMemo(() => {
    if (!sortedInstances.length) return "";
    if (selectedId && sortedInstances.some((i) => String(i.id) === selectedId)) {
      return selectedId;
    }
    return String(sortedInstances[0].id);
  }, [sortedInstances, selectedId]);

  const refreshSaved = useCallback(async () => {
    const t = await getApiAccessToken();
    setSaved(await fetchSavedGroceryLists(t));
  }, [getApiAccessToken]);

  const refreshPantry = useCallback(async () => {
    if (!sessionUser?.profile.meal_pantry_enabled) {
      setPantryRows([]);
      return;
    }
    const t = await getApiAccessToken();
    setPantryRows(await fetchPantryInventory(t));
  }, [getApiAccessToken, sessionUser?.profile.meal_pantry_enabled]);

  const refreshHints = useCallback(async () => {
    if (!sessionUser?.profile.meal_pantry_enabled) {
      setHints([]);
      return;
    }
    const t = await getApiAccessToken();
    const r = await fetchPantrySuggestions(t);
    setHints(r.hints ?? []);
  }, [getApiAccessToken, sessionUser?.profile.meal_pantry_enabled]);

  useEffect(() => {
    if (!sessionUser?.user.is_approved) return;
    const tid = window.setTimeout(() => {
      void refreshInstances().catch((e) =>
        setLoadErr(e instanceof Error ? e.message : "Load failed"),
      );
    }, 0);
    return () => window.clearTimeout(tid);
  }, [sessionUser?.user.is_approved, refreshInstances]);

  useEffect(() => {
    if (resolvedSelection === "") return;
    const iid = Number(resolvedSelection);
    if (!Number.isFinite(iid)) return;
    const timer = window.setTimeout(() => {
      void loadGroceryForInstance(iid).catch((e) =>
        setGroceryErr(e instanceof Error ? e.message : "Could not load grocery list"),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resolvedSelection, loadGroceryForInstance]);

  useEffect(() => {
    if (!sessionUser?.user.is_approved) return;
    void refreshSaved().catch(() => {});
  }, [sessionUser?.user.is_approved, refreshSaved]);

  useEffect(() => {
    if (!sessionUser?.user.is_approved) return;
    void refreshPantry().catch(() => {});
    void refreshHints().catch(() => {});
  }, [sessionUser?.user.is_approved, refreshPantry, refreshHints, sessionUser?.profile.meal_pantry_enabled]);

  useEffect(() => {
    if (!sessionUser?.profile.meal_pantry_enabled) return;
    const q = pantrySearch.trim();
    if (q.length < 2) {
      setPantryOpts([]);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const tok = await getApiAccessToken();
          setPantryOpts(await fetchIngredientVocab(tok, q));
        } catch {
          setPantryOpts([]);
        }
      })();
    }, 250);
    return () => window.clearTimeout(t);
  }, [pantrySearch, getApiAccessToken, sessionUser?.profile.meal_pantry_enabled]);

  if (isLoading) return <MealLoading />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser) {
    return <MealSessionReconnect onRetry={() => void refreshSession()} />;
  }
  if (!sessionUser.user.is_approved) {
    return <MealApprovalRequired />;
  }

  const selectedInstance =
    resolvedSelection !== ""
      ? sortedInstances.find((i) => String(i.id) === resolvedSelection)
      : undefined;

  const visibleItems = (grocery?.items ?? []).filter((it) => !(hideChecked && it.is_checked));

  function toggleItem(it: GroceryListItem, checked: boolean) {
    const previousChecked = it.is_checked;
    setGrocery((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((row) => (row.id === it.id ? { ...row, is_checked: checked } : row)),
          }
        : prev,
    );
    void (async () => {
      try {
        const t = await getApiAccessToken();
        await patchGroceryItem(t, it.id, { is_checked: checked });
      } catch (e) {
        setGrocery((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((row) =>
                  row.id === it.id ? { ...row, is_checked: previousChecked } : row,
                ),
              }
            : prev,
        );
        setGroceryErr(e instanceof Error ? e.message : "Update failed");
      }
    })();
  }

  async function copyPlaintext() {
    if (!grocery?.items?.length) return;
    const text = groceryToPlaintext(grocery.items, false);
    try {
      await navigator.clipboard.writeText(text);
      setGroceryErr(null);
      setCopyListNotice(true);
      window.setTimeout(() => setCopyListNotice(false), 2800);
    } catch {
      setCopyListNotice(false);
      setGroceryErr("Could not copy to clipboard");
    }
  }

  return (
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
      {loadErr ? (
        <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
          {loadErr}
        </Text>
      ) : null}

      {!sortedInstances.length ? (
        <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
          No week plans yet. Create one under{" "}
          <RouterLink to="/meal/plan/plans">
            <Text as="span" color="lilypad.solid" fontWeight="bold">
              Plans
            </Text>
          </RouterLink>
          .
        </Text>
      ) : (
        <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
          <PondButton
            alignSelf="flex-start"
            size="sm"
            variant="outline"
            colorPalette="sky"
            onClick={() => setPlanToolsOpen((o) => !o)}
          >
            {planToolsOpen ? "Hide plan & pantry" : "Show plan & pantry"}
          </PondButton>

          <Collapsible.Root open={planToolsOpen} onOpenChange={(d) => setPlanToolsOpen(d.open)}>
            <Collapsible.Content>
              <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
                <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                  Pick a planned week. Matching ingredient lines merge into one row: totals combine amounts (counts,
                  tsp/Tbsp/cups, weight, ml). Open the row for each meal’s original line. Regenerate after you change
                  the week or recipes.
                </Text>

                <HStack gap="3" flexWrap="wrap" align="center">
                  <Text fontSize={APP_TEXT_SIZES.helper}>Pantry (inventory & hints)</Text>
                  <Checkbox.Root
                    checked={sessionUser.profile.meal_pantry_enabled ?? false}
                    onCheckedChange={(d) => {
                      const next = d.checked === true;
                      void patchMyProfile({ meal_pantry_enabled: next }).catch(() => {});
                    }}
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Label fontSize={APP_TEXT_SIZES.helper}>Enabled</Checkbox.Label>
                  </Checkbox.Root>
                </HStack>

                <NativeSelectRoot size="sm" maxW="md">
                  <NativeSelectField
                    {...PANEL_FIELD_PROPS}
                    value={resolvedSelection}
                    onChange={(e) => setSelectedId(e.target.value)}
                  >
                    {sortedInstances.map((i) => (
                      <option key={i.id} value={i.id}>
                        Week of {formatWeekStartShort(i.week_start)}
                      </option>
                    ))}
                  </NativeSelectField>
                </NativeSelectRoot>

                {selectedInstance ? (
                  <Text fontSize={APP_TEXT_SIZES.helper}>
                    <RouterLink to={`/meal/plan/plans/${selectedInstance.id}`}>
                      <Text as="span" color="lilypad.solid" fontWeight="bold">
                        Edit week plan
                      </Text>
                    </RouterLink>{" "}
                    <Text as="span" color="fg.muted">
                      (grid & meals)
                    </Text>
                  </Text>
                ) : null}

                {sessionUser.profile.meal_pantry_enabled && hints.length > 0 ? (
                  <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
                    <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
                      <Heading size="sm" mb="2" fontWeight="semibold">
                        Inventory not on this week’s plan
                      </Heading>
                      <Stack gap="3">
                        {hints.map((h) => (
                          <Box key={h.ingredient_id}>
                            <Text fontSize={APP_TEXT_SIZES.helper}>
                              You have <Text as="span" fontWeight="semibold">{h.ingredient_name}</Text> in the pantry,
                              not planned this week. Try:{" "}
                              {h.recommended_meals.map((m, i) => (
                                <span key={m.id}>
                                  {i > 0 ? ", " : null}
                                  <RouterLink to={`/meal/plan/meals/${m.id}`}>
                                    <Text as="span" color="lilypad.solid" fontWeight="bold">
                                      {m.title}
                                    </Text>
                                  </RouterLink>
                                </span>
                              ))}
                              .
                            </Text>
                          </Box>
                        ))}
                      </Stack>
                    </Card.Body>
                  </Card.Root>
                ) : null}

                {sessionUser.profile.meal_pantry_enabled ? (
                  <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
                    <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
                      <Heading size="sm" mb="2" fontWeight="semibold">
                        Pantry inventory
                      </Heading>
                      <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" mb="2">
                        Set counts or use Have / Don’t have. Saving upserts one ingredient row.
                      </Text>
                      <HStack gap="2" flexWrap="wrap" align="flex-end" mb="3">
                        <Input
                          flex="1"
                          minW="10rem"
                          placeholder="Search ingredients (2+ letters)"
                          value={pantrySearch}
                          onChange={(e) => setPantrySearch(e.target.value)}
                          {...PANEL_FIELD_PROPS}
                        />
                        <NativeSelectRoot size="sm" minW="10rem">
                          <NativeSelectField
                            value={pantryPickId === "" ? "" : String(pantryPickId)}
                            onChange={(e) => setPantryPickId(e.target.value ? Number(e.target.value) : "")}
                            {...PANEL_FIELD_PROPS}
                          >
                            <option value="">Pick…</option>
                            {pantryOpts.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.name}
                              </option>
                            ))}
                          </NativeSelectField>
                        </NativeSelectRoot>
                        <Input
                          w="5rem"
                          type="number"
                          min={0}
                          value={pantryQty}
                          onChange={(e) => setPantryQty(e.target.value)}
                          {...PANEL_FIELD_PROPS}
                        />
                        <PondButton
                          size="sm"
                          colorPalette="lilypad"
                          disabled={pantryPickId === ""}
                          onClick={() => {
                            if (pantryPickId === "") return;
                            void (async () => {
                              setPantryBusy(true);
                              try {
                                const tok = await getApiAccessToken();
                                await upsertPantryInventory(tok, {
                                  ingredient_id: Number(pantryPickId),
                                  quantity: Math.max(0, parseInt(pantryQty, 10) || 0),
                                  simple_have: null,
                                });
                                setPantrySearch("");
                                setPantryPickId("");
                                setPantryOpts([]);
                                await refreshPantry();
                                await refreshHints();
                              } finally {
                                setPantryBusy(false);
                              }
                            })();
                          }}
                        >
                          Add / update
                        </PondButton>
                      </HStack>
                      <Stack gap="2">
                        {pantryRows.length === 0 ? (
                          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                            No rows yet — inventory appears when you add amounts from the API or future quick-add.
                          </Text>
                        ) : (
                          pantryRows.map((row) => (
                            <PantryRowEditor
                              key={row.id}
                              row={row}
                              busy={pantryBusy}
                              onSave={async (body) => {
                                setPantryBusy(true);
                                try {
                                  const t = await getApiAccessToken();
                                  await upsertPantryInventory(t, body);
                                  await refreshPantry();
                                  await refreshHints();
                                } finally {
                                  setPantryBusy(false);
                                }
                              }}
                            />
                          ))
                        )}
                      </Stack>
                    </Card.Body>
                  </Card.Root>
                ) : null}

                <Stack gap="2">
                  <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
                    Regenerate replaces auto lines; manual lines you add are kept.
                  </Text>
                  <HStack gap="2" flexWrap="wrap">
                    <PondButton
                      colorPalette="lilypad"
                      onClick={() => {
                        if (resolvedSelection === "") return;
                        void loadGroceryForInstance(Number(resolvedSelection)).catch((e) =>
                          setGroceryErr(e instanceof Error ? e.message : "Generate failed"),
                        );
                      }}
                    >
                      Generate / refresh
                    </PondButton>
                    <PondButton
                      colorPalette="sky"
                      variant="outline"
                      disabled={!grocery?.id}
                      onClick={() => {
                        if (!grocery?.id) return;
                        const label =
                          window.prompt("Label for this saved list", new Date().toLocaleString()) ?? "";
                        void (async () => {
                          try {
                            const t = await getApiAccessToken();
                            await saveGrocerySnapshot(t, grocery.id, label.trim() || "Saved list");
                            await refreshSaved();
                          } catch (e) {
                            setGroceryErr(e instanceof Error ? e.message : "Save failed");
                          }
                        })();
                      }}
                    >
                      Save a copy
                    </PondButton>
                  </HStack>
                  <Stack gap="2">
                    <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                      Add manual line
                    </Text>
                    <HStack gap="2" flexWrap="wrap" align="flex-end">
                      <Input
                        flex="1"
                        minW="min(100%, 12rem)"
                        placeholder="e.g. Milk 1 qt"
                        value={manualLine}
                        onChange={(e) => setManualLine(e.target.value)}
                        {...PANEL_FIELD_PROPS}
                      />
                      <PondButton
                        colorPalette="sky"
                        variant="outline"
                        disabled={!grocery?.id || !manualLine.trim()}
                        onClick={() => {
                          if (!grocery?.id) return;
                          void (async () => {
                            try {
                              const t = await getApiAccessToken();
                              await addGroceryManualItem(t, grocery.id, { display_text: manualLine.trim() });
                              setManualLine("");
                              setGrocery(await fetchGrocery(t, grocery.id));
                            } catch (e) {
                              setGroceryErr(e instanceof Error ? e.message : "Add failed");
                            }
                          })();
                        }}
                      >
                        Add
                      </PondButton>
                    </HStack>
                  </Stack>
                </Stack>

                <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
                  <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
                    <Heading size="sm" mb="2" fontWeight="semibold">
                      Saved lists
                    </Heading>
                    <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" mb="2">
                      Sorted by date saved. Snapshot only — edit the live grocery list below, then save another copy.
                    </Text>
                    <Stack gap="2">
                      {saved.length === 0 ? (
                        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                          No saved copies yet.
                        </Text>
                      ) : (
                        saved.map((s) => (
                          <HStack key={s.id} justify="space-between" gap="2" flexWrap="wrap">
                            <Text fontSize={APP_TEXT_SIZES.helper}>
                              {(s.label || "Saved list").trim()}{" "}
                              <Text as="span" color="fg.muted" fontSize={APP_TEXT_SIZES.meta}>
                                ({new Date(s.saved_at).toLocaleString()})
                              </Text>
                            </Text>
                            <PondButton
                              size="sm"
                              variant="outline"
                              colorPalette="sky"
                              onClick={() => {
                                void (async () => {
                                  try {
                                    const t = await getApiAccessToken();
                                    await deleteSavedGroceryList(t, s.id);
                                    await refreshSaved();
                                  } catch (e) {
                                    setGroceryErr(e instanceof Error ? e.message : "Delete failed");
                                  }
                                })();
                              }}
                            >
                              Delete
                            </PondButton>
                          </HStack>
                        ))
                      )}
                    </Stack>
                  </Card.Body>
                </Card.Root>
              </Stack>
            </Collapsible.Content>
          </Collapsible.Root>

          <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
            <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
              <HStack align="center" gap="3" mb="3" flexWrap="wrap" rowGap="3">
                <Stack gap="1" minW={0} flex="1">
                  <Heading size="sm" fontWeight="semibold">
                    Grocery List
                  </Heading>
                  {selectedInstance ? (
                    <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                      Week of {formatWeekStartShort(selectedInstance.week_start)}
                    </Text>
                  ) : null}
                </Stack>
                <Box flexShrink={0}>
                  <Checkbox.Root
                    checked={hideChecked}
                    onCheckedChange={(d) => {
                      const next = d.checked === true;
                      const gid = grocery?.id;
                      setHideChecked(next);
                      if (gid == null) return;
                      void (async () => {
                        try {
                          const tok = await getApiAccessToken();
                          const updated = await patchGroceryList(tok, gid, { hide_checked: next });
                          setGrocery((prev) =>
                            prev && prev.id === gid ? { ...prev, hide_checked: updated.hide_checked } : prev,
                          );
                        } catch (e) {
                          setHideChecked(!next);
                          setGroceryErr(e instanceof Error ? e.message : "Could not save preference");
                        }
                      })();
                    }}
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Label fontSize={APP_TEXT_SIZES.helper}>Hide checked</Checkbox.Label>
                  </Checkbox.Root>
                </Box>
                <HStack gap="2" flex="1" justify="flex-end" align="center" flexWrap="wrap" minW={0}>
                  {copyListNotice ? (
                    <Text
                      fontSize={APP_TEXT_SIZES.meta}
                      color="lilypad.solid"
                      fontWeight="medium"
                      role="status"
                      aria-live="polite"
                    >
                      Copied to clipboard
                    </Text>
                  ) : null}
                  <PondButton
                    flexShrink={0}
                    size="sm"
                    colorPalette="sky"
                    variant="outline"
                    onClick={() => void copyPlaintext()}
                    disabled={!grocery?.items?.length}
                  >
                    Copy as text
                  </PondButton>
                </HStack>
              </HStack>

              {groceryErr ? (
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  fontWeight="medium"
                  color="nautical.solid"
                  role="alert"
                  mb="2"
                >
                  {groceryErr}
                </Text>
              ) : null}
              {grocery?.items?.length ? (
                <Stack as="ul" gap="2" pl="0" listStyleType="none" fontSize={APP_TEXT_SIZES.body}>
                  {visibleItems.map((it) => {
                    const multi = (it.contributions?.length ?? 0) > 1;
                    const open = expanded[it.id] ?? false;
                    return (
                      <Box as="li" key={it.id} borderBottomWidth="1px" borderColor="border" pb="2">
                        <HStack align="flex-start" gap="2">
                          <Checkbox.Root
                            checked={it.is_checked}
                            onCheckedChange={(d) => void toggleItem(it, d.checked === true)}
                          >
                            <Checkbox.HiddenInput />
                            <Checkbox.Control flexShrink={0} mt="0.5">
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                          </Checkbox.Root>
                          <Box flex="1" minW={0}>
                            {multi ? (
                              <Collapsible.Root
                                open={open}
                                onOpenChange={(d) => setExpanded((prev) => ({ ...prev, [it.id]: d.open }))}
                              >
                                <Collapsible.Trigger asChild>
                                  <Box
                                    as="button"
                                    cursor="pointer"
                                    textAlign="left"
                                    fontWeight="medium"
                                    textDecoration={open ? "underline" : "none"}
                                    fontSize={APP_TEXT_SIZES.body}
                                  >
                                    {it.display_text}
                                    <Text as="span" fontSize={APP_TEXT_SIZES.meta} color="fg.muted" ml="1">
                                      ({it.contributions?.length} meals)
                                    </Text>
                                  </Box>
                                </Collapsible.Trigger>
                                <Collapsible.Content>
                                  <Stack gap="1" mt="2" pl="2" borderLeftWidth="2px" borderColor="border.subtle">
                                    {(it.contributions ?? []).map((c, idx) => (
                                      <Text key={idx} fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                                        <Text as="span" fontWeight="medium" color="fg">
                                          {c.meal_title}
                                        </Text>
                                        : {c.display}
                                      </Text>
                                    ))}
                                  </Stack>
                                </Collapsible.Content>
                              </Collapsible.Root>
                            ) : (
                              <Text fontWeight="medium">{it.display_text}</Text>
                            )}
                          </Box>
                        </HStack>
                      </Box>
                    );
                  })}
                </Stack>
              ) : grocery ? (
                <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                  No ingredient lines (add ingredients to meals in this week).
                </Text>
              ) : null}
            </Card.Body>
          </Card.Root>

        </Stack>
      )}
    </Stack>
  );
}

function PantryRowEditor({
  row,
  busy,
  onSave,
}: {
  row: PantryInventoryRow;
  busy: boolean;
  onSave: (body: { ingredient_id: number; quantity?: number; simple_have?: boolean | null }) => Promise<void>;
}) {
  const [qty, setQty] = useState(String(row.quantity));
  const [mode, setMode] = useState<"count" | "simple">(row.simple_have == null ? "count" : "simple");

  return (
    <HStack gap="2" flexWrap="wrap" align="flex-end">
      <Text fontSize={APP_TEXT_SIZES.helper} minW="8rem" fontWeight="medium">
        {row.ingredient.name}
      </Text>
      <NativeSelectRoot size="sm">
        <NativeSelectField
          value={mode}
          onChange={(e) => setMode(e.target.value as "count" | "simple")}
          {...PANEL_FIELD_PROPS}
        >
          <option value="count">Count</option>
          <option value="simple">Have / Don’t have</option>
        </NativeSelectField>
      </NativeSelectRoot>
      {mode === "count" ? (
        <Input
          w="6rem"
          type="number"
          min={0}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          {...PANEL_FIELD_PROPS}
        />
      ) : (
        <NativeSelectRoot size="sm">
          <NativeSelectField
            value={row.simple_have === true ? "1" : row.simple_have === false ? "0" : ""}
            onChange={(e) => {
              const v = e.target.value;
              void onSave({
                ingredient_id: row.ingredient.id,
                simple_have: v === "1" ? true : v === "0" ? false : null,
              });
            }}
            {...PANEL_FIELD_PROPS}
          >
            <option value="">—</option>
            <option value="1">Have</option>
            <option value="0">Don’t have</option>
          </NativeSelectField>
        </NativeSelectRoot>
      )}
      {mode === "count" ? (
        <PondButton
          size="sm"
          colorPalette="lilypad"
          loading={busy}
          onClick={() =>
            void onSave({
              ingredient_id: row.ingredient.id,
              quantity: Math.max(0, parseInt(qty, 10) || 0),
              simple_have: null,
            })
          }
        >
          Save
        </PondButton>
      ) : null}
    </HStack>
  );
}
