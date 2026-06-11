import { Card, Heading, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import type { Profile } from "../../auth/AppSessionContext";
import {
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
} from "../../theme/typography";
import { seedMealTags } from "../api";
import { MealDietaryPreferencesEditor } from "./MealDietaryPreferencesEditor";

type MealSettingsPreferencesSectionProps = {
  profile: Profile;
  getApiAccessToken: () => Promise<string | null>;
  patchMyProfile: (patch: { meal_dietary_preferences: string[] }) => Promise<void>;
  resyncSessionSilently: () => Promise<void>;
  onError: (message: string) => void;
};

export function MealSettingsPreferencesSection({
  profile,
  getApiAccessToken,
  patchMyProfile,
  resyncSessionSilently,
  onError,
}: MealSettingsPreferencesSectionProps) {
  const [dietary, setDietary] = useState<string[]>(() => [
    ...(profile.meal_dietary_preferences ?? []),
  ]);
  const [busy, setBusy] = useState(false);
  const syncKey = JSON.stringify(profile.meal_dietary_preferences ?? []);

  useEffect(() => {
    setDietary([...(profile.meal_dietary_preferences ?? [])]);
  }, [syncKey, profile.meal_dietary_preferences]);

  const persistDietary = useCallback(
    async (next: string[]) => {
      setDietary(next);
      setBusy(true);
      try {
        const tok = await getApiAccessToken();
        if (next.length > 0) {
          await seedMealTags(tok, next);
        }
        await patchMyProfile({ meal_dietary_preferences: next });
        await resyncSessionSilently();
      } catch (err) {
        onError(err instanceof Error ? err.message : "Could not save dietary preferences.");
        setDietary([...(profile.meal_dietary_preferences ?? [])]);
      } finally {
        setBusy(false);
      }
    },
    [getApiAccessToken, onError, patchMyProfile, profile.meal_dietary_preferences, resyncSessionSilently],
  );

  return (
    <Stack gap="2">
      <Heading as="h3" size="sm">
        Preferences
      </Heading>
      <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
        <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
          <Stack gap="3">
            <Text fontSize={APP_TEXT_SIZES.label} fontWeight="semibold">
              Dietary preferences
            </Text>
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
              Optional. Added to your meal tags and used as default dietary tags when you add pantry
              items.
            </Text>
            <MealDietaryPreferencesEditor
              value={dietary}
              onChange={(next) => void persistDietary(next)}
              disabled={busy}
            />
          </Stack>
        </Card.Body>
      </Card.Root>
    </Stack>
  );
}
