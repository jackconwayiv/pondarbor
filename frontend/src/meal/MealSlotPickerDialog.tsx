import {
  Box,
  Button,
  Card,
  Input,
  SimpleGrid,
  Stack,
  Tabs,
  Tag,
  Text,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink } from "react-router";
import { AppModal } from "../components/AppModal";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useIsMobile } from "../responsive";
import {
  APP_SHELL_TAB_LIST_NESTED_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import {
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FIELD_PROPS,
} from "../theme/typography";
import { MealEditorForm } from "./MealEditorForm";
import { mealLabel } from "./mealLabels";
import { linesToIngredients } from "./recipeIngredients";
import type { Meal, MealCreateInput } from "./types";

const MIN_TITLE_QUERY_LEN = 2;
const MAX_TITLE_MATCHES = 25;
const RECENT_MEALS_LIMIT = 10;
const TITLE_SEARCH_DEBOUNCE_MS = 300;

const MODAL_PAD = "2" as const;

const SLOT_MODAL_TAB_LIST_PROPS = {
  ...APP_SHELL_TAB_LIST_NESTED_PROPS,
  px: { base: "2", md: "2" } as const,
} as const;

function mealsMatchingTitle(meals: Meal[], query: string, limit: number): Meal[] {
  const q = query.trim().toLowerCase();
  if (q.length < MIN_TITLE_QUERY_LEN) return [];
  return meals
    .filter((m) => (m.title ?? "").trim().toLowerCase().includes(q))
    .slice(0, limit);
}

function mealActivityTime(meal: Meal): number {
  const updated = Date.parse(meal.updated_at);
  if (Number.isFinite(updated)) return updated;
  const created = Date.parse(meal.created_at);
  return Number.isFinite(created) ? created : 0;
}

function recentMeals(meals: Meal[], limit: number): Meal[] {
  return [...meals].sort((a, b) => mealActivityTime(b) - mealActivityTime(a)).slice(0, limit);
}

export type MealSlotPickerIntent = "assign" | "edit";

export type MealSlotPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** assign = empty slot; edit = slot already has meals (shows recipe links). */
  intent?: MealSlotPickerIntent;
  /** e.g. weekday name */
  dayLabel: string;
  /** User-facing meal-time name (e.g. Lunch). */
  slotDisplayName: string;
  mealIds: number[];
  meals: Meal[];
  disabled?: boolean;
  /** Persist slot assignment (called on every toggle / after create). Reject on failure so UI can revert. */
  onCommit: (mealIds: number[]) => void | Promise<void>;
  /** Copy current selection to the same meal time on every day of the week (week/template editors). */
  onApplyToAllDays?: (mealIds: number[]) => void | Promise<void>;
  /** Create a meal from the inline form (Save). Omit to hide the new meal section. */
  createMeal?: (body: MealCreateInput) => Promise<Meal>;
  /** After a meal is created from the form (parent can merge into list). */
  onMealCreated?: (meal: Meal) => void;
};

/**
 * Modal: add/remove meals in a slot via debounced title search (dropdown) and optional create form.
 */
export function MealSlotPickerDialog({
  open,
  onOpenChange,
  intent: intentProp,
  dayLabel,
  slotDisplayName,
  mealIds,
  meals,
  disabled,
  onCommit,
  onApplyToAllDays,
  createMeal,
  onMealCreated,
}: MealSlotPickerDialogProps) {
  const [slotTab, setSlotTab] = useState<"search" | "create">("search");
  const [selectedIds, setSelectedIds] = useState<number[]>(mealIds);
  const [search, setSearch] = useState("");
  /** Hide title matches after picking from the list until search changes or field is focused again. */
  const [searchMenuSuppressed, setSearchMenuSuppressed] = useState(false);
  const [newMealTitle, setNewMealTitle] = useState("");
  const [newMealBlurb, setNewMealBlurb] = useState("");
  const [newMealDirections, setNewMealDirections] = useState("");
  const [newMealIngredientsText, setNewMealIngredientsText] = useState("");
  const [commitErr, setCommitErr] = useState<string | null>(null);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [newMealSaveBusy, setNewMealSaveBusy] = useState(false);
  /** Prevents overlapping slot commits (pick/remove) so each change is persisted before the next. */
  const [commitBusy, setCommitBusy] = useState(false);
  const fieldDisabled = disabled || commitBusy;
  const isMobile = useIsMobile();
  const debouncedSearch = useDebouncedValue(search, TITLE_SEARCH_DEBOUNCE_MS);
  const wasOpen = useRef(false);
  const selectedRef = useRef(mealIds);
  const onCommitRef = useRef(onCommit);
  selectedRef.current = selectedIds;
  onCommitRef.current = onCommit;

  useEffect(() => {
    if (open && !wasOpen.current) {
      setSlotTab("search");
      setSelectedIds(mealIds);
      setSearch("");
      setSearchMenuSuppressed(false);
      setNewMealTitle("");
      setNewMealBlurb("");
      setNewMealDirections("");
      setNewMealIngredientsText("");
      setCommitErr(null);
      setCreateErr(null);
      setCreateSuccess(null);
      setCommitBusy(false);
    }
    wasOpen.current = open;
  }, [open, mealIds]);

  useEffect(() => {
    setSearchMenuSuppressed(false);
  }, [search]);

  const titleMatches = useMemo(
    () => mealsMatchingTitle(meals, debouncedSearch, MAX_TITLE_MATCHES),
    [meals, debouncedSearch],
  );

  const recentMealList = useMemo(() => recentMeals(meals, RECENT_MEALS_LIMIT), [meals]);

  const mealsById = useMemo(() => new Map(meals.map((m) => [m.id, m])), [meals]);

  const runCommit = useCallback(
    async (next: number[]) => {
      const prev = selectedRef.current;
      setSelectedIds(next);
      setCommitErr(null);
      setCommitBusy(true);
      try {
        await onCommit(next);
      } catch (e) {
        setSelectedIds(prev);
        setCommitErr(e instanceof Error ? e.message : `Could not update ${slotDisplayName}`);
      } finally {
        setCommitBusy(false);
      }
    },
    [onCommit, slotDisplayName],
  );

  const handleApplyToAllDays = useCallback(() => {
    if (!onApplyToAllDays || selectedIds.length === 0 || fieldDisabled) return;
    if (
      !window.confirm(
        `Apply these meals to ${slotDisplayName} for every day this week? Meals already planned for that time on other days will be replaced.`,
      )
    ) {
      return;
    }
    void (async () => {
      setCommitErr(null);
      setCommitBusy(true);
      try {
        await onApplyToAllDays(selectedIds);
      } catch (e) {
        setCommitErr(e instanceof Error ? e.message : `Could not update ${slotDisplayName}`);
      } finally {
        setCommitBusy(false);
      }
    })();
  }, [onApplyToAllDays, selectedIds, fieldDisabled, slotDisplayName]);

  const toggleId = useCallback(
    (id: number) => {
      if (fieldDisabled) return;
      const next = selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id];
      void runCommit(next);
    },
    [fieldDisabled, selectedIds, runCommit],
  );

  const intent: MealSlotPickerIntent =
    intentProp ?? (mealIds.length === 0 ? "assign" : "edit");
  const modalTitle =
    intent === "assign"
      ? `Assign meal to ${slotDisplayName}`
      : `Meals for ${slotDisplayName}`;
  const queryReady = debouncedSearch.trim().length >= MIN_TITLE_QUERY_LEN;
  const showResultsMenu = titleMatches.length > 0 && !searchMenuSuppressed;

  const pickFromSearchMenu = useCallback(
    (id: number) => {
      setSearchMenuSuppressed(true);
      toggleId(id);
    },
    [toggleId],
  );

  const modalChromeProps = {
    headerProps: { p: MODAL_PAD } as const,
    descriptionProps: { p: MODAL_PAD } as const,
    /** Tight top gap so the selected-meals card sits close under the description. */
    bodyProps: { px: MODAL_PAD, pb: MODAL_PAD, pt: "0" } as const,
  };

  const mealChip = (id: number, gridCell: boolean) => {
    const m = mealsById.get(id);
    const label = m ? mealLabel(m) : `#${id}`;
    return (
      <Button
        key={id}
        type="button"
        variant="outline"
        size="sm"
        display="inline-flex"
        alignItems="center"
        gap="1"
        h="auto"
        minH="0"
        w={gridCell ? "100%" : undefined}
        justifyContent={gridCell ? "space-between" : undefined}
        borderRadius="md"
        borderColor="teal.solid"
        bg="lilypad.subtle"
        fontSize={APP_TEXT_SIZES.helper}
        fontWeight="medium"
        disabled={fieldDisabled}
        opacity={fieldDisabled ? 0.65 : 1}
        aria-label={`Remove ${label} from ${slotDisplayName}`}
        onClick={() => toggleId(id)}
      >
        <Text
          as="span"
          lineClamp={1}
          maxW={gridCell ? undefined : "14rem"}
          textAlign="left"
          flex={gridCell ? "1" : undefined}
          minW={gridCell ? "0" : undefined}
        >
          {label}
        </Text>
        <Text as="span" color="fg.muted" aria-hidden flexShrink={gridCell ? 0 : undefined}>
          ×
        </Text>
      </Button>
    );
  };

  const selectedMealsCard = (
    <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0" mb="3">
      <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
        {selectedIds.length > 0 ? (
          selectedIds.length > 3 ? (
            <SimpleGrid columns={2} gap="2" w="100%">
              {selectedIds.map((id) => mealChip(id, true))}
            </SimpleGrid>
          ) : (
            <Wrap gap="2">
              {selectedIds.map((id) => (
                <WrapItem key={id}>{mealChip(id, false)}</WrapItem>
              ))}
            </Wrap>
          )
        ) : (
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
            No meals in {slotDisplayName} yet.
          </Text>
        )}
      </Card.Body>
    </Card.Root>
  );

  const searchPanel = (
    <Stack gap="3">
      <Box>
        <Text fontSize={APP_TEXT_SIZES.meta} fontWeight="medium" color="fg" mb="2">
          Search meals by title
        </Text>
        <Box position="relative" zIndex={1}>
          <Input
            placeholder={`Type at least ${MIN_TITLE_QUERY_LEN} characters…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchMenuSuppressed(false)}
            disabled={fieldDisabled}
            autoComplete="off"
            fontSize={isMobile ? "md" : undefined}
            {...PANEL_FIELD_PROPS}
          />
          {showResultsMenu ? (
            <Box
              role="listbox"
              aria-label="Matching meals"
              position="absolute"
              left="0"
              right="0"
              top="100%"
              mt="1"
              zIndex={2}
              bg="bg"
              borderWidth="1px"
              borderColor="border"
              borderRadius="md"
              boxShadow="md"
              maxH="32vh"
              overflowY="auto"
              px="2"
            >
              {titleMatches.map((m) => {
                const on = selectedIds.includes(m.id);
                return (
                  <Box
                    key={m.id}
                    role="option"
                    aria-selected={on}
                    cursor={fieldDisabled ? "not-allowed" : "pointer"}
                    opacity={fieldDisabled ? 0.6 : 1}
                    py="2"
                    bg={on ? "lilypad.subtle" : "transparent"}
                    _hover={fieldDisabled ? undefined : { bg: on ? "lilypad.subtle" : "gray.100" }}
                    onClick={() => pickFromSearchMenu(m.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        pickFromSearchMenu(m.id);
                      }
                    }}
                    tabIndex={0}
                  >
                    <Text fontSize={APP_TEXT_SIZES.body} fontWeight={on ? "semibold" : "normal"} lineClamp={2}>
                      {mealLabel(m)}
                    </Text>
                  </Box>
                );
              })}
            </Box>
          ) : null}
        </Box>
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" mt="2">
          {!queryReady
            ? `Enter at least ${MIN_TITLE_QUERY_LEN} letters to search by title.`
            : titleMatches.length === 0
              ? "No meals match that title."
              : `Showing up to ${MAX_TITLE_MATCHES} matches in the menu under the field.`}
        </Text>
        {!showResultsMenu && recentMealList.length > 0 ? (
          <Box mt="3" pb="2">
            <Text fontSize={APP_TEXT_SIZES.meta} fontWeight="medium" color="fg.muted" mb="2">
              Recent meals
            </Text>
            <Wrap gap="2">
              {recentMealList.map((m) => {
                const on = selectedIds.includes(m.id);
                const label = mealLabel(m);
                return (
                  <WrapItem key={m.id}>
                    <Tag.Root
                      size="sm"
                      colorPalette="lilypad"
                      variant={on ? "solid" : "outline"}
                      cursor={fieldDisabled ? "not-allowed" : "pointer"}
                      opacity={fieldDisabled ? 0.65 : 1}
                      aria-pressed={on}
                      aria-label={
                        on ? `Remove ${label} from ${slotDisplayName}` : `Add ${label} to ${slotDisplayName}`
                      }
                      onClick={() => {
                        if (fieldDisabled) return;
                        toggleId(m.id);
                      }}
                    >
                      <Tag.Label>{label}</Tag.Label>
                    </Tag.Root>
                  </WrapItem>
                );
              })}
            </Wrap>
          </Box>
        ) : null}
      </Box>
    </Stack>
  );

  const createPanel = createMeal ? (
    <Stack gap="3">
      <Box pb={createErr ? "0" : "2"}>
        <MealEditorForm
          compact
          title={newMealTitle}
          blurb={newMealBlurb}
          directions={newMealDirections}
          ingredientsText={newMealIngredientsText}
          onTitleChange={setNewMealTitle}
          onBlurbChange={setNewMealBlurb}
          onDirectionsChange={setNewMealDirections}
          onIngredientsTextChange={setNewMealIngredientsText}
          onSave={() => {
            const title = newMealTitle.trim();
            if (!title || !createMeal) return;
            void (async () => {
              setNewMealSaveBusy(true);
              setCreateErr(null);
              setCreateSuccess(null);
              try {
                const meal = await createMeal({
                  title,
                  blurb: newMealBlurb.trim() || undefined,
                  directions: newMealDirections.trim() || undefined,
                  ingredients: linesToIngredients(newMealIngredientsText),
                });
                onMealCreated?.(meal);
                const prev = selectedRef.current;
                const next = prev.includes(meal.id) ? prev : [...prev, meal.id];
                setSelectedIds(next);
                setCommitErr(null);
                try {
                  await onCommitRef.current(next);
                  setNewMealTitle("");
                  setNewMealBlurb("");
                  setNewMealDirections("");
                  setNewMealIngredientsText("");
                  setCreateSuccess("Meal saved and added.");
                } catch (e) {
                  setSelectedIds(prev);
                  setCommitErr(e instanceof Error ? e.message : `Could not add meal to ${slotDisplayName}`);
                }
              } catch (e) {
                setCreateErr(e instanceof Error ? e.message : "Could not create meal");
              } finally {
                setNewMealSaveBusy(false);
              }
            })();
          }}
          saveDisabled={!newMealTitle.trim()}
          saveLoading={newMealSaveBusy}
          disabled={fieldDisabled}
          compactBoostMobile
        />
      </Box>
      {createErr ? (
        <Text
          fontSize={APP_TEXT_SIZES.helper}
          color="nautical.solid"
          fontWeight="medium"
          role="alert"
          pb="2"
        >
          {createErr}
        </Text>
      ) : null}
    </Stack>
  ) : null;

  const modalDescription =
    intent === "assign"
      ? onApplyToAllDays
        ? `${dayLabel}: search or create a meal to assign. Changes save immediately. Use Apply to all days to copy this meal time to every day of the week.`
        : `${dayLabel}: search or create a meal to assign. Changes save immediately.`
      : onApplyToAllDays
        ? `${dayLabel}: change which meals are planned, or open a recipe below. Use Apply to all days to copy this meal time to every day of the week.`
        : `${dayLabel}: change which meals are planned, or open a recipe below.`;

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={modalTitle}
      description={modalDescription}
      size="lg"
      {...modalChromeProps}
    >
      <Stack
        gap="0"
        fontSize={isMobile ? { base: "md", md: "md" } : APP_TEXT_SIZES.body}
      >
        {commitErr ? (
          <Text
            fontSize={APP_TEXT_SIZES.helper}
            color="nautical.solid"
            fontWeight="medium"
            role="alert"
            mb="2"
          >
            {commitErr}
          </Text>
        ) : null}

        {createSuccess ? (
          <Text
            fontSize={APP_TEXT_SIZES.helper}
            color="teal.solid"
            fontWeight="medium"
            role="status"
            aria-live="polite"
            mb="2"
          >
            {createSuccess}
          </Text>
        ) : null}

        {intent === "edit" && selectedIds.length > 0 ? (
          <Stack gap="1" mb="2">
            <Text fontSize={APP_TEXT_SIZES.meta} fontWeight="medium" color="fg.muted">
              Open recipe
            </Text>
            {selectedIds.map((id) => {
              const m = mealsById.get(id);
              const label = m ? mealLabel(m) : `Meal #${id}`;
              return (
                <RouterLink
                  key={id}
                  to={`/meal/meals/${id}`}
                  style={{ textDecoration: "none" }}
                >
                  <Text fontSize={APP_TEXT_SIZES.body} color="teal.solid" fontWeight="semibold">
                    {label}
                  </Text>
                </RouterLink>
              );
            })}
          </Stack>
        ) : null}

        {selectedMealsCard}

        {onApplyToAllDays ? (
          <Box px="2" pb="2">
            <Button
              size="sm"
              variant="outline"
              disabled={fieldDisabled || selectedIds.length === 0}
              onClick={handleApplyToAllDays}
            >
              Apply to all days
            </Button>
            {selectedIds.length === 0 ? (
              <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" mt="2">
                Add one or more meals above, then use this to copy them to this meal time on every day.
              </Text>
            ) : null}
          </Box>
        ) : null}

        {createMeal && createPanel ? (
          <Tabs.Root
            variant="plain"
            value={slotTab}
            onValueChange={(d) => setSlotTab(d.value as "search" | "create")}
          >
            <Box>
              <Tabs.List {...SLOT_MODAL_TAB_LIST_PROPS}>
                <Tabs.Trigger value="search" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                  Search
                </Tabs.Trigger>
                <Tabs.Trigger value="create" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                  Create
                </Tabs.Trigger>
              </Tabs.List>
            </Box>
            <Tabs.Content value="search" p="2">
              {searchPanel}
            </Tabs.Content>
            <Tabs.Content value="create" p="2">
              {createPanel}
            </Tabs.Content>
          </Tabs.Root>
        ) : (
          <Box p="2">{searchPanel}</Box>
        )}
      </Stack>
    </AppModal>
  );
}
