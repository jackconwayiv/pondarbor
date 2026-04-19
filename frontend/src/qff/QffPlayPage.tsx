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
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import QffButton from "./QffButton";
import {
  fetchQffSession,
  qffSessionWsUrl,
  sendQffCommand,
  type QffAreaMapCell,
  type QffCommandResponse,
  type QffSessionWithCharacter,
} from "./api";

/** WebSocket keepalive; server may broadcast room session updates without changing activity. */
const WS_PING_MS = 30_000;
const WS_RECONNECT_BASE_MS = 2000;

/** Charcoal + light gray (same family as action log). */
const HUD_PANEL_BG = "#141414";
const HUD_PANEL_BORDER = "#404040";
const HUD_PANEL_TEXT = "#c8c8c8";
const HUD_PANEL_TEXT_MUTED = "#909090";
/** Most recent command + response in the log */
const HUD_LOG_RECENT = "#f5f5f5";
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
  const [initialSessionLoadDone, setInitialSessionLoadDone] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [line, setLine] = useState("");
  const [logLines, setLogLines] = useState<Array<{ id: number; text: string; recent: boolean }>>([]);
  const [mapVisible, setMapVisible] = useState(true);
  const logLineIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const logScrollRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const token = await getTokenRef.current();
    const s = await fetchQffSession(token);
    commandTokenRef.current = token;
    if (!s.has_character) {
      setSession(null);
      return;
    }
    setSession(s);
  }, []);

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
        attempt = 0;
        if (pingId != null) window.clearInterval(pingId);
        pingId = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, WS_PING_MS);
      };
      socket.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as { type?: string; session?: QffSessionWithCharacter };
          if (data.type === "session" && data.session?.has_character) {
            setSession(data.session);
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
    logScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [logLines]);

  /** Room broadcasts from other players (session poll consumes server queue). */
  useEffect(() => {
    const lines = session?.action_log;
    if (!lines?.length) return;
    setLogLines((prev) => {
      const nextId = () => logLineIdRef.current++;
      const block = lines.map((text) => ({ id: nextId(), text, recent: true }));
      return [...block, ...prev.map((p) => ({ ...p, recent: false }))];
    });
  }, [session]);

  const submit = useCallback(async () => {
    const raw = line.trim();
    if (!raw) return;
    setLine("");
    setLogLines((prev) => {
      const nextId = () => logLineIdRef.current++;
      return [
        { id: nextId(), text: `> ${raw}`, recent: true },
        ...prev.map((p) => ({ ...p, recent: false })),
      ];
    });
    try {
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
      setSession(res.session);
      setLogLines((prev) => {
        const nextId = () => logLineIdRef.current++;
        const rest = prev[0]?.text === `> ${raw}` ? prev.slice(1) : prev;
        const block = [`> ${raw}`, ...res.messages].map((text) => ({
          id: nextId(),
          text,
          recent: true,
        }));
        return [...block, ...rest.map((p) => ({ ...p, recent: false }))];
      });
    } catch (e) {
      setLogLines((prev) => {
        const nextId = () => logLineIdRef.current++;
        const rest = prev[0]?.text === `> ${raw}` ? prev.slice(1) : prev;
        const block = [
          { id: nextId(), text: `> ${raw}`, recent: true },
          {
            id: nextId(),
            text: e instanceof Error ? e.message : "Error.",
            recent: true,
          },
        ];
        return [...block, ...rest.map((p) => ({ ...p, recent: false }))];
      });
    }
  }, [line]);

  if (!isAuthenticated) {
    return (
      <Box px={4} py={8}>
        <Text>Sign in to play.</Text>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box px={4} py={8}>
        <Text>Loading…</Text>
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
      <Box px={4} py={8}>
        <Text>Loading…</Text>
      </Box>
    );
  }

  if (!session) {
    return <Navigate to="/qff/create" replace />;
  }

  const { room, area, exits, others_here, area_map } = session;
  const t = area.theme;
  const cp = session.character_profile;
  const eq = cp.equipment_slots;
  const st = cp.stats.modified;
  const stBase = cp.stats.base;
  const stBonus = cp.stats.bonusSum;
  const invLabel =
    cp.inventoryItems.length > 0 ? cp.inventoryItems.join(", ") : "—";

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
                .map((e) => (e.is_blocked ? `${e.label} (blocked)` : e.label))
                .join(", ")}
        </Text>
      </Text>
      {(others_here.length > 0 || (room.npcs?.length ?? 0) > 0) && (
        <Text fontSize="sm">
          <Text as="span" color={t.secondary}>
            Also here:{" "}
          </Text>
          {others_here.map((name, i) => (
            <Text as="span" key={`oh-p-${i}`} fontWeight="bold" color={t.accent}>
              {name}
              {i < others_here.length - 1 || (room.npcs?.length ?? 0) > 0 ? ", " : ""}
            </Text>
          ))}
          {room.npcs?.map((n, i) => (
            <Text as="span" key={n.slug} color={t.accent}>
              {n.name}
              {i < (room.npcs!.length - 1) ? ", " : ""}
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
        <QffMiniMap areaMap={area_map} currentRoomId={room.id} />
      </Flex>
    </Box>
  );

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
      {logLines.map(({ id, text, recent }) => (
        <Text key={id} fontSize="sm" color={recent ? HUD_LOG_RECENT : HUD_PANEL_TEXT}>
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
          if (e.key === "Enter") submit();
        }}
        bg="#1e1e1e"
        borderColor="#a0a0a0"
        color="#e0e0e0"
        _focusVisible={{
          borderColor: "#c0c0c0",
          boxShadow: "none",
        }}
        autoFocus
      />
      <QffButton type="button" onClick={submit}>
        Send
      </QffButton>
    </Flex>
  );

  return (
    <Box
      flex="1"
      minH="0"
      display="flex"
      flexDirection="column"
      w="100%"
      maxW="1200px"
      overflow="hidden"
      px={{ base: 2, md: 4 }}
      py={4}
      mx="auto"
    >
      <Flex flexShrink={0} justify="space-between" align="center" mb={4} flexWrap="wrap" gap={2}>
        <Flex align="baseline" flexWrap="wrap" gap={1} minW={0}>
          <Heading size="md" color={t.primary}>
            {room.name}
          </Heading>
          <Text as="span" fontSize="sm" color={t.secondary}>
            {"  |  "}
          </Text>
          <Text fontSize="sm" color={t.secondary}>
            {area.name}
          </Text>
        </Flex>
        <QffButton type="button" size="sm" onClick={() => navigate("/qff")}>
          Lobby
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
                {room.description}
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
          <Box
            gridColumn={{ base: "1", lg: "2" }}
            gridRow={{ base: "auto", lg: "1 / span 2" }}
            minH={0}
            minW={0}
          >
            {mapPanel}
          </Box>
          <Box
            gridColumn={{ base: "1", lg: "2" }}
            gridRow={{ base: "auto", lg: "3 / span 2" }}
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

const MAP_MAX_DIM = 15;
const MAP_SLOT_PX = "11px";

function exitDirectionsForCell(cell: QffAreaMapCell | undefined): Set<string> {
  const s = new Set<string>();
  if (!cell) return s;
  for (const ex of cell.exits) {
    s.add(ex.direction);
  }
  return s;
}

/** Single-area interleaved grid: rooms on even indices; `-` / `|` / `/` / `\` for seen exits. */
function QffMiniMapGrid({
  grid,
  currentRoomId,
}: {
  grid: QffSessionWithCharacter["area_map"]["grids"][0];
  currentRoomId: number;
}) {
  const { grid_width, grid_height, cells } = grid;
  if (!grid_width || !grid_height) return <Text color={HUD_PANEL_TEXT_MUTED}>—</Text>;

  const w = Math.min(grid_width, MAP_MAX_DIM);
  const h = Math.min(grid_height, MAP_MAX_DIM);
  const byKey = new Map<string, QffAreaMapCell>();
  for (const c of cells) {
    if (c.x < w && c.y < h) byKey.set(`${c.x},${c.y}`, c);
  }

  const roomAt = (x: number, y: number) => byKey.get(`${x},${y}`);
  const exitsAt = (x: number, y: number) => exitDirectionsForCell(roomAt(x, y));

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
  const rowsH = 2 * h - 1;

  for (let sy = 0; sy < rowsH; sy++) {
    const cols: ReactNode[] = [];
    for (let sx = 0; sx < 2 * w - 1; sx++) {
      const key = `m-${sx}-${sy}`;

      if (sx % 2 === 0 && sy % 2 === 0) {
        const x = sx / 2;
        const y = sy / 2;
        const cell = roomAt(x, y);
        if (!cell) {
          cols.push(
            <Box
              key={key}
              {...slotStyle}
              borderWidth={0}
              bg="#121212"
              aria-hidden
            />,
          );
          continue;
        }
        const isHere = cell.room_id === currentRoomId;
        cols.push(
          <Box
            key={key}
            {...slotStyle}
            borderWidth="1px"
            borderColor={isHere ? "#c0c0c0" : "#666666"}
            bg={isHere ? "#252525" : "#1c1c1c"}
            color={isHere ? HUD_PANEL_TEXT : HUD_PANEL_TEXT_MUTED}
            title={cell.room_name}
          >
            {isHere ? "◆" : "▢"}
          </Box>,
        );
        continue;
      }

      if (sx % 2 === 1 && sy % 2 === 0) {
        const x = (sx - 1) / 2;
        const y = sy / 2;
        const left = exitsAt(x, y).has("e");
        const right = exitsAt(x + 1, y).has("w");
        const ch = left || right ? "-" : "";
        cols.push(
          <Box key={key} {...slotStyle} color="#888888">
            {ch}
          </Box>,
        );
        continue;
      }

      if (sx % 2 === 0 && sy % 2 === 1) {
        const x = sx / 2;
        const y = (sy - 1) / 2;
        const top = exitsAt(x, y).has("s");
        const bottom = exitsAt(x, y + 1).has("n");
        const ch = top || bottom ? "|" : "";
        cols.push(
          <Box key={key} {...slotStyle} color="#888888">
            {ch}
          </Box>,
        );
        continue;
      }

      const x = (sx - 1) / 2;
      const y = (sy - 1) / 2;
      const se = exitsAt(x, y).has("se");
      const nw = exitsAt(x + 1, y + 1).has("nw");
      const ne = exitsAt(x, y + 1).has("ne");
      const sw = exitsAt(x + 1, y).has("sw");
      let ch = "";
      if (se || nw) ch = "\\";
      else if (ne || sw) ch = "/";
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
