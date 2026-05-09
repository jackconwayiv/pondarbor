import { Box, Heading, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { Link } from "react-router";

const SECTION_GROUPS: Array<{
  title: string;
  sections: Array<{ to: string; label: string; note: string }>;
}> = [
  {
    title: "Catalog definitions",
    sections: [
      {
        to: "/harbor/staff/ships",
        label: "Ships",
        note: "Hulls, capacities, roles",
      },
      {
        to: "/harbor/staff/buildings",
        label: "Buildings",
        note: "Districts, level effects, prereqs",
      },
      {
        to: "/harbor/staff/operations",
        label: "Operations",
        note: "Voyages, recruit, repair, public works",
      },
      {
        to: "/harbor/staff/arrivals",
        label: "Arrivals",
        note: "Trades, refugees, envoys",
      },
      {
        to: "/harbor/staff/events",
        label: "Events",
        note: "Random + pressure-driven crises",
      },
      {
        to: "/harbor/staff/consequences",
        label: "Consequences",
        note: "Delayed events from prior choices",
      },
      {
        to: "/harbor/staff/policies",
        label: "Policies",
        note: "Exclusive-group toggles",
      },
      {
        to: "/harbor/staff/doctrines",
        label: "Doctrines",
        note: "Endgame identities (stage 12)",
      },
      {
        to: "/harbor/staff/ship_upgrades",
        label: "Ship upgrades",
        note: "Age 1 yard attachments",
      },
    ],
  },
  {
    title: "Progression",
    sections: [
      {
        to: "/harbor/staff/stages",
        label: "Stages",
        note: "Age titles, tension copy, unlock deltas",
      },
    ],
  },
  {
    title: "Tools",
    sections: [
      {
        to: "/harbor/staff/playtest",
        label: "Playtest",
        note: "Run the engine on the live catalog",
      },
    ],
  },
];

export default function HarborStaffLobbyPage() {
  return (
    <Stack gap={6}>
      <Box>
        <Heading size="md">Catalog editor</Heading>
        <Text color="fg.muted" mt={2} maxW="3xl">
          Edit the tables that drive Harbormaster. Player saves reference
          content by slug; renames stay compatible only if you re-import. Use
          Playtest to run the engine without touching a save.
        </Text>
      </Box>

      {SECTION_GROUPS.map((group) => (
        <Box key={group.title}>
          <Text
            fontSize="sm"
            fontWeight="semibold"
            color="fg.muted"
            textTransform="uppercase"
            letterSpacing="wider"
            mb={3}
          >
            {group.title}
          </Text>
          <SimpleGrid
            columns={{ base: 1, md: 3, xl: 4 }}
            gap={4}
          >
            {group.sections.map((s) => (
              <Link key={s.to} to={s.to} style={{ textDecoration: "none" }}>
                <Box
                  borderWidth="1px"
                  borderRadius="lg"
                  borderColor="border.subtle"
                  p={5}
                  h="full"
                  transition="background 0.15s ease"
                  _hover={{
                    bg: "bg.muted",
                    borderColor: "border.emphasized",
                  }}
                >
                  <Heading size="sm">{s.label}</Heading>
                  <Text fontSize="sm" color="fg.muted" mt={2} lineHeight="short">
                    {s.note}
                  </Text>
                </Box>
              </Link>
            ))}
          </SimpleGrid>
        </Box>
      ))}
    </Stack>
  );
}
