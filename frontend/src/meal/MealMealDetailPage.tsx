import {
  Box,
  Card,
  Heading,
  HStack,
  Image,
  Input,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import {
  APP_SHELL_TAB_LIST_NESTED_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FIELD_PROPS,
} from "../theme/typography";
import { deleteMeal, fetchMeal, fetchMealCategoryOptions, patchMeal } from "./api";
import { MealCategoryAddEditor } from "./MealCategoryAddEditor";
import { MealCategorySelect } from "./MealCategorySelect";
import { MealAddToWeekDialog } from "./MealAddToWeekDialog";
import { MealEditorBackdropDismiss } from "./MealEditorBackdropDismiss";
import { MealEditorForm } from "./MealEditorForm";
import { MealImageField } from "./MealImageField";
import { publicUrlForR2ImageKey } from "./imagePublicUrl";
import { mealOwnerLabel } from "./mealOwnerLabel";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import { linesToIngredients } from "./recipeIngredients";
import type { Meal } from "./types";

const MEAL_DETAIL_TAB_LIST_PROPS = {
  ...APP_SHELL_TAB_LIST_NESTED_PROPS,
  px: { base: "2", md: "2" } as const,
} as const;

function parseTagList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function tagsMatch(a: string[] | undefined, b: string[]): boolean {
  const x = [...(a ?? [])].map((t) => t.toLowerCase()).sort();
  const y = [...b].map((t) => t.toLowerCase()).sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

export default function MealMealDetailPage() {
  const { id } = useParams();
  const mid = id ? Number(id) : Number.NaN;
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, sessionUser, getApiAccessToken, refreshSession } =
    useAppSession();
  const [addToPlanOpen, setAddToPlanOpen] = useState(false);
  const [addToPlanNotice, setAddToPlanNotice] = useState<string | null>(null);
  const [meal, setMeal] = useState<Meal | null>(null);
  const [mealTitle, setMealTitle] = useState("");
  const [blurb, setBlurb] = useState("");
  const [directions, setDirections] = useState("");
  const [ingredientsText, setIngredientsText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [patchBusy, setPatchBusy] = useState(false);
  const [draftImageKey, setDraftImageKey] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [mealTypeId, setMealTypeId] = useState("");
  const [cuisineId, setCuisineId] = useState("");
  const [timeId, setTimeId] = useState("");
  const [published, setPublished] = useState(false);
  const [mealTypeOpts, setMealTypeOpts] = useState<{ id: number; name: string }[]>([]);
  const [cuisineOpts, setCuisineOpts] = useState<{ id: number; name: string }[]>([]);
  const [timeOpts, setTimeOpts] = useState<{ id: number; name: string }[]>([]);
  const confirmDeleteButtonRef = useRef<HTMLButtonElement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const load = useCallback(async () => {
    const t = await getApiAccessToken();
    const m = await fetchMeal(t, mid);
    setErr(null);
    setMeal(m);
    setMealTitle(m.title);
    setBlurb(m.blurb);
    setDirections(m.directions ?? "");
    setIngredientsText((m.ingredients ?? []).map((ing) => ing.raw_line).join("\n"));
    setDraftImageKey((m.image_key ?? "").trim());
    setTagsText((m.tag_names ?? []).join(", "));
    setMealTypeId(m.meal_type ? String(m.meal_type.id) : "");
    setCuisineId(m.cuisine ? String(m.cuisine.id) : "");
    setTimeId(m.time ? String(m.time.id) : "");
    setPublished(Boolean(m.is_published_to_friends));
  }, [getApiAccessToken, mid]);

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
        // ignore
      }
    })();
  }, [sessionUser?.user.is_approved, getApiAccessToken]);

  useEffect(() => {
    if (!sessionUser?.user.is_approved || !Number.isFinite(mid)) return;
    const timer = window.setTimeout(() => {
      void load().catch((e) => setErr(e instanceof Error ? e.message : "Load failed"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [sessionUser?.user.is_approved, mid, load]);

  const flushPatch = useCallback(async () => {
    if (!meal) return;
    const title = mealTitle.trim();
    if (!title) {
      setMealTitle(meal.title);
      return;
    }
    const ingredients = linesToIngredients(ingredientsText);
    const prevKey = (meal.image_key ?? "").trim();
    const nextKey = draftImageKey.trim();
    const tagNames = parseTagList(tagsText);
    const mtId = mealTypeId ? Number(mealTypeId) : null;
    const cuId = cuisineId ? Number(cuisineId) : null;
    const tmId = timeId ? Number(timeId) : null;
    const unchanged =
      title === meal.title &&
      blurb === meal.blurb &&
      (directions ?? "") === (meal.directions ?? "") &&
      ingredients.length === meal.ingredients.length &&
      ingredients.every((ing, i) => ing.raw_line === meal.ingredients[i]?.raw_line) &&
      nextKey === prevKey &&
      tagsMatch(meal.tag_names, tagNames) &&
      (meal.meal_type?.id ?? null) === mtId &&
      (meal.cuisine?.id ?? null) === cuId &&
      (meal.time?.id ?? null) === tmId &&
      Boolean(meal.is_published_to_friends) === published;
    if (unchanged) return;

    setPatchBusy(true);
    try {
      const t = await getApiAccessToken();
      const next = await patchMeal(t, meal.id, {
        title,
        blurb,
        directions,
        ingredients,
        image_key: nextKey,
        tag_names: tagNames,
        meal_type_id: mtId,
        cuisine_id: cuId,
        time_id: tmId,
        is_published_to_friends: published,
      });
      setMeal(next);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
      throw e;
    } finally {
      setPatchBusy(false);
    }
  }, [
    meal,
    mealTitle,
    blurb,
    directions,
    ingredientsText,
    draftImageKey,
    tagsText,
    mealTypeId,
    cuisineId,
    timeId,
    published,
    getApiAccessToken,
  ]);

  const dismissToMealsList = useCallback(async () => {
    setConfirmDelete(false);
    if (isEditing) {
      try {
        await flushPatch();
      } catch {
        return;
      }
    }
    navigate("/meal/plan/meals");
  }, [isEditing, flushPatch, navigate]);

  if (isLoading) return <MealLoading />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser) {
    return <MealSessionReconnect onRetry={() => void refreshSession()} />;
  }
  if (!sessionUser.user.is_approved) {
    return <MealApprovalRequired />;
  }
  if (!Number.isFinite(mid)) {
    return (
      <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
        Invalid meal.
      </Text>
    );
  }
  if (!meal) {
    return err ? (
      <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
        {err}
      </Text>
    ) : (
      <MealLoading />
    );
  }

  const ownerLabel = mealOwnerLabel(meal.owner_user, sessionUser);
  const hasIngredients = meal.ingredients.length > 0;
  const hasDirections = Boolean(meal.directions?.trim());
  const defaultTab = hasIngredients ? "ingredients" : hasDirections ? "directions" : "details";
  const activeTab = searchParams.get("tab") ?? defaultTab;
  function setTab(tab: string) {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  }

  return (
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
      <Text fontSize={APP_TEXT_SIZES.helper}>
        <RouterLink to="/meal/plan/meals">
          <Text as="span" color="teal.solid" fontWeight="bold">
            ← All meals
          </Text>
        </RouterLink>
      </Text>

      <MealEditorBackdropDismiss
        disabled={deleteBusy || patchBusy}
        onDismiss={dismissToMealsList}
      >
        <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
        <Card.Body
          {...PANEL_ENTRY_CARD_BODY_PROPS}
          onPointerDownCapture={(event) => {
            if (!confirmDelete) return;
            const target = event.target as Node | null;
            if (!target) return;
            if (confirmDeleteButtonRef.current?.contains(target)) return;
            setConfirmDelete(false);
          }}
        >
          {!isEditing ? (
            <>
              <HStack justify="space-between" mb="2" flexWrap="wrap" gap="2">
                <Heading size="sm" fontWeight="semibold">
                  {mealTitle.trim() || "Meal"}
                </Heading>
                <HStack gap="2" flexWrap="wrap">
                  <PondButton
                    colorPalette="sky"
                    variant="outline"
                    onClick={() => {
                      setAddToPlanNotice(null);
                      setAddToPlanOpen(true);
                    }}
                  >
                    Add to meal plan…
                  </PondButton>
                  <PondButton
                    colorPalette="teal"
                    onClick={() => {
                      setAddToPlanNotice(null);
                      setIsEditing(true);
                    }}
                  >
                    Edit
                  </PondButton>
                  <PondButton
                    ref={confirmDeleteButtonRef}
                    flexShrink={0}
                    colorPalette="nautical"
                    loading={deleteBusy}
                    disabled={deleteBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!confirmDelete) {
                        setConfirmDelete(true);
                        return;
                      }
                      void (async () => {
                        setDeleteBusy(true);
                        try {
                          const t = await getApiAccessToken();
                          await deleteMeal(t, meal.id);
                          navigate("/meal/plan/meals");
                        } catch (e) {
                          setErr(e instanceof Error ? e.message : "Delete failed");
                        } finally {
                          setDeleteBusy(false);
                        }
                      })();
                    }}
                  >
                    {confirmDelete ? "Confirm Delete" : "Delete"}
                  </PondButton>
                </HStack>
              </HStack>
              {addToPlanNotice ? (
                <Box
                  mb="3"
                  w="100%"
                  bg="teal.solid"
                  color="black"
                  borderRadius="md"
                  px="2"
                  py="2"
                >
                  <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
                    {addToPlanNotice}
                  </Text>
                </Box>
              ) : null}
              {meal.image_url?.trim() ? (
                <Box mb="3" maxW="sm" w="100%">
                  <Image
                    src={meal.image_url}
                    alt=""
                    maxH="14rem"
                    w="100%"
                    objectFit="cover"
                    borderRadius="md"
                  />
                </Box>
              ) : null}
            </>
          ) : null}
          {isEditing ? (
            <Stack gap="3" w="100%">
              <Stack gap="2" w="100%">
                <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="semibold">
                  Tags & categories
                </Text>
                <Input
                  placeholder="Tags (comma-separated)"
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  onBlur={() => void flushPatch().catch(() => {})}
                  disabled={deleteBusy || patchBusy}
                  {...PANEL_FIELD_PROPS}
                />
                <MealCategoryAddEditor
                  getApiAccessToken={getApiAccessToken}
                  disabled={deleteBusy || patchBusy}
                  mealTypeOpts={mealTypeOpts}
                  cuisineOpts={cuisineOpts}
                  timeOpts={timeOpts}
                  setMealTypeOpts={setMealTypeOpts}
                  setCuisineOpts={setCuisineOpts}
                  setTimeOpts={setTimeOpts}
                  pickMealType={setMealTypeId}
                  pickCuisine={setCuisineId}
                  pickTime={setTimeId}
                />
                <SimpleGrid columns={{ base: 1, md: 3 }} gap="3" w="100%">
                  <MealCategorySelect
                    placeholderOption="Meal type"
                    ariaLabel="Meal type"
                    value={mealTypeId}
                    onValueChange={setMealTypeId}
                    options={mealTypeOpts}
                    disabled={deleteBusy || patchBusy}
                  />
                  <MealCategorySelect
                    placeholderOption="Cuisine"
                    ariaLabel="Cuisine"
                    value={cuisineId}
                    onValueChange={setCuisineId}
                    options={cuisineOpts}
                    disabled={deleteBusy || patchBusy}
                  />
                  <MealCategorySelect
                    placeholderOption="Time"
                    ariaLabel="Time"
                    value={timeId}
                    onValueChange={setTimeId}
                    options={timeOpts}
                    disabled={deleteBusy || patchBusy}
                  />
                </SimpleGrid>
                <HStack gap="2" alignItems="center" flexWrap="wrap">
                  <label
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      alignItems: "center",
                      cursor:
                        linesToIngredients(ingredientsText).length > 0 && directions.trim()
                          ? "pointer"
                          : "not-allowed",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={published}
                      disabled={
                        deleteBusy ||
                        patchBusy ||
                        !(linesToIngredients(ingredientsText).length > 0 && directions.trim())
                      }
                      onChange={(e) => setPublished(e.target.checked)}
                    />
                    <Text fontSize={APP_TEXT_SIZES.helper}>
                      Publish to friends (requires ingredients & directions)
                    </Text>
                  </label>
                </HStack>
              </Stack>
              <MealEditorForm
              title={mealTitle}
              blurb={blurb}
              directions={directions}
              ingredientsText={ingredientsText}
              onTitleChange={setMealTitle}
              onBlurbChange={setBlurb}
              onDirectionsChange={setDirections}
              onIngredientsTextChange={setIngredientsText}
              recipeImage={
                <MealImageField
                  imageKey={draftImageKey}
                  imageUrl={
                    (meal.image_url ?? "").trim() ||
                    (draftImageKey.trim() ? publicUrlForR2ImageKey(draftImageKey) : "")
                  }
                  onImageKeyChange={setDraftImageKey}
                  getApiAccessToken={getApiAccessToken}
                  disabled={deleteBusy || patchBusy}
                />
              }
              onBlurSave={flushPatch}
              saveDisabled={!mealTitle.trim()}
              saveLoading={patchBusy}
              disabled={deleteBusy}
              onSave={() => {
                void (async () => {
                  setConfirmDelete(false);
                  try {
                    await flushPatch();
                    setIsEditing(false);
                  } catch {
                    // err set in flushPatch
                  }
                })();
              }}
              trailingActions={
                <>
                  <PondButton
                    variant="outline"
                    disabled={patchBusy}
                    onClick={() => {
                      setMealTitle(meal.title);
                      setBlurb(meal.blurb);
                      setDirections(meal.directions ?? "");
                      setIngredientsText((meal.ingredients ?? []).map((ing) => ing.raw_line).join("\n"));
                      setDraftImageKey((meal.image_key ?? "").trim());
                      setTagsText((meal.tag_names ?? []).join(", "));
                      setMealTypeId(meal.meal_type ? String(meal.meal_type.id) : "");
                      setCuisineId(meal.cuisine ? String(meal.cuisine.id) : "");
                      setTimeId(meal.time ? String(meal.time.id) : "");
                      setPublished(Boolean(meal.is_published_to_friends));
                      setIsEditing(false);
                      setConfirmDelete(false);
                    }}
                  >
                    Cancel
                  </PondButton>
                  <PondButton
                    ref={confirmDeleteButtonRef}
                    flexShrink={0}
                    colorPalette="nautical"
                    loading={deleteBusy}
                    disabled={deleteBusy || patchBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!confirmDelete) {
                        setConfirmDelete(true);
                        return;
                      }
                      void (async () => {
                        setDeleteBusy(true);
                        try {
                          const t = await getApiAccessToken();
                          await deleteMeal(t, meal.id);
                          navigate("/meal/plan/meals");
                        } catch (e) {
                          setErr(e instanceof Error ? e.message : "Delete failed");
                        } finally {
                          setDeleteBusy(false);
                        }
                      })();
                    }}
                  >
                    {confirmDelete ? "Confirm Delete" : "Delete"}
                  </PondButton>
                </>
              }
            />
            </Stack>
          ) : null}
          {!isEditing ? (
            <Tabs.Root
              value={activeTab}
              onValueChange={(details) => setTab(details.value)}
              variant="plain"
            >
              <Tabs.List {...MEAL_DETAIL_TAB_LIST_PROPS}>
                {hasIngredients ? (
                  <Tabs.Trigger value="ingredients" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                    Ingredients
                  </Tabs.Trigger>
                ) : null}
                {hasDirections ? (
                  <Tabs.Trigger value="directions" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                    Directions
                  </Tabs.Trigger>
                ) : null}
                <Tabs.Trigger value="details" {...APP_SHELL_TAB_TRIGGER_PROPS}>
                  Details
                </Tabs.Trigger>
              </Tabs.List>
              {hasIngredients ? (
                <Tabs.Content value="ingredients">
                  <Stack as="ul" gap="1" pl="4" pt="2">
                    {meal.ingredients.map((ing) => (
                      <li key={ing.id}>{ing.raw_line}</li>
                    ))}
                  </Stack>
                </Tabs.Content>
              ) : null}
              {hasDirections ? (
                <Tabs.Content value="directions">
                  <Text whiteSpace="pre-wrap" pt="2">
                    {meal.directions}
                  </Text>
                </Tabs.Content>
              ) : null}
              <Tabs.Content value="details">
                <Stack gap="1" pt="2">
                  <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
                    Owner: {ownerLabel}
                  </Text>
                  {(meal.tag_names?.length ?? 0) > 0 ? (
                    <Text fontSize={APP_TEXT_SIZES.body}>
                      Tags: {meal.tag_names!.join(", ")}
                    </Text>
                  ) : null}
                  {[meal.meal_type, meal.cuisine, meal.time].filter(Boolean).length > 0 ? (
                    <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
                      {[meal.meal_type?.name, meal.cuisine?.name, meal.time?.name]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  ) : null}
                  {meal.is_published_to_friends ? (
                    <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
                      Published to friends
                    </Text>
                  ) : null}
                  {(meal.upcoming_slot_count ?? 0) > 0 ? (
                    <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
                      Planned {meal.upcoming_slot_count}× in upcoming weeks
                    </Text>
                  ) : null}
                  {meal.source_url?.trim() ? (
                    <Text fontSize={APP_TEXT_SIZES.body}>
                      <a href={meal.source_url} target="_blank" rel="noopener noreferrer">
                        View original recipe
                      </a>
                    </Text>
                  ) : null}
                  <Text>{meal.blurb?.trim() ? meal.blurb : "No details saved."}</Text>
                </Stack>
              </Tabs.Content>
            </Tabs.Root>
          ) : null}
        </Card.Body>
      </Card.Root>
      </MealEditorBackdropDismiss>

      {err ? (
        <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
          {err}
        </Text>
      ) : null}

      <MealAddToWeekDialog
        open={addToPlanOpen}
        onOpenChange={setAddToPlanOpen}
        mealId={meal.id}
        mealTitle={mealTitle}
        weekStartsOn={sessionUser.profile.meal_week_starts_on ?? 0}
        mealSlotLabels={sessionUser.profile.meal_slot_labels}
        getApiAccessToken={getApiAccessToken}
        onPlanUpdated={() => void refreshSession().catch(() => {})}
        onAddSuccess={setAddToPlanNotice}
      />
    </Stack>
  );
}
