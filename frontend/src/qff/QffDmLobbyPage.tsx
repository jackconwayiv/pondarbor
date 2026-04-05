import { Box, Heading, Text } from "@chakra-ui/react";
import { useNavigate } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";

export default function QffDmLobbyPage() {
  const navigate = useNavigate();
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

  return (
    <Box maxW="3xl" mx="auto" px={4} py={8} color="#c8e6a8">
      <Heading size="lg" mb={4}>
        Quest for Fat — DM
      </Heading>
      <Text mb={6} color="#889977">
        Choose which editor to open. More tools may be added here later.
      </Text>
      <Box mb={8}>
        <PondButton onClick={() => navigate("/qff/dm/world")}>
          World, areas & rooms
        </PondButton>
        <Text mt={2} fontSize="sm" color="#889977">
          Create areas and rooms, place rooms on the map, edit exits and room text.
        </Text>
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
