import { Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { AppModal } from "../components/AppModal";
import { PanelBlockSkeleton } from "../components/panelStatus";
import { useAppSession } from "../auth/AppSessionContext";
import { useIsMobile } from "../responsive";
import { APP_TEXT_SIZES, MAPPED_CLOSET_TAB_STACK_GAP } from "../theme/typography";
import type { ClosetItemModalNav } from "../closet/ClosetItemModalFooter";
import { fetchEntry } from "./api";
import EntryDetailContent from "./EntryDetailContent";
import type { RecommendationEntry } from "./types";

type RecommendationsEntryModalProps = {
  selectedEntryId: number | null;
  entryQueryInvalid: boolean;
  entryModalNav: ClosetItemModalNav;
  onClose: () => void;
  onEntryUpdated?: () => void;
};

export default function RecommendationsEntryModal({
  selectedEntryId,
  entryQueryInvalid,
  entryModalNav,
  onClose,
  onEntryUpdated,
}: RecommendationsEntryModalProps) {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { getApiAccessToken } = useAppSession();
  const [entry, setEntry] = useState<RecommendationEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const mergeNotice = (location.state as { merged?: boolean; message?: string } | null)?.message;

  const loadEntry = useCallback(async () => {
    if (selectedEntryId == null) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      setEntry(await fetchEntry(token, selectedEntryId));
    } catch (e) {
      setEntry(null);
      setError(e instanceof Error ? e.message : "Failed to load entry.");
    } finally {
      setLoading(false);
    }
  }, [getApiAccessToken, selectedEntryId]);

  useEffect(() => {
    if (selectedEntryId == null) {
      setEntry(null);
      setError(null);
      setLoading(false);
      return;
    }
    void loadEntry();
  }, [selectedEntryId, loadEntry]);

  const handleReload = useCallback(async () => {
    await loadEntry();
    onEntryUpdated?.();
  }, [loadEntry, onEntryUpdated]);

  const open = selectedEntryId != null || entryQueryInvalid;

  return (
    <AppModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      showHeader={false}
      size="xl"
      positionerProps={
        isMobile
          ? {
              px: "0",
              py: "0",
              alignItems: "stretch",
              justifyContent: "flex-start",
            }
          : undefined
      }
      contentProps={
        isMobile
          ? {
              maxW: "100vw",
              w: "100vw",
              maxH: "100dvh",
              h: "fit-content",
              my: "0",
              borderRadius: "0",
              borderWidth: "0",
              "aria-label": "Recommendation details",
              overflow: "hidden",
              pt: "2",
              px: "2",
              pb: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
            }
          : {
              maxW: "min(48rem, 100vw - 1.5rem)",
              "aria-label": "Recommendation details",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              maxH: "min(90vh, 760px)",
              my: "0",
              h: "fit-content",
            }
      }
      bodyProps={
        isMobile
          ? {
              flex: "0 1 auto",
              minH: 0,
              overflowY: "auto",
              maxH:
                "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)",
            }
          : {
              flex: "0 1 auto",
              minH: 0,
              overflowY: "auto",
              maxH: "min(85vh, 720px)",
            }
      }
    >
      <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
        {entryQueryInvalid ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="nautical.solid" role="alert">
            Invalid recommendation.
          </Text>
        ) : error && !entry ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="nautical.solid" role="alert">
            {error}
          </Text>
        ) : loading && !entry?.reviews?.length ? (
          <PanelBlockSkeleton lines={2} showTitleLine />
        ) : entry ? (
          <EntryDetailContent
            entry={entry}
            entryNav={entryModalNav}
            mergeNotice={mergeNotice}
            onReload={handleReload}
          />
        ) : (
          <PanelBlockSkeleton lines={2} showTitleLine />
        )}
      </Stack>
    </AppModal>
  );
}
