import { Card, Stack, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router";
import {
  APP_TEXT_SIZES,
  MEAL_NAV_LINK_CARD_PROPS,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import type { PantryRecipeMatch } from "./types";

export function MealPantryRecipeList({
  recipes,
  showMissing,
}: {
  recipes: PantryRecipeMatch[];
  showMissing: boolean;
}) {
  if (recipes.length === 0) {
    return (
      <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
        None right now.
      </Text>
    );
  }

  return (
    <Stack gap="2">
      {recipes.map((recipe) => (
        <RouterLink
          key={recipe.meal_id}
          to={`/meal/meals/${recipe.meal_id}`}
          aria-label={`Open meal: ${recipe.title}`}
          style={{ textDecoration: "none", color: "inherit", display: "block" }}
        >
          <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0" {...MEAL_NAV_LINK_CARD_PROPS}>
            <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS} py="2">
              <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.body}>
                {recipe.title}
              </Text>
              {showMissing && recipe.missing_ingredients.length > 0 ? (
                <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" mt="1">
                  Missing{" "}
                  {recipe.missing_count === 1
                    ? "1 ingredient"
                    : `${recipe.missing_count} ingredients`}
                  : {recipe.missing_ingredients.map((m) => m.name).join(", ")}
                </Text>
              ) : null}
            </Card.Body>
          </Card.Root>
        </RouterLink>
      ))}
    </Stack>
  );
}
