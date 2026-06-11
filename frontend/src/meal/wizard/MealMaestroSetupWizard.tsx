import { Box, Checkbox, HStack, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link as RouterLink } from "react-router";
import { AppModal } from "../../components/AppModal";
import type { ProfilePatch, SessionUser } from "../../auth/AppSessionContext";
import PondButton from "../../PondButton";
import PondNativeSelect from "../../components/PondNativeSelect";
import { APP_TEXT_SIZES } from "../../theme/typography";
import {
  cancelDisconnect,
  confirmDisconnect,
  seedMealTags,
} from "../api";
import { MealPartnerPicker } from "../MealPartnerPicker";
import { WEEKDAY_FULL } from "../mealLabels";
import { MealSlotNameEditor } from "../MealSlotNameEditor";
import { defaultSlotLabelsForCount } from "../mealSlotLabels";
import { patchMealSlotsPerDay } from "../mealPlanSlotsChange";
import { profileMealSlotsPerDay } from "../mealPlanSlots";
import { MealDietaryPreferencesEditor } from "../settings/MealDietaryPreferencesEditor";
import { MealWizardStepShell } from "./MealWizardStepShell";
import { firstIncompleteMealWizardStep } from "./mealWizardResume";
import { setMealWizardAutoOpenDisabled } from "./mealWizardStorage";
import {
  mealWizardHasNext,
  mealWizardHasPrior,
  mealWizardNextStep,
  mealWizardPriorStep,
  type MealWizardStepId,
} from "./mealWizardSteps";
import { useMealData } from "../MealDataContext";

export type MealMaestroSetupWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionUser: SessionUser;
  getApiAccessToken: () => Promise<string | null>;
  patchMyProfile: (patch: ProfilePatch) => Promise<void>;
  resyncSessionSilently: () => Promise<void>;
  /** When true, closing via X disables future auto-open. */
  markAutoOpenDisabledOnClose?: boolean;
  /** Override first step (e.g. incoming partner). */
  initialStep?: MealWizardStepId;
  /** Manual launch from Settings — always start at partner. */
  startAtBeginning?: boolean;
};

export function MealMaestroSetupWizard({
  open,
  onOpenChange,
  sessionUser,
  getApiAccessToken,
  patchMyProfile,
  resyncSessionSilently,
  markAutoOpenDisabledOnClose = false,
  initialStep,
  startAtBeginning = false,
}: MealMaestroSetupWizardProps) {
  const profile = sessionUser.profile;
  const [step, setStep] = useState<MealWizardStepId>("partner");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [slotsCount, setSlotsCount] = useState(() => profileMealSlotsPerDay(profile));
  const [slotNames, setSlotNames] = useState<string[]>(() => {
    const n = profileMealSlotsPerDay(profile);
    const custom = profile.meal_slot_labels?.[String(n)];
    return custom?.length === n ? [...custom] : defaultSlotLabelsForCount(n);
  });
  const [weekStart, setWeekStart] = useState(profile.meal_week_starts_on ?? 0);
  const [dietary, setDietary] = useState<string[]>(() => [...(profile.meal_dietary_preferences ?? [])]);
  const [enablePantry, setEnablePantry] = useState(profile.meal_pantry_enabled ?? false);
  const { disconnectPending: pending, setDisconnectPending: setPending, refreshAll } = useMealData();

  useEffect(() => {
    if (!open) return;
    const start = startAtBeginning
      ? "partner"
      : (initialStep ?? firstIncompleteMealWizardStep(profile));
    setStep(start);
    const n = profileMealSlotsPerDay(profile);
    setSlotsCount(n);
    const custom = profile.meal_slot_labels?.[String(n)];
    setSlotNames(custom?.length === n ? [...custom] : defaultSlotLabelsForCount(n));
    setWeekStart(profile.meal_week_starts_on ?? 0);
    setDietary([...(profile.meal_dietary_preferences ?? [])]);
    setEnablePantry(profile.meal_pantry_enabled ?? false);
    setErr(null);
  }, [open, initialStep, profile, startAtBeginning]);

  const closeWizard = useCallback(
    (disableAuto?: boolean) => {
      if (disableAuto ?? markAutoOpenDisabledOnClose) {
        setMealWizardAutoOpenDisabled(sessionUser.user.id);
      }
      onOpenChange(false);
    },
    [markAutoOpenDisabledOnClose, onOpenChange, sessionUser.user.id],
  );

  const saveSlotsCount = async (next: number) => {
    const current = profileMealSlotsPerDay(profile);
    await patchMealSlotsPerDay(patchMyProfile, next, current);
    await resyncSessionSilently();
    setSlotsCount(next);
    const custom = profile.meal_slot_labels?.[String(next)];
    setSlotNames(custom?.length === next ? [...custom] : defaultSlotLabelsForCount(next));
  };

  const saveSlotNames = async () => {
    const key = String(slotsCount);
    await patchMyProfile({ meal_slot_labels: { [key]: slotNames } });
    await resyncSessionSilently();
  };

  const goNext = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (step === "slotsCount") {
        await saveSlotsCount(slotsCount);
      } else if (step === "slotNames") {
        await saveSlotNames();
      } else if (step === "weekStart") {
        await patchMyProfile({ meal_week_starts_on: weekStart });
        await resyncSessionSilently();
      } else if (step === "dietary") {
        const tok = await getApiAccessToken();
        if (dietary.length > 0) {
          await seedMealTags(tok, dietary);
        }
        await patchMyProfile({ meal_dietary_preferences: dietary });
        await resyncSessionSilently();
      } else if (step === "pantry") {
        await patchMyProfile({ meal_pantry_enabled: enablePantry });
        await resyncSessionSilently();
      }
      const next = mealWizardNextStep(step);
      if (next) setStep(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const finishWizard = async () => {
    setBusy(true);
    setErr(null);
    try {
      const tok = await getApiAccessToken();
      if (dietary.length > 0) {
        await seedMealTags(tok, dietary);
      }
      await patchMyProfile({
        meal_maestro_setup_completed: true,
      });
      await resyncSessionSilently();
      onOpenChange(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not finish setup.");
    } finally {
      setBusy(false);
    }
  };

  const tourLinks = [
    {
      label: "Plan your week",
      to: "/meal/plan",
      hint: "Assign meals to slots; generate a grocery list",
    },
    {
      label: "Build your meal library",
      to: "/meal/meals",
      hint: "Import or add recipes; see Pantry % when tracking is on",
    },
    {
      label: "Stock your pantry",
      to: "/meal/pantry/inventory",
      hint: "Add items; cards show Not Scheduled or No Recipes hints",
    },
    {
      label: "Adjust settings",
      to: "/meal/settings",
      hint: "Partner, plan layout, dietary preferences",
    },
  ];

  let body: ReactNode = null;
  if (step === "partner") {
    body = (
      <MealWizardStepShell
        stepId="partner"
        helper="A meal partner shares meal planning and one combined pantry. You can skip and set this up later in Settings."
      >
        {pending ? (
          <Box mb="3" p="3" borderWidth="1px" borderColor="border.muted" borderRadius="md">
            <Text fontSize={APP_TEXT_SIZES.helper} mb="2">
              {pending.i_am_initiator
                ? "Disconnect pending — waiting for your partner to confirm."
                : "Your partner requested to disconnect. Confirm in Settings when ready."}
            </Text>
            {pending.i_am_initiator ? (
              <PondButton
                size="sm"
                variant="outline"
                onClick={() => {
                  void (async () => {
                    try {
                      const t = await getApiAccessToken();
                      await cancelDisconnect(t);
                      setPending(null);
                    } catch {
                      /* ignore */
                    }
                  })();
                }}
              >
                Cancel disconnect request
              </PondButton>
            ) : (
              <PondButton
                size="sm"
                colorPalette="lilypad"
                onClick={() => {
                  void (async () => {
                    try {
                      const t = await getApiAccessToken();
                      await confirmDisconnect(t);
                      setPending(null);
                      await resyncSessionSilently();
                    } catch {
                      /* ignore */
                    }
                  })();
                }}
              >
                Confirm disconnect
              </PondButton>
            )}
          </Box>
        ) : null}
        <MealPartnerPicker
          userId={sessionUser.user.id}
          partnerId={profile.meal_crud_partner_id}
          mutual={profile.meal_pair_mutual ?? false}
          getApiAccessToken={getApiAccessToken}
          patchMyProfile={patchMyProfile}
          resyncSessionSilently={resyncSessionSilently}
          onPartnerScopeChanged={() => void refreshAll()}
        />
      </MealWizardStepShell>
    );
  } else if (step === "slotsCount") {
    body = (
      <MealWizardStepShell
        stepId="slotsCount"
        helper="How many meal times do you want to plan each day? You can change this later in Settings under Weekly plan."
      >
        <PondNativeSelect
          fieldProps={{
            value: String(slotsCount),
            onChange: (e) => setSlotsCount(Number(e.target.value)),
          }}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "meal" : "meals"} per day
            </option>
          ))}
        </PondNativeSelect>
      </MealWizardStepShell>
    );
  } else if (step === "slotNames") {
    body = (
      <MealWizardStepShell
        stepId="slotNames"
        helper="These names appear when you assign meals to a time slot. Pick a preset or use the pencil for a custom name."
      >
        <MealSlotNameEditor
          labels={slotNames}
          onChangeLabel={(index, value) => {
            const next = [...slotNames];
            next[index] = value;
            setSlotNames(next);
          }}
        />
      </MealWizardStepShell>
    );
  } else if (step === "weekStart") {
    body = (
      <MealWizardStepShell stepId="weekStart" helper="Your meal plan weeks align to this day.">
        <PondNativeSelect
          fieldProps={{
            value: String(weekStart),
            onChange: (e) => setWeekStart(Number(e.target.value)),
          }}
        >
          {WEEKDAY_FULL.map((label, i) => (
            <option key={label} value={i}>
              {label}
            </option>
          ))}
        </PondNativeSelect>
      </MealWizardStepShell>
    );
  } else if (step === "dietary") {
    body = (
      <MealWizardStepShell
        stepId="dietary"
        helper="Optional. We’ll add these to your meal tags and use them as default dietary tags when you add pantry items."
      >
        <MealDietaryPreferencesEditor value={dietary} onChange={setDietary} />
      </MealWizardStepShell>
    );
  } else if (step === "pantry") {
    body = (
      <MealWizardStepShell
        stepId="pantry"
        helper="Optional. Track what you have on hand, see hints on pantry cards, and Pantry match % on meal cards."
      >
        <Checkbox.Root
          checked={enablePantry}
          onCheckedChange={(d) => setEnablePantry(d.checked === true)}
        >
          <Checkbox.HiddenInput />
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Checkbox.Label fontSize={APP_TEXT_SIZES.helper}>Enable pantry tracking</Checkbox.Label>
        </Checkbox.Root>
      </MealWizardStepShell>
    );
  } else {
    body = (
      <MealWizardStepShell stepId="tour" helper="Jump in anywhere — you can reopen this wizard from Settings.">
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="2">
          {tourLinks.map((item) => (
            <RouterLink key={item.label} to={item.to} onClick={() => onOpenChange(false)}>
              <Box
                p="3"
                borderWidth="1px"
                borderColor="border.muted"
                borderRadius="md"
                _hover={{ bg: "bg.subtle" }}
              >
                <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.helper}>
                  {item.label}
                </Text>
                <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
                  {item.hint}
                </Text>
              </Box>
            </RouterLink>
          ))}
        </SimpleGrid>
      </MealWizardStepShell>
    );
  }

  return (
    <AppModal
      open={open}
      onOpenChange={(o) => {
        if (!o) closeWizard(markAutoOpenDisabledOnClose);
        else onOpenChange(o);
      }}
      title="Meal Maestro setup"
      size="lg"
    >
      <Stack gap="4">
        {body}
        {err ? (
          <Text fontSize={APP_TEXT_SIZES.meta} color="nautical.solid" role="alert">
            {err}
          </Text>
        ) : null}
        <HStack justify="space-between" flexWrap="wrap" gap="2">
          <HStack gap="2">
            {mealWizardHasPrior(step) ? (
              <PondButton
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  const prior = mealWizardPriorStep(step);
                  if (prior) setStep(prior);
                }}
              >
                Back
              </PondButton>
            ) : null}
            {step === "partner" ? (
              <PondButton
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  const next = mealWizardNextStep(step);
                  if (next) setStep(next);
                }}
              >
                Skip for now
              </PondButton>
            ) : null}
            <PondButton
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => closeWizard(true)}
            >
              Remind me later
            </PondButton>
          </HStack>
          {step === "tour" ? (
            <PondButton size="sm" colorPalette="lilypad" loading={busy} onClick={() => void finishWizard()}>
              Finish
            </PondButton>
          ) : mealWizardHasNext(step) ? (
            <PondButton size="sm" colorPalette="lilypad" loading={busy} onClick={() => void goNext()}>
              Next
            </PondButton>
          ) : (
            <PondButton size="sm" colorPalette="lilypad" loading={busy} onClick={() => void goNext()}>
              Next
            </PondButton>
          )}
        </HStack>
      </Stack>
    </AppModal>
  );
}
