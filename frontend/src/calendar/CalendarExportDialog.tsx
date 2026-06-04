import { Box, Input, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppModal } from "../components/AppModal";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES, PANEL_NESTED_BLOCK_PROPS } from "../theme/typography";
import {
  downloadCalendarFeedIcs,
  fetchCalendarFeed,
  resetCalendarFeed,
  upsertCalendarFeed,
} from "./api";
import type { CalendarFeedSubscription } from "./types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderedCheckedUserIds: number[];
  getApiAccessToken: () => Promise<string | null>;
};

function sameIdSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sortedA.every((id, idx) => id === sortedB[idx]);
}

export default function CalendarExportDialog({
  open,
  onOpenChange,
  orderedCheckedUserIds,
  getApiAccessToken,
}: Props) {
  const [subscription, setSubscription] = useState<CalendarFeedSubscription | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectionChanged = useMemo(() => {
    if (!subscription) return false;
    return !sameIdSet(subscription.owner_ids, orderedCheckedUserIds);
  }, [orderedCheckedUserIds, subscription]);

  const loadSubscription = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      const result = await fetchCalendarFeed(token);
      setSubscription(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load subscription.");
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [getApiAccessToken]);

  useEffect(() => {
    if (!open) return;
    setNotice(null);
    void loadSubscription();
  }, [loadSubscription, open]);

  const ensureSubscription = async (): Promise<CalendarFeedSubscription> => {
    if (orderedCheckedUserIds.length === 0) {
      throw new Error("Select at least one person.");
    }
    const token = await getApiAccessToken();
    const next = await upsertCalendarFeed(token, orderedCheckedUserIds);
    setSubscription(next);
    return next;
  };

  const handleUpdateSubscription = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await ensureSubscription();
      setNotice("Your subscription now matches the people you checked.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not update subscription.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLink = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await ensureSubscription();
      setNotice("Link ready — copy it below for iPhone.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create link.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const sub = subscription && !selectionChanged
        ? subscription
        : await ensureSubscription();
      const blob = await downloadCalendarFeedIcs(sub.subscribe_url);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "friends-away.ics";
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice("Downloaded friends-away.ics — open it to import once.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not download calendar.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const token = await getApiAccessToken();
      const next = await resetCalendarFeed(token);
      setSubscription(next);
      setNotice(
        "Old link disabled. Paste the new link on iPhone (or copy again).",
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not reset link.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copied.`);
    } catch {
      setError("Could not copy to clipboard.");
    }
  };

  const showUrls =
    subscription !== null &&
    !selectionChanged &&
    subscription.subscribe_url.length > 0;

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title="Friends Away"
      description="A live calendar of when the people you checked are busy. Add it to iPhone, or download a snapshot file."
      size="md"
    >
      <Stack gap="3">
        {orderedCheckedUserIds.length === 0 ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="nautical.solid">
            Check at least one person in the list, then come back here.
          </Text>
        ) : null}

        {loading ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
            Loading…
          </Text>
        ) : null}

        {selectionChanged && subscription ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg" lineHeight="tall">
            You changed who is checked. Tap{" "}
            <Text as="span" fontWeight="semibold">
              Update subscription
            </Text>{" "}
            so your phone calendar matches.
          </Text>
        ) : null}

        {error ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="nautical.solid" role="alert">
            {error}
          </Text>
        ) : null}

        {notice ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="lilypad.solid">
            {notice}
          </Text>
        ) : null}

        {showUrls ? (
          <Stack gap="2" {...PANEL_NESTED_BLOCK_PROPS}>
            <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="semibold">
              Add to iPhone Calendar
            </Text>
            <Text as="ol" fontSize={APP_TEXT_SIZES.helper} color="fg.muted" lineHeight="tall" pl="4">
              <li>Settings → Calendar → Add Account → Other</li>
              <li>Add Subscribed Calendar</li>
              <li>Paste the link you copy below</li>
            </Text>
            <Input
              readOnly
              size="sm"
              value={subscription.subscribe_url}
              fontSize={APP_TEXT_SIZES.helper}
              aria-label="Subscription link for iPhone"
            />
            <PondButton
              size="sm"
              colorPalette="lilypad"
              onClick={() =>
                void handleCopy(subscription.subscribe_url, "Subscription link")
              }
            >
              Copy link for iPhone
            </PondButton>
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" lineHeight="tall">
              On a Mac or some apps you can{" "}
              <Box
                as="button"
                display="inline"
                fontSize={APP_TEXT_SIZES.helper}
                color="sky.solid"
                textDecoration="underline"
                cursor="pointer"
                bg="transparent"
                border="none"
                p="0"
                onClick={() =>
                  void handleCopy(subscription.webcal_url, "Calendar app link")
                }
              >
                use an alternate link
              </Box>{" "}
              that opens the calendar app directly (same feed as above). Treat
              the link like a password: anyone with it can see who is away for
              the people you included.
            </Text>
          </Stack>
        ) : null}

        <Stack gap="2">
          {selectionChanged && subscription ? (
            <PondButton
              size="sm"
              colorPalette="lilypad"
              onClick={() => void handleUpdateSubscription()}
              disabled={saving || orderedCheckedUserIds.length === 0}
            >
              Update subscription
            </PondButton>
          ) : !showUrls ? (
            <PondButton
              size="sm"
              colorPalette="lilypad"
              onClick={() => void handleCreateLink()}
              disabled={saving || loading || orderedCheckedUserIds.length === 0}
            >
              Create subscription link
            </PondButton>
          ) : null}

          <PondButton
            size="sm"
            colorPalette="sky"
            variant="outline"
            onClick={() => void handleDownload()}
            disabled={saving || loading || orderedCheckedUserIds.length === 0}
          >
            Download snapshot (.ics)
          </PondButton>

          {subscription ? (
            <PondButton
              size="sm"
              colorPalette="gray"
              variant="outline"
              onClick={() => void handleReset()}
              disabled={saving || loading}
            >
              Reset link (if shared by mistake)
            </PondButton>
          ) : null}
        </Stack>
      </Stack>
    </AppModal>
  );
}
