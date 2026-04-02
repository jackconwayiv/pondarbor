import { Code, Heading, HStack, Input, Stack, Tabs, Text, Textarea } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import PondButton from "../PondButton";
import { useAppSession } from "../auth/AppSessionContext";
import {
  bulkImportWhatIfQuestions,
  createWhatIfSession,
  createWhatIfQuestion,
  deleteWhatIfQuestion,
  joinWhatIfSession,
  listWhatIfQuestions,
  patchWhatIfQuestion,
  resumeHostingSession,
  saveHostToken,
  savePlayerToken,
  type WhatIfQuestionAdmin,
} from "./api";
import WhatIfShell from "./WhatIfShell";
import { whatifInputProps } from "./whatifFieldProps";

type EntryTab = "new" | "continue" | "join" | "admin-edit" | "admin-list" | "admin-bulk";

const ENTRY_TAB_VALUES: EntryTab[] = ["new", "continue", "join", "admin-edit", "admin-list", "admin-bulk"];
type QuestionDraft = {
  prompt: string;
  answer_1: string;
  answer_2: string;
  answer_3: string;
  answer_4: string;
  answer_5: string;
  answer_6: string;
  is_active: boolean;
};
const EMPTY_DRAFT: QuestionDraft = {
  prompt: "",
  answer_1: "",
  answer_2: "",
  answer_3: "",
  answer_4: "",
  answer_5: "",
  answer_6: "",
  is_active: true,
};

export default function WhatIfEntryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { sessionUser, isAuthenticated, getApiAccessToken } = useAppSession();
  const [activeTab, setActiveTab] = useState<EntryTab>("new");
  const [joinCode, setJoinCode] = useState("");
  const [resumeCode, setResumeCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isStaff = !!sessionUser?.user?.is_staff;
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<WhatIfQuestionAdmin[]>([]);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<QuestionDraft>(EMPTY_DRAFT);
  const [bulkText, setBulkText] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const confirmDeleteButtonRef = useRef<HTMLButtonElement | null>(null);

  const defaultName = useMemo(() => {
    return sessionUser?.profile?.display_name || "Guest";
  }, [sessionUser?.profile?.display_name]);
  const exampleBulk = useMemo(
    () =>
      `What if {subject} were a kind of fruit?\n1 - Apple\n2 - Orange\n3 - Banana\n4 - Pineapple\n5 - Cherry\n6 - Apricot\n\nWhat if {subject} picked a weekend plan?\n1 - Hike\n2 - Read\n3 - Nap\n4 - Cafe\n5 - Movie\n6 - Road trip`,
    [],
  );

  useEffect(() => {
    if (!isStaff || !isAuthenticated) return;
    if (confirmDeleteId == null) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (confirmDeleteButtonRef.current?.contains(target)) return;
      setConfirmDeleteId(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmDeleteId(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [confirmDeleteId, isStaff, isAuthenticated]);

  useEffect(() => {
    const raw = searchParams.get("tab");
    if (!raw || !ENTRY_TAB_VALUES.includes(raw as EntryTab)) return;
    const tab = raw as EntryTab;
    if (tab.startsWith("admin") && !isStaff) return;
    setActiveTab(tab);
  }, [searchParams, isStaff]);

  async function loadQuestions() {
    if (!isAuthenticated || !isStaff) return;
    setAdminBusy(true);
    setAdminError(null);
    try {
      const token = await getApiAccessToken();
      const items = await listWhatIfQuestions(token, query);
      setQuestions(items);
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : "Failed to load questions");
    } finally {
      setAdminBusy(false);
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !isStaff) return;
    void loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isStaff]);

  function beginCreateQuestion() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  }

  function beginEditQuestion(q: WhatIfQuestionAdmin) {
    setEditingId(q.id);
    setDraft({
      prompt: q.prompt,
      answer_1: q.answer_1,
      answer_2: q.answer_2,
      answer_3: q.answer_3,
      answer_4: q.answer_4,
      answer_5: q.answer_5,
      answer_6: q.answer_6,
      is_active: q.is_active,
    });
  }

  async function saveQuestion() {
    if (!isAuthenticated || !isStaff) return;
    setAdminBusy(true);
    setAdminError(null);
    try {
      const token = await getApiAccessToken();
      if (editingId == null) {
        await createWhatIfQuestion(token, draft);
      } else {
        await patchWhatIfQuestion(token, editingId, draft);
      }
      await loadQuestions();
      beginCreateQuestion();
      setActiveTab("admin-list");
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setAdminBusy(false);
    }
  }

  async function removeQuestion(id: number) {
    if (!isAuthenticated || !isStaff) return;
    setAdminBusy(true);
    setAdminError(null);
    try {
      const token = await getApiAccessToken();
      await deleteWhatIfQuestion(token, id);
      await loadQuestions();
      if (editingId === id) beginCreateQuestion();
      if (confirmDeleteId === id) setConfirmDeleteId(null);
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setAdminBusy(false);
    }
  }

  async function runBulkImport() {
    if (!isAuthenticated || !isStaff) return;
    setAdminBusy(true);
    setAdminError(null);
    try {
      const token = await getApiAccessToken();
      await bulkImportWhatIfQuestions(token, bulkText);
      setBulkText("");
      await loadQuestions();
      setActiveTab("admin-list");
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : "Bulk import failed");
    } finally {
      setAdminBusy(false);
    }
  }

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      const apiToken = await getApiAccessToken();
      const session = await createWhatIfSession(apiToken);
      saveHostToken(session.short_code, session.host_secret);
      navigate(`/whatif/lobby/${session.short_code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create game");
    } finally {
      setBusy(false);
    }
  }

  async function handleResumeHosting() {
    const code = resumeCode.trim().toUpperCase();
    if (code.length !== 4) {
      setError("Room code must be exactly 4 letters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const apiToken = await getApiAccessToken();
      const data = await resumeHostingSession(apiToken, code);
      saveHostToken(data.short_code, data.host_secret);
      const inLobby = data.status === "open" || data.status === "pre_lobby";
      navigate(inLobby ? `/whatif/lobby/${data.short_code}` : `/whatif/play/${data.short_code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to resume hosting");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    const displayName = (name.trim() || defaultName).slice(0, 80);
    if (code.length !== 4) {
      setError("Room code must be exactly 4 letters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = isAuthenticated ? await getApiAccessToken() : null;
      const join = await joinWhatIfSession(code, displayName, token);
      savePlayerToken(code, join.player_secret);
      navigate(`/whatif/hand/${code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to join");
    } finally {
      setBusy(false);
    }
  }

  return (
    <WhatIfShell>
      <Stack gap="5">
        <Heading as="h1" size="lg">
          Whatif
        </Heading>
        <Text color="fg">
          A Jackbox-style room game. The TV stays on <Code>/whatif/play/ROOM</Code>, and each player joins on their
          phone at <Code>/whatif/hand/ROOM</Code>.
        </Text>

        <Tabs.Root
          value={activeTab}
          variant="plain"
          onValueChange={(details) => {
            setActiveTab(details.value as EntryTab);
            setError(null);
          }}
        >
          <Tabs.List borderBottomWidth="1px" borderColor="border" gap="1" maxW="full" flexWrap="wrap">
            <Tabs.Trigger
              value="new"
              bg={activeTab === "new" ? "lilypad.solid" : undefined}
              color={activeTab === "new" ? "black" : undefined}
              borderTopRadius="md"
              borderBottomRadius="0"
              px="4"
              py="2"
              fontWeight="medium"
              _hover={{ bg: activeTab === "new" ? "lilypad.solid" : "transparent" }}
              _selected={{ bg: "lilypad.solid", color: "black" }}
            >
              New Game
            </Tabs.Trigger>
            <Tabs.Trigger
              value="continue"
              bg={activeTab === "continue" ? "lilypad.solid" : undefined}
              color={activeTab === "continue" ? "black" : undefined}
              borderTopRadius="md"
              borderBottomRadius="0"
              px="4"
              py="2"
              fontWeight="medium"
              _hover={{ bg: activeTab === "continue" ? "lilypad.solid" : "transparent" }}
              _selected={{ bg: "lilypad.solid", color: "black" }}
            >
              Resume
            </Tabs.Trigger>
            <Tabs.Trigger
              value="join"
              bg={activeTab === "join" ? "lilypad.solid" : undefined}
              color={activeTab === "join" ? "black" : undefined}
              borderTopRadius="md"
              borderBottomRadius="0"
              px="4"
              py="2"
              fontWeight="medium"
              _hover={{ bg: activeTab === "join" ? "lilypad.solid" : "transparent" }}
              _selected={{ bg: "lilypad.solid", color: "black" }}
            >
              Join
            </Tabs.Trigger>
            {isStaff ? (
              <Tabs.Trigger
                value="admin-edit"
                bg={activeTab === "admin-edit" ? "lilypad.solid" : undefined}
                color={activeTab === "admin-edit" ? "black" : undefined}
                borderTopRadius="md"
                borderBottomRadius="0"
                px="4"
                py="2"
                fontWeight="medium"
                _hover={{ bg: activeTab === "admin-edit" ? "lilypad.solid" : "transparent" }}
                _selected={{ bg: "lilypad.solid", color: "black" }}
              >
                Add ?
              </Tabs.Trigger>
            ) : null}
            {isStaff ? (
              <Tabs.Trigger
                value="admin-list"
                bg={activeTab === "admin-list" ? "lilypad.solid" : undefined}
                color={activeTab === "admin-list" ? "black" : undefined}
                borderTopRadius="md"
                borderBottomRadius="0"
                px="4"
                py="2"
                fontWeight="medium"
                _hover={{ bg: activeTab === "admin-list" ? "lilypad.solid" : "transparent" }}
                _selected={{ bg: "lilypad.solid", color: "black" }}
              >
                ? List
              </Tabs.Trigger>
            ) : null}
            {isStaff ? (
              <Tabs.Trigger
                value="admin-bulk"
                bg={activeTab === "admin-bulk" ? "lilypad.solid" : undefined}
                color={activeTab === "admin-bulk" ? "black" : undefined}
                borderTopRadius="md"
                borderBottomRadius="0"
                px="4"
                py="2"
                fontWeight="medium"
                _hover={{ bg: activeTab === "admin-bulk" ? "lilypad.solid" : "transparent" }}
                _selected={{ bg: "lilypad.solid", color: "black" }}
              >
                Import ?s
              </Tabs.Trigger>
            ) : null}
          </Tabs.List>

          <Tabs.Content value="new" pt="4">
            <Stack gap="4">
              <Text color="gray.700">
                {isAuthenticated
                  ? "Creates a room and records you as the host (not as a player). Open the lobby on the TV, then join on your phone to play."
                  : "Sign in to create a game."}
              </Text>
              <PondButton
                type="button"
                colorPalette="lilypad"
                alignSelf="flex-start"
                onClick={() => void handleCreate()}
                loading={busy}
                disabled={!isAuthenticated}
              >
                Create new game
              </PondButton>
            </Stack>
          </Tabs.Content>

          <Tabs.Content value="continue" pt="4">
            <Stack gap="4">
              <Text fontSize="sm" color="gray.700">
                Reconnect TV / lobby controls after a crash or new browser window. Sign in as the host and enter your
                four-letter room code. This does not add you as a player.
              </Text>
              <Input
                placeholder="4-letter room code"
                value={resumeCode}
                onChange={(e) => setResumeCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
                {...whatifInputProps}
              />
              <PondButton
                type="button"
                colorPalette="lilypad"
                alignSelf="flex-start"
                onClick={() => void handleResumeHosting()}
                loading={busy}
                disabled={!isAuthenticated}
              >
                Continue hosting
              </PondButton>
            </Stack>
          </Tabs.Content>

          <Tabs.Content value="join" pt="4">
            <Stack gap="4">
              <Text fontSize="sm" color="gray.700">
                Join this device as a player with the room code from the host.
              </Text>
              <Input
                placeholder="4-letter code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
                {...whatifInputProps}
              />
              <Input
                placeholder={`Display name (default: ${defaultName})`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                {...whatifInputProps}
              />
              <PondButton
                type="button"
                colorPalette="lilypad"
                alignSelf="flex-start"
                onClick={() => void handleJoin()}
                loading={busy}
              >
                Join on this phone
              </PondButton>
            </Stack>
          </Tabs.Content>

          {isStaff ? (
            <Tabs.Content value="admin-edit" pt="4">
              <Stack gap="2">
                <Text fontWeight="medium">{editingId == null ? "Create question" : `Edit question #${editingId}`}</Text>
                <Input value={draft.prompt} onChange={(e) => setDraft((d) => ({ ...d, prompt: e.target.value }))} placeholder='Prompt with "{subject}"' {...whatifInputProps} />
                <Input value={draft.answer_1} onChange={(e) => setDraft((d) => ({ ...d, answer_1: e.target.value }))} placeholder="Answer 1" {...whatifInputProps} />
                <Input value={draft.answer_2} onChange={(e) => setDraft((d) => ({ ...d, answer_2: e.target.value }))} placeholder="Answer 2" {...whatifInputProps} />
                <Input value={draft.answer_3} onChange={(e) => setDraft((d) => ({ ...d, answer_3: e.target.value }))} placeholder="Answer 3" {...whatifInputProps} />
                <Input value={draft.answer_4} onChange={(e) => setDraft((d) => ({ ...d, answer_4: e.target.value }))} placeholder="Answer 4" {...whatifInputProps} />
                <Input value={draft.answer_5} onChange={(e) => setDraft((d) => ({ ...d, answer_5: e.target.value }))} placeholder="Answer 5" {...whatifInputProps} />
                <Input value={draft.answer_6} onChange={(e) => setDraft((d) => ({ ...d, answer_6: e.target.value }))} placeholder="Answer 6" {...whatifInputProps} />
                <Text fontSize="sm" color="gray.600">
                  Note: is_active currently defaults true in this editor.
                </Text>
                <HStack gap="2" flexWrap="wrap">
                  <PondButton type="button" colorPalette="lilypad" alignSelf="flex-start" onClick={() => void saveQuestion()} loading={adminBusy}>
                    {editingId == null ? "Create question" : "Update question"}
                  </PondButton>
                  <PondButton
                    type="button"
                    colorPalette="orange"
                    alignSelf="flex-start"
                    onClick={() => {
                      beginCreateQuestion();
                      setActiveTab("admin-list");
                    }}
                  >
                    Cancel
                  </PondButton>
                </HStack>
              </Stack>
            </Tabs.Content>
          ) : null}

          {isStaff ? (
            <Tabs.Content value="admin-list" pt="4">
              <Stack gap="3">
                <Text fontWeight="medium">All questions ({questions.length})</Text>
                <HStack gap="2" align="end">
                  <Stack gap="1" flex="1">
                    <Text fontSize="sm" color="gray.700">
                      Search prompt
                    </Text>
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by prompt..." {...whatifInputProps} />
                  </Stack>
                  <PondButton type="button" colorPalette="lilypad" onClick={() => void loadQuestions()} loading={adminBusy}>
                    Refresh
                  </PondButton>
                </HStack>
                {questions.map((q) => (
                  <Stack key={q.id} p="3" borderWidth="1px" borderColor="border" borderRadius="md" bg="bg">
                    <Text fontWeight="medium">
                      #{q.id} {q.is_active ? "(active)" : "(inactive)"} - used {q.sessions_used_count} sessions
                    </Text>
                    <Text>{q.prompt}</Text>
                    <Text fontSize="sm" color="gray.700">
                      1) {q.answer_1} | 2) {q.answer_2} | 3) {q.answer_3} | 4) {q.answer_4} | 5) {q.answer_5} | 6){" "}
                      {q.answer_6}
                    </Text>
                    <HStack gap="2" flexWrap="wrap">
                      <PondButton
                        type="button"
                        colorPalette="lilypad"
                        alignSelf="flex-start"
                        onClick={() => {
                          beginEditQuestion(q);
                          setActiveTab("admin-edit");
                        }}
                      >
                        Edit
                      </PondButton>
                      <PondButton
                        type="button"
                        colorPalette="orange"
                        alignSelf="flex-start"
                        ref={confirmDeleteId === q.id ? confirmDeleteButtonRef : undefined}
                        onClick={() => {
                          if (confirmDeleteId !== q.id) {
                            setConfirmDeleteId(q.id);
                            return;
                          }
                          void removeQuestion(q.id);
                        }}
                        loading={adminBusy && confirmDeleteId === q.id}
                      >
                        {confirmDeleteId === q.id ? "Confirm Delete" : "Delete"}
                      </PondButton>
                    </HStack>
                  </Stack>
                ))}
              </Stack>
            </Tabs.Content>
          ) : null}

          {isStaff ? (
            <Tabs.Content value="admin-bulk" pt="4">
              <Stack gap="2">
                <Text fontWeight="medium">Bulk import (numbered blocks)</Text>
                <Textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} minH="240px" placeholder={exampleBulk} {...whatifInputProps} />
                <PondButton type="button" colorPalette="lilypad" alignSelf="flex-start" onClick={() => void runBulkImport()} loading={adminBusy}>
                  Import questions
                </PondButton>
              </Stack>
            </Tabs.Content>
          ) : null}
        </Tabs.Root>

        {error ? (
          <Text role="alert" color="red.600">
            {error}
          </Text>
        ) : null}
        {adminError ? (
          <Text role="alert" color="red.600">
            {adminError}
          </Text>
        ) : null}
      </Stack>
    </WhatIfShell>
  );
}
