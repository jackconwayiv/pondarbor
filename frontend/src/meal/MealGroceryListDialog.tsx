import {
  Box,
  Card,
  Checkbox,
  Collapsible,
  Heading,
  HStack,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { AppModal } from "../components/AppModal";
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
  fetchGrocery,
  fetchGroceryForInstance,
  fetchSavedGroceryLists,
  generateGrocery,
  patchGroceryItem,
  patchGroceryList,
  saveGrocerySnapshot,
} from "./api";
import { groceryToPlaintext } from "./groceryListPlaintext";
import type { GroceryList, GroceryListItem, SavedGroceryList } from "./types";

export type MealGroceryListDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: number;
  weekLabel: string;
  getApiAccessToken: () => Promise<string>;
};

export function MealGroceryListDialog({
  open,
  onOpenChange,
  instanceId,
  weekLabel,
  getApiAccessToken,
}: MealGroceryListDialogProps) {
  const [grocery, setGrocery] = useState<GroceryList | null>(null);
  const [groceryErr, setGroceryErr] = useState<string | null>(null);
  const [hideChecked, setHideChecked] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [manualLine, setManualLine] = useState("");
  const [saved, setSaved] = useState<SavedGroceryList[]>([]);
  const [copyListNotice, setCopyListNotice] = useState(false);
  const [loadBusy, setLoadBusy] = useState(false);

  const loadGrocery = useCallback(async () => {
    setGrocery(null);
    setGroceryErr(null);
    setLoadBusy(true);
    try {
      const t = await getApiAccessToken();
      let g = await fetchGroceryForInstance(t, instanceId);
      if (!g) {
        g = await generateGrocery(t, instanceId);
      }
      setGrocery(g);
      setHideChecked(g.hide_checked ?? false);
    } catch (e) {
      setGroceryErr(e instanceof Error ? e.message : "Could not load grocery list");
    } finally {
      setLoadBusy(false);
    }
  }, [getApiAccessToken, instanceId]);

  const refreshSaved = useCallback(async () => {
    const t = await getApiAccessToken();
    setSaved(await fetchSavedGroceryLists(t));
  }, [getApiAccessToken]);

  useEffect(() => {
    if (!open) return;
    void loadGrocery();
    void refreshSaved().catch(() => {});
  }, [open, loadGrocery, refreshSaved]);

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
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title="Grocery list"
      description={weekLabel}
      size="xl"
      contentProps={{ maxH: "min(90vh, 48rem)", overflow: "hidden", display: "flex", flexDirection: "column" }}
      bodyProps={{ overflowY: "auto", flex: "1", minH: 0 }}
    >
      <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
        <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
          Matching ingredient lines merge into one row. Regenerate after you change the week or recipes; manual lines
          you add are kept.
        </Text>

        <Stack gap="2">
          <HStack gap="2" flexWrap="wrap">
            <PondButton
              colorPalette="lilypad"
              size="sm"
              loading={loadBusy}
              onClick={() => void loadGrocery()}
            >
              Generate / refresh
            </PondButton>
            <PondButton
              colorPalette="sky"
              variant="outline"
              size="sm"
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
                size="sm"
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
            <Heading size="sm" mb="2">
              Saved lists
            </Heading>
            <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" mb="2">
              Snapshot only — edit the live list below, then save another copy.
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

        <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
          <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
            <HStack align="center" gap="3" mb="3" flexWrap="wrap" rowGap="3">
              <Heading size="sm" flex="1" minW={0}>
                Items
              </Heading>
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
                    color="teal.solid"
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

            {loadBusy && !grocery ? (
              <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                Loading…
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
    </AppModal>
  );
}
