import { Box, Collapsible, HStack, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { Link as RouterLink } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_NESTED_BLOCK_PROPS,
} from "../theme/typography";
import { upsertPantryInventory } from "./api";
import { useMealData } from "./MealDataContext";
import { MealGroceryListDialog } from "./MealGroceryListDialog";
import { formatWeekStartShort, instanceCoveringDate } from "./mealPlanDates";
import { MealPantryPageGate } from "./MealPantryPageGate";
import { PantryAddModal } from "./PantryAddModal";
import { PantryInventoryFilterPanel } from "./PantryInventoryFilterPanel";
import { PantryInventoryList } from "./PantryInventoryList";
import type { PantrySortKey } from "./pantryInventoryListUtils";
import { PantryRowEditModal } from "./PantryRowEditModal";
import type { PantryRowSaveBody } from "./PantryRowEditForm";
import { usePantryInventory } from "./usePantryInventory";
import type { PantryInventoryRow } from "./types";
import type { PantryTagDimension } from "./pantryTagVocab";

export default function MealPantryInventoryPage() {
  const { sessionUser, getApiAccessToken } = useAppSession();
  const { instances, refreshMeals } = useMealData();
  const { pantryRows, busy, setBusy, loadErr, refresh, pantryEnabled, upsertPantryRow } =
    usePantryInventory();
  const [addOpen, setAddOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<PantrySortKey>("name_asc");
  const [nameQuery, setNameQuery] = useState("");
  const [tagFilters, setTagFilters] = useState<Partial<Record<PantryTagDimension, string>>>({});
  const [editRow, setEditRow] = useState<PantryInventoryRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [groceryOpen, setGroceryOpen] = useState(false);
  const [groceryInstanceId, setGroceryInstanceId] = useState<number | null>(null);
  const [groceryWeekLabel, setGroceryWeekLabel] = useState("");
  const [groceryPrepErr, setGroceryPrepErr] = useState<string | null>(null);
  const [groceryPrepBusy, setGroceryPrepBusy] = useState(false);

  if (!sessionUser) return null;

  const openGroceryList = async () => {
    setGroceryPrepErr(null);
    setGroceryPrepBusy(true);
    try {
      const inst = instanceCoveringDate(instances, new Date());
      if (!inst) {
        setGroceryPrepErr("No meal plan for this week. Schedule meals on the Plan tab first.");
        return;
      }
      const hasMeals = inst.slots.some((slot) => slot.meal_ids.length > 0);
      if (!hasMeals) {
        setGroceryPrepErr("This week's plan has no meals scheduled yet.");
        return;
      }
      setGroceryInstanceId(inst.id);
      setGroceryWeekLabel(`Week of ${formatWeekStartShort(inst.week_start)}`);
      setGroceryOpen(true);
    } catch (e) {
      setGroceryPrepErr(e instanceof Error ? e.message : "Could not open grocery list.");
    } finally {
      setGroceryPrepBusy(false);
    }
  };

  const handleSave = async (body: PantryRowSaveBody) => {
    setBusy(true);
    try {
      const t = await getApiAccessToken();
      const row = await upsertPantryInventory(t, body);
      upsertPantryRow(row);
      void refreshMeals().catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <MealPantryPageGate>
      <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
        {pantryEnabled ? (
          <>
            <HStack justify="space-between" align="center" w="100%" gap="2" flexWrap="wrap">
              <PondButton
                colorPalette="lilypad"
                color="white"
                onClick={() => setAddOpen(true)}
                disabled={addOpen}
              >
                Add item(s)
              </PondButton>
              <PondButton
                type="button"
                size="sm"
                variant="outline"
                colorPalette="sky"
                loading={groceryPrepBusy}
                onClick={() => void openGroceryList()}
              >
                Grocery
              </PondButton>
              <PondButton
                type="button"
                size="sm"
                uiClass="filter"
                uiActive={filtersOpen}
                aria-expanded={filtersOpen}
                flexShrink={0}
                onClick={() => setFiltersOpen((o) => !o)}
              >
                Filter
              </PondButton>
            </HStack>

            <Collapsible.Root open={filtersOpen} onOpenChange={(d) => setFiltersOpen(d.open)}>
              <Collapsible.Content>
                <Box {...PANEL_NESTED_BLOCK_PROPS} bg="bg" p="3">
                  <PantryInventoryFilterPanel
                    sort={sort}
                    onSortChange={setSort}
                    nameQuery={nameQuery}
                    onNameQueryChange={setNameQuery}
                    tagFilters={tagFilters}
                    onTagFiltersChange={setTagFilters}
                  />
                </Box>
              </Collapsible.Content>
            </Collapsible.Root>

            {loadErr ? (
              <Text fontSize={APP_TEXT_SIZES.meta} color="nautical.solid" role="alert">
                {loadErr}
              </Text>
            ) : null}
            {groceryPrepErr ? (
              <Text fontSize={APP_TEXT_SIZES.meta} color="nautical.solid" role="alert">
                {groceryPrepErr}
              </Text>
            ) : null}

            <PantryInventoryList
              rows={pantryRows}
              busy={busy}
              sort={sort}
              nameQuery={nameQuery}
              tagFilters={tagFilters}
              onEditRow={(row) => {
                setEditRow(row);
                setEditOpen(true);
              }}
            />
          </>
        ) : (
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
            Enable pantry tracking in{" "}
            <RouterLink to="/meal/settings">Settings</RouterLink> to manage inventory.
          </Text>
        )}

        <PantryAddModal
          open={addOpen}
          onOpenChange={setAddOpen}
          getApiAccessToken={getApiAccessToken}
          busy={busy}
          setBusy={setBusy}
          onDone={refresh}
        />
        <PantryRowEditModal
          row={editRow}
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) setEditRow(null);
          }}
          busy={busy}
          onSave={handleSave}
        />
        {groceryInstanceId != null ? (
          <MealGroceryListDialog
            open={groceryOpen}
            onOpenChange={setGroceryOpen}
            instanceId={groceryInstanceId}
            weekLabel={groceryWeekLabel}
            getApiAccessToken={getApiAccessToken}
            pantryAware
          />
        ) : null}
      </Stack>
    </MealPantryPageGate>
  );
}
