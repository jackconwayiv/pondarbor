import { Box, Heading, HStack, Input, Stack, Tabs, Text, Textarea } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";

import PondButton from "../PondButton";
import { useAppSession } from "../auth/AppSessionContext";
import {
  bulkImportWhatIfQuestions,
  createWhatIfQuestion,
  deleteWhatIfQuestion,
  listWhatIfQuestions,
  patchWhatIfQuestion,
  type WhatIfQuestionAdmin,
} from "./api";
import WhatIfShell from "./WhatIfShell";
import { whatifInputProps } from "./whatifFieldProps";

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

export default function WhatIfAdminPage() {
  const { sessionUser, isAuthenticated, getApiAccessToken } = useAppSession();
  const [questions, setQuestions] = useState<WhatIfQuestionAdmin[]>([]);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<QuestionDraft>(EMPTY_DRAFT);
  const [bulkText, setBulkText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"list" | "edit" | "bulk">("list");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const confirmDeleteButtonRef = useRef<HTMLButtonElement | null>(null);
  const isStaff = !!sessionUser?.user?.is_staff;

  const exampleBulk = useMemo(
    () =>
      `What if {subject} were a kind of fruit?\n1 - Apple\n2 - Orange\n3 - Banana\n4 - Pineapple\n5 - Cherry\n6 - Apricot\n\nWhat if {subject} picked a weekend plan?\n1 - Hike\n2 - Read\n3 - Nap\n4 - Cafe\n5 - Movie\n6 - Road trip`,
    [],
  );

  async function load() {
    if (!isAuthenticated || !isStaff) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      const items = await listWhatIfQuestions(token, query);
      setQuestions(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load questions");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isStaff]);

  useEffect(() => {
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
  }, [confirmDeleteId]);

  function beginCreate() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  }

  function beginEdit(q: WhatIfQuestionAdmin) {
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
    setBusy(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      if (editingId == null) {
        await createWhatIfQuestion(token, draft);
      } else {
        await patchWhatIfQuestion(token, editingId, draft);
      }
      await load();
      beginCreate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeQuestion(id: number) {
    if (!isAuthenticated || !isStaff) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      await deleteWhatIfQuestion(token, id);
      await load();
      if (editingId === id) beginCreate();
      if (confirmDeleteId === id) setConfirmDeleteId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function runBulkImport() {
    if (!isAuthenticated || !isStaff) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      await bulkImportWhatIfQuestions(token, bulkText);
      setBulkText("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk import failed");
    } finally {
      setBusy(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <WhatIfShell>
        <Text>Sign in required.</Text>
      </WhatIfShell>
    );
  }
  if (!isStaff) {
    return (
      <WhatIfShell>
        <Text>Staff access required.</Text>
      </WhatIfShell>
    );
  }

  return (
    <Stack flex="1" minH="full" gap="0">
      <Tabs.Root
        value={activeTab}
        onValueChange={(d) => setActiveTab(d.value as "list" | "edit" | "bulk")}
        variant="plain"
        display="flex"
        flexDirection="column"
        flex="1"
        minH="full"
      >
        <Box bg="bg" px={{ base: "4", md: "6" }} py={{ base: "6", md: "6" }}>
          <Stack gap="3" maxW="5xl">
            <Heading as="h1" size="lg">
              Whatif Admin - Questions
            </Heading>
            <Tabs.List borderBottomWidth="1px" borderColor="border" gap="1" maxW="full" flexWrap="wrap">
              <Tabs.Trigger
                value="list"
                bg={activeTab === "list" ? "lilypad.solid" : undefined}
                color={activeTab === "list" ? "black" : undefined}
                borderTopRadius="md"
                borderBottomRadius="0"
                px="4"
                py="2"
                fontWeight="medium"
                _hover={{ bg: activeTab === "list" ? "lilypad.solid" : "transparent" }}
                _selected={{ bg: "lilypad.solid", color: "black" }}
              >
                Question List
              </Tabs.Trigger>
              <Tabs.Trigger
                value="edit"
                bg={activeTab === "edit" ? "lilypad.solid" : undefined}
                color={activeTab === "edit" ? "black" : undefined}
                borderTopRadius="md"
                borderBottomRadius="0"
                px="4"
                py="2"
                fontWeight="medium"
                _hover={{ bg: activeTab === "edit" ? "lilypad.solid" : "transparent" }}
                _selected={{ bg: "lilypad.solid", color: "black" }}
              >
                Add Question
              </Tabs.Trigger>
              <Tabs.Trigger
                value="bulk"
                bg={activeTab === "bulk" ? "lilypad.solid" : undefined}
                color={activeTab === "bulk" ? "black" : undefined}
                borderTopRadius="md"
                borderBottomRadius="0"
                px="4"
                py="2"
                fontWeight="medium"
                _hover={{ bg: activeTab === "bulk" ? "lilypad.solid" : "transparent" }}
                _selected={{ bg: "lilypad.solid", color: "black" }}
              >
                Bulk Import
              </Tabs.Trigger>
            </Tabs.List>
          </Stack>
        </Box>

        <Box flex="1" bg="sky.solid" px={{ base: "4", md: "6" }} py={{ base: "5", md: "6" }}>
          <WhatIfShell maxW="5xl">
            <Tabs.Content value="list">
              <Stack gap="3">
                <Text fontWeight="medium">All questions ({questions.length})</Text>
                <HStack gap="2" align="end">
                  <Stack gap="1" flex="1">
                    <Text fontSize="sm" color="gray.700">
                      Search prompt
                    </Text>
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by prompt..." {...whatifInputProps} />
                  </Stack>
                  <PondButton type="button" colorPalette="lilypad" onClick={() => void load()} loading={busy}>
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
                    <HStack gap="2" flexWrap="wrap" justify="flex-end" w="100%">
                      <PondButton
                        type="button"
                        colorPalette="lilypad"
                        onClick={() => {
                          beginEdit(q);
                          setActiveTab("edit");
                        }}
                      >
                        Edit
                      </PondButton>
                      <PondButton
                        type="button"
                        colorPalette="orange"
                        ref={confirmDeleteId === q.id ? confirmDeleteButtonRef : undefined}
                        onClick={() => {
                          if (confirmDeleteId !== q.id) {
                            setConfirmDeleteId(q.id);
                            return;
                          }
                          void removeQuestion(q.id);
                        }}
                        loading={busy && confirmDeleteId === q.id}
                      >
                        {confirmDeleteId === q.id ? "Confirm Delete" : "Delete"}
                      </PondButton>
                    </HStack>
                  </Stack>
                ))}
              </Stack>
            </Tabs.Content>

            <Tabs.Content value="edit">
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
                <PondButton
                  type="button"
                  colorPalette="lilypad"
                  alignSelf="flex-end"
                  onClick={() => void saveQuestion()}
                  loading={busy}
                >
                  {editingId == null ? "Create question" : "Update question"}
                </PondButton>
              </Stack>
            </Tabs.Content>

            <Tabs.Content value="bulk">
              <Stack gap="2">
                <Text fontWeight="medium">Bulk import (numbered blocks)</Text>
                <Textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} minH="240px" placeholder={exampleBulk} {...whatifInputProps} />
                <PondButton type="button" colorPalette="lilypad" alignSelf="flex-end" onClick={() => void runBulkImport()} loading={busy}>
                  Import questions
                </PondButton>
              </Stack>
            </Tabs.Content>

            {error ? (
              <Text role="alert" color="red.600" mt="4">
                {error}
              </Text>
            ) : null}
          </WhatIfShell>
        </Box>
      </Tabs.Root>
    </Stack>
  );
}
