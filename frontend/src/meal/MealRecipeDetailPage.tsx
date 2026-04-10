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
import { deleteRecipe, fetchRecipe, patchRecipe } from "./api";
import { mealOwnerLabel } from "./mealOwnerLabel";
import { linesToIngredients } from "./recipeIngredients";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import type { Recipe } from "./types";

export default function MealRecipeDetailPage() {
  const { id } = useParams();
  const rid = id ? Number(id) : Number.NaN;
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, sessionUser, getApiAccessToken, refreshSession } =
    useAppSession();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [title, setTitle] = useState("");
  const [directions, setDirections] = useState("");
  const [notes, setNotes] = useState("");
  const [ingLines, setIngLines] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [rowErr, setRowErr] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmDeleteButtonRef = useRef<HTMLButtonElement | null>(null);

  const load = useCallback(async () => {
    const t = await getApiAccessToken();
    const r = await fetchRecipe(t, rid);
    setErr(null);
    setRecipe(r);
    setTitle(r.title);
    setDirections(r.directions);
    setNotes(r.notes);
    setIngLines(r.ingredients.map((i) => i.raw_line || "").join("\n"));
  }, [getApiAccessToken, rid]);

  useEffect(() => {
    if (!sessionUser?.user.is_approved || !Number.isFinite(rid)) return;
    const timer = window.setTimeout(() => {
      void load().catch((e) => setErr(e instanceof Error ? e.message : "Load failed"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [sessionUser?.user.is_approved, rid, load]);

  if (isLoading) return <MealLoading />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser) {
    return <MealSessionReconnect onRetry={() => void refreshSession()} />;
  }
  if (!sessionUser.user.is_approved) {
    return <MealApprovalRequired />;
  }
  if (!Number.isFinite(rid)) {
    return (
      <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
        Invalid recipe.
      </Text>
    );
  }
  if (!recipe) {
    return err ? (
      <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
        {err}
      </Text>
    ) : (
      <MealLoading />
    );
  }

  const ownerLabel = mealOwnerLabel(recipe.owner_user, sessionUser);

  return (
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
      <Text fontSize={APP_TEXT_SIZES.helper}>
        <RouterLink to="/meal/menu/recipes">
          <Text as="span" color="lilypad.solid" fontWeight="bold">
            ← All recipes
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
          <Heading as="h2" size="md" fontWeight="bold" mb="2">
            {title.trim() || recipe.title}
          </Heading>
          <Stack gap="2" fontSize={APP_TEXT_SIZES.body}>
            <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
              Owner: {ownerLabel}
            </Text>
            <HStack gap="2" flexWrap="wrap" align="flex-end" w="100%">
              <Input
                flex="1"
                minW="min(100%, 9rem)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                {...PANEL_FIELD_PROPS}
              />
              <PondButton
                flexShrink={0}
                colorPalette="lilypad"
                disabled={!title.trim() || deleteBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(false);
                  void (async () => {
                    try {
                      const t = await getApiAccessToken();
                      const next = await patchRecipe(t, recipe.id, {
                        title: title.trim(),
                        directions,
                        notes,
                        ingredients: linesToIngredients(ingLines),
                      });
                      setRecipe(next);
                      setRowErr(null);
                    } catch (e) {
                      setRowErr(e instanceof Error ? e.message : "Save failed");
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
                      await deleteRecipe(t, recipe.id);
                      navigate("/meal/menu/recipes");
                    } catch (e) {
                      setRowErr(e instanceof Error ? e.message : "Delete failed");
                    } finally {
                      setDeleteBusy(false);
                    }
                  })();
                }}
              >
                {confirmDelete ? "Confirm Delete" : "Delete"}
              </PondButton>
            </HStack>
            <Textarea
              placeholder="Ingredients (one per line)"
              value={ingLines}
              onChange={(e) => setIngLines(e.target.value)}
              minH="20"
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
            {rowErr ? (
              <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
                {rowErr}
              </Text>
            ) : null}
          </Stack>
        </Card.Body>
      </Card.Root>
    </Stack>
  );
}
