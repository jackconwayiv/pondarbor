import { Box, Heading, Text } from "@chakra-ui/react";
import { useNavigate } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import QffButton from "./QffButton";
import {
  dmDownloadClassesJsonExport,
  dmDownloadItemsJsonExport,
  dmDownloadQuestWorldJsonExport,
} from "./api";

export default function QffDmLobbyPage() {
  const navigate = useNavigate();
  const { isAuthenticated, sessionUser, isLoading, getApiAccessToken } = useAppSession();
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

  return (
    <Box maxW="3xl" mx="auto" px={4} py={8} color="#c8e6a8">
      <Heading size="lg" mb={4}>
        Quest for Fat — DM
      </Heading>
      <Text mb={6} color="#889977">
        Choose which editor to open. More tools may be added here later.
      </Text>
      <Box mb={8}>
        <QffButton onClick={() => navigate("/qff/dm/world")}>
          World, areas & rooms
        </QffButton>
        <Text mt={2} fontSize="sm" color="#889977">
          Create areas and rooms, place rooms on the map, edit exits and room text.
        </Text>
      </Box>
      <Box mb={8}>
        <QffButton onClick={() => navigate("/qff/dm/items")}>
          Item templates
        </QffButton>
        <Text mt={2} fontSize="sm" color="#889977">
          Full CRUD on item definitions used to spawn instances in the world.
        </Text>
      </Box>
      <Box mb={8}>
        <QffButton onClick={() => navigate("/qff/dm/classes")}>
          Character classes
        </QffButton>
        <Text mt={2} fontSize="sm" color="#889977">
          Name, description, priority stats, chest + main starting items, and extra JSON for future spells.
        </Text>
      </Box>
      <Box mb={8}>
        <QffButton onClick={() => navigate("/qff/dm/quests")}>Quests</QffButton>
        <Text mt={2} fontSize="sm" color="#889977">
          Quest states, transitions, and effects (list view; full authoring via API for now).
        </Text>
      </Box>
      <Box mb={8}>
        <QffButton onClick={() => navigate("/qff/dm/npcs")}>NPCs</QffButton>
        <Text mt={2} fontSize="sm" color="#889977">
          Per-room NPCs and dialogue bindings.
        </Text>
      </Box>
      <Box mb={8}>
        <QffButton onClick={() => navigate("/qff/dm/shops")}>NPC shops</QffButton>
        <Text mt={2} fontSize="sm" color="#889977">
          Merchant stock, pricing, and sell rules (separate from the NPC dialogue editor).
        </Text>
      </Box>
      <Box mb={8}>
        <QffButton onClick={() => navigate("/qff/dm/interactables")}>Interactables</QffButton>
        <Text mt={2} fontSize="sm" color="#889977">
          Signs, levers, chests, and exit unlock links.
        </Text>
      </Box>
      <Box mb={8}>
        <QffButton onClick={() => navigate("/qff/dm/ineffective-inputs")}>
          Ineffective commands
        </QffButton>
        <Text mt={2} fontSize="sm" color="#889977">
          Unknown parser lines (“nothing happens”) with player email and timestamp.
        </Text>
      </Box>
      <Box mb={8}>
        <Text mb={2} fontSize="sm" color="#889977">
          Export JSON (backup / migration)
        </Text>
        <QffButton
          onClick={() =>
            getApiAccessToken().then((t) => dmDownloadItemsJsonExport(t))
          }
        >
          Download all items JSON
        </QffButton>{" "}
        <QffButton
          onClick={() =>
            getApiAccessToken().then((t) => dmDownloadClassesJsonExport(t))
          }
        >
          Download all classes JSON
        </QffButton>{" "}
        <QffButton
          onClick={() =>
            getApiAccessToken().then((t) => dmDownloadQuestWorldJsonExport(t))
          }
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
