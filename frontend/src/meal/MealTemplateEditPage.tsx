import { Card, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { deleteTemplate, fetchMeals, fetchTemplate, patchTemplateGrid } from "./api";
import MealSlotGrid from "./MealSlotGrid";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import type { Meal, MealPlanTemplate } from "./types";

export default function MealTemplateEditPage() {
  const { id } = useParams();
  const tid = id ? Number(id) : Number.NaN;
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, sessionUser, getApiAccessToken, refreshSession } =
    useAppSession();
  const [template, setTemplate] = useState<MealPlanTemplate | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmDeleteButtonRef = useRef<HTMLButtonElement | null>(null);

  const load = useCallback(async () => {
    const t = await getApiAccessToken();
    const [tpl, ml] = await Promise.all([fetchTemplate(t, tid), fetchMeals(t)]);
    setTemplate(tpl);
    setMeals(ml);
  }, [getApiAccessToken, tid]);

  useEffect(() => {
    if (!sessionUser?.user.is_approved || !Number.isFinite(tid)) return;
    const timer = window.setTimeout(() => {
      void load().catch((e) => setErr(e instanceof Error ? e.message : "Load failed"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [sessionUser?.user.is_approved, tid, load]);

  if (isLoading) return <MealLoading />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser) {
    return <MealSessionReconnect onRetry={() => void refreshSession()} />;
  }
  if (!sessionUser.user.is_approved) {
    return <MealApprovalRequired />;
  }
  if (!Number.isFinite(tid)) {
    return (
      <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
        Invalid template.
      </Text>
    );
  }
  if (!template) {
    return err ? (
      <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
        {err}
      </Text>
    ) : (
      <MealLoading />
    );
  }

  const weekStartsOn = sessionUser.profile.meal_week_starts_on ?? 0;

  return (
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
      <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
        <Card.Body
          {...PANEL_ENTRY_CARD_BODY_PROPS}
          onPointerDownCapture={(event) => {
            if (!confirmDelete) return;
            const target = event.target as Node | null;
            if (!target) return;
            if (confirmDeleteButtonRef.current?.contains(target)) return;
            setConfirmDelete(false);
          }}
        >
          <HStack
            justify="space-between"
            align="flex-start"
            flexWrap="wrap"
            gap="3"
            mb="2"
            w="100%"
          >
            <Heading size="sm" fontWeight="semibold" flex="1" minW="min(100%, 12rem)">
              {template.name}
            </Heading>
            <HStack gap="2" flexShrink={0}>
              <PondButton
                colorPalette="lilypad"
                loading={saveBusy}
                disabled={saveBusy || deleteBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(false);
                  void (async () => {
                    setSaveBusy(true);
                    try {
                      const tok = await getApiAccessToken();
                      const payload = template.slots.map((s) => ({
                        day_index: s.day_index,
                        slot_index: s.slot_index,
                        meal_ids: s.meal_ids,
                      }));
                      await patchTemplateGrid(tok, template.id, payload);
                      setErr(null);
                      navigate("/meal/plans/templates");
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : "Save failed");
                    } finally {
                      setSaveBusy(false);
                    }
                  })();
                }}
              >
                Save
              </PondButton>
              <PondButton
                ref={confirmDeleteButtonRef}
                colorPalette="nautical"
                loading={deleteBusy}
                disabled={deleteBusy || saveBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!confirmDelete) {
                    setConfirmDelete(true);
                    return;
                  }
                  void (async () => {
                    setDeleteBusy(true);
                    try {
                      const tok = await getApiAccessToken();
                      await deleteTemplate(tok, template.id);
                      navigate("/meal/plans/templates");
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : "Delete failed");
                    } finally {
                      setDeleteBusy(false);
                    }
                  })();
                }}
              >
                {confirmDelete ? "Confirm Delete" : "Delete"}
              </PondButton>
            </HStack>
          </HStack>

          <MealSlotGrid
            slots={template.slots}
            slotsPerDay={template.slots_per_day}
            weekStartsOn={weekStartsOn}
            meals={meals}
            disabled={saveBusy || deleteBusy}
            onCellChange={(dayIndex, slotIndex, mealIds) => {
              void (async () => {
                try {
                  const tok = await getApiAccessToken();
                  const next = await patchTemplateGrid(tok, template.id, [
                    { day_index: dayIndex, slot_index: slotIndex, meal_ids: mealIds },
                  ]);
                  setTemplate(next);
                  setErr(null);
                  setConfirmDelete(false);
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "Update failed");
                }
              })();
            }}
          />
        </Card.Body>
      </Card.Root>

      {err ? (
        <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
          {err}
        </Text>
      ) : null}
    </Stack>
  );
}
