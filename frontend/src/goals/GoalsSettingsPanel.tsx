import { Card, HStack, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";

import PondButton from "../PondButton";
import PondNativeSelect from "../components/PondNativeSelect";
import {
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { WEEKDAY_FULL } from "../meal/mealLabels";
import { GOALS_THEME } from "./theme";

type GoalsSettingsPanelProps = {
  weekStartsOn: number;
  onWeekStartsOnChange: (value: number) => void;
  onDeleteAllGoals: () => Promise<void>;
  onOpenGoalsManager: () => void;
  totalGoals: number;
};

export function GoalsSettingsPanel({
  weekStartsOn,
  onWeekStartsOnChange,
  onDeleteAllGoals,
  onOpenGoalsManager,
  totalGoals,
}: GoalsSettingsPanelProps) {
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Stack gap="4" maxW="lg">
      <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
        <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
          <Stack gap="3">
            <Text fontSize={APP_TEXT_SIZES.body} fontWeight="semibold" color={GOALS_THEME.textOnLight}>
              Goals Manager
            </Text>
            <Text fontSize={APP_TEXT_SIZES.helper} color={GOALS_THEME.textMuted}>
              See and edit every goal, chore, and project — including items not due today.
            </Text>
            <PondButton
              colorPalette="sky"
              alignSelf="flex-start"
              disabled={totalGoals === 0}
              onClick={onOpenGoalsManager}
            >
              Open Goals Manager
            </PondButton>
          </Stack>
        </Card.Body>
      </Card.Root>

      <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
        <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
          <Stack gap="2">
            <Text fontSize={APP_TEXT_SIZES.body} fontWeight="semibold" color={GOALS_THEME.textOnLight}>
              Week starts on
            </Text>
            <Text fontSize={APP_TEXT_SIZES.helper} color={GOALS_THEME.textMuted}>
              Used for weekly goals and progress on your dashboard stripe.
            </Text>
            <HStack align="center" flexWrap="wrap" gap="2">
              <PondNativeSelect
                rootProps={{ size: "sm", maxW: "xs", flexShrink: 0 }}
                fieldProps={{
                  value: String(weekStartsOn),
                  onChange: (e) => onWeekStartsOnChange(Number(e.target.value)),
                }}
              >
                {WEEKDAY_FULL.map((label, i) => (
                  <option key={label} value={i}>
                    {label}
                  </option>
                ))}
              </PondNativeSelect>
            </HStack>
          </Stack>
        </Card.Body>
      </Card.Root>

      <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0" borderColor="nautical.solid">
        <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
          <Stack gap="3">
            <Text fontSize={APP_TEXT_SIZES.body} fontWeight="semibold" color={GOALS_THEME.textOnLight}>
              Danger zone
            </Text>
            {confirmDeleteAll ? (
              <Text fontSize={APP_TEXT_SIZES.helper} color={GOALS_THEME.textMuted}>
                This will completely reset your Goals progress. Are you sure?
              </Text>
            ) : (
              <Text fontSize={APP_TEXT_SIZES.helper} color={GOALS_THEME.textMuted}>
                Remove every goal and all check-ins. This cannot be undone.
              </Text>
            )}
            <PondButton
              colorPalette="nautical"
              loading={busy}
              alignSelf="flex-start"
              onClick={() => {
                if (!confirmDeleteAll) {
                  setConfirmDeleteAll(true);
                  setError(null);
                  return;
                }
                void (async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await onDeleteAllGoals();
                    setConfirmDeleteAll(false);
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : "Delete failed.");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              {confirmDeleteAll ? "Yes, delete all goals" : "Delete all goals"}
            </PondButton>
            {confirmDeleteAll ? (
              <PondButton
                variant="outline"
                size="sm"
                alignSelf="flex-start"
                disabled={busy}
                onClick={() => {
                  setConfirmDeleteAll(false);
                  setError(null);
                }}
              >
                Cancel
              </PondButton>
            ) : null}
            {error ? (
              <Text color="red.600" fontSize="sm" role="alert">
                {error}
              </Text>
            ) : null}
          </Stack>
        </Card.Body>
      </Card.Root>
    </Stack>
  );
}
