import { Card, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink, Navigate } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { useIsMobile } from "../responsive";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  MEAL_NAV_LINK_CARD_PROPS,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { createMeal, fetchMeals } from "./api";
import { MealEditorBackdropDismiss } from "./MealEditorBackdropDismiss";
import { MealEditorForm } from "./MealEditorForm";
import { mealLabel } from "./mealLabels";
import { mealOwnerLabel } from "./mealOwnerLabel";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import { linesToIngredients } from "./recipeIngredients";
import type { Meal } from "./types";

export default function MealMealsPage() {
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
  const isMobile = useIsMobile();

  const dismissAddMeal = useCallback(() => {
    setTitle("");
    setBlurb("");
    setDirections("");
    setIngredientsText("");
    setShowAddMeal(false);
  }, []);

  const refresh = useCallback(async () => {
    const t = await getApiAccessToken();
    const m = await fetchMeals(t);
    setMeals(m);
  }, [getApiAccessToken]);

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
        Build meals with ingredients and directions, then assign them in templates and week plans.
      </Text>
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
        <MealEditorBackdropDismiss disabled={saveBusy} onDismiss={dismissAddMeal}>
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
                <MealEditorForm
                title={title}
                blurb={blurb}
                directions={directions}
                ingredientsText={ingredientsText}
                onTitleChange={setTitle}
                onBlurbChange={setBlurb}
                onDirectionsChange={setDirections}
                onIngredientsTextChange={setIngredientsText}
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
        alignItems="start"
      >
        {meals.map((m) => (
          <MealListCard
            key={m.id}
            meal={m}
            ownerLabel={mealOwnerLabel(m.owner_user, sessionUser)}
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

function MealListCard({ meal, ownerLabel }: { meal: Meal; ownerLabel: string }) {
  const ingredientSummary = mealIngredientSummary(meal);
  return (
    <RouterLink
      to={`/meal/plan/meals/${meal.id}`}
      aria-label={`Open meal: ${mealLabel(meal)}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0" {...MEAL_NAV_LINK_CARD_PROPS}>
        <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
          <Stack gap="1" minW="0">
            <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.body} lineClamp={2}>
              {mealLabel(meal)}
            </Text>
            <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" lineClamp={1}>
              {ownerLabel} · {ingredientSummary}
            </Text>
          </Stack>
        </Card.Body>
      </Card.Root>
    </RouterLink>
  );
}
