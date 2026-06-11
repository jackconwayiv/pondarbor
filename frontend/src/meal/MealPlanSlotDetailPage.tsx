import { Box, Card, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate, useSearchParams } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import PresignedImage from "../lib/PresignedImage";
import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { createMeal } from "./api";
import { useMealData } from "./MealDataContext";
import { mealLabel } from "./mealLabels";
import { commitPlanSlot } from "./mealPlanSlotCommit";
import {
  formatLongCalendarDate,
  instanceCoveringDate,
  localDateIso,
  parseLocalDate,
  pythonWeekday,
  startOfWeek,
} from "./mealPlanDates";
import { profileMealSlotsPerDay } from "./mealPlanSlots";
import { resolveSlotLabels } from "./mealSlotLabels";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import { MealSlotPickerDialog } from "./MealSlotPickerDialog";
import type { InstanceSlot } from "./types";

function slotMealIds(slots: InstanceSlot[], dayIndex: number, slotIndex: number): number[] {
  const row = slots.find((x) => x.day_index === dayIndex && x.slot_index === slotIndex);
  return row?.meal_ids ?? [];
}

function isValidDateIso(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default function MealPlanSlotDetailPage() {
  const [searchParams] = useSearchParams();
  const dateIso = searchParams.get("date") ?? "";
  const slotParam = searchParams.get("slot");
  const slotIndex = slotParam != null ? Number(slotParam) : Number.NaN;
  const navigate = useNavigate();
  const {
    isAuthenticated,
    isLoading,
    sessionUser,
    getApiAccessToken,
    refreshSession,
    resyncSessionSilently,
  } = useAppSession();
  const {
    meals,
    instances,
    instancesRef,
    setInstances,
    upsertMeal,
    refreshInstances,
    onGridCommitted,
  } = useMealData();
  const [draftSlots, setDraftSlots] = useState<InstanceSlot[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);

  const mealsById = useMemo(() => new Map(meals.map((m) => [m.id, m])), [meals]);
  const weekStartsOn = sessionUser?.profile.meal_week_starts_on ?? 0;
  const slotsPerDay = profileMealSlotsPerDay(sessionUser?.profile);
  const slotLabels = resolveSlotLabels(slotsPerDay, sessionUser?.profile.meal_slot_labels);

  const selectedDate = useMemo(
    () => (isValidDateIso(dateIso) ? parseLocalDate(dateIso) : null),
    [dateIso],
  );
  const selectedWeekStart = useMemo(
    () =>
      selectedDate != null
        ? localDateIso(startOfWeek(selectedDate, weekStartsOn))
        : "",
    [selectedDate, weekStartsOn],
  );
  const covering = selectedDate != null ? instanceCoveringDate(instances, selectedDate) : null;
  const dayIdx =
    selectedDate != null
      ? covering != null
        ? (pythonWeekday(selectedDate) - weekStartsOn + 7) % 7
        : (pythonWeekday(selectedDate) - weekStartsOn + 7) % 7
      : 0;

  const sourceSlots = covering?.slots ?? draftSlots;
  const mealIds =
    Number.isFinite(slotIndex) && slotIndex >= 0
      ? slotMealIds(sourceSlots, dayIdx, slotIndex)
      : [];

  const slotName =
    Number.isFinite(slotIndex) && slotIndex >= 0
      ? (slotLabels[slotIndex] ?? `Slot ${slotIndex + 1}`)
      : "";

  const backTo = `/meal/plan?date=${encodeURIComponent(dateIso)}`;

  if (isLoading) return <MealLoading />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser) {
    return <MealSessionReconnect onRetry={() => void refreshSession()} />;
  }
  if (!sessionUser.user.is_approved) {
    return <MealApprovalRequired />;
  }
  if (!isValidDateIso(dateIso) || !Number.isFinite(slotIndex) || slotIndex < 0 || slotIndex >= slotsPerDay) {
    return (
      <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
        Invalid slot. Return to your plan.
      </Text>
    );
  }
  if (selectedDate == null) {
    return (
      <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
        Invalid date.
      </Text>
    );
  }

  const dateHeading = formatLongCalendarDate(selectedDate);
  const dayLabel = selectedDate.toLocaleDateString(undefined, { weekday: "long" });

  return (
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
      <Text fontSize={APP_TEXT_SIZES.helper}>
        <RouterLink to={backTo}>
          <Text as="span" color="teal.solid" fontWeight="bold">
            ← Back to plan
          </Text>
        </RouterLink>
      </Text>

      <Heading as="h2" size="md">
        {slotName}
      </Heading>
      <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
        {dayLabel} · {dateHeading}
      </Text>

      {err ? (
        <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
          {err}
        </Text>
      ) : null}

      {mealIds.length === 0 ? (
        <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
          No meal assigned. Use Change to add one.
        </Text>
      ) : (
        <Stack gap="3">
          {mealIds.map((mealId) => {
            const meal = mealsById.get(mealId);
            const label = meal ? mealLabel(meal) : `Meal #${mealId}`;
            const thumb = (meal?.image_url ?? "").trim();
            const blurb = (meal?.blurb ?? "").trim();
            return (
              <Card.Root key={mealId} {...PANEL_ENTRY_CARD_PROPS} p="0">
                <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
                  <Stack gap="3">
                    <HStack gap="3" align="flex-start" flexWrap="wrap">
                      {thumb && meal ? (
                        <Box
                          position="relative"
                          w="5rem"
                          h="5rem"
                          flexShrink={0}
                          borderRadius="md"
                          overflow="hidden"
                          bg="bg.subtle"
                        >
                          <PresignedImage
                            position="absolute"
                            inset="0"
                            src={thumb}
                            imageKey={meal.image_key}
                            getApiAccessToken={getApiAccessToken}
                            alt=""
                            w="100%"
                            h="100%"
                            objectFit="cover"
                          />
                        </Box>
                      ) : null}
                      <Stack gap="1" flex="1" minW="min(100%, 12rem)">
                        <Text fontSize={APP_TEXT_SIZES.body} fontWeight="bold" lineHeight="short">
                          {label}
                        </Text>
                        {blurb ? (
                          <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" lineClamp={3}>
                            {blurb}
                          </Text>
                        ) : null}
                      </Stack>
                    </HStack>
                    <RouterLink to={`/meal/meals/${mealId}`}>
                      <Text fontSize={APP_TEXT_SIZES.body} color="teal.solid" fontWeight="semibold">
                        Open full recipe →
                      </Text>
                    </RouterLink>
                  </Stack>
                </Card.Body>
              </Card.Root>
            );
          })}
        </Stack>
      )}

      <HStack gap="2" flexWrap="wrap">
        <PondButton colorPalette="lilypad" onClick={() => setChangeOpen(true)}>
          Change
        </PondButton>
        <PondButton variant="outline" colorPalette="sky" onClick={() => navigate(backTo)}>
          Done
        </PondButton>
      </HStack>

      {changeOpen ? (
        <MealSlotPickerDialog
          open
          intent="edit"
          onOpenChange={(open) => {
            if (!open) setChangeOpen(false);
          }}
          dayLabel={dayLabel}
          slotDisplayName={slotName}
          mealIds={mealIds}
          meals={meals}
          createMeal={async (body) => {
            const tok = await getApiAccessToken();
            return createMeal(tok, body);
          }}
          onMealCreated={(m) => upsertMeal(m)}
          onCommit={async (selected) => {
            try {
              await commitPlanSlot(
                {
                  selectedDateIso: dateIso,
                  selectedWeekStart,
                  weekStartsOn,
                  slotIndex,
                  instancesRef,
                  setInstances,
                  setDraftSlots,
                  getApiAccessToken,
                  resyncSessionSilently,
                  refreshInstances,
                  onGridCommitted,
                },
                selected,
              );
              setErr(null);
              if (selected.length === 0) {
                navigate(backTo);
              }
            } catch (e) {
              setErr(e instanceof Error ? e.message : `Could not update ${slotName}`);
              throw e;
            }
          }}
        />
      ) : null}
    </Stack>
  );
}
