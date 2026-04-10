import {
  Card,
  Heading,
  HStack,
  Input,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
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
import { createRecipe, fetchRecipes } from "./api";
import { mealOwnerLabel } from "./mealOwnerLabel";
import { linesToIngredients } from "./recipeIngredients";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import type { Recipe } from "./types";

export default function MealRecipesPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, sessionUser, getApiAccessToken, refreshSession } =
    useAppSession();
  const [rows, setRows] = useState<Recipe[]>([]);
  const [title, setTitle] = useState("");
  const [directions, setDirections] = useState("");
  const [notes, setNotes] = useState("");
  const [ingLines, setIngLines] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const isMobile = useIsMobile();

  const refresh = useCallback(async () => {
    const t = await getApiAccessToken();
    setRows(await fetchRecipes(t));
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
      <Heading as="h2" size="md" fontWeight="bold">
        Recipes
      </Heading>
      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
        Add a title, ingredients, directions, and optional notes. Open a recipe from the grid to edit.
      </Text>

      <PondButton
        colorPalette="sky"
        variant="outline"
        alignSelf="flex-start"
        onClick={() => setShowAddRecipe((v) => !v)}
      >
        {showAddRecipe ? "Hide" : "Add New Recipe"}
      </PondButton>

      {showAddRecipe ? (
        <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
          <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
            <Heading size="sm" mb="2" fontWeight="semibold">
              New recipe:
            </Heading>
            <Stack gap="2">
              <HStack gap="2" flexWrap="wrap" align="flex-end" w="100%">
                <Input
                  flex="1"
                  minW="min(100%, 9rem)"
                  placeholder="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  {...PANEL_FIELD_PROPS}
                />
                <PondButton
                  flexShrink={0}
                  colorPalette="lilypad"
                  disabled={!title.trim()}
                  onClick={() => {
                    void (async () => {
                      try {
                        const t = await getApiAccessToken();
                        const created = await createRecipe(t, {
                          title: title.trim(),
                          directions,
                          notes,
                          ingredients: linesToIngredients(ingLines),
                        });
                        setTitle("");
                        setIngLines("");
                        setDirections("");
                        setNotes("");
                        setShowAddRecipe(false);
                        await refresh();
                        setErr(null);
                        navigate(`/meal/menu/recipes/${created.id}`);
                      } catch (e) {
                        setErr(e instanceof Error ? e.message : "Save failed");
                      }
                    })();
                  }}
                >
                  Save recipe
                </PondButton>
              </HStack>
              <Textarea
                placeholder="Ingredients (one per line)"
                value={ingLines}
                onChange={(e) => setIngLines(e.target.value)}
                minH="24"
                {...PANEL_FIELD_PROPS}
              />
              <Textarea
                placeholder="Directions"
                value={directions}
                onChange={(e) => setDirections(e.target.value)}
                {...PANEL_FIELD_PROPS}
              />
              <Textarea
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                minH="16"
                {...PANEL_FIELD_PROPS}
              />
            </Stack>
          </Card.Body>
        </Card.Root>
      ) : null}

      {err ? (
        <Text
          fontSize={APP_TEXT_SIZES.helper}
          fontWeight="medium"
          color="nautical.solid"
          role="alert"
        >
          {err}
        </Text>
      ) : null}

      <SimpleGrid
        columns={isMobile ? 2 : 3}
        gap={MAPPED_CLOSET_TAB_STACK_GAP}
        w="100%"
        alignItems="start"
      >
        {rows.map((r) => (
          <RecipeListCard
            key={r.id}
            recipe={r}
            ownerLabel={mealOwnerLabel(r.owner_user, sessionUser)}
          />
        ))}
      </SimpleGrid>
    </Stack>
  );
}

function RecipeListCard({ recipe, ownerLabel }: { recipe: Recipe; ownerLabel: string }) {
  const nIng = recipe.ingredients.length;
  const summaryMeta =
    nIng === 0 ? "No ingredients" : `${nIng} ingredient${nIng === 1 ? "" : "s"}`;

  return (
    <RouterLink
      to={`/meal/menu/recipes/${recipe.id}`}
      aria-label={`Edit recipe: ${recipe.title}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0" {...MEAL_NAV_LINK_CARD_PROPS}>
        <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
          <HStack align="flex-start" justify="space-between" gap="3">
            <Stack gap="1" flex="1" minW="0">
              <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.body} lineClamp={2}>
                {recipe.title}
              </Text>
              <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" lineClamp={1}>
                {ownerLabel} · {summaryMeta}
              </Text>
            </Stack>
            <Text fontSize={APP_TEXT_SIZES.meta} color="lilypad.solid" fontWeight="bold" flexShrink={0}>
              Edit
            </Text>
          </HStack>
        </Card.Body>
      </Card.Root>
    </RouterLink>
  );
}
