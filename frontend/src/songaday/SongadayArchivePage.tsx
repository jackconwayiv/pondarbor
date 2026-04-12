import { Stack, Text } from "@chakra-ui/react";
import { Navigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import SongadayArchivePanel from "./SongadayArchivePanel";

export default function SongadayArchivePage() {
  const { isAuthenticated, isLoading, sessionUser } = useAppSession();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  if (isLoading || !sessionUser) {
    return (
      <Stack gap="2" maxW="4xl">
        <Text fontWeight="semibold">Loading…</Text>
      </Stack>
    );
  }

  return (
    <SongadayArchivePanel variant="embedded" entryDetailReturnTo="/songaday/archive" />
  );
}
