import { Checkbox, HStack, Input, Stack, Text, Textarea } from "@chakra-ui/react";
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
    location: string;
    notes: string;
    start_at: string;
    end_at: string;
    all_day: boolean;
  };
  /** Default date to prefill when no initial event is supplied. */
  defaultDate?: Date;
};

export const EVENT_TITLE_MAX = 500;
export const EVENT_LOCATION_MAX = 500;
export const EVENT_NOTES_MAX = 20_000;

export default function EventFormDialog({
  open,
  onOpenChange,
  onSubmit,
  onDelete,
  title,
  submitLabel,
  initial,
  defaultDate,
}: Props) {
  const seed = useMemo(
    () => buildInitial(initial, defaultDate),
    [initial, defaultDate],
  );

  const [titleValue, setTitleValue] = useState(seed.title);
  const [location, setLocation] = useState(seed.location);
  const [notes, setNotes] = useState(seed.notes);
  const [startLocal, setStartLocal] = useState(seed.startLocal);
  const [endLocal, setEndLocal] = useState(seed.endLocal);
  const [startDate, setStartDate] = useState(seed.startDate);
  const [endDate, setEndDate] = useState(seed.endDate);
  const [allDay, setAllDay] = useState(seed.all_day);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitleValue(seed.title);
    setLocation(seed.location);
    setNotes(seed.notes);
    setStartLocal(seed.startLocal);
    setEndLocal(seed.endLocal);
    setStartDate(seed.startDate);
    setEndDate(seed.endDate);
    setAllDay(seed.all_day);
    setError(null);
    setConfirmDelete(false);
  }, [open, seed]);

  const handleSubmit = async () => {
    const trimmed = titleValue.trim();
    if (!trimmed) {
      setError("Title is required.");
      return;
    }
    if (trimmed.length > EVENT_TITLE_MAX) {
      setError(`Title must be at most ${EVENT_TITLE_MAX} characters.`);
      return;
    }
    if (location.length > EVENT_LOCATION_MAX) {
      setError(`Location must be at most ${EVENT_LOCATION_MAX} characters.`);
      return;
    }
    if (notes.length > EVENT_NOTES_MAX) {
      setError(`Notes must be at most ${EVENT_NOTES_MAX} characters.`);
      return;
    }

    let startIso: string;
    let endIso: string;
    if (allDay) {
      if (!startDate || !endDate) {
        setError("Pick start and end dates.");
        return;
      }
      if (endDate < startDate) {
        setError("End date must be on or after start date.");
        return;
      }
      // All-day events end at midnight UTC after the last selected day.
      startIso = midnightUtcIso(startDate);
      endIso = midnightUtcIso(addDays(endDate, 1));
    } else {
      if (!startLocal || !endLocal) {
        setError("Pick start and end date/times.");
        return;
      }
      const s = new Date(startLocal);
      const e = new Date(endLocal);
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
        setError("Invalid date/time value.");
        return;
      }
      if (e <= s) {
        setError("End must be after start.");
        return;
      }
      startIso = s.toISOString();
      endIso = e.toISOString();
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        title: trimmed,
        location,
        notes,
        start_at: startIso,
        end_at: endIso,
        all_day: allDay,
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
      description="Each event blocks out a window when you're unavailable."
      size="lg"
    >
      <Stack gap="3">
        <Stack gap="1">
          <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
            Title
          </Text>
          <Input
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            maxLength={EVENT_TITLE_MAX}
            placeholder="e.g. Out of town"
            {...PANEL_FIELD_PROPS}
          />
        </Stack>
        <Checkbox.Root
          checked={allDay}
          onCheckedChange={(d: { checked: boolean | "indeterminate" }) =>
            setAllDay(Boolean(d.checked))
          }
        >
          <Checkbox.HiddenInput />
          <Checkbox.Control />
          <Checkbox.Label fontSize={APP_TEXT_SIZES.helper}>
            All-day event
          </Checkbox.Label>
        </Checkbox.Root>
        {allDay ? (
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
        ) : (
          <HStack gap="2" flexWrap="wrap">
            <Stack gap="1" flex="1" minW="180px">
              <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
                Start
              </Text>
              <Input
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                {...PANEL_FIELD_PROPS}
              />
            </Stack>
            <Stack gap="1" flex="1" minW="180px">
              <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
                End
              </Text>
              <Input
                type="datetime-local"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
                {...PANEL_FIELD_PROPS}
              />
            </Stack>
          </HStack>
        )}
        <Stack gap="1">
          <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
            Location (optional)
          </Text>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={EVENT_LOCATION_MAX}
            {...PANEL_FIELD_PROPS}
          />
        </Stack>
        <Stack gap="1">
          <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
            Notes (optional)
          </Text>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={EVENT_NOTES_MAX}
            {...PANEL_FIELD_PROPS}
          />
        </Stack>
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

function buildInitial(
  initial: Props["initial"],
  defaultDate: Date | undefined,
) {
  if (initial) {
    const start = new Date(initial.start_at);
    const endExclusive = new Date(initial.end_at);
    // For all-day events, the API stores end as midnight-of-the-day-after.
    // Display the last covered day in the edit form.
    const endInclusive = initial.all_day
      ? new Date(endExclusive.getTime() - 24 * 60 * 60 * 1000)
      : endExclusive;
    return {
      title: initial.title,
      location: initial.location,
      notes: initial.notes,
      startLocal: toLocalInput(start),
      endLocal: toLocalInput(endExclusive),
      startDate: toDateInput(start),
      endDate: toDateInput(endInclusive),
      all_day: initial.all_day,
    };
  }
  const base = defaultDate ?? roundToNextHour(new Date());
  const end = new Date(base.getTime() + 60 * 60 * 1000);
  return {
    title: "",
    location: "",
    notes: "",
    startLocal: toLocalInput(base),
    endLocal: toLocalInput(end),
    startDate: toDateInput(base),
    endDate: toDateInput(base),
    all_day: false,
  };
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function midnightUtcIso(dateInput: string): string {
  const [y, m, d] = dateInput.split("-").map((v) => Number(v));
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)).toISOString();
}

function addDays(dateInput: string, days: number): string {
  const [y, m, d] = dateInput.split("-").map((v) => Number(v));
  const result = new Date(Date.UTC(y, m - 1, d));
  result.setUTCDate(result.getUTCDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${result.getUTCFullYear()}-${pad(result.getUTCMonth() + 1)}-${pad(
    result.getUTCDate(),
  )}`;
}

function roundToNextHour(d: Date): Date {
  const next = new Date(d);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next;
}
