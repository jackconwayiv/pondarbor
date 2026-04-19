import { Box, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import QffButton from "./QffButton";
import { deleteQffCharacter, fetchQffSession } from "./api";
import { QFF_STORY, QFF_SUBTITLES } from "./copy";

export default function QffLobbyPage() {
  const navigate = useNavigate();
  const {
    isAuthenticated,
    sessionUser,
    isLoading,
    error: sessionError,
    getApiAccessToken,
  } = useAppSession();
  const getTokenRef = useRef(getApiAccessToken);
  getTokenRef.current = getApiAccessToken;
  const [sessionBusy, setSessionBusy] = useState(true);
  const [hasCharacter, setHasCharacter] = useState<boolean | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const deleteButtonWrapRef = useRef<HTMLDivElement | null>(null);

  const subtitle = useMemo(() => {
    const i = Math.floor(Math.random() * QFF_SUBTITLES.length);
    return QFF_SUBTITLES[i];
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !sessionUser?.user?.is_approved) {
      setSessionBusy(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const s = await fetchQffSession(token);
        if (!cancelled) {
          setHasCharacter(s.has_character);
        }
      } catch {
        if (!cancelled) setHasCharacter(null);
      } finally {
        if (!cancelled) setSessionBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, sessionUser?.user?.is_approved]);

  useEffect(() => {
    if (!deleteConfirm) return;
    const cancel = (e: PointerEvent) => {
      const el = deleteButtonWrapRef.current;
      if (el && !el.contains(e.target as Node)) {
        setDeleteConfirm(false);
      }
    };
    document.addEventListener("pointerdown", cancel);
    return () => document.removeEventListener("pointerdown", cancel);
  }, [deleteConfirm]);

  if (!isAuthenticated) {
    return (
      <Box maxW="3xl" mx="auto" px={4} py={8}>
        <Text>Sign in to enter Quest for Fat IV.</Text>
      </Box>
    );
  }

  if (isAuthenticated && !sessionUser && !isLoading) {
    return (
      <Box maxW="3xl" mx="auto" px={4} py={8}>
        <Text color="nautical.solid" role="alert">
          {sessionError ?? "Could not load your session."}
        </Text>
      </Box>
    );
  }

  if (isLoading || !sessionUser || sessionBusy) {
    return (
      <Box px={4} py={8}>
        <Text>Loading…</Text>
      </Box>
    );
  }

  const approved = sessionUser.user.is_approved;

  return (
    <Box maxW="3xl" mx="auto" px={4} py={8}>
      <Heading size="lg" mb={2} color="#e8f5c8" letterSpacing="wide">
        Quest for Fat IV
      </Heading>
      <Text fontSize="sm" color="#889977" mb={6} fontStyle="italic">
        {subtitle}
      </Text>

      <Stack gap={4}>
        <Text whiteSpace="pre-wrap" lineHeight="tall">
          {QFF_STORY}
        </Text>

        {!approved && (
          <Text color="nautical.solid">Your account must be approved before you can play.</Text>
        )}

        {approved && hasCharacter === true && (
          <Flex gap={3} flexWrap="wrap" align="center">
            <QffButton type="button" onClick={() => navigate("/qff/play")}>
              Continue quest
            </QffButton>
            <Box ref={deleteButtonWrapRef} display="inline-block">
              <QffButton
                type="button"
                disabled={deleteBusy}
                colorPalette={deleteConfirm ? "red" : undefined}
                onClick={async () => {
                  if (deleteBusy) return;
                  if (!deleteConfirm) {
                    setDeleteConfirm(true);
                    return;
                  }
                  setDeleteBusy(true);
                  try {
                    const token = await getTokenRef.current();
                    await deleteQffCharacter(token);
                    setHasCharacter(false);
                    setDeleteConfirm(false);
                  } catch {
                    setDeleteConfirm(false);
                  } finally {
                    setDeleteBusy(false);
                  }
                }}
              >
                {deleteConfirm ? "Click again to delete character" : "Delete character"}
              </QffButton>
            </Box>
          </Flex>
        )}

        {approved && hasCharacter === false && (
          <QffButton type="button" onClick={() => navigate("/qff/create")}>
            Create character
          </QffButton>
        )}
      </Stack>
    </Box>
  );
}
