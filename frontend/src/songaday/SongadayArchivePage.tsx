import { Navigate, useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import {
  PanelSessionReconnect,
  SessionLoadingCard,
} from "../components/panelStatus";
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
    return <SessionLoadingCard />;
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
      variant="page"
      onSelectArchiveEntryDate={(iso) => {
        navigate("/songaday", { state: { songadayEntryDate: iso } });
      }}
    />
  );
}
