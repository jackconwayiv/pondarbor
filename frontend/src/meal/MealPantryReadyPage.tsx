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

export default function MealPantryReadyPage() {
  const { sessionUser } = useAppSession();
  const profilePantryOn = sessionUser?.profile.meal_pantry_enabled ?? false;
  const { canMake, pantryEnabled, loadErr, busy, refresh } = usePantryRecipeMatches(profilePantryOn);

  return (
    <MealPantryPageGate>
      <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <Heading size="sm" mb="1">
            Ready to make
          </Heading>
          <Text fontSize={APP_TEXT_SIZES.body} lineHeight="tall" color="fg">
            Meals where every ingredient is already in your pantry.
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
            <MealPantryRecipeList recipes={canMake} showMissing={false} />
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
