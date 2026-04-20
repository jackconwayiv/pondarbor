import { Box, Text } from "@chakra-ui/react";
import { Outlet } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";

/**
 * All `/qff/dm/*` tools require staff. This layout gates before child routes render.
 * Individual DM pages also check `is_staff` (defense in depth). DM APIs use
 * `IsStaffUser` on the server (`backend/qff/views.py`).
 */
export default function QffDmStaffLayout() {
  const { isAuthenticated, sessionUser, isLoading } = useAppSession();
  const isStaff = !!sessionUser?.user?.is_staff;

  if (isLoading) {
    return (
      <Box maxW="3xl" mx="auto" px={4} py={8} color="#c8e6a8">
        <Text>Loading…</Text>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Box maxW="3xl" mx="auto" px={4} py={8} color="#c8e6a8">
        <Text>Sign in to use DM tools.</Text>
      </Box>
    );
  }

  if (!isStaff) {
    return (
      <Box maxW="3xl" mx="auto" px={4} py={8} color="#c8e6a8">
        <Text>Staff only.</Text>
      </Box>
    );
  }

  return <Outlet />;
}
