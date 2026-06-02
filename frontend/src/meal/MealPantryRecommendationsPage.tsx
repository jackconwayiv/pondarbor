import { Box, Card, Heading, Stack, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { MealPantryPageGate } from "./MealPantryPageGate";
import { usePantryHints } from "./usePantryHints";

export default function MealPantryRecommendationsPage() {
  const { hints, busy, loadErr, pantryEnabled } = usePantryHints();

  return (
    <MealPantryPageGate>
      <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <Heading size="sm" mb="1">
            Recommendations
          </Heading>
          <Text fontSize={APP_TEXT_SIZES.body} lineHeight="tall" color="fg">
            Pantry items you have on hand that are not on this week’s meal plan, with meal ideas to
            use them up.
          </Text>
        </Box>

        {!pantryEnabled ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
            Enable pantry tracking on the Inventory tab to see recommendations.
          </Text>
        ) : loadErr ? (
          <Text fontSize={APP_TEXT_SIZES.meta} color="nautical.solid" role="alert">
            {loadErr}
          </Text>
        ) : busy && hints.length === 0 ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
            Loading…
          </Text>
        ) : hints.length === 0 ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
            Nothing to suggest right now — either your pantry matches the plan or you have no
            unused inventory.
          </Text>
        ) : (
          <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
            <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
              <Heading size="sm" mb="2">
                Inventory not on this week’s plan
              </Heading>
              <Stack gap="3">
                {hints.map((h) => (
                  <Box key={h.ingredient_id}>
                    <Text fontSize={APP_TEXT_SIZES.helper}>
                      You have{" "}
                      <Text as="span" fontWeight="semibold">
                        {h.ingredient_name}
                      </Text>{" "}
                      in the pantry, not planned this week. Try:{" "}
                      {h.recommended_meals.map((m, i) => (
                        <span key={m.id}>
                          {i > 0 ? ", " : null}
                          <RouterLink to={`/meal/meals/${m.id}`}>
                            <Text as="span" color="teal.solid" fontWeight="bold">
                              {m.title}
                            </Text>
                          </RouterLink>
                        </span>
                      ))}
                      .
                    </Text>
                  </Box>
                ))}
              </Stack>
            </Card.Body>
          </Card.Root>
        )}
      </Stack>
    </MealPantryPageGate>
  );
}
