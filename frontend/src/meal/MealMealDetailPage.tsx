import { Card, Heading, HStack, Input, Stack, Text, Textarea } from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate, useParams } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FIELD_PROPS,
} from "../theme/typography";
import { deleteMeal, fetchMeal, fetchRecipes, patchMeal } from "./api";
import MealRecipeIdsPicker from "./MealRecipeIdsPicker";
import { mealOwnerLabel } from "./mealOwnerLabel";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import type { Meal, Recipe } from "./types";

export default function MealMealDetailPage() {
  const { id } = useParams();
  const mid = id ? Number(id) : Number.NaN;
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, sessionUser, getApiAccessToken, refreshSession } =
    useAppSession();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [mealTitle, setMealTitle] = useState("");
  const [recipeIds, setRecipeIds] = useState<number[]>([]);
  const [blurb, setBlurb] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [recipeListBusy, setRecipeListBusy] = useState(false);
  const [recipeListErr, setRecipeListErr] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmDeleteButtonRef = useRef<HTMLButtonElement | null>(null);

  const load = useCallback(async () => {
    const t = await getApiAccessToken();
    const [m, r] = await Promise.all([fetchMeal(t, mid), fetchRecipes(t)]);
    setErr(null);
    setMeal(m);
    setRecipes(r);
    setMealTitle(m.title);
    setRecipeIds(m.recipes.map((x) => x.id));
    setBlurb(m.blurb);
  }, [getApiAccessToken, mid]);

  useEffect(() => {
    if (!sessionUser?.user.is_approved || !Number.isFinite(mid)) return;
    const timer = window.setTimeout(() => {
      void load().catch((e) => setErr(e instanceof Error ? e.message : "Load failed"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [sessionUser?.user.is_approved, mid, load]);

  const applyRecipeIds = useCallback(
    async (nextIds: number[]) => {
      const previousIds = recipeIds;
      setRecipeIds(nextIds);
      setRecipeListErr(null);
      setRecipeListBusy(true);
      try {
        const t = await getApiAccessToken();
        const next = await patchMeal(t, mid, {
          recipe_ids: nextIds,
          title: mealTitle.trim(),
          blurb,
        });
        setMeal(next);
        setRecipeIds(next.recipes.map((x) => x.id));
        setErr(null);
      } catch (e) {
        setRecipeIds(previousIds);
        setRecipeListErr(e instanceof Error ? e.message : "Could not update recipes");
      } finally {
        setRecipeListBusy(false);
      }
    },
    [blurb, getApiAccessToken, mealTitle, mid, recipeIds],
  );

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

  return (
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
      <Text fontSize={APP_TEXT_SIZES.helper}>
        <RouterLink to="/meal/menu/meals">
          <Text as="span" color="lilypad.solid" fontWeight="bold">
            ← All meals
          </Text>
        </RouterLink>
      </Text>

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
          <Heading size="sm" fontWeight="semibold" mb="2">
            {mealTitle.trim() || "Meal"}
          </Heading>
          <Stack gap="2" fontSize={APP_TEXT_SIZES.body}>
            <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
              Owner: {ownerLabel}
            </Text>
            <HStack gap="2" flexWrap="wrap" align="flex-end" w="100%">
              <Input
                flex="1"
                minW="min(100%, 9rem)"
                value={mealTitle}
                onChange={(e) => setMealTitle(e.target.value)}
                placeholder="Title"
                {...PANEL_FIELD_PROPS}
              />
              <PondButton
                flexShrink={0}
                colorPalette="lilypad"
                disabled={deleteBusy || recipeListBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(false);
                  void (async () => {
                    try {
                      const t = await getApiAccessToken();
                      const next = await patchMeal(t, meal.id, {
                        recipe_ids: recipeIds,
                        title: mealTitle.trim(),
                        blurb,
                      });
                      setMeal(next);
                      setErr(null);
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : "Save failed");
                    }
                  })();
                }}
              >
                Save
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
                      navigate("/meal/menu/meals");
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
            <Stack gap="1" w="100%">
              <MealRecipeIdsPicker
                recipes={recipes}
                recipeIds={recipeIds}
                onChange={(next) => {
                  void applyRecipeIds(next);
                }}
                disabled={recipeListBusy || deleteBusy}
              />
              {recipeListErr ? (
                <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
                  {recipeListErr}
                </Text>
              ) : null}
            </Stack>
            <Textarea
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              placeholder="Blurb (optional)"
              {...PANEL_FIELD_PROPS}
            />
          </Stack>
        </Card.Body>
      </Card.Root>

      {err ? (
        <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
          {err}
        </Text>
      ) : null}
    </Stack>
  );
}
