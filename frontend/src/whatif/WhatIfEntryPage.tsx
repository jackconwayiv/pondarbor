import {
  Badge,
  Box,
  Code,
  Collapsible,
  Flex,
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
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  MAPPED_LIST_STACK_GAP,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FIELD_PROPS,
} from "../theme/typography";
import {
  bulkImportWhatIfQuestions,
  createWhatIfQuestion,
  createWhatIfSession,
  deleteWhatIfQuestion,
  fetchWhatIfPendingCount,
  fetchMyWhatIfSessions,
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
import type { WhatIfMySessionRow, WhatIfMySessionsResponse, WhatIfSessionState } from "./types";
import WhatIfResumeBanners from "./WhatIfResumeBanners";
import { useWhatIfResumeContext } from "./WhatIfResumeContext";
import { isWhatIfLobbyStatus } from "./whatifSessionStatus";
import { WhatIfQuestionAdminListItem } from "./WhatIfQuestionAdminListItem";
import { WhatIfQuestionFields } from "./WhatIfQuestionFields";
import {
  mergeBulkQuestionsIntoList,
  mergeQuestionAfterMutation,
} from "./questionListMerge";

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

function formatWhatIfMySessionCreated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
  const [mobileMyGamesOpen, setMobileMyGamesOpen] = useState(false);
  const [joinFormOpen, setJoinFormOpen] = useState(false);
  const { targets: resumeTargets, loading: resumeTargetsLoading } =
    useWhatIfResumeContext();
  const hasResumeBanners =
    isMobile && !resumeTargetsLoading && resumeTargets.length > 0;
  const [mySessions, setMySessions] = useState<WhatIfMySessionsResponse | null>(
    null,
  );
  const [mySessionsLoading, setMySessionsLoading] = useState(false);
  const [mySessionsError, setMySessionsError] = useState<string | null>(null);
  const [enrolledPlayerNames, setEnrolledPlayerNames] = useState<string[]>([]);
  const [joinRoomStatus, setJoinRoomStatus] = useState<
    WhatIfSessionState["status"] | null
  >(null);
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
    if (resumeTargetsLoading) return;
    setJoinFormOpen(!hasResumeBanners);
  }, [resumeTargetsLoading, hasResumeBanners]);

  useEffect(() => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 4) {
      setEnrolledPlayerNames([]);
      setJoinRoomStatus(null);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const state = await fetchWhatIfTvState(code);
          if (cancelled || !state) return;
          setJoinRoomStatus(state.status);
          setEnrolledPlayerNames(
            (state.players ?? []).map((p) => p.display_name),
          );
        } catch {
          if (!cancelled) {
            setEnrolledPlayerNames([]);
            setJoinRoomStatus(null);
          }
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

  const joinBlockedBecauseStarted =
    joinRoomStatus != null && !isWhatIfLobbyStatus(joinRoomStatus);

  const joinFormDisabled =
    busy ||
    joinCode.trim().length !== 4 ||
    !sanitizeDisplayNameInput(name.trim()) ||
    nameTakenInRoom ||
    joinBlockedBecauseStarted;

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

  useEffect(() => {
    if (!isAuthenticated || !isApprovedUser) return;
    const loadForDesktopContinue =
      !showJoinOnly && activeTab === "continue";
    const loadForMobileLobby = isMobile && showJoinOnly;
    if (!loadForDesktopContinue && !loadForMobileLobby) return;
    let cancelled = false;
    setMySessionsLoading(true);
    setMySessionsError(null);
    void (async () => {
      try {
        const token = await getApiAccessToken();
        const data = await fetchMyWhatIfSessions(token);
        if (!cancelled) {
          setMySessions(data);
        }
      } catch (e) {
        if (!cancelled) {
          setMySessionsError(
            e instanceof Error ? e.message : "Failed to load your games",
          );
          setMySessions(null);
        }
      } finally {
        if (!cancelled) setMySessionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    isAuthenticated,
    isApprovedUser,
    showJoinOnly,
    getApiAccessToken,
    isMobile,
  ]);

  const myGamesTotalCount = useMemo(() => {
    if (!mySessions) return 0;
    return (
      mySessions.open_lobby.length +
      mySessions.in_progress.length +
      mySessions.completed.length
    );
  }, [mySessions]);

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
      const updated = await patchWhatIfQuestion(token, id, {
        review_status,
        is_active: review_status === "approved",
      });
      setQuestions((prev) =>
        mergeQuestionAfterMutation(prev, updated, questionListFilter),
      );
      const p = await fetchWhatIfPendingCount(token);
      setPendingCount(p);
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
      const updated = await patchWhatIfQuestion(token, id, { is_active });
      setQuestions((prev) =>
        mergeQuestionAfterMutation(prev, updated, questionListFilter),
      );
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
        const created = await createWhatIfQuestion(token, draft);
        setQuestions((prev) =>
          mergeQuestionAfterMutation(prev, created, questionListFilter),
        );
      } else {
        const updated = await patchWhatIfQuestion(token, editingId, draft);
        setQuestions((prev) =>
          mergeQuestionAfterMutation(prev, updated, questionListFilter),
        );
      }
      const p = await fetchWhatIfPendingCount(token);
      setPendingCount(p);
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
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      const p = await fetchWhatIfPendingCount(token);
      setPendingCount(p);
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
      const { questions: created } = await bulkImportWhatIfQuestions(
        token,
        bulkText,
      );
      setBulkText("");
      setQuestions((prev) =>
        mergeBulkQuestionsIntoList(prev, created, questionListFilter),
      );
      const p = await fetchWhatIfPendingCount(token);
      setPendingCount(p);
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

  async function resumeHostingWithCode(rawCode: string) {
    const codeErr = validateWhatIfRoomCode4(rawCode);
    if (codeErr) {
      setError(codeErr);
      return;
    }
    const code = rawCode.trim().toUpperCase();
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

  async function handleResumeHosting() {
    await resumeHostingWithCode(resumeCode);
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
      setProposeOpen(false);
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
      {joinBlockedBecauseStarted ? (
        <Text fontSize={APP_TEXT_SIZES.body} color="fg" role="status">
          This game has already started. New players cannot join. If you were already
          playing, use a Resume game banner above or open your hand from
          My games.
        </Text>
      ) : null}
      <PondButton
        type="button"
        colorPalette="teal"
        alignSelf="flex-start"
        onClick={() => void handleJoin()}
        loading={busy}
        disabled={joinFormDisabled}
      >
        Join on this phone
      </PondButton>
    </Stack>
  );

  const joinFormCollapsibleTrigger = (
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
        transform={joinFormOpen ? "rotate(90deg)" : "rotate(0deg)"}
        transition="transform 0.15s ease"
        lineHeight="1"
        flexShrink={0}
      >
        ›
      </Text>
      <Text as="span" flex="1">
        Join as a player
      </Text>
    </button>
  );

  const joinFormBlock = hasResumeBanners ? (
    <Collapsible.Root
      open={joinFormOpen}
      onOpenChange={(details) => setJoinFormOpen(details.open)}
    >
      <Collapsible.Trigger asChild>{joinFormCollapsibleTrigger}</Collapsible.Trigger>
      <Collapsible.Content>
        <Stack gap="4" pt="2">
          {joinFormContent}
        </Stack>
      </Collapsible.Content>
    </Collapsible.Root>
  ) : (
    joinFormContent
  );

  const playerTabTriggers = (
    <>
      <Tabs.Trigger
        value="join"
        bg={playerTabValue === "join" ? "teal.solid" : undefined}
        color={playerTabValue === "join" ? "black" : undefined}
        borderTopRadius="md"
        borderBottomRadius="0"
        px="2"
        py="2"
        fontWeight="medium"
        _hover={{
          bg: playerTabValue === "join" ? "teal.solid" : "transparent",
        }}
        _selected={{ bg: "teal.solid", color: "black" }}
      >
        Join Game
      </Tabs.Trigger>
      <Tabs.Trigger
        value="new"
        bg={playerTabValue === "new" ? "teal.solid" : undefined}
        color={playerTabValue === "new" ? "black" : undefined}
        borderTopRadius="md"
        borderBottomRadius="0"
        px="2"
        py="2"
        fontWeight="medium"
        _hover={{
          bg: playerTabValue === "new" ? "teal.solid" : "transparent",
        }}
        _selected={{ bg: "teal.solid", color: "black" }}
      >
        Host Game
      </Tabs.Trigger>
      <Tabs.Trigger
        value="continue"
        bg={playerTabValue === "continue" ? "teal.solid" : undefined}
        color={playerTabValue === "continue" ? "black" : undefined}
        borderTopRadius="md"
        borderBottomRadius="0"
        px="2"
        py="2"
        fontWeight="medium"
        _hover={{
          bg: playerTabValue === "continue" ? "teal.solid" : "transparent",
        }}
        _selected={{ bg: "teal.solid", color: "black" }}
      >
        Resume Game
      </Tabs.Trigger>
    </>
  );

  const adminTabTriggers = (
    <>
      <Tabs.Trigger
        value="admin-list"
        bg={adminTabValue === "admin-list" ? "teal.solid" : undefined}
        color={adminTabValue === "admin-list" ? "black" : undefined}
        borderTopRadius="md"
        borderBottomRadius="0"
        px="2"
        py="2"
        fontWeight="medium"
        _hover={{
          bg: adminTabValue === "admin-list" ? "teal.solid" : "transparent",
        }}
        _selected={{ bg: "teal.solid", color: "black" }}
      >
        Question List
      </Tabs.Trigger>
      <Tabs.Trigger
        value="admin-edit"
        bg={adminTabValue === "admin-edit" ? "teal.solid" : undefined}
        color={adminTabValue === "admin-edit" ? "black" : undefined}
        borderTopRadius="md"
        borderBottomRadius="0"
        px="4"
        py="2"
        fontWeight="medium"
        _hover={{
          bg: adminTabValue === "admin-edit" ? "teal.solid" : "transparent",
        }}
        _selected={{ bg: "teal.solid", color: "black" }}
      >
        Add Question
      </Tabs.Trigger>
      <Tabs.Trigger
        value="admin-bulk"
        bg={adminTabValue === "admin-bulk" ? "teal.solid" : undefined}
        color={adminTabValue === "admin-bulk" ? "black" : undefined}
        borderTopRadius="md"
        borderBottomRadius="0"
        px="2"
        py="2"
        fontWeight="medium"
        _hover={{
          bg: adminTabValue === "admin-bulk" ? "teal.solid" : "transparent",
        }}
        _selected={{ bg: "teal.solid", color: "black" }}
      >
        Bulk Import
      </Tabs.Trigger>
    </>
  );

  function renderMySessionRow(row: WhatIfMySessionRow) {
    const showResume = row.is_owner && row.status !== "ended" && !isMobile;
    const showOpenHand = row.status !== "ended" && (!row.is_owner || isMobile);
    const showStatusTag = row.status === "ended";
    return (
      <Flex
        key={row.short_code}
        flexWrap="wrap"
        alignItems="center"
        gap="3"
        py="3"
        borderBottomWidth="1px"
        borderColor="border"
        rowGap="2"
      >
        <Text minW="7rem" fontSize="sm" color="fg.muted" flexShrink={0}>
          {formatWhatIfMySessionCreated(row.created_at)}
        </Text>
        <Code fontSize="md" fontWeight="bold" flexShrink={0}>
          {row.short_code}
        </Code>
        <Text flex="1" minW="8rem" fontSize="sm">
          {row.player_names.length > 0 ? row.player_names.join(", ") : "—"}
        </Text>
        {showStatusTag ? (
          <Badge
            bg="yellow.200"
            color="black"
            borderWidth="1px"
            borderColor="yellow.400"
            flexShrink={0}
            fontWeight="semibold"
          >
            {row.winner_display_name ? `Winner: ${row.winner_display_name}` : "Completed"}
          </Badge>
        ) : null}
        <HStack gap="2" flexShrink={0} flexWrap="wrap">
          {showResume ? (
            <PondButton
              type="button"
              size="sm"
              colorPalette="teal"
              loading={busy}
              disabled={!isAuthenticated}
              onClick={() => void resumeHostingWithCode(row.short_code)}
            >
              Resume Hosting
            </PondButton>
          ) : null}
          {showOpenHand ? (
            <PondButton
              type="button"
              size="sm"
              variant="outline"
              colorPalette="teal"
              onClick={() => {
                const secret = row.player_secret?.trim();
                if (secret) savePlayerToken(row.short_code, secret);
                navigate(`/whatif/hand/${row.short_code}`);
              }}
            >
              Open hand
            </PondButton>
          ) : null}
        </HStack>
      </Flex>
    );
  }

  function renderMySessionsSection(title: string, rows: WhatIfMySessionRow[]) {
    if (rows.length === 0) return null;
    return (
      <Stack key={title} gap="2" align="stretch">
        <Text fontWeight="bold" fontSize={APP_TEXT_SIZES.body}>
          {title}
        </Text>
        <Stack gap="0" align="stretch">
          {rows.map((row) => renderMySessionRow(row))}
        </Stack>
      </Stack>
    );
  }

  const playerTabPanels = (
    <>
      <Tabs.Content value="join" pt="2">
        {joinFormBlock}
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
            colorPalette="teal"
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
            Reconnect hosting with one tap from the list, or enter a room code
            below if you do not see your room (for example, games created before
            you signed in).
          </Text>
          <HStack
            gap="3"
            align="center"
            flexWrap="nowrap"
            w="100%"
            overflowX="auto"
          >
            <Text
              fontSize={APP_TEXT_SIZES.label}
              fontWeight="semibold"
              color="fg"
              whiteSpace="nowrap"
              flexShrink={0}
            >
              Enter a room code:
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
              maxW="14rem"
              flexShrink={0}
              {...PANEL_FIELD_PROPS}
            />
            <PondButton
              type="button"
              colorPalette="teal"
              onClick={() => void handleResumeHosting()}
              loading={busy}
              disabled={!isAuthenticated}
              flexShrink={0}
            >
              Continue hosting
            </PondButton>
          </HStack>
          {mySessionsLoading ? (
            <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
              Loading your games…
            </Text>
          ) : null}
          {mySessionsError ? (
            <Text
              fontSize={APP_TEXT_SIZES.body}
              color="nautical.solid"
              role="alert"
            >
              {mySessionsError}
            </Text>
          ) : null}
          {mySessions &&
          !mySessionsLoading &&
          mySessions.open_lobby.length === 0 &&
          mySessions.in_progress.length === 0 &&
          mySessions.completed.length === 0 ? (
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
              No games linked to this account yet.
            </Text>
          ) : null}
          {mySessions && !mySessionsLoading ? (
            <Stack gap="6" align="stretch">
              {renderMySessionsSection("Open lobby", mySessions.open_lobby)}
              {renderMySessionsSection("In progress", mySessions.in_progress)}
              {renderMySessionsSection("Completed", mySessions.completed)}
            </Stack>
          ) : null}
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
              colorPalette="teal"
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
              colorPalette="teal"
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
            colorPalette="teal"
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

  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box
        flex="1"
        bg="bg"
        px={0}
        py={{ base: "2", md: "2" }}
      >
        <Box {...APP_SHELL_TRAY_PROPS}>
          <Stack gap={{ base: "4", md: "4" }} p={{ base: "2", md: "2" }}>
            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Heading
                as="h1"
                size={{ base: "lg", md: "xl" }}
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
              <WhatIfResumeBanners />
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
              <Box {...PANEL_ENTRY_CARD_PROPS}>
                <Stack gap="4">
                  {showJoinOnly ? (
                    joinFormBlock
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
                              ? "teal.solid"
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
                                ? "teal.solid"
                                : "transparent",
                          }}
                          _selected={{ bg: "teal.solid", color: "black" }}
                        >
                          Player
                        </Tabs.Trigger>
                        <Tabs.Trigger
                          value="admin"
                          bg={
                            outerSection === "admin"
                              ? "teal.solid"
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
                                ? "teal.solid"
                                : "transparent",
                          }}
                          _selected={{ bg: "teal.solid", color: "black" }}
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
              <Box {...PANEL_ENTRY_CARD_PROPS}>
                {proposeSuccess ? (
                  <Text
                    role="status"
                    mb="2"
                    fontSize={APP_TEXT_SIZES.helper}
                    color="teal.solid"
                    fontWeight="medium"
                  >
                    {proposeSuccess}
                  </Text>
                ) : null}
                <Collapsible.Root
                  open={proposeOpen}
                  onOpenChange={(details) => {
                    setProposeOpen(details.open);
                    if (details.open) {
                      setProposeSuccess(null);
                    }
                  }}
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
                        colorPalette="teal"
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

            {isMobile &&
            isAuthenticated &&
            isApprovedUser &&
            myGamesTotalCount >= 1 &&
            !mySessionsLoading &&
            mySessions ? (
              <Box {...PANEL_ENTRY_CARD_PROPS}>
                <Collapsible.Root
                  open={mobileMyGamesOpen}
                  onOpenChange={(details) => setMobileMyGamesOpen(details.open)}
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
                          mobileMyGamesOpen ? "rotate(90deg)" : "rotate(0deg)"
                        }
                        transition="transform 0.15s ease"
                        lineHeight="1"
                        flexShrink={0}
                      >
                        ›
                      </Text>
                      <Text as="span" flex="1">
                        My games ({myGamesTotalCount})
                      </Text>
                    </button>
                  </Collapsible.Trigger>
                  <Collapsible.Content>
                    <Stack gap="4" pt="2">
                      <Text fontSize={APP_TEXT_SIZES.body} color="fg">
                        Resume hosting or open your hand for a room you host or
                        have joined.
                      </Text>
                      {mySessionsError ? (
                        <Text
                          fontSize={APP_TEXT_SIZES.body}
                          color="nautical.solid"
                          role="alert"
                        >
                          {mySessionsError}
                        </Text>
                      ) : null}
                      <Stack gap="6" align="stretch">
                        {renderMySessionsSection(
                          "Open lobby",
                          mySessions.open_lobby,
                        )}
                        {renderMySessionsSection(
                          "In progress",
                          mySessions.in_progress,
                        )}
                        {renderMySessionsSection(
                          "Completed",
                          mySessions.completed,
                        )}
                      </Stack>
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
