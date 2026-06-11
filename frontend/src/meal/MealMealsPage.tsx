import { Box, Card, Collapsible, HStack, Input, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  MEAL_NAV_LINK_CARD_PROPS,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FIELD_PROPS,
  PANEL_NESTED_BLOCK_PROPS,
} from "../theme/typography";
import { createMeal, importMealFromUrl, importPaprikaRecipes } from "./api";
import type { MealListQuery } from "./api";
import { useMealData } from "./MealDataContext";
import {
  filterOwnedMealsForList,
  mergeOwnedAndSharedMeals,
  type MealListEntry,
} from "./mealListMerge";
import { MealEditorBackdropDismiss } from "./MealEditorBackdropDismiss";
import { MealEditorForm } from "./MealEditorForm";
import { MealImageField } from "./MealImageField";
import { MealMealsFilterPanel } from "./MealMealsFilterPanel";
import PresignedImage from "../lib/PresignedImage";
import { mealLabel, mealPlanSlotSummary } from "./mealLabels";
import { MealPantryCoverageBadge } from "./MealPantryCoverageBadge";
import { MealTagsCategoriesChips } from "./MealTagsCategoriesChips";
import { mealOwnerLabel } from "./mealOwnerLabel";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import { linesToIngredients } from "./recipeIngredients";

export default function MealMealsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, sessionUser, getApiAccessToken, refreshSession } =
    useAppSession();
  const {
    meals: ownedMeals,
    sharedMeals,
    categoryOptions,
    upsertMeal,
    addCategoryOption,
  } = useMealData();
  const [title, setTitle] = useState("");
  const [blurb, setBlurb] = useState("");
  const [directions, setDirections] = useState("");
  const [ingredientsText, setIngredientsText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [paprikaBusy, setPaprikaBusy] = useState(false);
  const [draftImageKey, setDraftImageKey] = useState("");
  const [listQ, setListQ] = useState("");
  const [listIngredientQ, setListIngredientQ] = useState("");
  const [listTags, setListTags] = useState("");
  const [mealTypeFilter, setMealTypeFilter] = useState("");
  const [cuisineFilter, setCuisineFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const [sort, setSort] = useState<MealListQuery["sort"]>("pantry_coverage_pct");
  const paprikaInputRef = useRef<HTMLInputElement | null>(null);

  const mealTypeOpts = useMemo(
    () => categoryOptions.meal_type.map((o) => ({ id: o.id, name: o.name })),
    [categoryOptions.meal_type],
  );
  const cuisineOpts = useMemo(
    () => categoryOptions.cuisine.map((o) => ({ id: o.id, name: o.name })),
    [categoryOptions.cuisine],
  );
  const timeOpts = useMemo(
    () => categoryOptions.time.map((o) => ({ id: o.id, name: o.name })),
    [categoryOptions.time],
  );

  const listQuery = useMemo((): MealListQuery => {
    const q: MealListQuery = { sort: sort ?? "pantry_coverage_pct" };
    if (listQ.trim()) q.q = listQ.trim();
    if (listIngredientQ.trim()) q.ingredient_q = listIngredientQ.trim();
    if (listTags.trim()) q.tags = listTags.trim();
    if (mealTypeFilter) q.meal_type_id = Number(mealTypeFilter);
    if (cuisineFilter) q.cuisine_id = Number(cuisineFilter);
    if (timeFilter) q.time_id = Number(timeFilter);
    return q;
  }, [
    sort,
    listQ,
    listIngredientQ,
    listTags,
    mealTypeFilter,
    cuisineFilter,
    timeFilter,
  ]);

  const meals = useMemo((): MealListEntry[] => {
    const filteredOwned = filterOwnedMealsForList(ownedMeals, listQuery);
    return mergeOwnedAndSharedMeals(filteredOwned, sharedMeals, listQuery);
  }, [ownedMeals, sharedMeals, listQuery]);

  const dismissAddMeal = useCallback(() => {
    setTitle("");
    setBlurb("");
    setDirections("");
    setIngredientsText("");
    setImportUrl("");
    setDraftImageKey("");
    setShowAddMeal(false);
  }, []);

  if (isLoading) return <MealLoading />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser) {
    return <MealSessionReconnect onRetry={() => void refreshSession()} />;
  }
  if (!sessionUser.user.is_approved) {
    return <MealApprovalRequired />;
  }

  return (
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
      <HStack justify="space-between" align="center" w="100%" gap="2" flexWrap="nowrap">
        <PondButton
          colorPalette="lilypad"
          color="white"
          onClick={() => setShowAddMeal(true)}
          disabled={showAddMeal}
        >
          Add meal
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
            <MealMealsFilterPanel
              listQ={listQ}
              onListQChange={setListQ}
              listTags={listTags}
              onListTagsChange={setListTags}
              sort={sort}
              onSortChange={setSort}
              listIngredientQ={listIngredientQ}
              onListIngredientQChange={setListIngredientQ}
              mealTypeFilter={mealTypeFilter}
              onMealTypeFilterChange={setMealTypeFilter}
              cuisineFilter={cuisineFilter}
              onCuisineFilterChange={setCuisineFilter}
              timeFilter={timeFilter}
              onTimeFilterChange={setTimeFilter}
              mealTypeOpts={mealTypeOpts}
              cuisineOpts={cuisineOpts}
              timeOpts={timeOpts}
              getApiAccessToken={getApiAccessToken}
              setMealTypeOpts={(next) => {
                const added = typeof next === "function" ? next(mealTypeOpts) : next;
                for (const o of added) {
                  addCategoryOption({ id: o.id, name: o.name, axis: "meal_type" });
                }
              }}
              setCuisineOpts={(next) => {
                const added = typeof next === "function" ? next(cuisineOpts) : next;
                for (const o of added) {
                  addCategoryOption({ id: o.id, name: o.name, axis: "cuisine" });
                }
              }}
              setTimeOpts={(next) => {
                const added = typeof next === "function" ? next(timeOpts) : next;
                for (const o of added) {
                  addCategoryOption({ id: o.id, name: o.name, axis: "time" });
                }
              }}
            />
          </Box>
        </Collapsible.Content>
      </Collapsible.Root>

      {err ? (
        <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
          {err}
        </Text>
      ) : null}

      <SimpleGrid columns={{ base: 1, md: 2 }} gap="2" w="100%" alignItems="stretch">
        {meals.map((m) => (
          <MealListRow
            key={m.id}
            meal={m}
            ownerLabel={mealOwnerLabel(m.owner_user, sessionUser)}
            getApiAccessToken={getApiAccessToken}
            pantryEnabled={sessionUser.profile.meal_pantry_enabled ?? false}
          />
        ))}
      </SimpleGrid>

      {meals.length === 0 ? (
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
          No meals match your filters.
        </Text>
      ) : null}

      {showAddMeal ? (
        <MealEditorBackdropDismiss disabled={saveBusy || importBusy || paprikaBusy} onDismiss={dismissAddMeal}>
          <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
            <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
              <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
                <Stack gap="2" w="100%" pb="3">
                  <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                    Import from a recipe URL (ingredients and directions are filled automatically).
                  </Text>
                  <HStack gap="2" flexWrap="wrap" align="flex-end" w="100%">
                    <Input
                      flex="1"
                      minW="min(100%, 12rem)"
                      type="url"
                      placeholder="https://…"
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      disabled={importBusy || saveBusy || paprikaBusy}
                      {...PANEL_FIELD_PROPS}
                    />
                    <PondButton
                      colorPalette="sky"
                      loading={importBusy}
                      disabled={importBusy || saveBusy || paprikaBusy || !importUrl.trim()}
                      onClick={() => {
                        void (async () => {
                          setImportBusy(true);
                          try {
                            const t = await getApiAccessToken();
                            const created = await importMealFromUrl(t, importUrl.trim());
                            upsertMeal(created);
                            dismissAddMeal();
                            setErr(null);
                            navigate(`/meal/meals/${created.id}`);
                          } catch (e) {
                            setErr(e instanceof Error ? e.message : "Import failed");
                          } finally {
                            setImportBusy(false);
                          }
                        })();
                      }}
                    >
                      Import from URL
                    </PondButton>
                  </HStack>
                  <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" pt="2">
                    Import a Paprika backup: one or more recipes from a{" "}
                    <Text as="span" fontWeight="medium">
                      .paprikarecipes
                    </Text>{" "}
                    zip or a single{" "}
                    <Text as="span" fontWeight="medium">
                      .paprikarecipe
                    </Text>{" "}
                    file (photos included when present).
                  </Text>
                  <input
                    ref={paprikaInputRef}
                    type="file"
                    accept=".paprikarecipes,.paprikarecipe,.zip,application/zip"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      void (async () => {
                        setPaprikaBusy(true);
                        try {
                          const t = await getApiAccessToken();
                          const res = await importPaprikaRecipes(t, file);
                          for (const meal of res.meals) upsertMeal(meal);
                          dismissAddMeal();
                          if (res.errors.length > 0) {
                            setErr(
                              `Imported ${res.imported_count} recipe(s); ${res.errors.length} skipped.`,
                            );
                          } else {
                            setErr(null);
                          }
                          if (res.meals.length === 1) {
                            navigate(`/meal/meals/${res.meals[0].id}`);
                          }
                        } catch (importErr) {
                          setErr(importErr instanceof Error ? importErr.message : "Paprika import failed");
                        } finally {
                          setPaprikaBusy(false);
                        }
                      })();
                    }}
                  />
                  <PondButton
                    colorPalette="sky"
                    variant="outline"
                    loading={paprikaBusy}
                    disabled={paprikaBusy || saveBusy || importBusy}
                    alignSelf="flex-start"
                    onClick={() => paprikaInputRef.current?.click()}
                  >
                    Choose Paprika file…
                  </PondButton>
                </Stack>
                <MealEditorForm
                  title={title}
                  blurb={blurb}
                  directions={directions}
                  ingredientsText={ingredientsText}
                  onTitleChange={setTitle}
                  onBlurbChange={setBlurb}
                  onDirectionsChange={setDirections}
                  onIngredientsTextChange={setIngredientsText}
                  recipeImage={
                    <MealImageField
                      imageKey={draftImageKey}
                      imageUrl=""
                      onImageKeyChange={setDraftImageKey}
                      getApiAccessToken={getApiAccessToken}
                      disabled={saveBusy || importBusy || paprikaBusy}
                    />
                  }
                  saveDisabled={!title.trim()}
                  saveLoading={saveBusy}
                  onSave={() => {
                    void (async () => {
                      if (!title.trim()) return;
                      setSaveBusy(true);
                      try {
                        const t = await getApiAccessToken();
                        const created = await createMeal(t, {
                          title: title.trim(),
                          blurb,
                          directions,
                          ingredients: linesToIngredients(ingredientsText),
                          ...(draftImageKey.trim() ? { image_key: draftImageKey.trim() } : {}),
                        });
                        upsertMeal(created);
                        dismissAddMeal();
                        setErr(null);
                      } catch (e) {
                        setErr(e instanceof Error ? e.message : "Save failed");
                      } finally {
                        setSaveBusy(false);
                      }
                    })();
                  }}
                />
              </Card.Body>
            </Card.Root>
          </Stack>
        </MealEditorBackdropDismiss>
      ) : null}
    </Stack>
  );
}

function mealIngredientSummary(meal: MealListEntry): string {
  if (!meal.ingredients?.length) return "No ingredients";
  return `${meal.ingredients.length} ingredients`;
}

function MealListRow({
  meal,
  ownerLabel,
  getApiAccessToken,
  pantryEnabled,
}: {
  meal: MealListEntry;
  ownerLabel: string;
  getApiAccessToken: () => Promise<string>;
  pantryEnabled: boolean;
}) {
  const ingredientSummary = mealIngredientSummary(meal);
  const thumb = (meal.image_url ?? "").trim();
  const fromLabel = meal.author_display?.trim()
    ? `From ${meal.author_display.trim()}`
    : ownerLabel;
  const planSlotSummary = mealPlanSlotSummary(meal);
  const coveragePct = meal.pantry_coverage_pct;
  const showCoverage =
    pantryEnabled && coveragePct != null && typeof coveragePct === "number";
  return (
    <RouterLink
      to={`/meal/meals/${meal.id}`}
      aria-label={`Open meal: ${mealLabel(meal)}`}
      style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}
    >
      <HStack
        {...PANEL_NESTED_BLOCK_PROPS}
        {...MEAL_NAV_LINK_CARD_PROPS}
        bg="bg"
        gap="3"
        align="center"
        p="2"
        h="100%"
        minH="4.5rem"
      >
        <Box
          position="relative"
          w="4rem"
          h="4rem"
          flexShrink={0}
          borderRadius="md"
          overflow="hidden"
          bg="bg.subtle"
          borderWidth="1px"
          borderColor="border"
        >
          {thumb ? (
            <PresignedImage
              position="absolute"
              inset="0"
              src={thumb}
              imageKey={meal.image_key}
              getApiAccessToken={getApiAccessToken}
              alt=""
              w="100%"
              h="100%"
              objectFit="cover"
            />
          ) : null}
        </Box>
        <Stack gap="0.5" minW="0" flex="1">
          <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.body} lineClamp={2}>
            {mealLabel(meal)}
          </Text>
          <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" lineClamp={1}>
            {fromLabel} · {ingredientSummary}
          </Text>
          {planSlotSummary ? (
            <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" lineClamp={1}>
              {planSlotSummary}
            </Text>
          ) : null}
          {showCoverage ? <MealPantryCoverageBadge pct={coveragePct} variant="chip" /> : null}
          <MealTagsCategoriesChips meal={meal} maxTags={4} />
        </Stack>
      </HStack>
    </RouterLink>
  );
}
