import { Card, Heading, Stack, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import type { Profile, ProfilePatch } from "../../auth/AppSessionContext";
import PondNativeSelect from "../../components/PondNativeSelect";
import {
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
} from "../../theme/typography";
import { MealPlanSlotControls } from "../MealPlanSlotControls";
import { MealSlotNameEditor } from "../MealSlotNameEditor";
import { WEEKDAY_FULL } from "../mealLabels";
import { profileMealSlotsPerDay } from "../mealPlanSlots";
import { patchMealSlotsPerDay } from "../mealPlanSlotsChange";
import { slotDraftFromProfile } from "../mealSlotDraft";
import { defaultSlotLabelsForCount } from "../mealSlotLabels";

type MealSettingsPlanSectionProps = {
  profile: Profile;
  patchMyProfile: (patch: ProfilePatch) => Promise<void>;
  resyncSessionSilently: () => Promise<void>;
  onError: (message: string) => void;
};

export function MealSettingsPlanSection({
  profile,
  patchMyProfile,
  resyncSessionSilently,
  onError,
}: MealSettingsPlanSectionProps) {
  const slotsPerDay = profileMealSlotsPerDay(profile);
  const activeKey = String(slotsPerDay);
  const [mealSlotDraft, setMealSlotDraft] = useState<Record<string, string[]>>(() =>
    slotDraftFromProfile(profile.meal_slot_labels),
  );
  const [slotsPerDayBusy, setSlotsPerDayBusy] = useState(false);
  const mealSlotDraftRef = useRef(mealSlotDraft);
  mealSlotDraftRef.current = mealSlotDraft;

  const labelsSyncKey = JSON.stringify(profile.meal_slot_labels ?? null);

  useEffect(() => {
    setMealSlotDraft(slotDraftFromProfile(profile.meal_slot_labels));
  }, [labelsSyncKey, profile.meal_slot_labels]);

  const persistMealSlotRow = async (countKey: string, row: string[]) => {
    try {
      await patchMyProfile({ meal_slot_labels: { [countKey]: row } });
      await resyncSessionSilently();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save meal time names.");
      await resyncSessionSilently().catch(() => {});
    }
  };

  const handleLabelChange = (index: number, value: string) => {
    const prev = mealSlotDraftRef.current;
    const row = [...(prev[activeKey] ?? defaultSlotLabelsForCount(slotsPerDay))];
    row[index] = value;
    const nextDraft = { ...prev, [activeKey]: row };
    mealSlotDraftRef.current = nextDraft;
    setMealSlotDraft(nextDraft);
    void persistMealSlotRow(activeKey, row);
  };

  const activeRow = mealSlotDraft[activeKey] ?? defaultSlotLabelsForCount(slotsPerDay);

  return (
    <Stack gap="2">
      <Heading as="h3" size="sm">
        Weekly plan
      </Heading>
      <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
        <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
          <Stack gap="5">
            <Stack gap="2">
              <Text fontSize={APP_TEXT_SIZES.label} fontWeight="semibold">
                Week starts on
              </Text>
              <PondNativeSelect
                rootProps={{ size: "sm", maxW: "xs" }}
                fieldProps={{
                  value: String(profile.meal_week_starts_on ?? 0),
                  onChange: (e) => {
                    const v = Number(e.target.value);
                    void patchMyProfile({ meal_week_starts_on: v }).catch((err: Error) =>
                      onError(err.message),
                    );
                  },
                }}
              >
                {WEEKDAY_FULL.map((label, i) => (
                  <option key={label} value={i}>
                    {label}
                  </option>
                ))}
              </PondNativeSelect>
            </Stack>

            <Stack gap="2">
              <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                How many meal times you plan each day (for example breakfast, lunch, and dinner).
              </Text>
              <MealPlanSlotControls
                slotsPerDay={slotsPerDay}
                disabled={slotsPerDayBusy}
                onChange={async (next) => {
                  setSlotsPerDayBusy(true);
                  try {
                    await patchMealSlotsPerDay(patchMyProfile, next, slotsPerDay);
                    await resyncSessionSilently();
                  } catch (err) {
                    onError(err instanceof Error ? err.message : "Could not update meal rows");
                  } finally {
                    setSlotsPerDayBusy(false);
                  }
                }}
              />
            </Stack>

            <Stack gap="2">
              <Text fontSize={APP_TEXT_SIZES.label} fontWeight="semibold">
                Meal time names
              </Text>
              <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                Labels for each meal time in your plan. Pick a preset or use the pencil for a custom
                name.
              </Text>
              <MealSlotNameEditor labels={activeRow} onChangeLabel={handleLabelChange} />
            </Stack>
          </Stack>
        </Card.Body>
      </Card.Root>
    </Stack>
  );
}
