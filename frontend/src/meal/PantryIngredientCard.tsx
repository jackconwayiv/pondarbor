import { Box, Button, Stack, Text } from "@chakra-ui/react";
import {
  APP_TEXT_SIZES,
  MEAL_NAV_LINK_CARD_PROPS,
  PANEL_NESTED_BLOCK_PROPS,
} from "../theme/typography";
import { pantryIngredientDisplayEmoji } from "./pantryIngredientEmoji";
import {
  formatPantryLocation,
  formatPantryQuantity,
  formatPantryRecommendationHint,
  ingredientFoodGroup,
  isPantryRowDepleted,
} from "./pantryInventoryListUtils";
import type { PantryInventoryRow } from "./types";

type PantryIngredientCardProps = {
  row: PantryInventoryRow;
  busy?: boolean;
  onEditRow: (row: PantryInventoryRow) => void;
};

export function PantryIngredientCard({ row, busy, onEditRow }: PantryIngredientCardProps) {
  const depleted = isPantryRowDepleted(row);
  const name = row.ingredient.name;
  const category = ingredientFoodGroup(row);
  const recommendationHint = formatPantryRecommendationHint(row);

  return (
    <Button
      variant="ghost"
      w="100%"
      h="auto"
      p="0"
      minW="0"
      borderRadius="md"
      cursor={busy ? "wait" : "pointer"}
      opacity={busy ? 0.7 : depleted ? 0.55 : 1}
      aria-label={`Edit pantry item: ${name}`}
      onClick={() => onEditRow(row)}
    >
      <Box
        {...PANEL_NESTED_BLOCK_PROPS}
        {...MEAL_NAV_LINK_CARD_PROPS}
        aspectRatio={1}
        w="100%"
        bg={depleted ? "bg.subtle" : "bg"}
        borderColor={depleted ? "border.muted" : "border"}
        display="flex"
        alignItems="center"
        justifyContent="center"
        p="1"
      >
        <Stack gap="0.5" align="center" textAlign="center" w="100%" minW="0">
          <Text fontSize="2xl" lineHeight="1" aria-hidden>
            {pantryIngredientDisplayEmoji(row)}
          </Text>
          <Text
            fontSize={APP_TEXT_SIZES.meta}
            fontWeight="semibold"
            color={depleted ? "fg.muted" : "fg"}
            lineClamp={2}
            w="100%"
          >
            {name}
          </Text>
          {category ? (
            <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" lineClamp={1} w="100%">
              {category}
            </Text>
          ) : null}
          <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" lineClamp={1} w="100%">
            {formatPantryQuantity(row)}
          </Text>
          <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" lineClamp={2} w="100%">
            {formatPantryLocation(row)}
          </Text>
          {recommendationHint ? (
            <Text
              fontSize={APP_TEXT_SIZES.meta}
              fontWeight="semibold"
              color={row.pantry_recommendation_hint === "not_scheduled" ? "teal.fg" : "fg.muted"}
              lineClamp={1}
              w="100%"
            >
              {recommendationHint}
            </Text>
          ) : null}
        </Stack>
      </Box>
    </Button>
  );
}
