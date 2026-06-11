import { Card, Checkbox, Heading, Stack, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router";
import type { Profile } from "../../auth/AppSessionContext";
import {
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
} from "../../theme/typography";
import { useMealData } from "../MealDataContext";

type MealSettingsPantrySectionProps = {
  profile: Profile;
  patchMyProfile: (patch: { meal_pantry_enabled: boolean }) => Promise<void>;
  onError: (message: string) => void;
};

export function MealSettingsPantrySection({
  profile,
  patchMyProfile,
  onError,
}: MealSettingsPantrySectionProps) {
  const { refreshAll } = useMealData();
  const pantryEnabled = profile.meal_pantry_enabled ?? false;

  return (
    <Stack gap="2">
      <Heading as="h3" size="sm">
        Pantry
      </Heading>
      <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
        <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
          <Stack gap="3">
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
              Track ingredients on hand. When enabled, inventory cards show hints (Not Scheduled,
              No Recipes) and meal cards show a Pantry match percentage.
            </Text>
            <Checkbox.Root
              checked={pantryEnabled}
              onCheckedChange={(d) => {
                const next = d.checked === true;
                void patchMyProfile({ meal_pantry_enabled: next })
                  .then(() => refreshAll())
                  .catch((err: Error) => onError(err.message));
              }}
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Label fontSize={APP_TEXT_SIZES.helper}>Enable pantry tracking</Checkbox.Label>
            </Checkbox.Root>
            {pantryEnabled ? (
              <Text fontSize={APP_TEXT_SIZES.helper}>
                <RouterLink to="/meal/pantry/inventory">
                  <Text as="span" color="teal.solid" fontWeight="bold">
                    Open pantry inventory
                  </Text>
                </RouterLink>
              </Text>
            ) : null}
          </Stack>
        </Card.Body>
      </Card.Root>
    </Stack>
  );
}
