import {
  Box,
  Heading,
  HStack,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Stack,
  Tabs,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAppSession } from "../auth/AppSessionContext";
import {
  validateWhatIfBulkText,
  validateWhatIfQuestionDraft,
} from "../forms/validation";
import PondButton from "../PondButton";
import { MAPPED_LIST_STACK_GAP } from "../theme/typography";
import {
  bulkImportWhatIfQuestions,
  createWhatIfQuestion,
  deleteWhatIfQuestion,
  fetchWhatIfPendingCount,
  listWhatIfQuestions,
  patchWhatIfQuestion,
  WHATIF_QUESTION_LIST_FILTER_LABELS,
  WHATIF_QUESTION_LIST_FILTERS,
  type WhatIfQuestionAdmin,
  type WhatIfQuestionListFilter,
} from "./api";
import { whatifInputProps } from "./whatifFieldProps";
import { WhatIfQuestionAdminListItem } from "./WhatIfQuestionAdminListItem";
import { WhatIfQuestionFields } from "./WhatIfQuestionFields";
import WhatIfShell from "./WhatIfShell";

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
  const [questionListFilter, setQuestionListFilter] =
    useState<WhatIfQuestionListFilter>("all");
  const [pendingCount, setPendingCount] = useState(0);
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
      const [items, pending] = await Promise.all([
        listWhatIfQuestions(token, query, { listFilter: questionListFilter }),
        fetchWhatIfPendingCount(token),
      ]);
      setQuestions(items);
      setPendingCount(pending);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load questions");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isStaff, questionListFilter]);

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
    const draftErr = validateWhatIfQuestionDraft(draft);
    if (draftErr) {
      setError(draftErr);
      return;
    }
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

  async function setReviewStatus(
    id: number,
    review_status: "approved" | "rejected",
  ) {
    if (!isAuthenticated || !isStaff) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      await patchWhatIfQuestion(token, id, {
        review_status,
        is_active: review_status === "approved",
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleQuestionActive(id: number, is_active: boolean) {
    if (!isAuthenticated || !isStaff) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      await patchWhatIfQuestion(token, id, { is_active });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function runBulkImport() {
    if (!isAuthenticated || !isStaff) return;
    const bulkErr = validateWhatIfBulkText(bulkText);
    if (bulkErr) {
      setError(bulkErr);
      return;
    }
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
        <Box bg="bg" px={{ base: "2", md: "2" }} py={{ base: "2", md: "2" }}>
          <Stack gap="3" maxW="5xl">
            <HStack
              justify="space-between"
              align="center"
              flexWrap="wrap"
              gap="3"
            >
              <Heading as="h1" size="lg">
                Whatif Admin - Questions
              </Heading>
              {pendingCount > 0 ? (
                <Text fontWeight="bold" color="orange.solid">
                  Unreviewed submissions: {pendingCount}
                </Text>
              ) : null}
            </HStack>
            <Tabs.List
              borderBottomWidth="1px"
              borderColor="border"
              gap="1"
              maxW="full"
              flexWrap="wrap"
            >
              <Tabs.Trigger
                value="list"
                bg={activeTab === "list" ? "lilypad.solid" : undefined}
                color={activeTab === "list" ? "black" : undefined}
                borderTopRadius="md"
                borderBottomRadius="0"
                px="2"
                py="2"
                fontWeight="medium"
                _hover={{
                  bg: activeTab === "list" ? "lilypad.solid" : "transparent",
                }}
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
                px="2"
                py="2"
                fontWeight="medium"
                _hover={{
                  bg: activeTab === "edit" ? "lilypad.solid" : "transparent",
                }}
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
                px="2"
                py="2"
                fontWeight="medium"
                _hover={{
                  bg: activeTab === "bulk" ? "lilypad.solid" : "transparent",
                }}
                _selected={{ bg: "lilypad.solid", color: "black" }}
              >
                Bulk Import
              </Tabs.Trigger>
            </Tabs.List>
          </Stack>
        </Box>

        <Box
          flex="1"
          bg="sky.solid"
          px={{ base: "2", md: "2" }}
          py={{ base: "2", md: "2" }}
        >
          <WhatIfShell maxW="5xl">
            <Tabs.Content value="list">
              <Stack gap="3">
                <Text fontWeight="medium">Questions ({questions.length})</Text>
                <HStack gap="2" align="end" flexWrap="wrap">
                  <Stack gap="1" flex="1" minW="200px">
                    <Text fontSize="sm" color="gray.700">
                      Search prompt
                    </Text>
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Filter by prompt..."
                      {...whatifInputProps}
                    />
                  </Stack>
                  <Stack gap="1" minW="160px">
                    <Text fontSize="sm" color="gray.700">
                      List
                    </Text>
                    <NativeSelectRoot>
                      <NativeSelectField
                        value={questionListFilter}
                        onChange={(e) =>
                          setQuestionListFilter(
                            e.target.value as WhatIfQuestionListFilter,
                          )
                        }
                        {...whatifInputProps}
                      >
                        {WHATIF_QUESTION_LIST_FILTERS.map((v) => (
                          <option key={v} value={v}>
                            {WHATIF_QUESTION_LIST_FILTER_LABELS[v]}
                          </option>
                        ))}
                      </NativeSelectField>
                    </NativeSelectRoot>
                  </Stack>
                  <PondButton
                    type="button"
                    colorPalette="lilypad"
                    onClick={() => void load()}
                    loading={busy}
                  >
                    Refresh
                  </PondButton>
                </HStack>

                <Stack gap={MAPPED_LIST_STACK_GAP}>
                  {questions.map((q) => (
                    <WhatIfQuestionAdminListItem
                      key={q.id}
                      q={q}
                      busy={busy}
                      confirmDeleteId={confirmDeleteId}
                      confirmDeleteButtonRef={confirmDeleteButtonRef}
                      onToggleActive={(id, is_active) =>
                        void toggleQuestionActive(id, is_active)
                      }
                      onEdit={(row) => {
                        beginEdit(row);
                        setActiveTab("edit");
                      }}
                      onDeleteClick={(row) => {
                        if (confirmDeleteId !== row.id) {
                          setConfirmDeleteId(row.id);
                          return;
                        }
                        void removeQuestion(row.id);
                      }}
                      onApprove={(id) => void setReviewStatus(id, "approved")}
                      onReject={(id) => void setReviewStatus(id, "rejected")}
                    />
                  ))}
                </Stack>
              </Stack>
            </Tabs.Content>

            <Tabs.Content value="edit">
              <Stack gap="2">
                <Text fontWeight="medium">
                  {editingId == null
                    ? "Create question"
                    : `Edit question #${editingId}`}
                </Text>
                <Text fontSize="sm" color="gray.600">
                  Type only the part after &quot;What if {"{subject}"}&quot; for
                  the question. Answer rows show the number for you; only the
                  answer text is saved.
                </Text>
                <WhatIfQuestionFields
                  draft={draft}
                  onDraftChange={(patch) =>
                    setDraft((d) => ({ ...d, ...patch }))
                  }
                />
                <Text fontSize="sm" color="gray.600">
                  Note: is_active currently defaults true in this editor.
                </Text>
                <HStack gap="2" justify="flex-end" flexWrap="wrap">
                  {editingId != null ? (
                    <PondButton
                      type="button"
                      variant="outline"
                      colorPalette="gray"
                      onClick={() => {
                        beginCreate();
                        setError(null);
                        setActiveTab("list");
                      }}
                      disabled={busy}
                    >
                      Cancel
                    </PondButton>
                  ) : null}
                  <PondButton
                    type="button"
                    colorPalette="lilypad"
                    onClick={() => void saveQuestion()}
                    loading={busy}
                  >
                    {editingId == null ? "Create question" : "Update question"}
                  </PondButton>
                </HStack>
              </Stack>
            </Tabs.Content>

            <Tabs.Content value="bulk">
              <Stack gap="2">
                <Text fontWeight="medium">Bulk import (numbered blocks)</Text>
                <Textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  minH="240px"
                  placeholder={exampleBulk}
                  {...whatifInputProps}
                />
                <PondButton
                  type="button"
                  colorPalette="lilypad"
                  alignSelf="flex-end"
                  onClick={() => void runBulkImport()}
                  loading={busy}
                >
                  Import questions
                </PondButton>
              </Stack>
            </Tabs.Content>

            {error ? (
              <Text role="alert" color="nautical.solid" mt="4">
                {error}
              </Text>
            ) : null}
          </WhatIfShell>
        </Box>
      </Tabs.Root>
    </Stack>
  );
}
