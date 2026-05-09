import { Box, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import { Link, NavLink, Outlet } from "react-router";

import { useAppSession } from "../../auth/AppSessionContext";

const NAV_GROUPS: Array<{
  title: string;
  links: Array<{ to: string; label: string }>;
}> = [
  {
    title: "Overview",
    links: [{ to: "/harbor/staff", label: "Lobby" }],
  },
  {
    title: "Catalog",
    links: [
      { to: "/harbor/staff/ships", label: "Ships" },
      { to: "/harbor/staff/buildings", label: "Buildings" },
      { to: "/harbor/staff/operations", label: "Operations" },
      { to: "/harbor/staff/arrivals", label: "Arrivals" },
      { to: "/harbor/staff/events", label: "Events" },
      { to: "/harbor/staff/consequences", label: "Consequences" },
      { to: "/harbor/staff/policies", label: "Policies" },
      { to: "/harbor/staff/doctrines", label: "Doctrines" },
      { to: "/harbor/staff/ship_upgrades", label: "Ship upgrades" },
    ],
  },
  {
    title: "Progression",
    links: [{ to: "/harbor/staff/stages", label: "Stages" }],
  },
  {
    title: "Tools",
    links: [{ to: "/harbor/staff/playtest", label: "Playtest" }],
  },
];

function NavItem({
  to,
  label,
}: {
  to: string;
  label: string;
}) {
  const isLobby = to === "/harbor/staff";
  return (
    <NavLink to={to} end={isLobby}>
      {({ isActive }) => (
        <Box
          display="block"
          px={3}
          py={1.5}
          borderRadius="md"
          fontSize="sm"
          fontWeight={isActive ? "semibold" : "normal"}
          bg={isActive ? "bg.muted" : "transparent"}
          color={isActive ? "fg" : "fg.muted"}
          borderWidth="1px"
          borderColor={isActive ? "border.subtle" : "transparent"}
          _hover={{
            bg: isActive ? "bg.muted" : "bg.subtle",
            color: "fg",
          }}
        >
          {label}
        </Box>
      )}
    </NavLink>
  );
}

export default function HarborStaffLayout() {
  const { isAuthenticated, sessionUser, isLoading } = useAppSession();
  const isStaff = !!sessionUser?.user?.is_staff;

  if (isLoading) {
    return (
      <Box maxW="7xl" mx="auto" px={{ base: 4, md: 8 }} py={6}>
        <Text>Loading…</Text>
      </Box>
    );
  }
  if (!isAuthenticated) {
    return (
      <Box maxW="7xl" mx="auto" px={{ base: 4, md: 8 }} py={6}>
        <Text>Sign in to use Harbormaster staff tools.</Text>
      </Box>
    );
  }
  if (!isStaff) {
    return (
      <Box maxW="7xl" mx="auto" px={{ base: 4, md: 8 }} py={6}>
        <Text>Staff only.</Text>
      </Box>
    );
  }

  return (
    <Box maxW="7xl" mx="auto" px={{ base: 4, md: 8 }} py={6} w="full">
      <Stack gap={{ base: 4, md: 6 }}>
        <Box>
          <Heading size="lg">Harbormaster · Staff</Heading>
          <Text fontSize="sm" color="fg.muted" mt={1}>
            Catalog editors for desktop.{" "}
            <Link to="/harbor" style={{ textDecoration: "underline" }}>
              ← Harbor lobby
            </Link>
          </Text>
        </Box>

        <Flex
          gap={{ base: 4, md: 8 }}
          align="flex-start"
          flexDir={{ base: "column", md: "row" }}
          minH="70vh"
        >
          <Box
            flexShrink={0}
            w={{ base: "full", md: "240px" }}
            position={{ md: "sticky" }}
            top={{ md: 4 }}
            alignSelf="flex-start"
          >
            <Stack gap={4}>
              {NAV_GROUPS.map((group) => (
                <Box key={group.title}>
                  <Text
                    fontSize="xs"
                    fontWeight="semibold"
                    color="fg.muted"
                    textTransform="uppercase"
                    letterSpacing="wider"
                    mb={2}
                    px={1}
                  >
                    {group.title}
                  </Text>
                  <Stack gap={1}>
                    {group.links.map((link) => (
                      <NavItem
                        key={link.to}
                        to={link.to}
                        label={link.label}
                      />
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>

          <Box
            flex="1"
            minW={0}
            w="full"
            borderLeftWidth={{ base: 0, md: "1px" }}
            borderColor="border.subtle"
            pl={{ base: 0, md: 8 }}
          >
            <Outlet />
          </Box>
        </Flex>
      </Stack>
    </Box>
  );
}
