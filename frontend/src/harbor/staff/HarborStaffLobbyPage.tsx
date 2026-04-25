import { Box, Heading, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { Link } from "react-router";

const SECTIONS = [
  { to: "/harbor/staff/ships", label: "Ships", note: "Hulls, capacities, roles" },
  { to: "/harbor/staff/buildings", label: "Buildings", note: "Districts, level effects, prereqs" },
  { to: "/harbor/staff/operations", label: "Operations", note: "Voyages, recruit, repair, public works" },
  { to: "/harbor/staff/arrivals", label: "Arrivals", note: "Trades, refugees, envoys" },
  { to: "/harbor/staff/events", label: "Events", note: "Random + pressure-driven crises" },
  { to: "/harbor/staff/consequences", label: "Consequences", note: "Delayed events from prior choices" },
  { to: "/harbor/staff/policies", label: "Policies", note: "Exclusive-group toggles" },
  { to: "/harbor/staff/doctrines", label: "Doctrines", note: "Endgame identities (stage 12)" },
  { to: "/harbor/staff/playtest", label: "Playtest", note: "Run the engine on the live catalog" },
];

export default function HarborStaffLobbyPage() {
  return (
    <Stack gap={3}>
      <Heading size="md">Catalog editor</Heading>
      <Text color="fg.muted">
        Edit the eight catalog tables that drive Harbormaster. Player saves
        reference content by slug; renames remain compatible only if you
        re-import. Use Playtest to run the engine without touching your save.
      </Text>
      <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} gap={3}>
        {SECTIONS.map((s) => (
          <Link key={s.to} to={s.to} style={{ textDecoration: "none" }}>
            <Box
              borderWidth="1px"
              borderRadius="lg"
              p={4}
              _hover={{ bg: "bg.muted" }}
              h="full"
            >
              <Heading size="sm">{s.label}</Heading>
              <Text fontSize="sm" color="fg.muted" mt={1}>
                {s.note}
              </Text>
            </Box>
          </Link>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
