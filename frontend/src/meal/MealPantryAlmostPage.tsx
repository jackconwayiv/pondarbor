import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { MealPantryPageGate, PantryRecipesStatus } from "./MealPantryPageGate";
import { MealPantryRecipeList } from "./MealPantryRecipeList";
import { usePantryRecipeMatches } from "./usePantryRecipeMatches";

export default function MealPantryAlmostPage() {
  const { sessionUser } = useAppSession();
  const profilePantryOn = sessionUser?.profile.meal_pantry_enabled ?? false;
  const { almostMake, pantryEnabled, loadErr, busy, refresh } = usePantryRecipeMatches(profilePantryOn);

  return (
    <MealPantryPageGate>
      <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <Heading size="sm" mb="1">
            Almost ready
          </Heading>
          <Text fontSize={APP_TEXT_SIZES.body} lineHeight="tall" color="fg">
            Meals you are one to three ingredients away from making. Missing items are listed for each
            recipe.
          </Text>
        </Box>

        <PantryRecipesStatus
          profilePantryOn={profilePantryOn}
          pantryEnabled={pantryEnabled}
          busy={busy}
          loadErr={loadErr}
          onRetry={() => void refresh()}
        >
          <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
            <MealPantryRecipeList recipes={almostMake} showMissing />
            <PondButton
              alignSelf="flex-start"
              size="sm"
              variant="outline"
              colorPalette="sky"
              onClick={() => void refresh()}
            >
              Refresh
            </PondButton>
          </Stack>
        </PantryRecipesStatus>
      </Stack>
    </MealPantryPageGate>
  );
}
