import { Box, Field, Flex, Heading, HStack, Input, Stack, Table, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { AppModal } from "../components/AppModal";
import { useAppSession } from "../auth/AppSessionContext";
import { PanelBlockSkeleton } from "../components/panelStatus";
import QffButton from "./QffButton";
import { QFF_MAIN_CONTENT_PROPS } from "./qffUi";
import {
  deleteQffCharacter,
  fetchQffLeaderboard,
  fetchQffSession,
  type QffLeaderboardEntry,
} from "./api";
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
  const [characterName, setCharacterName] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteNameInput, setDeleteNameInput] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [leaderboard, setLeaderboard] = useState<QffLeaderboardEntry[] | null>(null);
  const [leaderboardErr, setLeaderboardErr] = useState<string | null>(null);

  const subtitle = useMemo(() => {
    const i = Math.floor(Math.random() * QFF_SUBTITLES.length);
    const raw = QFF_SUBTITLES[i] as string;
    const afterColon = raw.split(/:\s/).slice(1).join(": ");
    return afterColon || raw;
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
          if (s.has_character) {
            setCharacterName(s.character.name);
          } else {
            setCharacterName(null);
          }
        }
      } catch {
        if (!cancelled) {
          setHasCharacter(null);
          setCharacterName(null);
        }
      } finally {
        if (!cancelled) setSessionBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, sessionUser?.user?.is_approved]);

  useEffect(() => {
    if (!isAuthenticated || !sessionUser?.user?.is_approved) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const rows = await fetchQffLeaderboard(token);
        if (!cancelled) {
          setLeaderboard(rows);
          setLeaderboardErr(null);
        }
      } catch (e) {
        if (!cancelled) {
          setLeaderboard(null);
          setLeaderboardErr(e instanceof Error ? e.message : "Could not load leaderboard.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, sessionUser?.user?.is_approved]);

  if (!isAuthenticated) {
    return (
      <Box {...QFF_MAIN_CONTENT_PROPS} py={4}>
        <Text>Sign in to enter Quest for Fat IV.</Text>
      </Box>
    );
  }

  if (isAuthenticated && !sessionUser && !isLoading) {
    return (
      <Box {...QFF_MAIN_CONTENT_PROPS} py={4}>
        <Text color="nautical.solid" role="alert">
          {sessionError ?? "Could not load your session."}
        </Text>
      </Box>
    );
  }

  if (isLoading || !sessionUser || sessionBusy) {
    return (
      <Box {...QFF_MAIN_CONTENT_PROPS} py={4}>
        <PanelBlockSkeleton lines={3} showTitleLine />
      </Box>
    );
  }

  const approved = sessionUser.user.is_approved;

  const leaderboardSection =
    approved ? (
      <Box w="100%" pt={2}>
        <Heading
          as="h2"
          size="sm"
          color="#c8e6a8"
          mb={3}
          fontWeight="semibold"
          letterSpacing="wide"
        >
          Leaderboard
        </Heading>
        {leaderboardErr && (
          <Text fontSize="xs" color="red.300" mb={2}>
            {leaderboardErr}
          </Text>
        )}
        {leaderboard && leaderboard.length === 0 && !leaderboardErr && (
          <Text fontSize="sm" color="#6a7a5a">
            No active heroes yet.
          </Text>
        )}
        {leaderboard && leaderboard.length > 0 && (
          <Box overflowX="auto" w="100%" mt={1}>
            <Table.Root
              size="sm"
              variant="line"
              w="100%"
              bg="transparent"
              css={{ "& th, & td": { backgroundColor: "transparent" } }}
            >
              <Table.Header>
                <Table.Row bg="transparent">
                  <Table.ColumnHeader
                    color="#889977"
                    textAlign="left"
                    px={2}
                    py={1}
                    fontWeight="bold"
                    bg="transparent"
                    borderColor="whiteAlpha.200"
                  >
                    Lv
                  </Table.ColumnHeader>
                  <Table.ColumnHeader
                    color="#889977"
                    textAlign="left"
                    px={2}
                    py={1}
                    fontWeight="bold"
                    bg="transparent"
                    borderColor="whiteAlpha.200"
                  >
                    Name
                  </Table.ColumnHeader>
                  <Table.ColumnHeader
                    color="#889977"
                    textAlign="left"
                    px={2}
                    py={1}
                    fontWeight="bold"
                    bg="transparent"
                    borderColor="whiteAlpha.200"
                  >
                    Class
                  </Table.ColumnHeader>
                  <Table.ColumnHeader
                    color="#889977"
                    textAlign="right"
                    px={2}
                    py={1}
                    fontWeight="bold"
                    bg="transparent"
                    borderColor="whiteAlpha.200"
                  >
                    XP
                  </Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {leaderboard.map((row, i) => (
                  <Table.Row key={`${row.class_slug}-${row.name}-${i}`} bg="transparent">
                    <Table.Cell
                      color="#a8b898"
                      textAlign="left"
                      fontFamily="monospace"
                      fontSize="xs"
                      px={2}
                      py={1}
                      bg="transparent"
                      borderColor="whiteAlpha.200"
                    >
                      {row.level}
                    </Table.Cell>
                    <Table.Cell
                      color="#c8e6a8"
                      textAlign="left"
                      fontSize="xs"
                      overflow="hidden"
                      textOverflow="ellipsis"
                      maxW={{ base: "10rem", md: "16rem" }}
                      px={2}
                      py={1}
                      bg="transparent"
                      borderColor="whiteAlpha.200"
                    >
                      {row.name}
                    </Table.Cell>
                    <Table.Cell
                      color="#889977"
                      textAlign="left"
                      fontSize="xs"
                      overflow="hidden"
                      textOverflow="ellipsis"
                      maxW={{ base: "6rem", md: "10rem" }}
                      px={2}
                      py={1}
                      bg="transparent"
                      borderColor="whiteAlpha.200"
                    >
                      {row.class_name}
                    </Table.Cell>
                    <Table.Cell
                      color="#a8c890"
                      textAlign="right"
                      fontFamily="monospace"
                      fontSize="xs"
                      px={2}
                      py={1}
                      bg="transparent"
                      borderColor="whiteAlpha.200"
                    >
                      {row.xp}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        )}
      </Box>
    ) : null;

  return (
    <Stack {...QFF_MAIN_CONTENT_PROPS} py={4} gap={4} align="stretch">
      <Flex
        w="100%"
        align="flex-start"
        justify="space-between"
        gap={4}
        flexWrap="wrap"
      >
        <Box flex="1" minW={{ base: "12rem", md: "16rem" }}>
          <Heading size="lg" mb={2} color="#e8f5c8" letterSpacing="wide">
            Quest for Fat IV
          </Heading>
          <Text fontSize="sm" color="#889977" fontStyle="italic" lineHeight="short">
            {subtitle}
          </Text>
        </Box>
        {approved ? (
          <QffButton
            type="button"
            onClick={() => navigate("/qff/handbook")}
            flexShrink={0}
            alignSelf="flex-start"
          >
            Player&apos;s Handbook
          </QffButton>
        ) : null}
      </Flex>

      <Text whiteSpace="pre-wrap" lineHeight="tall" color="#c8e6a8">
        {QFF_STORY}
      </Text>

      {!approved && (
        <Text color="nautical.solid">Your account must be approved before you can play.</Text>
      )}

      {approved && hasCharacter === true && (
        <>
          <Flex
            w="100%"
            justify="space-between"
            align="center"
            flexWrap="wrap"
            gap={3}
          >
            <QffButton type="button" onClick={() => navigate("/qff/play")}>
              Continue quest
            </QffButton>
            <QffButton
              type="button"
              variant="outline"
              colorPalette="red"
              flexShrink={0}
              onClick={() => {
                setDeleteNameInput("");
                setDeleteModalOpen(true);
              }}
              disabled={deleteBusy}
            >
              Delete character
            </QffButton>
          </Flex>
          <AppModal
            open={deleteModalOpen}
            onOpenChange={(open) => {
              setDeleteModalOpen(open);
              if (!open) setDeleteNameInput("");
            }}
            title={
              characterName
                ? `Really, Truly Delete ${characterName}?`
                : "Really, Truly Delete your character?"
            }
            description="Type the character name exactly to delete."
            size="md"
            contentProps={{
              bg: "#1a1a1a",
              borderColor: "#404040",
              color: "#c8e6a8",
            }}
            descriptionProps={{ color: "#889977" }}
            headerProps={{ color: "#c8e6a8" }}
          >
            <Stack gap={3}>
              {characterName && (
                <Text fontSize="sm" color="#a8b898">
                  Type <Text as="strong" color="#e8f5c8">{characterName}</Text> in the box
                  below, then press DELETE. This cannot be undone.
                </Text>
              )}
              <Field.Root>
                <Field.Label>Character name</Field.Label>
                <Input
                  value={deleteNameInput}
                  onChange={(e) => setDeleteNameInput(e.target.value)}
                  bg="#222"
                  color="#c8e6a8"
                  autoFocus
                  autoComplete="off"
                  placeholder={characterName ?? ""}
                />
              </Field.Root>
              <HStack gap={2} justify="flex-end" flexWrap="wrap" pt={1}>
                <QffButton
                  type="button"
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setDeleteNameInput("");
                  }}
                  disabled={deleteBusy}
                >
                  Cancel
                </QffButton>
                <QffButton
                  type="button"
                  colorPalette="red"
                  disabled={
                    deleteBusy ||
                    !characterName ||
                    deleteNameInput !== characterName
                  }
                  onClick={async () => {
                    if (!characterName || deleteNameInput !== characterName) return;
                    setDeleteBusy(true);
                    try {
                      const token = await getTokenRef.current();
                      await deleteQffCharacter(token);
                      setHasCharacter(false);
                      setCharacterName(null);
                      setDeleteModalOpen(false);
                      setDeleteNameInput("");
                    } catch {
                      /* error surfaced elsewhere if needed */
                    } finally {
                      setDeleteBusy(false);
                    }
                  }}
                >
                  {deleteBusy ? "…" : "DELETE"}
                </QffButton>
              </HStack>
            </Stack>
          </AppModal>
        </>
      )}

      {approved && hasCharacter === false && (
        <QffButton type="button" onClick={() => navigate("/qff/create")} w="fit-content">
          Create character
        </QffButton>
      )}

      {leaderboardSection}
    </Stack>
  );
}
