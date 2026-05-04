import { Box, Stack } from "@chakra-ui/react";
import { Navigate, useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import {
  PanelBlockSkeleton,
  PanelListRowSkeleton,
  PanelSessionReconnect,
  SessionLoadingCard,
} from "../components/panelStatus";
import { PANEL_ENTRY_CARD_PROPS } from "../theme/typography";
import SongadayArchivePanel from "./SongadayArchivePanel";

export default function SongadayArchivePage() {
  const {
    isAuthenticated,
    isLoading,
    sessionUser,
    error: sessionError,
    refreshSession,
  } = useAppSession();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  if (isLoading) {
    return (
      <SessionLoadingCard>
        <Stack gap="3">
          <Box {...PANEL_ENTRY_CARD_PROPS}>
            <PanelBlockSkeleton lines={1} showTitleLine />
          </Box>
          <Box {...PANEL_ENTRY_CARD_PROPS}>
            <PanelListRowSkeleton rows={3} />
          </Box>
        </Stack>
      </SessionLoadingCard>
    );
  }
  if (!sessionUser) {
    return (
      <PanelSessionReconnect
        sessionError={sessionError}
        onRetry={() => void refreshSession()}
      />
    );
  }

  return (
    <SongadayArchivePanel
      onSelectArchiveEntryDate={(iso) => {
        navigate("/songaday", { state: { songadayEntryDate: iso } });
      }}
    />
  );
}
