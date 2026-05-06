import {
  Box,
  Flex,
  Grid,
  GridItem,
  Heading,
  IconButton,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import type { ReactNode } from "react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { PanelBlockSkeleton } from "../components/panelStatus";
import QffButton from "./QffButton";
import {
  fetchQffSession,
  postQffSessionActivity,
  postQffSessionLeave,
  qffSessionWsUrl,
  sendQffCommand,
  type QffAreaMapCell,
  type QffCommandResponse,
  type QffSession,
  type QffSessionWithCharacter,
  type QffShopPanelLine,
} from "./api";
import { optimisticMoveHeadLine, tryParseQffMoveDirection } from "./commandParser";
import { QFF_NARRATIVE_TOO_DARK } from "./copy";
import { QFF_PLAY_PAGE_CONTENT_PROPS } from "./qffUi";

/** WebSocket keepalive; must be ≤ combat round length so lazy sim runs on time (~6s). */
const WS_PING_MS = 6_000;
const WS_RECONNECT_BASE_MS = 2000;
const WS_WHO_TIMEOUT_MS = 800;
/** After initial GET /session/, HTTP activity touch only if WS did not connect in time. */
const WS_ACTIVITY_FALLBACK_MS = 1_200;

/** Charcoal + light gray (same family as action log). */
const HUD_PANEL_BG = "#141414";
const HUD_PANEL_BORDER = "#404040";
const HUD_PANEL_TEXT = "#c8c8c8";
const HUD_PANEL_TEXT_MUTED = "#909090";
/** Most recent command + response in the log */
const HUD_LOG_RECENT = "#f5f5f5";
/** Combat log tones (placeholders; revise when spells/healing land). */
const HUD_LOG_HERO_HIT = "#dff7e8";
const HUD_LOG_ENEMY_HIT = "#fce8f0";
const HUD_LOG_MISS = "#faf6e0";

function sortShopStockForDisplay(lines: QffShopPanelLine[]): QffShopPanelLine[] {
  return [...lines].sort((a, b) => {
    if (a.price !== b.price) return a.price - b.price;
    const aKey = a.quantity == null ? Number.POSITIVE_INFINITY : a.quantity;
    const bKey = b.quantity == null ? Number.POSITIVE_INFINITY : b.quantity;
    if (aKey !== bKey) return aKey - bKey;
    const nc = a.name.localeCompare(b.name);
    if (nc !== 0) return nc;
    return a.id - b.id;
  });
}

function hudLogLineColor(recent: boolean, logTone: string | undefined): string {
  if (logTone === "hero_hit") return HUD_LOG_HERO_HIT;
  if (logTone === "enemy_hit") return HUD_LOG_ENEMY_HIT;
  if (logTone === "miss") return HUD_LOG_MISS;
  return recent ? HUD_LOG_RECENT : HUD_PANEL_TEXT;
}

/** Accept snake_case or camelCase (some proxies / serializers rename keys). */
function actionLogEntryTone(e: { log_tone?: string; logTone?: string }): string | undefined {
  const raw = (e.log_tone ?? e.logTone ?? "").trim();
  return raw || undefined;
}

function mergeSessionSnapshot(
  prev: QffSessionWithCharacter | null,
  next: QffSessionWithCharacter,
): QffSessionWithCharacter {
  if (!next.has_character) return next;
  if (!next.session_partial || !prev?.has_character) return next;
  const snapshotMapStub =
    next.area_map.minimal === true &&
    next.area_map.grids.length === 0;
  const usePrevAreaMap =
    snapshotMapStub &&
    (prev.area_map.grids.length > 0 || prev.area_map.minimal !== true);
  return {
    ...next,
    active_heroes: next.active_heroes ?? prev.active_heroes,
    area_map: usePrevAreaMap ? prev.area_map : next.area_map,
    shops: next.shops ?? prev.shops,
    active_quests: next.active_quests ?? prev.active_quests,
    character_profile: next.character_profile ?? prev.character_profile,
  };
}

function areaMapHasRoom(
  areaMap: QffSessionWithCharacter["area_map"],
  roomId: number,
): boolean {
  for (const grid of areaMap.grids) {
    if (grid.cells.some((cell) => cell.room_id === roomId)) return true;
  }
  return false;
}
/** Stat total (modified) */
const HUD_STAT_TOTAL = "#f0f0f0";
/** (base + modifiers) — darker than label + total */
const HUD_STAT_PAREN = "#555555";

function QffStatLine({
  label,
  total,
  base,
  bonus,
}: {
  label: string;
  total: number;
  base: number;
  bonus: number;
}) {
  return (
    <Text lineHeight="short" fontSize="xs">
      <Text as="span" color={HUD_PANEL_TEXT_MUTED}>
        {label}:{" "}
      </Text>
      <Text as="span" color={HUD_STAT_TOTAL}>
        {total}
      </Text>
      <Text as="span" color={HUD_STAT_PAREN}>
        {" "}
        ({base} + {bonus})
      </Text>
    </Text>
  );
}

function QffHudLabeledValue({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  const display = value == null || value === "" ? "—" : value;
  const highlight = display !== "—";
  return (
    <Text lineHeight="short" fontSize="xs">
      <Text as="span" color={HUD_PANEL_TEXT_MUTED}>
        {label}{" "}
      </Text>
      <Text as="span" color={highlight ? HUD_STAT_TOTAL : HUD_PANEL_TEXT_MUTED}>
        {display}
      </Text>
    </Text>
  );
}

export default function QffPlayPage() {
  const navigate = useNavigate();
  const { isAuthenticated, sessionUser, isLoading, getApiAccessToken } = useAppSession();
  const getTokenRef = useRef(getApiAccessToken);
  getTokenRef.current = getApiAccessToken;
  /** Last token used for a successful QFF HTTP call — avoids await getAccessTokenSilently on every command. */
  const commandTokenRef = useRef<string | null>(null);
  const [session, setSession] = useState<QffSessionWithCharacter | null>(null);
  const sessionRef = useRef<QffSessionWithCharacter | null>(null);
  sessionRef.current = session;
  const [initialSessionLoadDone, setInitialSessionLoadDone] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [line, setLine] = useState("");
  const [logLines, setLogLines] = useState<
    Array<{ id: number; text: string; recent: boolean; logTone?: string }>
  >([]);
  const [mapVisible, setMapVisible] = useState(true);
  // When true, the shop panel takes over the minimap's grid slot until the player
  // types `map` (or leaves a room with no shops).
  const [shopPanelOpen, setShopPanelOpen] = useState(false);
  /** When true, container contents replace the minimap (same grid slot as shop). */
  const [containerPanelOpen, setContainerPanelOpen] = useState(false);
  const [questPanelOpen, setQuestPanelOpen] = useState(false);
  const [activeUsersPanelOpen, setActiveUsersPanelOpen] = useState(false);
  const prevRoomIdRef = useRef<number | null>(null);
  const logLineIdRef = useRef(0);
  const lastBroadcastIdRef = useRef(0);
  /** RoomBroadcast ids already applied via POST /command (avoids duplicating lines when session effect runs). */
  const commandActionLogBroadcastIdsRef = useRef<Set<number>>(new Set());
  /** Ids for in-flight `> input`, `…`, and optional move preview; stripped when the command response is merged. */
  const optimisticCommandLogIdsRef = useRef<number[]>([]);
  /** In-flight POST /command; a second Enter queues at most one follow-up in `queuedLineRef`. */
  const commandInFlightRef = useRef(false);
  const queuedLineRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const logScrollRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const activityFallbackTimerRef = useRef<number | null>(null);
  const whoRequestSeqRef = useRef(0);
  const whoResponseWaitersRef = useRef(new Map<number, (rows: QffSessionWithCharacter["active_heroes"]) => void>());
  const [commandPending, setCommandPending] = useState(false);
  const [leavePending, setLeavePending] = useState<false | { waitSeconds: number }>(false);
  /** Last room id known to exist inside current minimap data; prevents transient blank map on partial updates. */
  const lastRenderableMinimapRoomIdRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    const token = await getTokenRef.current();
    // POST activity must run before GET /session/: build_session uses force_lobby when
    // is_in_realm is false (e.g. after Leave). Touching activity re-enters the realm so
    // the session payload does not immediately redirect back to /qff.
    try {
      await postQffSessionActivity(token);
    } catch {
      /* ignore — still fetch session */
    }
    const s = await fetchQffSession(token);
    commandTokenRef.current = token;
    if (!s.has_character) {
      setSession(null);
      return;
    }
    setSession(s);
    if (activityFallbackTimerRef.current != null) {
      window.clearTimeout(activityFallbackTimerRef.current);
      activityFallbackTimerRef.current = null;
    }
    activityFallbackTimerRef.current = window.setTimeout(async () => {
      activityFallbackTimerRef.current = null;
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) return;
      try {
        await postQffSessionActivity(await getTokenRef.current());
      } catch {
        /* ignore — WS may connect later */
      }
    }, WS_ACTIVITY_FALLBACK_MS);
  }, []);

  const handleLeaveClick = useCallback(async () => {
    if (leavePending !== false) return;
    const token = await getTokenRef.current();
    try {
      const res = await postQffSessionLeave(token);
      if (!res.in_realm) {
        navigate("/qff");
        return;
      }
      if (res.pending) {
        setLeavePending({ waitSeconds: res.wait_seconds });
        const delayMs = Math.max(0, res.wait_seconds * 1000) + 250;
        window.setTimeout(async () => {
          try {
            const s = await fetchQffSession(token);
            if (!s.has_character || s.force_lobby) {
              navigate("/qff");
              return;
            }
            setSession(s);
          } catch {
            /* fall through: leave state stays; user can retry */
          } finally {
            setLeavePending(false);
          }
        }, delayMs);
        return;
      }
      if (res.messages.length > 0) {
        setLogLines((prev) => {
          const nextId = () => logLineIdRef.current++;
          const block = res.messages.map((text) => ({
            id: nextId(),
            text,
            recent: true,
          }));
          return [...prev.map((p) => ({ ...p, recent: false })), ...block];
        });
      }
      try {
        const s = await fetchQffSession(token);
        if (s.has_character) setSession(s);
      } catch {
        /* ignore */
      }
    } catch {
      setLeavePending(false);
    }
  }, [leavePending, navigate]);

  useEffect(() => {
    if (!isAuthenticated || !sessionUser?.user?.is_approved) return;
    let cancelled = false;
    setInitialSessionLoadDone(false);
    (async () => {
      try {
        await load();
        if (!cancelled) setLoadError(null);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Load failed.");
      } finally {
        if (!cancelled) setInitialSessionLoadDone(true);
      }
    })();
    return () => {
      cancelled = true;
      if (activityFallbackTimerRef.current != null) {
        window.clearTimeout(activityFallbackTimerRef.current);
        activityFallbackTimerRef.current = null;
      }
    };
  }, [isAuthenticated, sessionUser?.user?.is_approved, load]);

  const characterId = session?.has_character ? session.character.id : null;

  useEffect(() => {
    if (!isAuthenticated || !sessionUser?.user?.is_approved || characterId == null) return;

    let cancelled = false;
    let ws: WebSocket | null = null;
    let pingId: number | null = null;
    let reconnectTimer: number | null = null;
    let attempt = 0;

    const scheduleReconnect = () => {
      if (cancelled) return;
      const delay = Math.min(WS_RECONNECT_BASE_MS * 2 ** attempt, 60_000);
      attempt += 1;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, delay);
    };

    const connect = async () => {
      if (cancelled) return;
      const token = await getTokenRef.current();
      if (!token || cancelled) return;
      let socket: WebSocket;
      try {
        socket = new WebSocket(qffSessionWsUrl(token));
      } catch {
        scheduleReconnect();
        return;
      }
      ws = socket;
      socket.onopen = () => {
        wsRef.current = socket;
        attempt = 0;
        socket.send(JSON.stringify({ type: "activity" }));
        if (pingId != null) window.clearInterval(pingId);
        pingId = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, WS_PING_MS);
      };
      socket.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as {
            type?: string;
            request_id?: number;
            rows?: QffSessionWithCharacter["active_heroes"];
            session?: QffSessionWithCharacter;
          };
          if (data.type === "session" && data.session?.has_character) {
            setSession((prev) => mergeSessionSnapshot(prev, data.session!));
          } else if (data.type === "active_heroes" && typeof data.request_id === "number") {
            const waiter = whoResponseWaitersRef.current.get(data.request_id);
            if (waiter) {
              whoResponseWaitersRef.current.delete(data.request_id);
              waiter(data.rows ?? []);
            }
          }
        } catch {
          /* ignore */
        }
      };
      socket.onclose = () => {
        if (pingId != null) {
          window.clearInterval(pingId);
          pingId = null;
        }
        if (wsRef.current === socket) wsRef.current = null;
        if (!cancelled) scheduleReconnect();
      };
      socket.onerror = () => {
        socket.close();
      };
    };

    void connect();

    return () => {
      cancelled = true;
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
      if (pingId != null) window.clearInterval(pingId);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      if (wsRef.current === ws) wsRef.current = null;
      whoResponseWaitersRef.current.clear();
    };
  }, [isAuthenticated, sessionUser?.user?.is_approved, characterId]);

  useEffect(() => {
    if (session) inputRef.current?.focus();
  }, [session]);

  /** Lock document scroll while on play — HUD uses internal panes only. */
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      htmlOverflowX: html.style.overflowX,
      htmlOverflowY: html.style.overflowY,
      bodyOverflow: body.style.overflow,
      bodyOverflowX: body.style.overflowX,
      bodyOverflowY: body.style.overflowY,
      bodyOverscroll: body.style.overscrollBehavior,
    };
    html.style.overflow = "hidden";
    html.style.overflowX = "hidden";
    html.style.overflowY = "hidden";
    body.style.overflow = "hidden";
    body.style.overflowX = "hidden";
    body.style.overflowY = "hidden";
    body.style.overscrollBehavior = "none";
    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.overflowX = prev.htmlOverflowX;
      html.style.overflowY = prev.htmlOverflowY;
      body.style.overflow = prev.bodyOverflow;
      body.style.overflowX = prev.bodyOverflowX;
      body.style.overflowY = prev.bodyOverflowY;
      body.style.overscrollBehavior = prev.bodyOverscroll;
    };
  }, []);

  useEffect(() => {
    const el = logScrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [logLines]);

  /** Room broadcasts (targeted + room); skip ids already applied (HTTP + WS can repeat the same session). */
  useEffect(() => {
    const entries = session?.action_log;
    if (!entries?.length) return;
    const fresh = entries.filter((e) => {
      if (e.id <= lastBroadcastIdRef.current) return false;
      if (typeof e.id === "number" && e.id > 0 && commandActionLogBroadcastIdsRef.current.has(e.id)) {
        return false;
      }
      return true;
    });
    if (!fresh.length) return;
    const posIds = fresh.map((e) => e.id).filter((id) => id > 0);
    if (posIds.length) {
      lastBroadcastIdRef.current = Math.max(lastBroadcastIdRef.current, ...posIds);
    }
    setLogLines((prev) => {
      const nextId = () => logLineIdRef.current++;
      const block = fresh.map((e) => ({
        id: nextId(),
        text: e.text,
        recent: true,
        logTone: actionLogEntryTone(e),
      }));
      return [...prev.map((p) => ({ ...p, recent: false })), ...block];
    });
  }, [session]);

  useEffect(() => {
    if (!session?.has_character) return;
    const roomId = session.room.id;
    const prev = prevRoomIdRef.current;
    prevRoomIdRef.current = roomId;
    if (prev !== null && prev !== roomId) {
      // Left the room — only auto-close if the new room has no shops at all.
      if ((session.shops?.length ?? 0) === 0) setShopPanelOpen(false);
      setContainerPanelOpen(false);
      setQuestPanelOpen(false);
      setActiveUsersPanelOpen(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session?.has_character) return;
    if (!session.room.opened_container) {
      setContainerPanelOpen(false);
    }
  }, [session?.has_character, session?.room?.opened_container]);

  const runCommand = useCallback(async (rawLine: string) => {
    const raw = rawLine.trim();
    if (!raw) return;
    // Client-only "map" command: restore the minimap to its grid slot. No HTTP, no log echo.
    const mapWord = raw.replace(/^>+\s*/, "").replace(/^\//, "").trim().toLowerCase();
    if (mapWord === "map") {
      setShopPanelOpen(false);
      setContainerPanelOpen(false);
      setQuestPanelOpen(false);
      setActiveUsersPanelOpen(false);
      setMapVisible(true);
      setLine("");
      queueMicrotask(() => inputRef.current?.focus());
      return;
    }
    if (mapWord === "who" || mapWord === "whois") {
      setShopPanelOpen(false);
      setContainerPanelOpen(false);
      setQuestPanelOpen(false);
      setMapVisible(true);
      setLine("");
      void (async () => {
        const socket = wsRef.current;
        if (socket && socket.readyState === WebSocket.OPEN) {
          const requestId = ++whoRequestSeqRef.current;
          const wsRows = await new Promise<QffSessionWithCharacter["active_heroes"] | null>(
            (resolve) => {
              const timer = window.setTimeout(() => {
                whoResponseWaitersRef.current.delete(requestId);
                resolve(null);
              }, WS_WHO_TIMEOUT_MS);
              whoResponseWaitersRef.current.set(requestId, (rows) => {
                window.clearTimeout(timer);
                resolve(rows);
              });
              socket.send(JSON.stringify({ type: "who", request_id: requestId }));
            },
          );
          if (wsRows) {
            const current = sessionRef.current;
            if (current?.has_character) {
              setSession({ ...current, active_heroes: wsRows });
            }
            setActiveUsersPanelOpen(true);
            queueMicrotask(() => inputRef.current?.focus());
            return;
          }
        }
        let token = commandTokenRef.current;
        if (!token) {
          token = await getTokenRef.current();
        }
        const applySession = (s: QffSession, t: string) => {
          commandTokenRef.current = t;
          if (s.has_character) {
            setSession(s);
          }
        };
        try {
          const s = await fetchQffSession(token);
          applySession(s, token);
        } catch (firstErr) {
          const msg = firstErr instanceof Error ? firstErr.message : "";
          if (/\(401\)|\(403\)/.test(msg)) {
            try {
              const t2 = await getTokenRef.current();
              const s2 = await fetchQffSession(t2);
              applySession(s2, t2);
            } catch {
              /* keep prior session */
            }
          }
        }
        setActiveUsersPanelOpen(true);
        queueMicrotask(() => inputRef.current?.focus());
      })();
      return;
    }
    const s = sessionRef.current;
    if (s?.has_character && s.character_profile.isDead) {
      setLogLines((prev) => {
        const nextId = () => logLineIdRef.current++;
        return [
          ...prev.map((p) => ({ ...p, recent: false })),
          { id: nextId(), text: "You are dead and cannot act.", recent: true },
        ];
      });
      setLine("");
      return;
    }
    const normalized = raw.replace(/^>+\s*/, "").replace(/^\//, "").trim().toLowerCase();
    const firstWord = normalized.split(/\s+/, 1)[0] ?? "";
    const isLeaveAlias = firstWord === "leave" || firstWord === "exit" || firstWord === "quit";
    const moveDir = tryParseQffMoveDirection(raw);
    if (
      moveDir &&
      !isLeaveAlias &&
      sessionRef.current?.has_character &&
      !sessionRef.current.exits.some((ex) => ex.direction === moveDir)
    ) {
      setLogLines((prev) => {
        const nextId = () => logLineIdRef.current++;
        return [
          ...prev.map((p) => ({ ...p, recent: false })),
          { id: nextId(), text: `> ${raw}`, recent: true },
          { id: nextId(), text: "You can't go that way.", recent: true },
        ];
      });
      setLine("");
      queueMicrotask(() => inputRef.current?.focus());
      return;
    }
    if (commandInFlightRef.current) {
      queuedLineRef.current = raw;
      setLine("");
      return;
    }
    commandInFlightRef.current = true;
    setCommandPending(true);
    commandActionLogBroadcastIdsRef.current.clear();
    setLine("");
    const cur = sessionRef.current;
    const optimisticSecond =
      cur?.has_character && moveDir ? optimisticMoveHeadLine(cur.exits, moveDir) : null;
      try {
        if (optimisticSecond != null) {
          const cmdId = logLineIdRef.current++;
          const dotId = logLineIdRef.current++;
          const moveId = logLineIdRef.current++;
          optimisticCommandLogIdsRef.current = [cmdId, dotId, moveId];
          setLogLines((prev) => [
            ...prev.map((p) => ({ ...p, recent: false })),
            { id: cmdId, text: `> ${raw}`, recent: true },
            { id: dotId, text: "…", recent: true },
            { id: moveId, text: optimisticSecond, recent: true },
          ]);
        } else {
          const cmdId = logLineIdRef.current++;
          const dotId = logLineIdRef.current++;
          optimisticCommandLogIdsRef.current = [cmdId, dotId];
          setLogLines((prev) => [
            ...prev.map((p) => ({ ...p, recent: false })),
            { id: cmdId, text: `> ${raw}`, recent: true },
            { id: dotId, text: "…", recent: true },
          ]);
        }
        let token = commandTokenRef.current;
        if (!token) {
          token = await getTokenRef.current();
        }
        let res: QffCommandResponse;
        try {
          res = await sendQffCommand(token, raw);
        } catch (firstErr) {
          const msg = firstErr instanceof Error ? firstErr.message : "";
          if (/\(401\)|\(403\)/.test(msg)) {
            token = await getTokenRef.current();
            res = await sendQffCommand(token, raw);
          } else {
            throw firstErr;
          }
        }
        commandTokenRef.current = token;
        const sessionSnapshot = res.session;
        // Always show one `> line` in the HUD; do not use res.echo_command to hide it.
        const verb = raw
          .replace(/^>+\s*/, "")
          .replace(/^\//, "")
          .trim()
          .toLowerCase()
          .split(/\s+/, 1)[0];
        const shopVerb =
          verb === "shop" ||
          verb === "list" ||
          verb === "buy" ||
          verb === "purchase";
        // Apply log (and broadcast-id bookkeeping) before session so effects see an up-to-date watermark.
        setLogLines((prev) => {
          const pending = optimisticCommandLogIdsRef.current;
          optimisticCommandLogIdsRef.current = [];
          const filtered = pending.length ? prev.filter((p) => !pending.includes(p.id)) : prev;
          const nextId = () => logLineIdRef.current++;
          const al = sessionSnapshot.action_log ?? [];
          let block: Array<{ id: number; text: string; recent: boolean; logTone?: string }>;
          if (al.length > 0) {
            block = al.map((e) => ({
              id: nextId(),
              text: e.text,
              recent: true,
              logTone: actionLogEntryTone(e),
            }));
            block = [{ id: nextId(), text: `> ${raw}`, recent: true }, ...block];
          } else {
            const narr = res.messages;
            const toShow: string[] = [`> ${raw}`, ...narr];
            block = toShow.map((text) => ({
              id: nextId(),
              text,
              recent: true,
            }));
          }
          const pos = al.filter((e) => e.id > 0).map((e) => e.id);
          for (const id of pos) {
            commandActionLogBroadcastIdsRef.current.add(id);
          }
          if (pos.length) {
            lastBroadcastIdRef.current = Math.max(
              lastBroadcastIdRef.current,
              ...pos,
            );
          }
          return [...filtered.map((p) => ({ ...p, recent: false })), ...block];
        });
        if (shopVerb && (sessionSnapshot.shops?.length ?? 0) > 0) {
          setShopPanelOpen(true);
          setContainerPanelOpen(false);
          setQuestPanelOpen(false);
          setActiveUsersPanelOpen(false);
        }
        if (res.ui?.openShop) {
          setShopPanelOpen(true);
          setContainerPanelOpen(false);
          setQuestPanelOpen(false);
          setActiveUsersPanelOpen(false);
        }
        if (verb === "open" && sessionSnapshot.room.opened_container) {
          setContainerPanelOpen(true);
          setShopPanelOpen(false);
          setQuestPanelOpen(false);
          setActiveUsersPanelOpen(false);
        }
        if (verb === "quest") {
          setQuestPanelOpen(true);
          setShopPanelOpen(false);
          setContainerPanelOpen(false);
          setActiveUsersPanelOpen(false);
        }
        if (verb === "train" || (verb === "buy" && /\b(stat|stats|gains|moves|guts|smarts|sense|rizz)\b/.test(raw.toLowerCase()))) {
          setShopPanelOpen(false);
          setContainerPanelOpen(false);
          setQuestPanelOpen(false);
          setActiveUsersPanelOpen(false);
        }
        setSession((prev) => mergeSessionSnapshot(prev, sessionSnapshot));
      } catch (e) {
        setLogLines((prev) => {
          const pending = optimisticCommandLogIdsRef.current;
          optimisticCommandLogIdsRef.current = [];
          const filtered = pending.length ? prev.filter((p) => !pending.includes(p.id)) : prev;
          const nextId = () => logLineIdRef.current++;
          const block = [
            { id: nextId(), text: `> ${raw}`, recent: true },
            {
              id: nextId(),
              text: e instanceof Error ? e.message : "Error.",
              recent: true,
            },
          ];
          return [...filtered.map((p) => ({ ...p, recent: false })), ...block];
        });
      } finally {
        commandInFlightRef.current = false;
        setCommandPending(false);
        const next = queuedLineRef.current;
        queuedLineRef.current = null;
        queueMicrotask(() => {
          inputRef.current?.focus();
          if (next) void runCommand(next);
        });
      }
  }, []);

  if (!isAuthenticated) {
    return (
      <Box px={4} py={8}>
        <Text>Sign in to play.</Text>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box px={4} py={8} maxW="md">
        <PanelBlockSkeleton lines={2} showTitleLine />
      </Box>
    );
  }

  if (!sessionUser?.user?.is_approved) {
    return (
      <Box px={4} py={8}>
        <Text>Approval required.</Text>
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box px={4} py={8}>
        <Text color="nautical.solid" role="alert">
          {loadError}
        </Text>
      </Box>
    );
  }

  if (!initialSessionLoadDone) {
    return (
      <Box px={4} py={8} maxW="md">
        <PanelBlockSkeleton lines={2} showTitleLine />
      </Box>
    );
  }

  if (!session) {
    return <Navigate to="/qff/create" replace />;
  }

  if (session.force_lobby) {
    return <Navigate to="/qff" replace />;
  }

  const { room, area, exits, others_here, area_map } = session;
  const roomInMap = areaMapHasRoom(area_map, room.id);
  if (roomInMap) {
    lastRenderableMinimapRoomIdRef.current = room.id;
  }
  const minimapRoomId = roomInMap
    ? room.id
    : (lastRenderableMinimapRoomIdRef.current ?? room.id);
  const mapMinimal = area_map.minimal === true;
  const t = area.theme;
  // When absent (older API), treat as visible until backend with `room.details_visible` is deployed.
  const roomDetailsVisible = room.details_visible !== false;
  const cp = session.character_profile;
  const heroDead = cp.isDead === true;
  const roomMonsters = room.monsters ?? [];
  const eq = cp.equipment_slots;
  const st = cp.stats.modified;
  const stBase = cp.stats.base;
  const stBonus = cp.stats.bonusSum;
  const invLabel =
    cp.inventoryItems.length > 0
      ? cp.inventoryItems.join(", ") + (cp.isEncumbered ? " (encumbered)" : "")
      : "—";

  const exitsBlock = (
    <>
      <Text fontSize="sm">
        <Text as="span" color={t.secondary}>
          Exits:{" "}
        </Text>
        <Text as="span" color={t.accent}>
          {exits.length === 0
            ? "none obvious"
            : exits
                .map((e) => {
                  if (e.is_blocked || e.is_locked) return `${e.label} (locked)`;
                  return e.label;
                })
                .join(", ")}
        </Text>
      </Text>
      {(others_here.length > 0 ||
        (room.npcs?.length ?? 0) > 0 ||
        roomMonsters.length > 0) && (
        <Text fontSize="sm">
          <Text as="span" color={t.secondary}>
            Also here:{" "}
          </Text>
          {others_here.map((o, i) => (
            <Text as="span" key={`oh-p-${i}`} fontWeight="bold" color={t.accent}>
              {o.name}
              {o.inactive ? " (inactive)" : ""}
              {i < others_here.length - 1 ||
              (room.npcs?.length ?? 0) > 0 ||
              roomMonsters.length > 0
                ? ", "
                : ""}
            </Text>
          ))}
          {room.npcs?.map((n, i) => (
            <Text as="span" key={n.slug} color={t.accent}>
              {n.name}
              {i < (room.npcs!.length - 1) || roomMonsters.length > 0 ? ", " : ""}
            </Text>
          ))}
          {roomMonsters.map((m, i) => (
            <Text as="span" key={`m-${m.id}`} color={t.accent} fontWeight="semibold">
              {m.name}
              {i < roomMonsters.length - 1 ? ", " : ""}
            </Text>
          ))}
        </Text>
      )}
      {room.youSee.length > 0 && (
        <Text fontSize="sm">
          <Text as="span" color={t.secondary}>
            You see:{" "}
          </Text>
          <Text as="span" color={t.accent}>
            {room.youSee.join(", ")}
          </Text>
        </Text>
      )}
    </>
  );

  const mapPanel = (
    <Box
      position="relative"
      flexShrink={0}
      w="100%"
      minW={0}
      borderWidth="1px"
      borderColor={HUD_PANEL_BORDER}
      borderRadius="md"
      p={2}
      bg={HUD_PANEL_BG}
      fontSize="xs"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      overflow="visible"
    >
      <IconButton
        type="button"
        variant="ghost"
        size="xs"
        aria-label={mapVisible ? "Hide map" : "Show map"}
        title={mapVisible ? "Hide map" : "Show map"}
        position="absolute"
        top={1}
        right={1}
        zIndex={2}
        color={HUD_PANEL_TEXT_MUTED}
        _hover={{ color: HUD_PANEL_TEXT, bg: "rgba(255,255,255,0.06)" }}
        onClick={() => setMapVisible((v) => !v)}
      >
        <Box
          as="span"
          display="block"
          lineHeight={0}
          opacity={mapVisible ? 1 : 0.55}
          aria-hidden
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 6.5 9 4l6 2.5L21 4v15l-6 2.5-6-2.5-6 2.5V6.5z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
            <path d="M9 4v15M15 6.5V22" stroke="currentColor" strokeWidth="1.75" />
          </svg>
        </Box>
      </IconButton>
      <Flex
        w="100%"
        justify="center"
        align="center"
        overflow="visible"
        pt={1}
        visibility={mapVisible ? "visible" : "hidden"}
        pointerEvents={mapVisible ? "auto" : "none"}
        aria-hidden={!mapVisible}
      >
        <QffMiniMap areaMap={area_map} currentRoomId={minimapRoomId} />
      </Flex>
    </Box>
  );

  const shopsForPanel = session.shops ?? [];
  const shopPanel = (
    <Box
      position="relative"
      flexShrink={0}
      w="100%"
      minW={0}
      borderWidth="1px"
      borderColor={HUD_PANEL_BORDER}
      borderRadius="md"
      p={2}
      bg={HUD_PANEL_BG}
      fontSize="xs"
      display="flex"
      flexDirection="column"
      overflowY="auto"
      maxH={{ base: "min(300px, 42vh)", lg: "min(460px, 48vh)" }}
    >
      {shopsForPanel.length === 0 ? (
        <Text color={HUD_PANEL_TEXT_MUTED}>No shops here.</Text>
      ) : (
        shopsForPanel.map((sh, shopIdx) => {
          const sorted = sortShopStockForDisplay(sh.stock_lines);
          return (
            <Box key={sh.id} mt={shopIdx === 0 ? 0 : 2}>
              <Text fontWeight="semibold" color={HUD_PANEL_TEXT} mb={1}>
                {sh.npc_name}&apos;s Shoppe
              </Text>
              {sh.stock_lines.length === 0 ? (
                <Text color={HUD_PANEL_TEXT_MUTED}>(nothing for sale)</Text>
              ) : (
                <Grid
                  templateColumns="minmax(2.25ch, auto) 1fr auto"
                  columnGap={2}
                  rowGap={0.5}
                  alignItems="baseline"
                >
                  <Text color={HUD_PANEL_TEXT_MUTED} fontSize="2xs">
                    Qty
                  </Text>
                  <Text color={HUD_PANEL_TEXT_MUTED} fontSize="2xs">
                    Item
                  </Text>
                  <Text color={HUD_PANEL_TEXT_MUTED} fontSize="2xs" textAlign="right">
                    Cost
                  </Text>
                  {sorted.map((sl) => (
                    <Fragment key={sl.id}>
                      <Text color={HUD_PANEL_TEXT} whiteSpace="nowrap" fontSize="xs">
                        {sl.quantity == null ? "∞" : sl.quantity}
                      </Text>
                      <Text color={HUD_PANEL_TEXT} minW={0} fontSize="xs">
                        {sl.name}
                      </Text>
                      <Text
                        color={HUD_PANEL_TEXT}
                        whiteSpace="nowrap"
                        textAlign="right"
                        fontSize="xs"
                      >
                        {sl.price}g
                      </Text>
                    </Fragment>
                  ))}
                </Grid>
              )}
            </Box>
          );
        })
      )}
      <Text mt={2} color={HUD_PANEL_TEXT_MUTED} fontSize="2xs">
        Type <strong>buy &lt;item&gt;</strong> to purchase. <strong>look</strong> /{" "}
        <strong>inspect</strong> a listed item. <strong>map</strong> to return.
      </Text>
    </Box>
  );

  const openedForPanel = room.opened_container;
  const containerPanel =
    openedForPanel != null ? (
      <Box
        position="relative"
        flexShrink={0}
        w="100%"
        minW={0}
        borderWidth="1px"
        borderColor={HUD_PANEL_BORDER}
        borderRadius="md"
        p={2}
        bg={HUD_PANEL_BG}
        fontSize="xs"
        display="flex"
        flexDirection="column"
        overflowY="auto"
        maxH={{ base: "min(300px, 42vh)", lg: "min(460px, 48vh)" }}
      >
        <Text fontWeight="semibold" color={HUD_PANEL_TEXT} mb={1}>
          {openedForPanel.name}
        </Text>
        {openedForPanel.items.length === 0 ? (
          <Text color={HUD_PANEL_TEXT_MUTED}>Empty.</Text>
        ) : (
          <Stack gap={0.5}>
            {openedForPanel.items.map((it) => (
              <Text key={it.id} color={HUD_PANEL_TEXT}>
                {it.name}
                {it.quantity > 1 ? ` ×${it.quantity}` : ""}
              </Text>
            ))}
          </Stack>
        )}
        <Text mt={2} color={HUD_PANEL_TEXT_MUTED} fontSize="2xs">
          <strong>get</strong> / <strong>take</strong> to pick up · <strong>put</strong> /{" "}
          <strong>place</strong> to stash · <strong>map</strong> or leave the room to close.
        </Text>
      </Box>
    ) : null;

  const activeQuestRows = session.active_quests ?? [];
  const questPanel = (
    <Box
      position="relative"
      flexShrink={0}
      w="100%"
      minW={0}
      borderWidth="1px"
      borderColor={HUD_PANEL_BORDER}
      borderRadius="md"
      p={2}
      bg={HUD_PANEL_BG}
      fontSize="xs"
      display="flex"
      flexDirection="column"
      overflowY="auto"
      maxH={{ base: "min(300px, 42vh)", lg: "min(460px, 48vh)" }}
    >
      <Text fontWeight="semibold" color={HUD_PANEL_TEXT} mb={1}>
        Active Quests
      </Text>
      {activeQuestRows.length === 0 ? (
        <Text color={HUD_PANEL_TEXT_MUTED}>No active quests.</Text>
      ) : (
        <Stack gap={0.5}>
          {activeQuestRows.map((q, i) => (
            <Text key={`${q.slug}-${i}`} color={HUD_PANEL_TEXT}>
              {q.label}
            </Text>
          ))}
        </Stack>
      )}
      <Text mt={2} color={HUD_PANEL_TEXT_MUTED} fontSize="2xs">
        <strong>map</strong> to return.
      </Text>
    </Box>
  );

  const activeHeroRows = session.active_heroes ?? [];
  const pendingPrompt = session.pending_prompt ?? null;
  const trainerPromptKind = pendingPrompt?.kind ?? "";
  const trainerGlyphPickOpen =
    trainerPromptKind === "trainer_second_glyph" || trainerPromptKind === "trainer_level_glyph_pick";
  const trainerStatOpen = trainerPromptKind === "trainer_stat_spend";
  const activeUsersPanel = (
    <Box
      position="relative"
      flexShrink={0}
      w="100%"
      minW={0}
      borderWidth="1px"
      borderColor={HUD_PANEL_BORDER}
      borderRadius="md"
      p={2}
      bg={HUD_PANEL_BG}
      fontSize="xs"
      display="flex"
      flexDirection="column"
      overflowY="auto"
      maxH={{ base: "min(300px, 42vh)", lg: "min(460px, 48vh)" }}
    >
      <Text fontWeight="semibold" color={HUD_PANEL_TEXT} mb={1}>
        Active Users
      </Text>
      {activeHeroRows.length === 0 ? (
        <Text color={HUD_PANEL_TEXT_MUTED}>No active users.</Text>
      ) : (
        <Stack gap={1}>
          {activeHeroRows.map((h) => (
            <Flex key={h.name} justify="space-between" align="start" gap={2} w="100%">
              <Text color={HUD_PANEL_TEXT} minW={0} lineHeight="short">
                {h.name} L{h.level} {h.class_name}
              </Text>
              <Text
                color={HUD_PANEL_TEXT}
                textAlign="right"
                flexShrink={0}
                maxW="50%"
                lineHeight="short"
              >
                {h.area_name}
              </Text>
            </Flex>
          ))}
        </Stack>
      )}
      <Text mt={2} color={HUD_PANEL_TEXT_MUTED} fontSize="2xs">
        <strong>map</strong> to return.
      </Text>
    </Box>
  );

  const trainerGlyphPanel = trainerGlyphPickOpen ? (
    <Box
      borderWidth="1px"
      borderColor={HUD_PANEL_BORDER}
      borderRadius="md"
      p={2}
      bg={HUD_PANEL_BG}
      fontSize="xs"
      display="flex"
      flexDirection="column"
      gap={2}
    >
      <Text color={HUD_PANEL_TEXT} fontWeight="semibold">
        {trainerPromptKind === "trainer_second_glyph" ? "Choose your second glyph" : "Choose glyph to level"}
      </Text>
      <Flex gap={2} flexWrap="wrap">
        {(pendingPrompt?.options ?? []).map((glyph) => (
          <QffButton
            key={glyph}
            type="button"
            onClick={() => void runCommand(glyph)}
            disabled={commandPending}
            minW="54px"
          >
            {glyph}
          </QffButton>
        ))}
      </Flex>
      <Text color={HUD_PANEL_TEXT_MUTED} fontSize="2xs">
        Triggered from <strong>train</strong>.
      </Text>
    </Box>
  ) : null;

  const draft = pendingPrompt?.draft ?? {};
  const trainerStatPanel = trainerStatOpen ? (
    <Box
      borderWidth="1px"
      borderColor={HUD_PANEL_BORDER}
      borderRadius="md"
      p={2}
      bg={HUD_PANEL_BG}
      fontSize="xs"
      display="flex"
      flexDirection="column"
      gap={2}
    >
      <Text color={HUD_PANEL_TEXT} fontWeight="semibold">
        Spend Stat Points
      </Text>
      {(["gains", "moves", "guts", "smarts", "sense", "rizz"] as const).map((stat) => (
        <Flex key={stat} align="center" justify="space-between">
          <Text color={HUD_PANEL_TEXT}>{stat.toUpperCase()}</Text>
          <Flex gap={1} align="center">
            <QffButton type="button" size="xs" onClick={() => void runCommand(`- ${stat}`)} disabled={commandPending}>
              -
            </QffButton>
            <Text minW="18px" textAlign="center" color={HUD_PANEL_TEXT}>
              {Number(draft[stat] ?? 0)}
            </Text>
            <QffButton type="button" size="xs" onClick={() => void runCommand(`+ ${stat}`)} disabled={commandPending}>
              +
            </QffButton>
          </Flex>
        </Flex>
      ))}
      <Flex gap={2}>
        <QffButton type="button" onClick={() => void runCommand("commit")} disabled={commandPending}>
          Commit
        </QffButton>
        <QffButton type="button" onClick={() => void runCommand("cancel")} disabled={commandPending}>
          Cancel
        </QffButton>
      </Flex>
    </Box>
  ) : null;

  const characterPanel = (
    <Box
      flexShrink={0}
      minH={{ base: "100px", lg: "auto" }}
      borderWidth="1px"
      borderColor={HUD_PANEL_BORDER}
      borderRadius="md"
      p={2}
      bg={HUD_PANEL_BG}
      display="flex"
      flexDirection="column"
      fontSize="xs"
    >
      <Text flexShrink={0} textAlign="center" fontWeight="medium" lineHeight="short">
        <Text as="span" color={HUD_STAT_TOTAL} textTransform="uppercase">
          {session.character.name}
        </Text>
        <Text as="span" color={HUD_PANEL_TEXT_MUTED}>
          {"  |  "}
        </Text>
        <Text as="span" color={HUD_PANEL_TEXT}>
          Lv {cp.level} {session.character.class_name}
        </Text>
      </Text>
      <Text fontSize="xs" color={HUD_PANEL_TEXT_MUTED} textAlign="center" mt={1}>
        HP {cp.curHealth}/{cp.maxHealth} · MP {cp.curMana}/{cp.maxMana} · XP {cp.xp} · Gold{" "}
        {cp.gold ?? 0}
      </Text>
      {heroDead && (
        <Text fontSize="xs" color="#c08080" textAlign="center" mt={1} fontWeight="semibold">
          You are dead — you cannot take action until you revive.
        </Text>
      )}
      {cp.isInactive && !heroDead && (
        <Text fontSize="xs" color={HUD_PANEL_TEXT_MUTED} textAlign="center" mt={1}>
          You are inactive (no commands for 5+ minutes).
        </Text>
      )}
      <Grid templateColumns="1fr 1fr" gap={3} mt={2} w="100%" alignItems="start">
        <GridItem minW={0}>
          <Stack gap={0} flexShrink={0}>
            <QffHudLabeledValue label="Head:" value={eq.head} />
            <QffHudLabeledValue label="Main Hand:" value={eq.mainHand} />
            <QffHudLabeledValue label="Off-Hand:" value={eq.offHand} />
            <QffHudLabeledValue label="Chest:" value={eq.chest} />
            <QffHudLabeledValue label="Feet:" value={eq.feet} />
            <QffHudLabeledValue label="Ring:" value={eq.ring} />
            <QffHudLabeledValue label="Amulet:" value={eq.amulet} />
          </Stack>
        </GridItem>
        <GridItem minW={0}>
          <Stack gap={0} flexShrink={0}>
            <QffStatLine
              label="Gains"
              total={st.gains}
              base={stBase.gains}
              bonus={stBonus.gains}
            />
            <QffStatLine
              label="Moves"
              total={st.moves}
              base={stBase.moves}
              bonus={stBonus.moves}
            />
            <QffStatLine
              label="Guts"
              total={st.guts}
              base={stBase.guts}
              bonus={stBonus.guts}
            />
            <QffStatLine
              label="Smarts"
              total={st.smarts}
              base={stBase.smarts}
              bonus={stBonus.smarts}
            />
            <QffStatLine
              label="Sense"
              total={st.sense}
              base={stBase.sense}
              bonus={stBonus.sense}
            />
            <QffStatLine
              label="Rizz"
              total={st.rizz}
              base={stBase.rizz}
              bonus={stBonus.rizz}
            />
            <QffHudLabeledValue label="Armor:" value={String(cp.armorTotal ?? 0)} />
          </Stack>
        </GridItem>
      </Grid>
      <Box mt={3} w="100%">
        <QffHudLabeledValue label="Inventory:" value={invLabel} />
      </Box>
    </Box>
  );

  const logPanel = (
    <Box
      ref={logScrollRef}
      borderWidth="1px"
      borderColor={HUD_PANEL_BORDER}
      borderRadius="md"
      p={2}
      bg={HUD_PANEL_BG}
      minH="80px"
      maxH={{ base: "200px", lg: "min(220px, 28vh)" }}
      overflowY="auto"
      flexShrink={0}
      css={{
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      {logLines.map(({ id, text, recent, logTone }) => (
        <Text
          key={id}
          fontSize="sm"
          style={{ color: hudLogLineColor(recent, logTone) }}
        >
          {text}
        </Text>
      ))}
    </Box>
  );

  const commandRow = (
    <Flex gap={2} align="center" flexWrap="wrap" flexShrink={0}>
      <label
        htmlFor="qff-command-line"
        style={{
          flexShrink: 0,
          color: "#c0c0c0",
          fontSize: "0.875rem",
          cursor: "text",
        }}
      >
        Command:
      </label>
      <Input
        id="qff-command-line"
        ref={inputRef}
        flex={1}
        minW={{ base: "100px", md: "120px" }}
        maxW="100%"
        value={line}
        onChange={(e) => setLine(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          void runCommand(line);
        }}
        placeholder={session.pending_prompt ? "(y/n)" : undefined}
        bg="#1e1e1e"
        borderColor="#a0a0a0"
        color="#e0e0e0"
        _focusVisible={{
          borderColor: "#c0c0c0",
          boxShadow: "none",
        }}
        autoFocus
        disabled={heroDead}
        aria-busy={commandPending}
        aria-disabled={heroDead}
      />
      <QffButton type="button" onClick={() => void runCommand(line)} disabled={heroDead}>
        {commandPending ? "…" : "Send"}
      </QffButton>
    </Flex>
  );

  return (
    <Box
      {...QFF_PLAY_PAGE_CONTENT_PROPS}
      flex="1"
      minH="0"
      display="flex"
      flexDirection="column"
      overflow="hidden"
      py={4}
    >
      <Flex flexShrink={0} justify="space-between" align="center" mb={4} flexWrap="wrap" gap={2}>
        <Flex align="baseline" flexWrap="wrap" gap={1} minW={0}>
          <Heading size="md" color={heroDead ? "#888888" : t.primary}>
            {room.name}
            {heroDead ? " (dead)" : ""}
          </Heading>
          <Text as="span" fontSize="sm" color={t.secondary}>
            {"  |  "}
          </Text>
          <Text fontSize="sm" color={t.secondary}>
            {area.name}
          </Text>
        </Flex>
        <QffButton
          type="button"
          size="sm"
          onClick={handleLeaveClick}
          disabled={leavePending !== false}
        >
          {leavePending !== false ? `Leaving in ${leavePending.waitSeconds}s…` : "Lobby"}
        </QffButton>
      </Flex>

      <Box flex="1" minH={0} minW={0} overflowY="auto" overflowX="hidden" overscrollBehavior="contain">
        <Grid
          templateColumns={{
            base: "1fr",
            lg: "minmax(0, 1fr) minmax(360px, min(480px, 42vw))",
          }}
          templateRows={{
            base: "none",
            lg: "auto auto auto auto",
          }}
          gap={4}
          alignItems="start"
          w="100%"
          maxW="100%"
        >
          <Box gridColumn={{ base: "1", lg: "1" }} gridRow={{ base: "auto", lg: "1" }} minW={0}>
            <Stack gap={3}>
              <Text
                textAlign="left"
                whiteSpace="pre-wrap"
                lineHeight="tall"
                fontSize="sm"
                color={t.accent}
              >
                {roomDetailsVisible ? room.description : QFF_NARRATIVE_TOO_DARK}
              </Text>
              <Stack gap={1}>{exitsBlock}</Stack>
            </Stack>
          </Box>
          <Box
            display={{ base: "none", lg: "block" }}
            gridColumn="1"
            gridRow="2"
            minW={0}
            minH={0}
            aria-hidden
          />
          {!mapMinimal ||
          shopPanelOpen ||
          containerPanelOpen ||
          questPanelOpen ||
          activeUsersPanelOpen ||
          trainerGlyphPickOpen ||
          trainerStatOpen ? (
            <Box
              gridColumn={{ base: "1", lg: "2" }}
              gridRow={{ base: "auto", lg: "1 / span 2" }}
              minH={0}
              minW={0}
            >
              {trainerGlyphPickOpen && trainerGlyphPanel
                ? trainerGlyphPanel
                : trainerStatOpen && trainerStatPanel
                  ? trainerStatPanel
                  : shopPanelOpen
                ? shopPanel
                : containerPanelOpen && containerPanel
                  ? containerPanel
                  : questPanelOpen
                    ? questPanel
                    : activeUsersPanelOpen
                      ? activeUsersPanel
                      : mapPanel}
            </Box>
          ) : null}
          <Box
            gridColumn={{ base: "1", lg: "2" }}
            gridRow={{ base: "auto", lg: mapMinimal ? "1 / span 2" : "3 / span 2" }}
            w="100%"
            maxH={{ base: "min(300px, 42vh)", lg: "min(460px, 48vh)" }}
            minW={0}
            overflowY="auto"
          >
            {characterPanel}
          </Box>
          <Box gridColumn={{ base: "1", lg: "1" }} gridRow={{ base: "auto", lg: "3" }} minW={0}>
            {logPanel}
          </Box>
          <Box gridColumn={{ base: "1", lg: "1" }} gridRow={{ base: "auto", lg: "4" }} minW={0}>
            {commandRow}
          </Box>
        </Grid>
      </Box>
    </Box>
  );
}

/** Room cells in the minimap window (interleaved grid is 2n−1 slots per axis). */
const MAP_VIEWPORT_ROOMS = 7;
const MAP_SLOT_PX = "11px";

function exitDirectionsForCell(cell: QffAreaMapCell | undefined): Set<string> {
  const s = new Set<string>();
  if (!cell) return s;
  for (const ex of cell.exits) {
    s.add(ex.direction);
  }
  return s;
}

/** Single-area interleaved grid centered on the player: rooms on even indices; exit glyphs between. */
function QffMiniMapGrid({
  grid,
  currentRoomId,
}: {
  grid: QffSessionWithCharacter["area_map"]["grids"][0];
  currentRoomId: number;
}) {
  const {
    grid_width,
    grid_height,
    cells,
    is_dark_minimap = false,
    lit_room_ids = [],
    visited_room_ids = [],
    map_full_reveal_active = false,
  } = grid;
  if (!grid_width || !grid_height) return <Text color={HUD_PANEL_TEXT_MUTED}>—</Text>;

  const cur = cells.find((c) => c.room_id === currentRoomId);
  if (!cur) return <Text color={HUD_PANEL_TEXT_MUTED}>—</Text>;

  const cx = cur.x;
  const cy = cur.y;
  const half = Math.floor(MAP_VIEWPORT_ROOMS / 2);
  const litSet = new Set(lit_room_ids);
  const visitedSet = new Set(visited_room_ids);

  const byKey = new Map<string, QffAreaMapCell>();
  for (const c of cells) {
    byKey.set(`${c.x},${c.y}`, c);
  }

  const roomAtWorld = (wx: number, wy: number) => byKey.get(`${wx},${wy}`);

  const cellVisible = (cell: QffAreaMapCell | undefined): boolean => {
    if (!cell) return false;
    if (!is_dark_minimap) return true;
    if (cell.room_id === currentRoomId) return true;
    if (litSet.has(cell.room_id)) return true;
    if (map_full_reveal_active && visitedSet.has(cell.room_id)) return true;
    return false;
  };

  const isMapOnlyReveal = (roomId: number): boolean =>
    map_full_reveal_active &&
    visitedSet.has(roomId) &&
    !litSet.has(roomId) &&
    roomId !== currentRoomId;

  const exitsAtWorld = (wx: number, wy: number) =>
    exitDirectionsForCell(roomAtWorld(wx, wy));

  const showHorizontal = (leftWx: number, leftWy: number, rightWx: number, rightWy: number) => {
    const left = roomAtWorld(leftWx, leftWy);
    const right = roomAtWorld(rightWx, rightWy);
    const leftVis = left && cellVisible(left);
    const rightVis = right && cellVisible(right);
    const leftHere = leftWx === cx && leftWy === cy;
    const rightHere = rightWx === cx && rightWy === cy;
    if (!is_dark_minimap) {
      return exitsAtWorld(leftWx, leftWy).has("e") || exitsAtWorld(rightWx, rightWy).has("w");
    }
    if (leftHere && left && exitsAtWorld(leftWx, leftWy).has("e")) return true;
    if (rightHere && right && exitsAtWorld(rightWx, rightWy).has("w")) return true;
    if (leftVis && rightVis) {
      return exitsAtWorld(leftWx, leftWy).has("e") || exitsAtWorld(rightWx, rightWy).has("w");
    }
    return false;
  };

  const showVertical = (topWx: number, topWy: number, botWx: number, botWy: number) => {
    const top = roomAtWorld(topWx, topWy);
    const bot = roomAtWorld(botWx, botWy);
    const topVis = top && cellVisible(top);
    const botVis = bot && cellVisible(bot);
    const topHere = topWx === cx && topWy === cy;
    const botHere = botWx === cx && botWy === cy;
    if (!is_dark_minimap) {
      return exitsAtWorld(topWx, topWy).has("s") || exitsAtWorld(botWx, botWy).has("n");
    }
    if (topHere && top && exitsAtWorld(topWx, topWy).has("s")) return true;
    if (botHere && bot && exitsAtWorld(botWx, botWy).has("n")) return true;
    if (topVis && botVis) {
      return exitsAtWorld(topWx, topWy).has("s") || exitsAtWorld(botWx, botWy).has("n");
    }
    return false;
  };

  const showDiagBackslash = (
    tlWx: number,
    tlWy: number,
    brWx: number,
    brWy: number,
  ) => {
    const tl = roomAtWorld(tlWx, tlWy);
    const br = roomAtWorld(brWx, brWy);
    const tlVis = tl && cellVisible(tl);
    const brVis = br && cellVisible(br);
    const tlHere = tlWx === cx && tlWy === cy;
    const brHere = brWx === cx && brWy === cy;
    if (!is_dark_minimap) {
      return (
        exitsAtWorld(tlWx, tlWy).has("se") || exitsAtWorld(brWx, brWy).has("nw")
      );
    }
    if (tlHere && tl && exitsAtWorld(tlWx, tlWy).has("se")) return true;
    if (brHere && br && exitsAtWorld(brWx, brWy).has("nw")) return true;
    if (tlVis && brVis) {
      return (
        exitsAtWorld(tlWx, tlWy).has("se") || exitsAtWorld(brWx, brWy).has("nw")
      );
    }
    return false;
  };

  const showDiagSlash = (trWx: number, trWy: number, blWx: number, blWy: number) => {
    const tr = roomAtWorld(trWx, trWy);
    const bl = roomAtWorld(blWx, blWy);
    const trVis = tr && cellVisible(tr);
    const blVis = bl && cellVisible(bl);
    const trHere = trWx === cx && trWy === cy;
    const blHere = blWx === cx && blWy === cy;
    if (!is_dark_minimap) {
      return (
        exitsAtWorld(blWx, blWy).has("ne") || exitsAtWorld(trWx, trWy).has("sw")
      );
    }
    if (blHere && bl && exitsAtWorld(blWx, blWy).has("ne")) return true;
    if (trHere && tr && exitsAtWorld(trWx, trWy).has("sw")) return true;
    if (trVis && blVis) {
      return (
        exitsAtWorld(blWx, blWy).has("ne") || exitsAtWorld(trWx, trWy).has("sw")
      );
    }
    return false;
  };

  const slotStyle = {
    w: MAP_SLOT_PX,
    minW: MAP_SLOT_PX,
    h: MAP_SLOT_PX,
    minH: MAP_SLOT_PX,
    fontSize: "10px",
    lineHeight: `${MAP_SLOT_PX}`,
    textAlign: "center" as const,
    fontFamily: "ui-monospace, monospace",
    flexShrink: 0,
  };

  const rows: ReactNode[] = [];
  const rowsH = 2 * MAP_VIEWPORT_ROOMS - 1;
  const colsW = 2 * MAP_VIEWPORT_ROOMS - 1;

  for (let sy = 0; sy < rowsH; sy++) {
    const cols: ReactNode[] = [];
    for (let sx = 0; sx < colsW; sx++) {
      const key = `m-${sx}-${sy}`;

      if (sx % 2 === 0 && sy % 2 === 0) {
        const vx = sx / 2;
        const vy = sy / 2;
        const wx = cx + vx - half;
        const wy = cy + vy - half;
        if (wx < 0 || wx >= grid_width || wy < 0 || wy >= grid_height) {
          cols.push(
            <Box key={key} {...slotStyle} borderWidth={0} bg="#121212" aria-hidden />,
          );
          continue;
        }
        const cell = roomAtWorld(wx, wy);
        if (!cell || !cellVisible(cell)) {
          cols.push(
            <Box key={key} {...slotStyle} borderWidth={0} bg="#121212" aria-hidden />,
          );
          continue;
        }
        const isHere = cell.room_id === currentRoomId;
        const mapOnly = isMapOnlyReveal(cell.room_id);
        cols.push(
          <Box
            key={key}
            {...slotStyle}
            borderWidth="1px"
            borderColor={isHere ? "#c0c0c0" : mapOnly ? "#555555" : "#666666"}
            bg={isHere ? "#252525" : mapOnly ? "#181818" : "#1c1c1c"}
            color={isHere ? HUD_PANEL_TEXT : mapOnly ? "#6a6a6a" : HUD_PANEL_TEXT_MUTED}
            title={cell.room_name}
          >
            {isHere ? "◆" : mapOnly ? "▫" : "▢"}
          </Box>,
        );
        continue;
      }

      if (sx % 2 === 1 && sy % 2 === 0) {
        const vx = (sx - 1) / 2;
        const vy = sy / 2;
        const leftWx = cx + vx - half;
        const leftWy = cy + vy - half;
        const rightWx = leftWx + 1;
        const rightWy = leftWy;
        const ch = showHorizontal(leftWx, leftWy, rightWx, rightWy) ? "-" : "";
        cols.push(
          <Box key={key} {...slotStyle} color="#888888">
            {ch}
          </Box>,
        );
        continue;
      }

      if (sx % 2 === 0 && sy % 2 === 1) {
        const vx = sx / 2;
        const vy = (sy - 1) / 2;
        const topWx = cx + vx - half;
        const topWy = cy + vy - half;
        const botWx = topWx;
        const botWy = topWy + 1;
        const ch = showVertical(topWx, topWy, botWx, botWy) ? "|" : "";
        cols.push(
          <Box key={key} {...slotStyle} color="#888888">
            {ch}
          </Box>,
        );
        continue;
      }

      const vx = (sx - 1) / 2;
      const vy = (sy - 1) / 2;
      const wx0 = cx + vx - half;
      const wy0 = cy + vy - half;
      const se = showDiagBackslash(wx0, wy0, wx0 + 1, wy0 + 1);
      const ne = showDiagSlash(wx0 + 1, wy0, wx0, wy0 + 1);
      let ch = "";
      if (se) ch = "\\";
      else if (ne) ch = "/";
      cols.push(
        <Box key={key} {...slotStyle} color="#888888">
          {ch}
        </Box>,
      );
    }
    rows.push(
      <Flex key={`row-${sy}`} gap={0} align="stretch">
        {cols}
      </Flex>,
    );
  }

  return (
    <Box as="span" display="inline-block" verticalAlign="top">
      <Stack gap={0}>{rows}</Stack>
    </Box>
  );
}

/** Minimap for the current area only; session may still carry other areas’ grids for visit state. */
function QffMiniMap({
  areaMap,
  currentRoomId,
}: {
  areaMap: QffSessionWithCharacter["area_map"];
  currentRoomId: number;
}) {
  const { grids, current_area_id } = areaMap;
  if (!grids?.length) return <Text color={HUD_PANEL_TEXT_MUTED}>—</Text>;

  const g = grids.find((grid) => grid.area_id === current_area_id);
  if (!g) return <Text color={HUD_PANEL_TEXT_MUTED}>—</Text>;

  return (
    <Flex w="100%" justify="center" align="center">
      <QffMiniMapGrid grid={g} currentRoomId={currentRoomId} />
    </Flex>
  );
}
