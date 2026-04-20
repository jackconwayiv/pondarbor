import {
  HStack,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { AppModal } from "../components/AppModal";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES, PANEL_FIELD_PROPS } from "../theme/typography";
import type { CalendarColor, SourceCreatePayload } from "./types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: SourceCreatePayload) => Promise<void>;
};

const COLOR_OPTIONS: Array<{ value: CalendarColor; label: string }> = [
  { value: "lilypad", label: "Lilypad (green)" },
  { value: "sky", label: "Sky (blue)" },
  { value: "nautical", label: "Nautical (coral)" },
  { value: "gray", label: "Gray" },
];

export default function ImportIcalDialog({ open, onOpenChange, onSubmit }: Props) {
  const [displayName, setDisplayName] = useState("");
  const [icalUrl, setIcalUrl] = useState("");
  const [color, setColor] = useState<CalendarColor>("lilypad");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDisplayName("");
    setIcalUrl("");
    setColor("lilypad");
    setError(null);
  }, [open]);

  const handleSubmit = async () => {
    const trimmedName = displayName.trim();
    const trimmedUrl = icalUrl.trim();
    if (!trimmedName) {
      setError("Give the calendar a short label.");
      return;
    }
    if (!trimmedUrl) {
      setError("Paste your Google Calendar's iCal URL.");
      return;
    }
    try {
      const parsed = new URL(trimmedUrl);
      if (parsed.protocol !== "https:") {
        setError("The URL must start with https://");
        return;
      }
      if (parsed.hostname.toLowerCase() !== "calendar.google.com") {
        setError(
          "Only Google Calendar iCal URLs are supported (calendar.google.com).",
        );
        return;
      }
    } catch {
      setError("That doesn't look like a valid URL.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        display_name: trimmedName,
        ical_url: trimmedUrl,
        color,
      });
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not import calendar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title="Import Google Calendar"
      size="lg"
      description={
        <>
          In Google Calendar go to <strong>Settings → your calendar →
          Integrate calendar</strong> and copy the{" "}
          <strong>Secret address in iCal format</strong>. That URL shares
          exactly one calendar with Pondarbor.
        </>
      }
    >
      <Stack gap="3">
        <Stack gap="1">
          <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
            Label
          </Text>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={120}
            placeholder="e.g. Travel, Family"
            {...PANEL_FIELD_PROPS}
          />
        </Stack>
        <Stack gap="1">
          <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
            iCal URL
          </Text>
          <Input
            value={icalUrl}
            onChange={(e) => setIcalUrl(e.target.value)}
            placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
            {...PANEL_FIELD_PROPS}
          />
          <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
            We only fetch this URL server-side every ~15 minutes. Sharing this
            link is equivalent to sharing that one calendar.
          </Text>
        </Stack>
        <Stack gap="1">
          <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium">
            Color
          </Text>
          <NativeSelectRoot maxW="260px">
            <NativeSelectField
              value={color}
              onChange={(e) => setColor(e.target.value as CalendarColor)}
            >
              {COLOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </NativeSelectField>
          </NativeSelectRoot>
        </Stack>
        {error ? (
          <Text color="nautical.solid" fontSize={APP_TEXT_SIZES.helper}>
            {error}
          </Text>
        ) : null}
        <HStack gap="2">
          <PondButton colorPalette="lilypad" loading={saving} onClick={handleSubmit}>
            Import calendar
          </PondButton>
          <PondButton
            colorPalette="sky"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </PondButton>
        </HStack>
      </Stack>
    </AppModal>
  );
}
