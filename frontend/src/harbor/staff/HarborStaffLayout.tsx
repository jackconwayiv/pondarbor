import { Box, HStack, Heading, Stack, Text } from "@chakra-ui/react";
import { Link, Outlet } from "react-router";

import { useAppSession } from "../../auth/AppSessionContext";
import PondButton from "../../PondButton";

const NAV_LINKS: Array<{ to: string; label: string }> = [
  { to: "/harbor/staff", label: "Lobby" },
  { to: "/harbor/staff/ships", label: "Ships" },
  { to: "/harbor/staff/buildings", label: "Buildings" },
  { to: "/harbor/staff/operations", label: "Operations" },
  { to: "/harbor/staff/arrivals", label: "Arrivals" },
  { to: "/harbor/staff/events", label: "Events" },
  { to: "/harbor/staff/consequences", label: "Consequences" },
  { to: "/harbor/staff/policies", label: "Policies" },
  { to: "/harbor/staff/doctrines", label: "Doctrines" },
  { to: "/harbor/staff/playtest", label: "Playtest" },
];

export default function HarborStaffLayout() {
  const { isAuthenticated, sessionUser, isLoading } = useAppSession();
  const isStaff = !!sessionUser?.user?.is_staff;

  if (isLoading) {
    return (
      <Box maxW="5xl" mx="auto" px={4} py={6}>
        <Text>Loading…</Text>
      </Box>
    );
  }
  if (!isAuthenticated) {
    return (
      <Box maxW="5xl" mx="auto" px={4} py={6}>
        <Text>Sign in to use Harbormaster staff tools.</Text>
      </Box>
    );
  }
  if (!isStaff) {
    return (
      <Box maxW="5xl" mx="auto" px={4} py={6}>
        <Text>Staff only.</Text>
      </Box>
    );
  }
  return (
    <Box maxW="5xl" mx="auto" px={4} py={6}>
      <Stack gap={4}>
        <Heading size="lg">Harbormaster · Staff</Heading>
        <HStack flexWrap="wrap" gap={2}>
          {NAV_LINKS.map((link) => (
            <Link key={link.to} to={link.to}>
              <PondButton size="xs" colorPalette="lilypad">
                {link.label}
              </PondButton>
            </Link>
          ))}
        </HStack>
        <Outlet />
      </Stack>
    </Box>
  );
}
