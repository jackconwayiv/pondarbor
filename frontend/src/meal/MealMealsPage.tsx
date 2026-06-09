import { Box, Card, HStack, Input, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import PondNativeSelect from "../components/PondNativeSelect";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { useIsMobile } from "../responsive";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  MEAL_NAV_LINK_CARD_PROPS,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FIELD_PROPS,
} from "../theme/typography";
import {
  createMeal,
  fetchMealCategoryOptions,
  fetchMeals,
  importMealFromUrl,
  importPaprikaRecipes,
} from "./api";
import type { MealListQuery } from "./api";
import { MealEditorBackdropDismiss } from "./MealEditorBackdropDismiss";
import { MealEditorForm } from "./MealEditorForm";
import { MealImageField } from "./MealImageField";
import PresignedImage from "../lib/PresignedImage";
import { mealLabel } from "./mealLabels";
import { mealOwnerLabel } from "./mealOwnerLabel";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import { MealCategoryAddEditor } from "./MealCategoryAddEditor";
import { MealCategorySelect } from "./MealCategorySelect";
import { linesToIngredients } from "./recipeIngredients";
import type { Meal } from "./types";

const MEALS_TOOLBAR_SECTION_LABEL_PROPS = {
  fontSize: APP_TEXT_SIZES.helper,
  fontWeight: "semibold" as const,
  color: "fg.muted",
};

export default function MealMealsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, sessionUser, getApiAccessToken, refreshSession } =
    useAppSession();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [title, setTitle] = useState("");
  const [blurb, setBlurb] = useState("");
  const [directions, setDirections] = useState("");
  const [ingredientsText, setIngredientsText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [showAddMeal, setShowAddMeal] = useState(false);
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
  const [sort, setSort] = useState<MealListQuery["sort"]>("updated_at");
  const [mealTypeOpts, setMealTypeOpts] = useState<{ id: number; name: string }[]>([]);
  const [cuisineOpts, setCuisineOpts] = useState<{ id: number; name: string }[]>([]);
  const [timeOpts, setTimeOpts] = useState<{ id: number; name: string }[]>([]);
  const paprikaInputRef = useRef<HTMLInputElement | null>(null);
  const isMobile = useIsMobile();

  const dismissAddMeal = useCallback(() => {
    setTitle("");
    setBlurb("");
    setDirections("");
    setIngredientsText("");
    setImportUrl("");
    setDraftImageKey("");
    setShowAddMeal(false);
  }, []);

  const refresh = useCallback(async () => {
    const t = await getApiAccessToken();
    const q: MealListQuery = { sort: sort ?? "updated_at" };
    if (listQ.trim()) q.q = listQ.trim();
    if (listIngredientQ.trim()) q.ingredient_q = listIngredientQ.trim();
    if (listTags.trim()) q.tags = listTags.trim();
    if (mealTypeFilter) q.meal_type_id = Number(mealTypeFilter);
    if (cuisineFilter) q.cuisine_id = Number(cuisineFilter);
    if (timeFilter) q.time_id = Number(timeFilter);
    const m = await fetchMeals(t, q);
    setMeals(m);
  }, [
    getApiAccessToken,
    listQ,
    listIngredientQ,
    listTags,
    mealTypeFilter,
    cuisineFilter,
    timeFilter,
    sort,
  ]);

  useEffect(() => {
    if (!sessionUser?.user.is_approved) return;
    void (async () => {
      try {
        const t = await getApiAccessToken();
        const [mt, cu, tm] = await Promise.all([
          fetchMealCategoryOptions(t, "meal_type"),
          fetchMealCategoryOptions(t, "cuisine"),
          fetchMealCategoryOptions(t, "time"),
        ]);
        setMealTypeOpts(mt.map((o) => ({ id: o.id, name: o.name })));
        setCuisineOpts(cu.map((o) => ({ id: o.id, name: o.name })));
        setTimeOpts(tm.map((o) => ({ id: o.id, name: o.name })));
      } catch {
        // ignore vocab load errors; filters still work by id
      }
    })();
  }, [sessionUser?.user.is_approved, getApiAccessToken]);

  useEffect(() => {
    if (!sessionUser?.user.is_approved) return;
    const tid = window.setTimeout(() => {
      void refresh().catch((e) => setErr(e instanceof Error ? e.message : "Load failed"));
    }, 0);
    return () => window.clearTimeout(tid);
  }, [sessionUser?.user.is_approved, refresh]);

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
      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
        Build meals with ingredients and directions, then assign them on the Plan tab.
      </Text>
      <Text fontSize={APP_TEXT_SIZES.helper}>
        <RouterLink to="/meal/shared">
          <Text as="span" color="teal.solid" fontWeight="bold">
            Shared meals
          </Text>
        </RouterLink>{" "}
        <Text as="span" color="fg.muted">
          from your meal partner
        </Text>
      </Text>

      <Stack gap="3" w="100%">
        <SimpleGrid columns={3} gap={{ base: "2", md: "3" }} w="100%" alignItems="flex-start">
          <Stack gap="2" w="100%" minW={0}>
            <Text {...MEALS_TOOLBAR_SECTION_LABEL_PROPS}>Search</Text>
            <Input
              w="100%"
              placeholder="Search title & recipe text"
              value={listQ}
              onChange={(e) => setListQ(e.target.value)}
              {...PANEL_FIELD_PROPS}
            />
          </Stack>
          <Stack gap="2" w="100%" minW={0}>
            <Text {...MEALS_TOOLBAR_SECTION_LABEL_PROPS}>Tags</Text>
            <Input
              w="100%"
              placeholder="Comma-separated, AND"
              value={listTags}
              onChange={(e) => setListTags(e.target.value)}
              {...PANEL_FIELD_PROPS}
            />
          </Stack>
          <Stack gap="2" w="100%" minW={0}>
            <Text {...MEALS_TOOLBAR_SECTION_LABEL_PROPS}>Sort</Text>
            <PondNativeSelect
              rootProps={{ size: "sm", maxW: "xs", w: "100%" }}
              fieldProps={{
                value: sort ?? "updated_at",
                onChange: (e) => setSort(e.target.value as MealListQuery["sort"]),
                "aria-label": "Sort",
              }}
            >
              <option value="updated_at">Recently updated</option>
              <option value="title">Title A–Z</option>
              <option value="upcoming_slot_count">Most upcoming plans</option>
            </PondNativeSelect>
          </Stack>
        </SimpleGrid>

        <Stack
          gap="2"
          w="100%"
          pb="3"
          borderBottomWidth="1px"
          borderColor="border"
        >
          <Text {...MEALS_TOOLBAR_SECTION_LABEL_PROPS}>Categories</Text>
          <Stack gap="2" w="100%" maxW="md">
            <Text {...MEALS_TOOLBAR_SECTION_LABEL_PROPS}>Ingredient contains</Text>
            <Input
              w="100%"
              placeholder="Match ingredient lines"
              value={listIngredientQ}
              onChange={(e) => setListIngredientQ(e.target.value)}
              {...PANEL_FIELD_PROPS}
            />
          </Stack>
          <HStack gap="2" flexWrap="wrap" align="flex-start" w="100%">
            <Stack gap="2" flex="1" minW={0}>
              <Text {...MEALS_TOOLBAR_SECTION_LABEL_PROPS}>Meal type</Text>
              <MealCategorySelect
                placeholderOption="All meal types"
                ariaLabel="Meal type filter"
                value={mealTypeFilter}
                onValueChange={setMealTypeFilter}
                options={mealTypeOpts}
                size="sm"
              />
            </Stack>
            <Stack gap="2" flex="1" minW={0}>
              <Text {...MEALS_TOOLBAR_SECTION_LABEL_PROPS}>Cuisine</Text>
              <MealCategorySelect
                placeholderOption="All cuisines"
                ariaLabel="Cuisine filter"
                value={cuisineFilter}
                onValueChange={setCuisineFilter}
                options={cuisineOpts}
                size="sm"
              />
            </Stack>
            <Stack gap="2" flex="1" minW={0}>
              <Text {...MEALS_TOOLBAR_SECTION_LABEL_PROPS}>Time</Text>
              <MealCategorySelect
                placeholderOption="All times"
                ariaLabel="Time filter"
                value={timeFilter}
                onValueChange={setTimeFilter}
                options={timeOpts}
                size="sm"
              />
            </Stack>
            <Stack
              gap="2"
              w={{ base: "100%", md: "auto" }}
              minW={{ md: "11rem" }}
              maxW={{ md: "sm" }}
              flexShrink={0}
            >
              <Text
                {...MEALS_TOOLBAR_SECTION_LABEL_PROPS}
                display={{ base: "none", md: "block" }}
                visibility="hidden"
                aria-hidden
              >
                Meal type
              </Text>
              <MealCategoryAddEditor
                getApiAccessToken={getApiAccessToken}
                size="sm"
                triggerLabels={{ closed: "Add Category", open: "Close" }}
                mealTypeOpts={mealTypeOpts}
                cuisineOpts={cuisineOpts}
                timeOpts={timeOpts}
                setMealTypeOpts={setMealTypeOpts}
                setCuisineOpts={setCuisineOpts}
                setTimeOpts={setTimeOpts}
                pickMealType={setMealTypeFilter}
                pickCuisine={setCuisineFilter}
                pickTime={setTimeFilter}
              />
            </Stack>
          </HStack>
        </Stack>
      </Stack>

      {!showAddMeal ? (
        <PondButton
          colorPalette="sky"
          variant="outline"
          alignSelf="flex-start"
          onClick={() => setShowAddMeal(true)}
        >
          Add New Meal
        </PondButton>
      ) : null}

      {showAddMeal ? (
        <MealEditorBackdropDismiss disabled={saveBusy || importBusy || paprikaBusy} onDismiss={dismissAddMeal}>
          <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
            <PondButton
              colorPalette="sky"
              variant="outline"
              alignSelf="flex-start"
              onClick={() => dismissAddMeal()}
            >
              Hide
            </PondButton>
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
                            dismissAddMeal();
                            await refresh();
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
                          dismissAddMeal();
                          await refresh();
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
                        } catch (err) {
                          setErr(err instanceof Error ? err.message : "Paprika import failed");
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
                      await createMeal(t, {
                        title: title.trim(),
                        blurb,
                        directions,
                        ingredients: linesToIngredients(ingredientsText),
                        ...(draftImageKey.trim() ? { image_key: draftImageKey.trim() } : {}),
                      });
                      dismissAddMeal();
                      await refresh();
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

      {err ? (
        <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
          {err}
        </Text>
      ) : null}

      <SimpleGrid
        columns={isMobile ? 2 : 3}
        gap={MAPPED_CLOSET_TAB_STACK_GAP}
        w="100%"
        alignItems="stretch"
      >
        {meals.map((m) => (
          <MealListCard
            key={m.id}
            meal={m}
            ownerLabel={mealOwnerLabel(m.owner_user, sessionUser)}
            getApiAccessToken={getApiAccessToken}
          />
        ))}
      </SimpleGrid>
    </Stack>
  );
}

function mealIngredientSummary(meal: Meal): string {
  if (!meal.ingredients?.length) return "No ingredients";
  return `${meal.ingredients.length} ingredients`;
}

function MealListCard({
  meal,
  ownerLabel,
  getApiAccessToken,
}: {
  meal: Meal;
  ownerLabel: string;
  getApiAccessToken: () => Promise<string>;
}) {
  const ingredientSummary = mealIngredientSummary(meal);
  const thumb = (meal.image_url ?? "").trim();
  return (
    <RouterLink
      to={`/meal/meals/${meal.id}`}
      aria-label={`Open meal: ${mealLabel(meal)}`}
      style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}
    >
      <Card.Root
        {...PANEL_ENTRY_CARD_PROPS}
        p="0"
        {...MEAL_NAV_LINK_CARD_PROPS}
        overflow="hidden"
        h="100%"
        display="flex"
        flexDirection="column"
      >
        <Box
          position="relative"
          w="100%"
          aspectRatio="4 / 3"
          minH="0"
          flexShrink={0}
          bg="bg.subtle"
          borderBottomWidth="1px"
          borderColor="border"
          overflow="hidden"
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
        <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS} flex="1" display="flex" flexDirection="column">
          <Stack gap="1" minW="0" flex="1">
            <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.body} lineClamp={2}>
              {mealLabel(meal)}
            </Text>
            <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" lineClamp={1}>
              {ownerLabel} · {ingredientSummary}
              {(meal.upcoming_slot_count ?? 0) > 0
                ? ` · Planned ${meal.upcoming_slot_count}×`
                : ""}
            </Text>
            {(meal.tag_names?.length ?? 0) > 0 ? (
              <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" lineClamp={2}>
                {meal.tag_names!.slice(0, 4).join(" · ")}
                {(meal.tag_names!.length ?? 0) > 4 ? "…" : ""}
              </Text>
            ) : null}
          </Stack>
        </Card.Body>
      </Card.Root>
    </RouterLink>
  );
}
