import { Stack, Text } from "@chakra-ui/react";
import { Navigate, useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import SongadayArchivePanel from "./SongadayArchivePanel";

export default function SongadayArchivePage() {
  const { isAuthenticated, isLoading, sessionUser } = useAppSession();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  if (isLoading || !sessionUser) {
    return (
      <Stack gap="2" maxW="5xl">
        <Text fontWeight="semibold">Loading…</Text>
      </Stack>
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
