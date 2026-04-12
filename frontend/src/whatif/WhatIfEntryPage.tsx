import {
  Box,
  Code,
  Collapsible,
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
import { useNavigate, useSearchParams } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import {
  validateWhatIfBulkText,
  validateWhatIfQuestionDraft,
  validateWhatIfRoomCode4,
} from "../forms/validation";
import PondButton from "../PondButton";
import { fullBleedStackProps, useIsMobile } from "../responsive";
import {
  APP_TEXT_SIZES,
  MAPPED_LIST_STACK_GAP,
  PANEL_FIELD_PROPS,
} from "../theme/typography";
import {
  bulkImportWhatIfQuestions,
  createWhatIfQuestion,
  createWhatIfSession,
  deleteWhatIfQuestion,
  fetchWhatIfPendingCount,
  fetchWhatIfTvState,
  joinWhatIfSession,
  listWhatIfQuestions,
  patchWhatIfQuestion,
  proposeWhatIfQuestion,
  resumeHostingSession,
  saveHostToken,
  savePlayerToken,
  WHATIF_QUESTION_LIST_FILTER_LABELS,
  WHATIF_QUESTION_LIST_FILTERS,
  type WhatIfQuestionAdmin,
  type WhatIfQuestionListFilter,
} from "./api";
import { WhatIfQuestionAdminListItem } from "./WhatIfQuestionAdminListItem";
import { WhatIfQuestionFields } from "./WhatIfQuestionFields";

type EntryTab =
  | "new"
  | "continue"
  | "join"
  | "admin-edit"
  | "admin-list"
  | "admin-bulk";
type PlayerTab = "new" | "continue" | "join";
type AdminTab = "admin-edit" | "admin-list" | "admin-bulk";
type OuterSection = "player" | "admin";

const ENTRY_TAB_VALUES: EntryTab[] = [
  "new",
  "continue",
  "join",
  "admin-edit",
  "admin-list",
  "admin-bulk",
];
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

type ProposeDraft = Omit<QuestionDraft, "is_active">;
const EMPTY_PROPOSE: ProposeDraft = {
  prompt: "",
  answer_1: "",
  answer_2: "",
  answer_3: "",
  answer_4: "",
  answer_5: "",
  answer_6: "",
};

function normalizeWhatIfDisplayNameForCompare(raw: string): string {
  return raw.trim().toLowerCase();
}

function sanitizeDisplayNameInput(raw: string): string {
  return raw
    .split("")
    .filter((ch) => /^[A-Za-z0-9 ]$/.test(ch))
    .join("")
    .slice(0, 12);
}

export default function WhatIfEntryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { sessionUser, isAuthenticated, getApiAccessToken } = useAppSession();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<EntryTab>(
    isMobile ? "join" : "new",
  );
  const [joinCode, setJoinCode] = useState("");
  const [resumeCode, setResumeCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isStaff = !!sessionUser?.user?.is_staff;
  const isApprovedUser = !!sessionUser?.user?.is_approved;
  const showJoinOnly = isMobile || !isAuthenticated || !isApprovedUser;
  const canProposeQuestions =
    isAuthenticated &&
    isApprovedUser &&
    !isStaff &&
    (sessionUser?.profile?.whatif_completed_session ?? false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<WhatIfQuestionAdmin[]>([]);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<QuestionDraft>(EMPTY_DRAFT);
  const [bulkText, setBulkText] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const confirmDeleteButtonRef = useRef<HTMLButtonElement | null>(null);
  const [questionListFilter, setQuestionListFilter] =
    useState<WhatIfQuestionListFilter>("all");
  const [pendingCount, setPendingCount] = useState(0);
  const [proposeDraft, setProposeDraft] = useState<ProposeDraft>(EMPTY_PROPOSE);
  const [proposeBusy, setProposeBusy] = useState(false);
  const [proposeError, setProposeError] = useState<string | null>(null);
  const [proposeSuccess, setProposeSuccess] = useState<string | null>(null);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [enrolledPlayerNames, setEnrolledPlayerNames] = useState<string[]>([]);
  const lastPlayerTabRef = useRef<PlayerTab>(isMobile ? "join" : "new");
  const lastAdminTabRef = useRef<AdminTab>("admin-list");
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
    if (showJoinOnly) return;
    const raw = searchParams.get("tab");
    if (!raw || !ENTRY_TAB_VALUES.includes(raw as EntryTab)) return;
    const tab = raw as EntryTab;
    if (tab.startsWith("admin") && !isStaff) return;
    setActiveTab(tab);
  }, [searchParams, isStaff, showJoinOnly]);

  useEffect(() => {
    if (!isAuthenticated) {
      setName("");
      return;
    }
    const raw = sessionUser?.profile?.display_name ?? "";
    if (raw) setName(sanitizeDisplayNameInput(raw));
    else setName("");
  }, [isAuthenticated, sessionUser?.profile?.display_name]);

  useEffect(() => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 4) {
      setEnrolledPlayerNames([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const state = await fetchWhatIfTvState(code);
          if (cancelled || !state) return;
          setEnrolledPlayerNames(
            (state.players ?? []).map((p) => p.display_name),
          );
        } catch {
          if (!cancelled) setEnrolledPlayerNames([]);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [joinCode]);

  const nameTakenInRoom = useMemo(() => {
    const candidate = sanitizeDisplayNameInput(name.trim());
    if (!candidate) return false;
    const c = normalizeWhatIfDisplayNameForCompare(candidate);
    return enrolledPlayerNames.some(
      (n) => normalizeWhatIfDisplayNameForCompare(n) === c,
    );
  }, [name, enrolledPlayerNames]);

  const joinFormDisabled =
    busy ||
    joinCode.trim().length !== 4 ||
    !sanitizeDisplayNameInput(name.trim()) ||
    nameTakenInRoom;

  useEffect(() => {
    if (
      activeTab === "new" ||
      activeTab === "continue" ||
      activeTab === "join"
    ) {
      lastPlayerTabRef.current = activeTab;
    } else if (
      activeTab === "admin-edit" ||
      activeTab === "admin-list" ||
      activeTab === "admin-bulk"
    ) {
      lastAdminTabRef.current = activeTab;
    }
  }, [activeTab]);

  async function loadQuestions() {
    if (!isAuthenticated || !isStaff) return;
    setAdminBusy(true);
    setAdminError(null);
    try {
      const token = await getApiAccessToken();
      const [items, pending] = await Promise.all([
        listWhatIfQuestions(token, query, { listFilter: questionListFilter }),
        fetchWhatIfPendingCount(token),
      ]);
      setQuestions(items);
      setPendingCount(pending);
    } catch (e) {
      setAdminError(
        e instanceof Error ? e.message : "Failed to load questions",
      );
    } finally {
      setAdminBusy(false);
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !isStaff) return;
    void loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isStaff, questionListFilter]);

  async function setReviewStatus(
    id: number,
    review_status: "approved" | "rejected",
  ) {
    if (!isAuthenticated || !isStaff) return;
    setAdminBusy(true);
    setAdminError(null);
    try {
      const token = await getApiAccessToken();
      await patchWhatIfQuestion(token, id, {
        review_status,
        is_active: review_status === "approved",
      });
      await loadQuestions();
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setAdminBusy(false);
    }
  }

  async function toggleQuestionActive(id: number, is_active: boolean) {
    if (!isAuthenticated || !isStaff) return;
    setAdminBusy(true);
    setAdminError(null);
    try {
      const token = await getApiAccessToken();
      await patchWhatIfQuestion(token, id, { is_active });
      await loadQuestions();
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setAdminBusy(false);
    }
  }

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
    const draftErr = validateWhatIfQuestionDraft(draft);
    if (draftErr) {
      setAdminError(draftErr);
      return;
    }
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
    const bulkErr = validateWhatIfBulkText(bulkText);
    if (bulkErr) {
      setAdminError(bulkErr);
      return;
    }
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
    const codeErr = validateWhatIfRoomCode4(resumeCode);
    if (codeErr) {
      setError(codeErr);
      return;
    }
    const code = resumeCode.trim().toUpperCase();
    setBusy(true);
    setError(null);
    try {
      const apiToken = await getApiAccessToken();
      const data = await resumeHostingSession(apiToken, code);
      saveHostToken(data.short_code, data.host_secret);
      const inLobby = data.status === "open" || data.status === "pre_lobby";
      navigate(
        inLobby
          ? `/whatif/lobby/${data.short_code}`
          : `/whatif/play/${data.short_code}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to resume hosting");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    const codeErr = validateWhatIfRoomCode4(joinCode);
    if (codeErr) {
      setError(codeErr);
      return;
    }
    const code = joinCode.trim().toUpperCase();
    const displayName = sanitizeDisplayNameInput(name.trim());
    if (!displayName) {
      setError("Enter a player name.");
      return;
    }
    if (nameTakenInRoom) {
      setError("That name is already taken in this room.");
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

  async function submitPropose() {
    if (!canProposeQuestions) return;
    const pErr = validateWhatIfQuestionDraft(proposeDraft);
    if (pErr) {
      setProposeError(pErr);
      return;
    }
    setProposeBusy(true);
    setProposeError(null);
    setProposeSuccess(null);
    try {
      const token = await getApiAccessToken();
      await proposeWhatIfQuestion(token, proposeDraft);
      setProposeDraft(EMPTY_PROPOSE);
      setProposeSuccess("Submitted for review. Thanks!");
    } catch (e) {
      setProposeError(e instanceof Error ? e.message : "Could not submit");
    } finally {
      setProposeBusy(false);
    }
  }

  const outerSection: OuterSection = activeTab.startsWith("admin")
    ? "admin"
    : "player";
  const playerTabValue: PlayerTab =
    activeTab === "new" || activeTab === "continue" || activeTab === "join"
      ? activeTab
      : lastPlayerTabRef.current;
  const adminTabValue: AdminTab =
    activeTab === "admin-edit" ||
    activeTab === "admin-list" ||
    activeTab === "admin-bulk"
      ? activeTab
      : lastAdminTabRef.current;

  const joinNamePlaceholder = isAuthenticated
    ? "Letters, numbers, spaces (max 12)"
    : "Enter a player name";

  const joinFormContent = (
    <Stack gap="4">
      <Text fontSize={APP_TEXT_SIZES.body} color="fg">
        Join as a player on this device with the room code from the host.
      </Text>
      <Stack gap="1.5">
        <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium" color="fg">
          Room code
        </Text>
        <Input
          placeholder="4-letter code"
          value={joinCode}
          onChange={(e) =>
            setJoinCode(
              e.target.value
                .toUpperCase()
                .replace(/[^A-Z]/g, "")
                .slice(0, 4),
            )
          }
          {...PANEL_FIELD_PROPS}
        />
      </Stack>
      <Stack gap="1.5">
        <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium" color="fg">
          Player name
        </Text>
        <Input
          placeholder={joinNamePlaceholder}
          value={name}
          onChange={(e) => setName(sanitizeDisplayNameInput(e.target.value))}
          maxLength={12}
          {...PANEL_FIELD_PROPS}
        />
      </Stack>
      {nameTakenInRoom ? (
        <Text
          fontSize={APP_TEXT_SIZES.helper}
          color="nautical.solid"
          fontWeight="medium"
        >
          That name is already taken in this room.
        </Text>
      ) : null}
      <PondButton
        type="button"
        colorPalette="lilypad"
        alignSelf="flex-start"
        onClick={() => void handleJoin()}
        loading={busy}
        disabled={joinFormDisabled}
      >
        Join on this phone
      </PondButton>
    </Stack>
  );

  const playerTabTriggers = (
    <>
      <Tabs.Trigger
        value="join"
        bg={playerTabValue === "join" ? "lilypad.solid" : undefined}
        color={playerTabValue === "join" ? "black" : undefined}
        borderTopRadius="md"
        borderBottomRadius="0"
        px="2"
        py="2"
        fontWeight="medium"
        _hover={{
          bg: playerTabValue === "join" ? "lilypad.solid" : "transparent",
        }}
        _selected={{ bg: "lilypad.solid", color: "black" }}
      >
        Join Game
      </Tabs.Trigger>
      <Tabs.Trigger
        value="new"
        bg={playerTabValue === "new" ? "lilypad.solid" : undefined}
        color={playerTabValue === "new" ? "black" : undefined}
        borderTopRadius="md"
        borderBottomRadius="0"
        px="2"
        py="2"
        fontWeight="medium"
        _hover={{
          bg: playerTabValue === "new" ? "lilypad.solid" : "transparent",
        }}
        _selected={{ bg: "lilypad.solid", color: "black" }}
      >
        Host Game
      </Tabs.Trigger>
      <Tabs.Trigger
        value="continue"
        bg={playerTabValue === "continue" ? "lilypad.solid" : undefined}
        color={playerTabValue === "continue" ? "black" : undefined}
        borderTopRadius="md"
        borderBottomRadius="0"
        px="2"
        py="2"
        fontWeight="medium"
        _hover={{
          bg: playerTabValue === "continue" ? "lilypad.solid" : "transparent",
        }}
        _selected={{ bg: "lilypad.solid", color: "black" }}
      >
        Resume Game
      </Tabs.Trigger>
    </>
  );

  const adminTabTriggers = (
    <>
      <Tabs.Trigger
        value="admin-list"
        bg={adminTabValue === "admin-list" ? "lilypad.solid" : undefined}
        color={adminTabValue === "admin-list" ? "black" : undefined}
        borderTopRadius="md"
        borderBottomRadius="0"
        px="2"
        py="2"
        fontWeight="medium"
        _hover={{
          bg: adminTabValue === "admin-list" ? "lilypad.solid" : "transparent",
        }}
        _selected={{ bg: "lilypad.solid", color: "black" }}
      >
        Question List
      </Tabs.Trigger>
      <Tabs.Trigger
        value="admin-edit"
        bg={adminTabValue === "admin-edit" ? "lilypad.solid" : undefined}
        color={adminTabValue === "admin-edit" ? "black" : undefined}
        borderTopRadius="md"
        borderBottomRadius="0"
        px="4"
        py="2"
        fontWeight="medium"
        _hover={{
          bg: adminTabValue === "admin-edit" ? "lilypad.solid" : "transparent",
        }}
        _selected={{ bg: "lilypad.solid", color: "black" }}
      >
        Add Question
      </Tabs.Trigger>
      <Tabs.Trigger
        value="admin-bulk"
        bg={adminTabValue === "admin-bulk" ? "lilypad.solid" : undefined}
        color={adminTabValue === "admin-bulk" ? "black" : undefined}
        borderTopRadius="md"
        borderBottomRadius="0"
        px="2"
        py="2"
        fontWeight="medium"
        _hover={{
          bg: adminTabValue === "admin-bulk" ? "lilypad.solid" : "transparent",
        }}
        _selected={{ bg: "lilypad.solid", color: "black" }}
      >
        Bulk Import
      </Tabs.Trigger>
    </>
  );

  const playerTabPanels = (
    <>
      <Tabs.Content value="join" pt="2">
        {joinFormContent}
      </Tabs.Content>

      <Tabs.Content value="new" pt="2">
        <Stack gap="4">
          <Text fontSize={APP_TEXT_SIZES.body} color="fg">
            {isAuthenticated
              ? "Creates a room code and records you as the host. Project the lobby on a large screen, then join on your phone to play."
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

      <Tabs.Content value="continue" pt="2">
        <Stack gap="4">
          <Text fontSize={APP_TEXT_SIZES.body} color="fg">
            Reconnect the host lobby controls after a crash or new browser
            window. Sign in as the host and enter your four-letter room code.
          </Text>
          <Stack gap="1.5">
            <Text
              fontSize={APP_TEXT_SIZES.label}
              fontWeight="medium"
              color="fg"
            >
              Room code
            </Text>
            <Input
              placeholder="4-letter room code"
              value={resumeCode}
              onChange={(e) =>
                setResumeCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z]/g, "")
                    .slice(0, 4),
                )
              }
              {...PANEL_FIELD_PROPS}
            />
          </Stack>
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
    </>
  );

  const adminTabPanels = (
    <>
      <Tabs.Content value="admin-list" pt="2">
        <Stack gap="3">
          <HStack justify="space-between" flexWrap="wrap" gap="3">
            <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.body}>
              Questions ({questions.length})
            </Text>
            {pendingCount > 0 ? (
              <Text
                fontWeight="bold"
                fontSize={APP_TEXT_SIZES.helper}
                color="nautical.solid"
              >
                Unreviewed: {pendingCount}
              </Text>
            ) : null}
          </HStack>
          <HStack gap="2" align="end" flexWrap="wrap">
            <Stack gap="1.5" flex="1" minW="200px">
              <Text
                fontSize={APP_TEXT_SIZES.label}
                fontWeight="medium"
                color="fg"
              >
                Search prompt
              </Text>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by prompt..."
                {...PANEL_FIELD_PROPS}
              />
            </Stack>
            <Stack gap="1.5" minW="160px">
              <Text
                fontSize={APP_TEXT_SIZES.label}
                fontWeight="medium"
                color="fg"
              >
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
                  {...PANEL_FIELD_PROPS}
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
              onClick={() => void loadQuestions()}
              loading={adminBusy}
            >
              Refresh
            </PondButton>
          </HStack>
          <Stack gap={MAPPED_LIST_STACK_GAP}>
            {questions.map((q) => (
              <WhatIfQuestionAdminListItem
                key={q.id}
                q={q}
                busy={adminBusy}
                confirmDeleteId={confirmDeleteId}
                confirmDeleteButtonRef={confirmDeleteButtonRef}
                onToggleActive={(id, is_active) =>
                  void toggleQuestionActive(id, is_active)
                }
                onEdit={(row) => {
                  beginEditQuestion(row);
                  setActiveTab("admin-edit");
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

      <Tabs.Content value="admin-edit" pt="2">
        <Stack gap="2">
          <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.body}>
            {editingId == null
              ? "Create question"
              : `Edit question #${editingId}`}
          </Text>
          <Text fontSize={APP_TEXT_SIZES.helper} color="gray.600">
            Type only the part after &quot;What if {"{subject}"}&quot; for the
            question. Answer rows show the number for you; only the answer text
            is saved.
          </Text>
          <WhatIfQuestionFields
            draft={draft}
            onDraftChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          />
          <Text fontSize={APP_TEXT_SIZES.helper} color="gray.600">
            Note: is_active currently defaults true in this editor.
          </Text>
          <HStack gap="2" justify="flex-end" flexWrap="wrap">
            {editingId != null ? (
              <PondButton
                type="button"
                colorPalette="sky"
                onClick={() => {
                  beginCreateQuestion();
                  setAdminError(null);
                  setActiveTab("admin-list");
                }}
                disabled={adminBusy}
              >
                Cancel
              </PondButton>
            ) : null}
            <PondButton
              type="button"
              colorPalette="lilypad"
              onClick={() => void saveQuestion()}
              loading={adminBusy}
            >
              {editingId == null ? "Create question" : "Update question"}
            </PondButton>
          </HStack>
        </Stack>
      </Tabs.Content>

      <Tabs.Content value="admin-bulk" pt="2">
        <Stack gap="2">
          <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.body}>
            Bulk import (numbered blocks)
          </Text>
          <Textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            minH="240px"
            placeholder={exampleBulk}
            {...PANEL_FIELD_PROPS}
          />
          <PondButton
            type="button"
            colorPalette="lilypad"
            alignSelf="flex-end"
            onClick={() => void runBulkImport()}
            loading={adminBusy}
          >
            Import questions
          </PondButton>
        </Stack>
      </Tabs.Content>
    </>
  );

  const showDesktopUnapprovedOnly =
    showJoinOnly && !isMobile && (!isAuthenticated || !isApprovedUser);

  const entryCardProps = {
    bg: "white",
    borderWidth: "1px",
    borderColor: "border",
    borderRadius: "xl",
    p: { base: "2", md: "2" },
  } as const;

  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box
        flex="1"
        bg="sky.solid"
        px={{ base: "2", md: "2" }}
        py={{ base: "2", md: "2" }}
      >
        <Box
          maxW="4xl"
          w="100%"
          mx="auto"
          bg="gray.100"
          borderWidth="1px"
          borderColor="border"
          borderRadius="xl"
          overflow="hidden"
        >
          <Stack gap={{ base: "4", md: "4" }} p={{ base: "2", md: "2" }}>
            <Box {...entryCardProps}>
              <Heading
                as="h1"
                size={{ base: "lg", md: "xl" }}
                fontWeight="bold"
                mb="2"
              >
                <HStack
                  as="span"
                  display="inline-flex"
                  gap="2"
                  alignItems="center"
                >
                  <Text as="span" aria-hidden="true">
                    🎲
                  </Text>
                  <Text as="span">WhatIf</Text>
                </HStack>
              </Heading>
              {!isMobile ? (
                <Text
                  fontSize={APP_TEXT_SIZES.body}
                  lineHeight="tall"
                  color="fg"
                >
                  Gather a group of friends for this multiplayer party game!
                  Someone creates a new game room and projects{" "}
                  <Code>/whatif/play/ROOM</Code> on a TV or projector to host a
                  game, and each player joins on their mobile device at{" "}
                  <Code>/whatif/hand/ROOM</Code> to play along!
                </Text>
              ) : null}
              {showDesktopUnapprovedOnly ? (
                <Text
                  fontSize={APP_TEXT_SIZES.body}
                  color="fg"
                  mt={!isMobile ? 3 : 0}
                >
                  Approved users can host a game. Guests and other users can
                  join games with a mobile device.
                </Text>
              ) : null}
            </Box>

            {!showDesktopUnapprovedOnly ? (
              <Box {...entryCardProps}>
                <Stack gap="4">
                  {showJoinOnly ? (
                    joinFormContent
                  ) : isStaff ? (
                    <Tabs.Root
                      id="whatif-entry-outer"
                      value={outerSection}
                      variant="plain"
                      onValueChange={(details) => {
                        const v = details.value as OuterSection;
                        if (v === "player")
                          setActiveTab(lastPlayerTabRef.current);
                        else setActiveTab(lastAdminTabRef.current);
                        setError(null);
                      }}
                    >
                      <Tabs.List
                        borderBottomWidth="1px"
                        borderColor="border"
                        gap="1"
                        w="100%"
                        maxW="full"
                        flexWrap="wrap"
                        justifyContent="flex-end"
                      >
                        <Tabs.Trigger
                          value="player"
                          bg={
                            outerSection === "player"
                              ? "lilypad.solid"
                              : undefined
                          }
                          color={
                            outerSection === "player" ? "black" : undefined
                          }
                          borderTopRadius="md"
                          borderBottomRadius="0"
                          px="2"
                          py="2"
                          fontWeight="semibold"
                          _hover={{
                            bg:
                              outerSection === "player"
                                ? "lilypad.solid"
                                : "transparent",
                          }}
                          _selected={{ bg: "lilypad.solid", color: "black" }}
                        >
                          Player
                        </Tabs.Trigger>
                        <Tabs.Trigger
                          value="admin"
                          bg={
                            outerSection === "admin"
                              ? "lilypad.solid"
                              : undefined
                          }
                          color={outerSection === "admin" ? "black" : undefined}
                          borderTopRadius="md"
                          borderBottomRadius="0"
                          px="2"
                          py="2"
                          fontWeight="semibold"
                          _hover={{
                            bg:
                              outerSection === "admin"
                                ? "lilypad.solid"
                                : "transparent",
                          }}
                          _selected={{ bg: "lilypad.solid", color: "black" }}
                        >
                          Admin
                        </Tabs.Trigger>
                      </Tabs.List>

                      <Tabs.Content value="player" pt="2">
                        <Tabs.Root
                          id="whatif-entry-player"
                          value={playerTabValue}
                          variant="plain"
                          onValueChange={(details) => {
                            const v = details.value as PlayerTab;
                            lastPlayerTabRef.current = v;
                            setActiveTab(v);
                            setError(null);
                          }}
                        >
                          <Tabs.List
                            borderBottomWidth="1px"
                            borderColor="border"
                            gap="1"
                            maxW="full"
                            flexWrap="wrap"
                          >
                            {playerTabTriggers}
                          </Tabs.List>
                          {playerTabPanels}
                        </Tabs.Root>
                      </Tabs.Content>

                      <Tabs.Content value="admin" pt="2">
                        <Tabs.Root
                          id="whatif-entry-admin"
                          value={adminTabValue}
                          variant="plain"
                          onValueChange={(details) => {
                            const v = details.value as AdminTab;
                            lastAdminTabRef.current = v;
                            setActiveTab(v);
                            setError(null);
                          }}
                        >
                          <Tabs.List
                            borderBottomWidth="1px"
                            borderColor="border"
                            gap="1"
                            maxW="full"
                            flexWrap="wrap"
                          >
                            {adminTabTriggers}
                          </Tabs.List>
                          {adminTabPanels}
                        </Tabs.Root>
                      </Tabs.Content>
                    </Tabs.Root>
                  ) : (
                    <Tabs.Root
                      id="whatif-entry-player-only"
                      value={playerTabValue}
                      variant="plain"
                      onValueChange={(details) => {
                        setActiveTab(details.value as EntryTab);
                        setError(null);
                      }}
                    >
                      <Tabs.List
                        borderBottomWidth="1px"
                        borderColor="border"
                        gap="1"
                        maxW="full"
                        flexWrap="wrap"
                      >
                        {playerTabTriggers}
                      </Tabs.List>
                      {playerTabPanels}
                    </Tabs.Root>
                  )}
                  {error ? (
                    <Text
                      role="alert"
                      color="nautical.solid"
                      fontSize={APP_TEXT_SIZES.helper}
                      fontWeight="medium"
                    >
                      {error}
                    </Text>
                  ) : null}
                  {adminError ? (
                    <Text
                      role="alert"
                      color="nautical.solid"
                      fontSize={APP_TEXT_SIZES.helper}
                      fontWeight="medium"
                    >
                      {adminError}
                    </Text>
                  ) : null}
                </Stack>
              </Box>
            ) : null}

            {canProposeQuestions ? (
              <Box {...entryCardProps}>
                <Collapsible.Root
                  open={proposeOpen}
                  onOpenChange={(details) => setProposeOpen(details.open)}
                >
                  <Collapsible.Trigger asChild>
                    <button
                      type="button"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        width: "100%",
                        textAlign: "left",
                        fontSize: "1rem",
                        fontWeight: 600,
                        color: "inherit",
                        cursor: "pointer",
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        margin: 0,
                      }}
                    >
                      <Text
                        as="span"
                        transform={
                          proposeOpen ? "rotate(90deg)" : "rotate(0deg)"
                        }
                        transition="transform 0.15s ease"
                        lineHeight="1"
                        flexShrink={0}
                      >
                        ›
                      </Text>
                      <Text as="span" flex="1">
                        Propose a question
                      </Text>
                    </button>
                  </Collapsible.Trigger>
                  <Collapsible.Content>
                    <Stack gap="3" pt="2">
                      <Text fontSize={APP_TEXT_SIZES.body} color="fg">
                        Suggest a prompt for staff to review. Approved questions
                        may appear in future sessions. Type only the part after
                        &quot;What if {"{subject}"}&quot;; only answer text is
                        stored for each option.
                      </Text>
                      {proposeSuccess ? (
                        <Text
                          role="status"
                          fontSize={APP_TEXT_SIZES.helper}
                          color="lilypad.solid"
                          fontWeight="medium"
                        >
                          {proposeSuccess}
                        </Text>
                      ) : null}
                      {proposeError ? (
                        <Text
                          role="alert"
                          color="nautical.solid"
                          fontSize={APP_TEXT_SIZES.helper}
                          fontWeight="medium"
                        >
                          {proposeError}
                        </Text>
                      ) : null}
                      <WhatIfQuestionFields
                        draft={proposeDraft}
                        onDraftChange={(patch) =>
                          setProposeDraft((d) => ({ ...d, ...patch }))
                        }
                      />
                      <PondButton
                        type="button"
                        colorPalette="lilypad"
                        alignSelf="flex-end"
                        onClick={() => void submitPropose()}
                        loading={proposeBusy}
                      >
                        Submit proposal
                      </PondButton>
                    </Stack>
                  </Collapsible.Content>
                </Collapsible.Root>
              </Box>
            ) : null}
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}
