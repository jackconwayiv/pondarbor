import { HStack, Input, Stack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";

import { AppModal } from "../components/AppModal";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES, PANEL_FIELD_PROPS } from "../theme/typography";
import type { EventWritePayload } from "./types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: EventWritePayload) => Promise<void>;
  onDelete?: () => Promise<void>;
  title: string;
  submitLabel: string;
  initial?: {
    title: string;
    start_date: string;
    end_date: string;
  };
};

export const EVENT_TITLE_MAX = 500;

/**
 * Date-only "busy" event form. The calendar is binary (busy or free per day),
 * so we collect a date range and an optional private title — no times,
 * locations, or notes.
 */
export default function EventFormDialog({
  open,
  onOpenChange,
  onSubmit,
  onDelete,
  title,
  submitLabel,
  initial,
}: Props) {
  const seed = useMemo(() => buildInitial(initial), [initial]);

  const [titleValue, setTitleValue] = useState(seed.title);
  const [startDate, setStartDate] = useState(seed.startDate);
  const [endDate, setEndDate] = useState(seed.endDate);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitleValue(seed.title);
    setStartDate(seed.startDate);
    setEndDate(seed.endDate);
    setError(null);
    setConfirmDelete(false);
  }, [open, seed]);

  const handleSubmit = async () => {
    const trimmed = titleValue.trim();
    if (trimmed.length > EVENT_TITLE_MAX) {
      setError(`Title must be at most ${EVENT_TITLE_MAX} characters.`);
      return;
    }
    if (!startDate || !endDate) {
      setError("Pick start and end dates.");
      return;
    }
    if (endDate < startDate) {
      setError("End date must be on or after start date.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        title: trimmed,
        start_date: startDate,
        end_date: endDate,
      });
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save event.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Mark yourself busy for a single day or a date range. Times aren't tracked — each day is either busy or free."
      size="lg"
    >
      <Stack gap="3">
        <Stack gap="1">
          <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
            Title (optional, only you can see it)
          </Text>
          <Input
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            maxLength={EVENT_TITLE_MAX}
            placeholder="e.g. Out of town"
            {...PANEL_FIELD_PROPS}
          />
        </Stack>
        <HStack gap="2" flexWrap="wrap">
          <Stack gap="1" flex="1" minW="160px">
            <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
              Start date
            </Text>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              {...PANEL_FIELD_PROPS}
            />
          </Stack>
          <Stack gap="1" flex="1" minW="160px">
            <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
              End date
            </Text>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              {...PANEL_FIELD_PROPS}
            />
          </Stack>
        </HStack>
        {error ? (
          <Text color="nautical.solid" fontSize={APP_TEXT_SIZES.helper}>
            {error}
          </Text>
        ) : null}
        <HStack justify="space-between" flexWrap="wrap" gap="2">
          <HStack gap="2">
            <PondButton
              colorPalette="lilypad"
              loading={saving}
              onClick={handleSubmit}
            >
              {submitLabel}
            </PondButton>
            <PondButton
              colorPalette="sky"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </PondButton>
          </HStack>
          {onDelete ? (
            <PondButton
              colorPalette="nautical"
              loading={saving}
              onClick={async () => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                setSaving(true);
                try {
                  await onDelete();
                  onOpenChange(false);
                } catch (err: unknown) {
                  setError(
                    err instanceof Error ? err.message : "Failed to delete.",
                  );
                } finally {
                  setSaving(false);
                }
              }}
            >
              {confirmDelete ? "Confirm delete" : "Delete event"}
            </PondButton>
          ) : null}
        </HStack>
      </Stack>
    </AppModal>
  );
}

function buildInitial(initial: Props["initial"]) {
  if (initial) {
    return {
      title: initial.title,
      startDate: initial.start_date,
      endDate: initial.end_date,
    };
  }
  const today = new Date();
  const iso = toDateInput(today);
  return {
    title: "",
    startDate: iso,
    endDate: iso,
  };
}

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
