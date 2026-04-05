import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { dmFetchInteractables, type DmInteractableRow } from "./api";

export default function QffDmInteractablesPage() {
  const navigate = useNavigate();
  const { isAuthenticated, sessionUser, isLoading, getApiAccessToken } = useAppSession();
  const isStaff = !!sessionUser?.user?.is_staff;
  const [rows, setRows] = useState<DmInteractableRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getApiAccessToken();
    const data = await dmFetchInteractables(token);
    setRows(data);
  }, [getApiAccessToken]);

  useEffect(() => {
    if (!isAuthenticated || !isStaff) return;
    load().catch((e) => setErr(String(e)));
  }, [isAuthenticated, isStaff, load]);

  if (isLoading) {
    return (
      <Box maxW="4xl" mx="auto" px={4} py={8} color="#c8e6a8">
        <Text>Loading…</Text>
      </Box>
    );
  }

  if (!isAuthenticated || !isStaff) {
    return (
      <Box maxW="4xl" mx="auto" px={4} py={8} color="#c8e6a8">
        <Text>Staff only.</Text>
      </Box>
    );
  }

  return (
    <Box maxW="4xl" mx="auto" px={4} py={8} color="#c8e6a8">
      <Heading size="lg" mb={2}>
        Interactables
      </Heading>
      <Text mb={4} color="#889977" fontSize="sm">
        Signs, levers, chests, etc. Link unlocks_exit_id to a room exit for timed realm opens, or
        attach a quest transition for scripted use.
      </Text>
      {err && (
        <Text color="red.300" mb={4}>
          {err}
        </Text>
      )}
      <PondButton onClick={() => navigate("/qff/dm")} mb={6}>
        ← DM home
      </PondButton>
      <Stack gap={2} fontSize="sm">
        {rows.map((o) => (
          <Box key={o.id} borderWidth="1px" borderRadius="md" p={2} borderColor="whiteAlpha.300">
            <Text fontWeight="medium">
              {o.name}{" "}
              <Text as="span" color="#889977" fontWeight="normal">
                ({o.kind})
              </Text>
            </Text>
            <Text color="#889977">
              room {o.room_id} · {o.slug}
            </Text>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
