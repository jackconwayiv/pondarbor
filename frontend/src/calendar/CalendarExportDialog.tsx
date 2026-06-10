import { Box, HStack, Input, Stack, Text } from "@chakra-ui/react";
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

type FeedMode = "selected" | "all_visible";

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

/** Subscription and Safari preview both need https — webcal opens the Calendar app, not the browser. */
function httpsFeedUrl(url: string): string {
  return url.replace(/^http:\/\//i, "https://");
}

function webcalFromSubscription(subscription: CalendarFeedSubscription): string {
  const https = httpsFeedUrl(subscription.subscribe_url);
  if (subscription.webcal_url.startsWith("webcal://")) {
    return subscription.webcal_url;
  }
  return https.replace(/^https:\/\//i, "webcal://");
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
  const [feedMode, setFeedMode] = useState<FeedMode>("selected");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const configMismatch = useMemo(() => {
    if (!subscription) return false;
    if (feedMode === "all_visible") {
      return !subscription.include_all_visible;
    }
    if (subscription.include_all_visible) return true;
    return !sameIdSet(subscription.owner_ids, orderedCheckedUserIds);
  }, [feedMode, orderedCheckedUserIds, subscription]);

  const canSave = feedMode === "all_visible" || orderedCheckedUserIds.length > 0;

  const loadSubscription = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      const result = await fetchCalendarFeed(token);
      setSubscription(result);
      if (result?.include_all_visible) {
        setFeedMode("all_visible");
      } else if (result) {
        setFeedMode("selected");
      }
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
    if (feedMode === "selected" && orderedCheckedUserIds.length === 0) {
      throw new Error("Select at least one person, or choose everyone you can see.");
    }
    const token = await getApiAccessToken();
    const next = await upsertCalendarFeed(
      token,
      feedMode === "all_visible"
        ? { include_all_visible: true, owner_ids: [] }
        : {
            include_all_visible: false,
            owner_ids: orderedCheckedUserIds,
          },
    );
    setSubscription(next);
    return next;
  };

  const handleUpdateSubscription = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await ensureSubscription();
      setNotice(
        feedMode === "all_visible"
          ? "Subscription now includes everyone you can see (updates automatically)."
          : "Your subscription now matches the people you checked.",
      );
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
      const sub =
        subscription && !configMismatch ? subscription : await ensureSubscription();
      const blob = await downloadCalendarFeedIcs(httpsFeedUrl(sub.subscribe_url));
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
    !configMismatch &&
    subscription.subscribe_url.length > 0;

  const httpsSubscribeUrl = subscription
    ? httpsFeedUrl(subscription.subscribe_url)
    : "";
  const webcalSubscribeUrl = subscription
    ? webcalFromSubscription(subscription)
    : "";

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title="Friends Away"
      description="A live calendar of when people are busy. Add it to iPhone, or download a snapshot file."
      size="md"
    >
      <Stack gap="3">
        <Stack gap="2" {...PANEL_NESTED_BLOCK_PROPS}>
          <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="semibold">
            Who to include
          </Text>
          <HStack gap="2" flexWrap="wrap">
            <PondButton
              size="sm"
              colorPalette="lilypad"
              variant={feedMode === "all_visible" ? "solid" : "outline"}
              onClick={() => setFeedMode("all_visible")}
            >
              Everyone I can see
            </PondButton>
            <PondButton
              size="sm"
              colorPalette="sky"
              variant={feedMode === "selected" ? "solid" : "outline"}
              onClick={() => setFeedMode("selected")}
            >
              Only checked people
            </PondButton>
          </HStack>
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" lineHeight="tall">
            {feedMode === "all_visible"
              ? "Matches the people list in Calendar — new members appear automatically when you can see them. No need to update the link."
              : "Uses whoever you have checked in the people list right now. Update the subscription if you change checkboxes."}
          </Text>
        </Stack>

        {feedMode === "selected" && orderedCheckedUserIds.length === 0 ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="nautical.solid">
            Check at least one person in the list, or switch to everyone you can see.
          </Text>
        ) : null}

        {loading ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
            Loading…
          </Text>
        ) : null}

        {configMismatch && subscription ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg" lineHeight="tall">
            Your link settings changed. Tap{" "}
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
              <li>Calendar → Calendars → Add Calendar → Add Subscription Calendar</li>
              <li>
                Or: Settings → Calendar → Add Account → Other → Add Subscribed
                Calendar
              </li>
              <li>Paste the https link you copy below (not webcal)</li>
            </Text>
            <Input
              readOnly
              size="sm"
              value={httpsSubscribeUrl}
              fontSize={APP_TEXT_SIZES.helper}
              aria-label="HTTPS subscription link"
            />
            <PondButton
              size="sm"
              colorPalette="lilypad"
              onClick={() =>
                void handleCopy(httpsSubscribeUrl, "HTTPS subscription link")
              }
            >
              Copy https link for iPhone
            </PondButton>
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" lineHeight="tall">
              Use the https link to preview in Safari or subscribe on iPhone.
              Webcal links open the Calendar app instead of the browser, so they
              are not useful for checking the feed in Safari. On a Mac you can{" "}
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
                  void handleCopy(webcalSubscribeUrl, "Webcal link")
                }
              >
                copy a webcal link
              </Box>{" "}
              to add the subscription in Calendar directly. Treat either link
              like a password: anyone with it can see who is away for the people
              you included.
            </Text>
          </Stack>
        ) : null}

        <Stack gap="2">
          {configMismatch && subscription ? (
            <PondButton
              size="sm"
              colorPalette="lilypad"
              onClick={() => void handleUpdateSubscription()}
              disabled={saving || !canSave}
            >
              Update subscription
            </PondButton>
          ) : !showUrls ? (
            <PondButton
              size="sm"
              colorPalette="lilypad"
              onClick={() => void handleCreateLink()}
              disabled={saving || loading || !canSave}
            >
              Create subscription link
            </PondButton>
          ) : null}

          <PondButton
            size="sm"
            colorPalette="sky"
            variant="outline"
            onClick={() => void handleDownload()}
            disabled={saving || loading || !canSave}
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
