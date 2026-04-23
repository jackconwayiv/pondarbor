import { Box, Grid, Heading, Text } from "@chakra-ui/react";
import { useNavigate, Link as RouterLink } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import QffButton from "./QffButton";
import {
  dmDownloadClassesJsonExport,
  dmDownloadItemsJsonExport,
  dmDownloadQuestWorldJsonExport,
} from "./api";

const DM_EDITOR_CARDS: { to: string; title: string; blurb: string }[] = [
  {
    to: "/qff/dm/world",
    title: "World / Areas / Rooms",
    blurb: "Create areas and rooms, place rooms on the map, edit exits and room text.",
  },
  {
    to: "/qff/dm/quests",
    title: "Quests",
    blurb: "Quest states, transitions, and effects (list view; full authoring via API for now).",
  },
  {
    to: "/qff/dm/npcs",
    title: "NPCs",
    blurb: "Per-room NPCs and dialogue bindings.",
  },
  {
    to: "/qff/dm/interactables",
    title: "Interactables",
    blurb: "Signs, levers, chests, and exit unlock links.",
  },
  {
    to: "/qff/dm/items",
    title: "Items",
    blurb: "Full CRUD on item definitions used to spawn instances in the world.",
  },
  {
    to: "/qff/dm/monsters",
    title: "Monsters",
    blurb: "Stats, combat fields, and loot JSON for lairs and encounters.",
  },
  {
    to: "/qff/dm/combat-sim",
    title: "Combat Simulator",
    blurb: "Deterministic to-hit, crit, and mitigation; import as scratch, export new rows only.",
  },
  {
    to: "/qff/dm/shops",
    title: "Shops",
    blurb: "Merchant stock, pricing, and sell rules (separate from the NPC dialogue editor).",
  },
  {
    to: "/qff/dm/classes",
    title: "Classes",
    blurb: "Name, description, priority stats, chest + main starting items, and extra JSON.",
  },
  {
    to: "/qff/dm/ineffective-inputs",
    title: "Ineffective Commands",
    blurb: "Unknown parser lines (“nothing happens”) with player email and timestamp.",
  },
];

export default function QffDmLobbyPage() {
  const navigate = useNavigate();
  const { isAuthenticated, sessionUser, isLoading, getApiAccessToken } = useAppSession();
  const isStaff = !!sessionUser?.user?.is_staff;

  if (isLoading) {
    return (
      <Box maxW="6xl" mx="auto" px={4} py={8} color="#c8e6a8">
        <Text>Loading…</Text>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Box maxW="6xl" mx="auto" px={4} py={8} color="#c8e6a8">
        <Text>Sign in to use DM tools.</Text>
      </Box>
    );
  }

  if (!isStaff) {
    return (
      <Box maxW="6xl" mx="auto" px={4} py={8} color="#c8e6a8">
        <Text>Staff only.</Text>
      </Box>
    );
  }

  return (
    <Box maxW="6xl" mx="auto" px={4} py={8} color="#c8e6a8">
      <Heading size="lg" mb={4}>
        Quest for Fat — DM
      </Heading>
      <Text mb={6} color="#889977">
        Choose an editor. More tools may be added here later.
      </Text>

      <Grid
        templateColumns={{
          base: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          md: "repeat(3, minmax(0, 1fr))",
          lg: "repeat(4, minmax(0, 1fr))",
        }}
        gap={4}
        mb={8}
      >
        {DM_EDITOR_CARDS.map((c) => (
          <Box
            key={c.to}
            as={RouterLink}
            to={c.to}
            display="block"
            borderWidth="1px"
            borderColor="whiteAlpha.300"
            borderRadius="md"
            p={4}
            bg="#1a1a1a"
            textDecoration="none"
            color="inherit"
            transition="border-color 0.15s, background 0.15s"
            _hover={{
              borderColor: "whiteAlpha.500",
              bg: "#222",
            }}
            _focusVisible={{ outline: "2px solid", outlineColor: "green.500", outlineOffset: "2px" }}
          >
            <Text fontSize="sm" fontWeight="semibold" color="#c8e6a8" lineHeight="short">
              {c.title}
            </Text>
            <Text fontSize="xs" color="#889977" mt={2} lineHeight="snug">
              {c.blurb}
            </Text>
          </Box>
        ))}
      </Grid>

      <Box mb={8}>
        <Text mb={2} fontSize="sm" color="#889977">
          Export JSON (backup / migration)
        </Text>
        <QffButton
          onClick={() => getApiAccessToken().then((t) => dmDownloadItemsJsonExport(t))}
        >
          Download all items JSON
        </QffButton>{" "}
        <QffButton
          onClick={() => getApiAccessToken().then((t) => dmDownloadClassesJsonExport(t))}
        >
          Download all classes JSON
        </QffButton>{" "}
        <QffButton
          onClick={() => getApiAccessToken().then((t) => dmDownloadQuestWorldJsonExport(t))}
        >
          Download quest world JSON
        </QffButton>
      </Box>
      <Box
        as="button"
        color="#889977"
        cursor="pointer"
        textDecoration="underline"
        textAlign="left"
        bg="transparent"
        border="none"
        p={0}
        font="inherit"
        onClick={() => navigate("/qff")}
      >
        ← Quest for Fat lobby
      </Box>
    </Box>
  );
}
