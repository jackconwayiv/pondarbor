import { Box, Card, Heading, HStack, Image, Stack, Tabs, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { deleteMeal, fetchMeal, patchMeal } from "./api";
import { MealEditorBackdropDismiss } from "./MealEditorBackdropDismiss";
import { MealEditorForm } from "./MealEditorForm";
import { mealOwnerLabel } from "./mealOwnerLabel";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import { linesToIngredients } from "./recipeIngredients";
import type { Meal } from "./types";

const MEAL_DETAIL_TAB_LIST_PROPS = {
  px: { base: "2", md: "2" } as const,
  pt: "0",
  pb: "0",
  borderBottomWidth: "1px",
  borderColor: "border",
  gap: "1",
  w: "100%",
};

function mealDetailTabTriggerProps(activeTab: string, value: string) {
  return {
    value,
    bg: activeTab === value ? "lilypad.solid" : undefined,
    color: activeTab === value ? "black" : undefined,
    borderTopRadius: "md" as const,
    borderBottomRadius: "0" as const,
    px: "2",
    py: "2",
    fontWeight: "medium" as const,
    _hover: {
      bg: activeTab === value ? "lilypad.solid" : "transparent",
    },
    _selected: { bg: "lilypad.solid", color: "black" },
  };
}

export default function MealMealDetailPage() {
  const { id } = useParams();
  const mid = id ? Number(id) : Number.NaN;
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, sessionUser, getApiAccessToken, refreshSession } =
    useAppSession();
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
  }, [getApiAccessToken, mid]);

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
    const unchanged =
      title === meal.title &&
      blurb === meal.blurb &&
      (directions ?? "") === (meal.directions ?? "") &&
      ingredients.length === meal.ingredients.length &&
      ingredients.every((ing, i) => ing.raw_line === meal.ingredients[i]?.raw_line);
    if (unchanged) return;

    setPatchBusy(true);
    try {
      const t = await getApiAccessToken();
      const next = await patchMeal(t, meal.id, {
        title,
        blurb,
        directions,
        ingredients,
      });
      setMeal(next);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
      throw e;
    } finally {
      setPatchBusy(false);
    }
  }, [meal, mealTitle, blurb, directions, ingredientsText, getApiAccessToken]);

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
          <Text as="span" color="lilypad.solid" fontWeight="bold">
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
                <HStack gap="2">
                  <PondButton colorPalette="lilypad" onClick={() => setIsEditing(true)}>
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
            <MealEditorForm
              title={mealTitle}
              blurb={blurb}
              directions={directions}
              ingredientsText={ingredientsText}
              onTitleChange={setMealTitle}
              onBlurbChange={setBlurb}
              onDirectionsChange={setDirections}
              onIngredientsTextChange={setIngredientsText}
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
          ) : null}
          {!isEditing ? (
            <Tabs.Root
              value={activeTab}
              onValueChange={(details) => setTab(details.value)}
              variant="plain"
            >
              <Tabs.List {...MEAL_DETAIL_TAB_LIST_PROPS}>
                {hasIngredients ? (
                  <Tabs.Trigger {...mealDetailTabTriggerProps(activeTab, "ingredients")}>
                    Ingredients
                  </Tabs.Trigger>
                ) : null}
                {hasDirections ? (
                  <Tabs.Trigger {...mealDetailTabTriggerProps(activeTab, "directions")}>
                    Directions
                  </Tabs.Trigger>
                ) : null}
                <Tabs.Trigger {...mealDetailTabTriggerProps(activeTab, "details")}>Details</Tabs.Trigger>
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
    </Stack>
  );
}
