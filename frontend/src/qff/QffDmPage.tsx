import {
  Box,
  Button,
  Field,
  Flex,
  Grid,
  Heading,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import QffButton from "./QffButton";
import { qffGridCellButtonProps } from "./qffUi";
import {
  dmCreateArea,
  dmCreateExit,
  dmCreateRoom,
  dmCreateRoomRoomItem,
  dmDeleteExit,
  dmDeleteRoom,
  dmDeleteRoomItem,
  dmPatchRoomItem,
  dmDownloadAreaRoomsJson,
  dmFetchAreaExits,
  dmFetchAreas,
  dmFetchCells,
  dmFetchExits,
  dmFetchItems,
  dmFetchQuestDetail,
  dmFetchQuests,
  dmFetchRoomRoomItems,
  dmFetchRooms,
  dmPatchArea,
  dmPatchExit,
  dmPatchRoom,
  dmPlaceRoomInCell,
  dmPostAreaRoomsImportJson,
  type DmArea,
  type DmAreaExit,
  type DmAreaRoomsJson,
  type DmExit,
  type DmItem,
  type DmRoomItem,
  type DmQuestDetail,
  type DmQuestSummary,
  type DmRoom,
} from "./api";

const DIRECTIONS = [
  "n",
  "s",
  "e",
  "w",
  "nw",
  "ne",
  "sw",
  "se",
  "up",
  "down",
  "in",
  "out",
] as const;

const DM_DRAG_TYPE = "application/x-qff-room-id";

/** Solid green primary actions on dark DM chrome (lilypad = site green). */
const DM_PRIMARY_BTN = { colorPalette: "lilypad" as const };

/** Player UI theme: one locked shade per hue (DM picks from these only). */
const AREA_THEME_HUES = [
  { key: "red", label: "Red", hex: "#c06060" },
  { key: "orange", label: "Orange", hex: "#d08045" },
  { key: "yellow", label: "Yellow", hex: "#d8c060" },
  { key: "green", label: "Green", hex: "#58a070" },
  { key: "blue", label: "Blue", hex: "#4a8fd0" },
  { key: "purple", label: "Purple", hex: "#8870c8" },
  { key: "brown", label: "Brown", hex: "#a07850" },
  { key: "gray", label: "Gray", hex: "#909498" },
  { key: "pink", label: "Pink", hex: "#d090b0" },
] as const;

const DEFAULT_NEW_AREA_THEME: { primary: string; secondary: string; accent: string } = {
  primary: AREA_THEME_HUES.find((h) => h.key === "brown")!.hex,
  secondary: AREA_THEME_HUES.find((h) => h.key === "gray")!.hex,
  accent: AREA_THEME_HUES.find((h) => h.key === "yellow")!.hex,
};

function parseHexRgb(s: string): [number, number, number] | null {
  const t = s.trim();
  if (!t.startsWith("#")) return null;
  let h = t.slice(1);
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function normalizeHex6(s: string): string {
  const rgb = parseHexRgb(s);
  if (!rgb) return "#000000";
  return `#${rgb.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** Map any stored hex to the closest preset (legacy data / API). */
function snapHexToAreaHuePreset(hex: string): string {
  const rgb = parseHexRgb(hex);
  if (!rgb) return AREA_THEME_HUES[6].hex;
  let bestHex: string = AREA_THEME_HUES[0].hex;
  let bestD = Infinity;
  for (const { hex: presetHex } of AREA_THEME_HUES) {
    const p = parseHexRgb(presetHex)!;
    const d =
      (rgb[0] - p[0]) ** 2 + (rgb[1] - p[1]) ** 2 + (rgb[2] - p[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      bestHex = presetHex;
    }
  }
  return bestHex;
}

function DmAreaThemeHueRow({
  rowLabel,
  value,
  onChange,
}: {
  rowLabel: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const current = normalizeHex6(snapHexToAreaHuePreset(value));
  return (
    <Box>
      <Text fontSize="xs" color="#888" mb={1}>
        {rowLabel}
      </Text>
      <Flex gap={1.5} flexWrap="wrap" align="center">
        {AREA_THEME_HUES.map(({ key, label, hex }) => {
          const selected = normalizeHex6(hex) === current;
          return (
            <button
              key={key}
              type="button"
              title={label}
              aria-label={`${rowLabel}: ${label}`}
              style={{
                width: "28px",
                height: "28px",
                minWidth: "28px",
                padding: 0,
                borderRadius: "6px",
                backgroundColor: hex,
                cursor: "pointer",
                border: selected
                  ? "2px solid #e8e8e8"
                  : "2px solid rgba(255,255,255,0.12)",
                boxShadow: selected ? "0 0 0 1px rgba(255,255,255,0.5)" : undefined,
                lineHeight: 0,
              }}
              onClick={() => onChange(hex)}
            />
          );
        })}
      </Flex>
    </Box>
  );
}

/** Grid offsets for n/s/e/w and diagonals (same-area adjacency). */
const SPATIAL_EXIT_OFFSETS: Record<string, [number, number]> = {
  n: [0, -1],
  s: [0, 1],
  e: [1, 0],
  w: [-1, 0],
  nw: [-1, -1],
  ne: [1, -1],
  sw: [-1, 1],
  se: [1, 1],
};

function slugifyInput(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export default function QffDmPage() {
  const navigate = useNavigate();
  const { isAuthenticated, sessionUser, isLoading, getApiAccessToken } = useAppSession();
  const getTokenRef = useRef(getApiAccessToken);
  getTokenRef.current = getApiAccessToken;
  const isStaff = !!sessionUser?.user?.is_staff;
  const [areas, setAreas] = useState<DmArea[]>([]);
  const [areaId, setAreaId] = useState<number | null>(null);
  const [cells, setCells] = useState<
    Array<{ id: number; x: number; y: number; room_id: number; room_name: string }>
  >([]);
  const [rooms, setRooms] = useState<DmRoom[]>([]);
  /** All rooms in all areas — for exit destination picker (cross-area). */
  const [exitDestRooms, setExitDestRooms] = useState<
    Array<{ id: number; name: string; areaId: number; areaName: string }>
  >([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [exits, setExits] = useState<DmExit[]>([]);
  const [roomItems, setRoomItems] = useState<DmRoomItem[]>([]);
  const [itemTemplates, setItemTemplates] = useState<DmItem[]>([]);
  const [dmQuests, setDmQuests] = useState<DmQuestSummary[]>([]);
  const [questDetailById, setQuestDetailById] = useState<Map<number, DmQuestDetail>>(
    () => new Map(),
  );
  const revealQuestFetchedRef = useRef<Set<number>>(new Set());
  const [newRoomItemId, setNewRoomItemId] = useState<string>("");
  const [newRoomNickname, setNewRoomNickname] = useState<string>("");
  const [newRoomVisibleQuestId, setNewRoomVisibleQuestId] = useState<string>("");
  const [newRoomVisibleStateId, setNewRoomVisibleStateId] = useState<string>("");
  /** Exits from every room in the selected area — drives map edge markers. */
  const [areaExits, setAreaExits] = useState<DmAreaExit[]>([]);
  const [panelName, setPanelName] = useState("");
  const [panelDesc, setPanelDesc] = useState("");
  const [panelSearch, setPanelSearch] = useState("");
  const [panelSearchChance, setPanelSearchChance] = useState("50");
  const [newExitDir, setNewExitDir] = useState<string>("n");
  const [newExitTo, setNewExitTo] = useState<number | null>(null);
  /** Area chosen in exit destination picker (room list is filtered to this area). */
  const [exitDestAreaId, setExitDestAreaId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [areaName, setAreaName] = useState("");
  const [areaGridW, setAreaGridW] = useState(3);
  const [areaGridH, setAreaGridH] = useState(3);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaDesc, setNewAreaDesc] = useState("");
  const [newAreaW, setNewAreaW] = useState(15);
  const [newAreaH, setNewAreaH] = useState(15);
  const [newAreaThemePrimary, setNewAreaThemePrimary] = useState(
    DEFAULT_NEW_AREA_THEME.primary,
  );
  const [newAreaThemeSecondary, setNewAreaThemeSecondary] = useState(
    DEFAULT_NEW_AREA_THEME.secondary,
  );
  const [newAreaThemeAccent, setNewAreaThemeAccent] = useState(
    DEFAULT_NEW_AREA_THEME.accent,
  );
  const [areaDescription, setAreaDescription] = useState("");
  const [showAreaDescEditor, setShowAreaDescEditor] = useState(false);
  const [areaThemePrimary, setAreaThemePrimary] = useState("");
  const [areaThemeSecondary, setAreaThemeSecondary] = useState("");
  const [areaThemeAccent, setAreaThemeAccent] = useState("");
  const [panelCellX, setPanelCellX] = useState("0");
  const [panelCellY, setPanelCellY] = useState("0");
  const dmMapColumnRef = useRef<HTMLDivElement | null>(null);
  const dmRoomPanelRef = useRef<HTMLDivElement | null>(null);
  const roomsImportInputRef = useRef<HTMLInputElement | null>(null);

  const area = areas.find((a) => a.id === areaId) ?? null;

  const roomsInExitDestArea = useMemo(
    () =>
      exitDestRooms.filter(
        (r) => r.areaId === exitDestAreaId && r.id !== selectedRoomId,
      ),
    [exitDestRooms, exitDestAreaId, selectedRoomId],
  );

  const newRoomQuestDetailForAdd = useMemo(() => {
    const qid = parseInt(newRoomVisibleQuestId, 10);
    if (!Number.isFinite(qid)) return undefined;
    return questDetailById.get(qid);
  }, [newRoomVisibleQuestId, questDetailById]);

  useEffect(() => {
    if (area) {
      setAreaName(area.name);
      setAreaDescription(area.description ?? "");
      setAreaGridW(area.grid_width);
      setAreaGridH(area.grid_height);
      setAreaThemePrimary(
        snapHexToAreaHuePreset(area.theme_primary || area.theme.primary),
      );
      setAreaThemeSecondary(
        snapHexToAreaHuePreset(area.theme_secondary || area.theme.secondary),
      );
      setAreaThemeAccent(
        snapHexToAreaHuePreset(area.theme_accent || area.theme.accent),
      );
      setShowAreaDescEditor(false);
    }
  }, [area]);

  const refreshAreas = useCallback(async () => {
    if (!isStaff) return;
    const token = await getTokenRef.current();
    const list = await dmFetchAreas(token);
    setAreas(list);
  }, [isStaff]);

  useEffect(() => {
    if (!isStaff) return;
    refreshAreas().catch((e) => setErr(String(e)));
  }, [isStaff, refreshAreas]);

  useEffect(() => {
    if (areaId == null && areas.length > 0) {
      setAreaId(areas[0].id);
    }
  }, [areas, areaId]);

  const refreshExitDestRooms = useCallback(async () => {
    if (!isStaff || areas.length === 0) {
      setExitDestRooms([]);
      return;
    }
    const token = await getTokenRef.current();
    const chunks = await Promise.all(
      areas.map(async (a) => {
        const rs = await dmFetchRooms(token, a.id);
        return rs.map((r) => ({
          id: r.id,
          name: r.name,
          areaId: a.id,
          areaName: a.name,
        }));
      }),
    );
    setExitDestRooms(
      chunks.flat().sort((a, b) => {
        const byArea = a.areaName.localeCompare(b.areaName);
        return byArea !== 0 ? byArea : a.name.localeCompare(b.name);
      }),
    );
  }, [isStaff, areas]);

  useEffect(() => {
    if (!isStaff || areas.length === 0) return;
    refreshExitDestRooms().catch((e) => setErr(String(e)));
  }, [isStaff, areas, refreshExitDestRooms]);

  const loadCellsAndRooms = useCallback(async () => {
    if (!areaId || !isStaff) return;
    const token = await getTokenRef.current();
    const [c, r, ax] = await Promise.all([
      dmFetchCells(token, areaId),
      dmFetchRooms(token, areaId),
      dmFetchAreaExits(token, areaId),
    ]);
    setCells(c);
    setRooms(r);
    setAreaExits(ax);
    await refreshExitDestRooms();
  }, [areaId, isStaff, refreshExitDestRooms]);

  const handleDownloadRoomsJson = useCallback(async () => {
    if (!areaId) return;
    setErr(null);
    try {
      const token = await getTokenRef.current();
      await dmDownloadAreaRoomsJson(token, areaId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Download failed");
    }
  }, [areaId]);

  const handleRoomsImportFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !areaId) return;
      setErr(null);
      try {
        const text = await file.text();
        const payload = JSON.parse(text) as DmAreaRoomsJson;
        const token = await getTokenRef.current();
        await dmPostAreaRoomsImportJson(token, areaId, payload);
        await loadCellsAndRooms();
        if (selectedRoomId != null) {
          const ex = await dmFetchExits(token, selectedRoomId);
          setExits(ex);
        }
      } catch (err) {
        setErr(err instanceof Error ? err.message : "Import failed");
      }
    },
    [areaId, loadCellsAndRooms, selectedRoomId],
  );

  useEffect(() => {
    if (!areaId || !isStaff) return;
    let cancelled = false;
    loadCellsAndRooms()
      .catch((e) => {
        if (!cancelled) setErr(String(e));
      })
      .then(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [areaId, isStaff, loadCellsAndRooms]);

  useEffect(() => {
    if (!isStaff || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      const token = await getTokenRef.current();
      const rows = await dmFetchItems(token);
      if (!cancelled) setItemTemplates(rows);
    })().catch((e) => setErr(String(e)));
    return () => {
      cancelled = true;
    };
  }, [isStaff, isAuthenticated]);

  useEffect(() => {
    if (!isStaff || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      const token = await getTokenRef.current();
      const list = await dmFetchQuests(token);
      if (!cancelled) setDmQuests(list);
    })().catch((e) => setErr(String(e)));
    return () => {
      cancelled = true;
    };
  }, [isStaff, isAuthenticated]);

  useEffect(() => {
    if (exits.length === 0 && roomItems.length === 0) return;
    let cancelled = false;
    (async () => {
      const token = await getTokenRef.current();
      const questIds = new Set<number>();
      for (const ex of exits) {
        if (ex.reveal_quest_id != null) questIds.add(ex.reveal_quest_id);
      }
      for (const ri of roomItems) {
        if (ri.visible_quest_id != null) questIds.add(ri.visible_quest_id);
      }
      for (const qid of questIds) {
        if (revealQuestFetchedRef.current.has(qid)) continue;
        revealQuestFetchedRef.current.add(qid);
        try {
          const d = await dmFetchQuestDetail(token, qid);
          if (!cancelled) {
            setQuestDetailById((prev) => new Map(prev).set(qid, d));
          }
        } catch {
          revealQuestFetchedRef.current.delete(qid);
        }
      }
    })().catch((e) => setErr(String(e)));
    return () => {
      cancelled = true;
    };
  }, [exits, roomItems]);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) ?? null;

  useEffect(() => {
    if (!selectedRoom) {
      setPanelName("");
      setPanelDesc("");
      setPanelSearch("");
      setPanelSearchChance("50");
      setExits([]);
      setRoomItems([]);
      return;
    }
    setPanelName(selectedRoom.name);
    setPanelDesc(selectedRoom.description);
    setPanelSearch(selectedRoom.search_text);
    setPanelSearchChance(String(selectedRoom.search_chance ?? 50));
    let cancelled = false;
    (async () => {
      const token = await getTokenRef.current();
      const [ex, roomSlots] = await Promise.all([
        dmFetchExits(token, selectedRoom.id),
        dmFetchRoomRoomItems(token, selectedRoom.id),
      ]);
      if (!cancelled) {
        setExits(ex);
        setRoomItems(roomSlots);
      }
    })().catch((e) => setErr(String(e)));
    return () => {
      cancelled = true;
    };
  }, [selectedRoom]);

  useEffect(() => {
    if (selectedRoomId != null && areaId != null) {
      setExitDestAreaId(areaId);
      setNewExitTo(null);
    }
  }, [selectedRoomId, areaId]);

  useEffect(() => {
    if (selectedRoomId == null || areaId == null) return;
    const SEM = new Set(["up", "down", "in", "out"]);
    if (SEM.has(newExitDir)) return;
    const d = SPATIAL_EXIT_OFFSETS[newExitDir];
    if (!d) return;
    const cell = selectedRoom?.cell;
    if (!cell) return;
    const nx = cell.x + d[0];
    const ny = cell.y + d[1];
    const hit = cells.find((c) => c.x === nx && c.y === ny);
    if (hit && hit.room_id !== selectedRoomId) {
      setExitDestAreaId(areaId);
      setNewExitTo(hit.room_id);
    }
  }, [selectedRoomId, newExitDir, selectedRoom, cells, areaId]);

  useEffect(() => {
    if (!selectedRoom) return;
    if (selectedRoom.cell) {
      setPanelCellX(String(selectedRoom.cell.x));
      setPanelCellY(String(selectedRoom.cell.y));
    } else {
      setPanelCellX("0");
      setPanelCellY("0");
    }
  }, [selectedRoom]);

  useEffect(() => {
    if (selectedRoomId == null) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (dmRoomPanelRef.current?.contains(t)) return;
      if (dmMapColumnRef.current?.contains(t)) return;
      setSelectedRoomId(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [selectedRoomId]);

  const saveRoom = useCallback(async () => {
    if (!selectedRoomId) return;
    setErr(null);
    try {
      const token = await getTokenRef.current();
      let sc = parseInt(panelSearchChance, 10);
      if (Number.isNaN(sc)) sc = 50;
      sc = Math.max(1, Math.min(100, sc));
      await dmPatchRoom(token, selectedRoomId, {
        name: panelName,
        description: panelDesc,
        search_text: panelSearch,
        search_chance: sc,
      });
      if (areaId) {
        const r = await dmFetchRooms(await getTokenRef.current(), areaId);
        setRooms(r);
      }
      await refreshExitDestRooms();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
  }, [selectedRoomId, panelName, panelDesc, panelSearch, panelSearchChance, areaId, refreshExitDestRooms]);

  const addExit = useCallback(async () => {
    if (!selectedRoomId || newExitTo == null) return;
    setErr(null);
    try {
      const token = await getTokenRef.current();
      await dmCreateExit(token, selectedRoomId, {
        direction: newExitDir,
        to_room_id: newExitTo,
      });
      const ex = await dmFetchExits(token, selectedRoomId);
      setExits(ex);
      if (areaId) {
        setAreaExits(await dmFetchAreaExits(token, areaId));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Exit create failed");
    }
  }, [selectedRoomId, newExitDir, newExitTo, areaId]);

  const handleCreateArea = useCallback(async () => {
    setErr(null);
    const name = newAreaName.trim();
    if (!name) {
      setErr("Area name is required.");
      return;
    }
    const slug = slugifyInput(name);
    if (!slug) {
      setErr("Use a name with letters or numbers so a URL-safe ID can be generated.");
      return;
    }
    try {
      const token = await getTokenRef.current();
      const a = await dmCreateArea(token, {
        name,
        slug,
        description: newAreaDesc.trim() || undefined,
        grid_width: Math.min(15, Math.max(1, newAreaW)),
        grid_height: Math.min(15, Math.max(1, newAreaH)),
        theme_primary: newAreaThemePrimary,
        theme_secondary: newAreaThemeSecondary,
        theme_accent: newAreaThemeAccent,
      });
      await refreshAreas();
      setAreaId(a.id);
      setSelectedRoomId(null);
      setNewAreaName("");
      setNewAreaDesc("");
      setNewAreaThemePrimary(DEFAULT_NEW_AREA_THEME.primary);
      setNewAreaThemeSecondary(DEFAULT_NEW_AREA_THEME.secondary);
      setNewAreaThemeAccent(DEFAULT_NEW_AREA_THEME.accent);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Create area failed");
    }
  }, [
    newAreaName,
    newAreaDesc,
    newAreaW,
    newAreaH,
    newAreaThemePrimary,
    newAreaThemeSecondary,
    newAreaThemeAccent,
    refreshAreas,
  ]);

  const creatingRoomAtCellRef = useRef(false);
  const createRoomAtCell = useCallback(
    async (x: number, y: number) => {
      if (!areaId || !area) return;
      if (creatingRoomAtCellRef.current) return;
      if (x < 0 || x >= area.grid_width || y < 0 || y >= area.grid_height) {
        return;
      }
      creatingRoomAtCellRef.current = true;
      setErr(null);
      try {
        const token = await getTokenRef.current();
        const created = await dmCreateRoom(token, areaId, {
          name: `Room (${x}, ${y})`,
          cell_x: x,
          cell_y: y,
        });
        await loadCellsAndRooms();
        setSelectedRoomId(created.id);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Create room failed");
      } finally {
        creatingRoomAtCellRef.current = false;
      }
    },
    [areaId, area, loadCellsAndRooms],
  );

  const applyCellPosition = useCallback(async () => {
    if (!selectedRoomId || !areaId || !area) return;
    setErr(null);
    const x = parseInt(panelCellX, 10);
    const y = parseInt(panelCellY, 10);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      setErr("Grid position must be numbers.");
      return;
    }
    if (x < 0 || x >= area.grid_width || y < 0 || y >= area.grid_height) {
      setErr(
        `Cell must be within 0…${area.grid_width - 1} × 0…${area.grid_height - 1}.`,
      );
      return;
    }
    try {
      const token = await getTokenRef.current();
      await dmPlaceRoomInCell(token, areaId, selectedRoomId, x, y);
      await loadCellsAndRooms();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Move failed");
    }
  }, [
    selectedRoomId,
    areaId,
    area,
    panelCellX,
    panelCellY,
    loadCellsAndRooms,
  ]);

  const deleteRoom = useCallback(async () => {
    if (!selectedRoomId || !areaId) return;
    if (
      !window.confirm(
        "Delete this room? Its grid cell and exits will be removed. This cannot be undone.",
      )
    ) {
      return;
    }
    setErr(null);
    try {
      const token = await getTokenRef.current();
      await dmDeleteRoom(token, selectedRoomId);
      setSelectedRoomId(null);
      await loadCellsAndRooms();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete room failed");
    }
  }, [selectedRoomId, areaId, loadCellsAndRooms]);

  const moveRoomOnGrid = useCallback(
    async (roomId: number, x: number, y: number) => {
      if (!areaId || !area) return;
      setErr(null);
      if (x < 0 || x >= area.grid_width || y < 0 || y >= area.grid_height) {
        return;
      }
      try {
        const token = await getTokenRef.current();
        await dmPlaceRoomInCell(token, areaId, roomId, x, y);
        await loadCellsAndRooms();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Move failed");
      }
    },
    [areaId, area, loadCellsAndRooms],
  );

  if (!isAuthenticated || isLoading) {
    return (
      <Box p={8}>
        <Text>Loading…</Text>
      </Box>
    );
  }

  if (!isStaff) {
    return (
      <Box p={8}>
        <Text>Staff only.</Text>
      </Box>
    );
  }

  return (
    <Box p={4} maxW="1400px" mx="auto" color="#e0e0e0">
      <Flex align="baseline" gap={4} mb={2} flexWrap="wrap">
        <Heading size="lg">QFF DM — world, areas & rooms</Heading>
        <Box
          as="button"
          fontSize="sm"
          color="#889977"
          cursor="pointer"
          textDecoration="underline"
          bg="transparent"
          border="none"
          p={0}
          font="inherit"
          onClick={() => navigate("/qff/dm")}
        >
          ← DM menu
        </Box>
      </Flex>
      {err && (
        <Text color="nautical.solid" mb={2} fontSize="sm" role="alert">
          {err}
        </Text>
      )}

      <Box
        borderWidth="1px"
        borderColor="#444"
        borderRadius="md"
        p={3}
        mb={4}
        bg="#181818"
      >
        <Heading size="sm" mb={2}>
          Create new area
        </Heading>
        <Flex gap={2} flexWrap="wrap" align="flex-end">
          <Field.Root maxW="200px">
            <Field.Label>Name</Field.Label>
            <Input
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
              bg="#222"
              placeholder="e.g. Swamp"
            />
          </Field.Root>
          <Field.Root flex="1" minW="180px">
            <Field.Label>Description</Field.Label>
            <Input
              value={newAreaDesc}
              onChange={(e) => setNewAreaDesc(e.target.value)}
              bg="#222"
            />
          </Field.Root>
          <Field.Root maxW="72px">
            <Field.Label>W</Field.Label>
            <Input
              type="number"
              min={1}
              max={15}
              value={newAreaW}
              onChange={(e) => setNewAreaW(Number(e.target.value) || 1)}
              bg="#222"
            />
          </Field.Root>
          <Field.Root maxW="72px">
            <Field.Label>H</Field.Label>
            <Input
              type="number"
              min={1}
              max={15}
              value={newAreaH}
              onChange={(e) => setNewAreaH(Number(e.target.value) || 1)}
              bg="#222"
            />
          </Field.Root>
          <Field.Root flex="1" minW="240px">
            <Field.Label fontSize="xs">Area colors (play UI)</Field.Label>
            <Stack gap={2} mt={1}>
              <DmAreaThemeHueRow
                rowLabel="Room"
                value={newAreaThemePrimary}
                onChange={setNewAreaThemePrimary}
              />
              <DmAreaThemeHueRow
                rowLabel="Area"
                value={newAreaThemeSecondary}
                onChange={setNewAreaThemeSecondary}
              />
              <DmAreaThemeHueRow
                rowLabel="Description"
                value={newAreaThemeAccent}
                onChange={setNewAreaThemeAccent}
              />
            </Stack>
          </Field.Root>
          <QffButton type="button" {...DM_PRIMARY_BTN} onClick={() => void handleCreateArea()}>
            Create new area
          </QffButton>
        </Flex>
      </Box>

      <Flex gap={4} mb={4} flexWrap="wrap" align="flex-end">
        <Field.Root maxW="280px">
          <Field.Label>Area</Field.Label>
          <NativeSelectRoot>
            <NativeSelectField
              value={areaId ?? ""}
              onChange={(e) => {
                setAreaId(Number(e.target.value) || null);
                setSelectedRoomId(null);
              }}
              bg="#222"
            >
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelectField>
          </NativeSelectRoot>
        </Field.Root>
        {area && (
          <>
            <Field.Root maxW="200px">
              <Field.Label>Name</Field.Label>
              <Input
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
                bg="#222"
              />
            </Field.Root>
            <Field.Root maxW="80px">
              <Field.Label>W</Field.Label>
              <Input
                type="number"
                min={1}
                value={areaGridW}
                onChange={(e) => setAreaGridW(Number(e.target.value) || 1)}
                bg="#222"
              />
            </Field.Root>
            <Field.Root maxW="80px">
              <Field.Label>H</Field.Label>
              <Input
                type="number"
                min={1}
                value={areaGridH}
                onChange={(e) => setAreaGridH(Number(e.target.value) || 1)}
                bg="#222"
              />
            </Field.Root>
            <Field.Root flex="1" minW="240px">
              <Field.Label fontSize="xs">Colors</Field.Label>
              <Stack gap={2} mt={1}>
                <DmAreaThemeHueRow
                  rowLabel="Room"
                  value={areaThemePrimary}
                  onChange={setAreaThemePrimary}
                />
                <DmAreaThemeHueRow
                  rowLabel="Area"
                  value={areaThemeSecondary}
                  onChange={setAreaThemeSecondary}
                />
                <DmAreaThemeHueRow
                  rowLabel="Description"
                  value={areaThemeAccent}
                  onChange={setAreaThemeAccent}
                />
              </Stack>
            </Field.Root>
            <QffButton
              type="button"
              variant="outline"
              borderColor="#555"
              color="#c8d8c8"
              onClick={() => setShowAreaDescEditor((v) => !v)}
            >
              {showAreaDescEditor ? "Hide description" : "Edit description"}
            </QffButton>
            <QffButton
              type="button"
              {...DM_PRIMARY_BTN}
              onClick={async () => {
                if (!areaId) return;
                setErr(null);
                try {
                  const token = await getTokenRef.current();
                  await dmPatchArea(token, areaId, {
                    name: areaName,
                    description: areaDescription,
                    grid_width: areaGridW,
                    grid_height: areaGridH,
                    theme_primary: areaThemePrimary,
                    theme_secondary: areaThemeSecondary,
                    theme_accent: areaThemeAccent,
                  });
                  await refreshAreas();
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "Save failed");
                }
              }}
            >
              Save area
            </QffButton>
            <input
              ref={roomsImportInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: "none" }}
              onChange={(e) => void handleRoomsImportFile(e)}
            />
            <QffButton
              type="button"
              variant="outline"
              borderColor="#555"
              color="#c8d8c8"
              onClick={() => void handleDownloadRoomsJson()}
            >
              Download rooms JSON
            </QffButton>
            <QffButton
              type="button"
              variant="outline"
              borderColor="#555"
              color="#c8d8c8"
              onClick={() => roomsImportInputRef.current?.click()}
            >
              Upload rooms JSON
            </QffButton>
          </>
        )}
      </Flex>

      {area && showAreaDescEditor && (
        <Box mb={4} maxW="720px">
          <Field.Root>
            <Field.Label>Area description</Field.Label>
            <Textarea
              value={areaDescription}
              onChange={(e) => setAreaDescription(e.target.value)}
              rows={5}
              bg="#222"
              placeholder="Shown in DM tools / future play UI as needed."
            />
          </Field.Root>
        </Box>
      )}

      {area && (
        <Grid
          templateColumns={{ base: "1fr", lg: "1fr minmax(400px, 36vw)" }}
          gap={4}
          alignItems="start"
        >
          <Box ref={dmMapColumnRef} minW={0} w="100%">
            <Text fontSize="sm" color="#888" mb={2}>
              Map — dots on edges are N/S/E/W/diagonal exits; ↑ ↓ are up/down; ⟨ ⟩ are
              in/out. Click a room to edit, an empty cell to add a room, or drag to
              move/swap.
            </Text>
            <Box
              borderWidth="1px"
              borderColor="#444"
              borderRadius="md"
              p={3}
              bg="#181818"
              overflow="auto"
              maxH="calc(100vh - 18rem)"
            >
              <DmGrid
                area={area}
                cells={cells}
                areaExits={areaExits}
                selectedRoomId={selectedRoomId}
                onSelect={(roomId) => setSelectedRoomId(roomId)}
                onMoveRoom={(roomId, x, y) => void moveRoomOnGrid(roomId, x, y)}
                onEmptyCellClick={(x, y) => void createRoomAtCell(x, y)}
              />
            </Box>
          </Box>

          <Box
            ref={dmRoomPanelRef}
            borderWidth="1px"
            borderColor="#444"
            borderRadius="md"
            bg="#181818"
            display="flex"
            flexDirection="column"
            maxH="calc(100vh - 18rem)"
            minH={0}
            minW={0}
          >
            {!selectedRoom && (
              <Box p={3}>
                <Text color="#888">Select a room.</Text>
              </Box>
            )}
            {selectedRoom && (
              <>
                <Box flex="1" minH={0} overflowY="auto" px={3} pt={3} pb={2}>
                  <Stack gap={3}>
                    <Heading size="sm">{selectedRoom.name}</Heading>
                    <Field.Root>
                      <Field.Label>Name</Field.Label>
                      <Input
                        value={panelName}
                        onChange={(e) => setPanelName(e.target.value)}
                        bg="#222"
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>Description</Field.Label>
                      <Textarea
                        value={panelDesc}
                        onChange={(e) => setPanelDesc(e.target.value)}
                        rows={4}
                        bg="#222"
                      />
                    </Field.Root>

                    <Text fontWeight="bold" mt={3}>
                      Room items
                    </Text>
                    <Text fontSize="xs" color="#888">
                      Same appearance as floor items in play, but <strong>get</strong> mints a new
                      instance per player (not a shared pickup). Hidden while a floor copy of the
                      same template exists in this room.
                    </Text>
                    <Box
                      borderLeftWidth="3px"
                      borderColor="#5a6a8a"
                      pl={2}
                      py={1}
                      mb={1}
                      bg="rgba(90, 106, 138, 0.08)"
                      borderRadius="sm"
                    >
                      <Text fontSize="xs" fontWeight="bold" color="#c8d0e8">
                        Spawn conditions (optional)
                      </Text>
                      <Text fontSize="xs" color="#aaa" mb={2}>
                        Same rules as floor items: quest state, not shown if the player already
                        carries this template, and not shown if an unowned floor instance of this
                        template is in the room.
                      </Text>
                    </Box>
                    {roomItems.length === 0 ? (
                      <Text fontSize="sm" color="#666">
                        No room items yet — add one below.
                      </Text>
                    ) : (
                      roomItems.map((ri) => {
                        const roomQuestDetail =
                          ri.visible_quest_id != null
                            ? questDetailById.get(ri.visible_quest_id)
                            : undefined;
                        return (
                          <Stack
                            key={ri.id}
                            gap={1}
                            py={1.5}
                            borderBottomWidth="1px"
                            borderColor="#333"
                          >
                            <Flex
                              justify="space-between"
                              align="center"
                              fontSize="sm"
                              gap={2}
                            >
                              <Text>
                                {ri.nickname
                                  ? `${ri.nickname} (${ri.item_name})`
                                  : ri.item_name}
                                <Text as="span" fontSize="xs" color="#666" ml={1}>
                                  #{ri.id}
                                </Text>
                              </Text>
                              <QffButton
                                type="button"
                                size="sm"
                                {...DM_PRIMARY_BTN}
                                onClick={async () => {
                                  const token = await getTokenRef.current();
                                  await dmDeleteRoomItem(token, ri.id);
                                  const next = await dmFetchRoomRoomItems(
                                    token,
                                    selectedRoom!.id,
                                  );
                                  setRoomItems(next);
                                }}
                              >
                                Remove
                              </QffButton>
                            </Flex>
                            <Text fontSize="xs" color="#888">
                              Show this slot only when:
                            </Text>
                            <Flex gap={2} flexWrap="wrap" align="flex-end">
                              <Field.Root flex="1" minW="140px">
                                <Field.Label fontSize="xs">Quest</Field.Label>
                                <NativeSelectRoot>
                                  <NativeSelectField
                                    value={
                                      ri.visible_quest_id != null
                                        ? String(ri.visible_quest_id)
                                        : ""
                                    }
                                    onChange={async (e) => {
                                      const raw = e.target.value;
                                      const qid =
                                        raw === ""
                                          ? null
                                          : parseInt(raw, 10);
                                      const token = await getTokenRef.current();
                                      if (qid != null) {
                                        revealQuestFetchedRef.current.add(qid);
                                        const d = await dmFetchQuestDetail(
                                          token,
                                          qid,
                                        );
                                        setQuestDetailById((prev) =>
                                          new Map(prev).set(qid, d),
                                        );
                                      }
                                      const nx = await dmPatchRoomItem(token, ri.id, {
                                        visible_quest_state_id: null,
                                      });
                                      setRoomItems((prev) =>
                                        prev.map((x) =>
                                          x.id === ri.id
                                            ? {
                                                ...nx,
                                                visible_quest_id: qid,
                                                visible_quest_slug:
                                                  qid != null
                                                    ? dmQuests.find(
                                                        (q) => q.id === qid,
                                                      )?.slug ?? null
                                                    : null,
                                                visible_quest_state_slug: null,
                                              }
                                            : x,
                                        ),
                                      );
                                    }}
                                    bg="#222"
                                  >
                                    <option value="">— any player —</option>
                                    {[...dmQuests]
                                      .sort((a, b) =>
                                        a.name.localeCompare(b.name),
                                      )
                                      .map((q) => (
                                        <option key={q.id} value={String(q.id)}>
                                          {q.name}
                                        </option>
                                      ))}
                                  </NativeSelectField>
                                </NativeSelectRoot>
                              </Field.Root>
                              <Field.Root flex="1" minW="140px">
                                <Field.Label fontSize="xs">Quest state</Field.Label>
                                <NativeSelectRoot>
                                  <NativeSelectField
                                    value={
                                      ri.visible_quest_state_id != null
                                        ? String(ri.visible_quest_state_id)
                                        : ""
                                    }
                                    pointerEvents={
                                      !roomQuestDetail ? "none" : undefined
                                    }
                                    onChange={async (e) => {
                                      const raw = e.target.value;
                                      const sid =
                                        raw === ""
                                          ? null
                                          : parseInt(raw, 10);
                                      const token = await getTokenRef.current();
                                      const nx = await dmPatchRoomItem(
                                        token,
                                        ri.id,
                                        {
                                          visible_quest_state_id:
                                            sid != null &&
                                            Number.isFinite(sid)
                                              ? sid
                                              : null,
                                        },
                                      );
                                      setRoomItems((prev) =>
                                        prev.map((x) =>
                                          x.id === ri.id ? nx : x,
                                        ),
                                      );
                                    }}
                                    bg="#222"
                                    opacity={!roomQuestDetail ? 0.55 : undefined}
                                  >
                                    <option value="">
                                      {roomQuestDetail
                                        ? "— choose state —"
                                        : "— pick quest first —"}
                                    </option>
                                    {(roomQuestDetail?.states ?? [])
                                      .slice()
                                      .sort(
                                        (a, b) =>
                                          a.sort_order - b.sort_order ||
                                          a.name.localeCompare(b.name),
                                      )
                                      .map((s) => (
                                        <option key={s.id} value={String(s.id)}>
                                          {s.name} ({s.slug})
                                        </option>
                                      ))}
                                  </NativeSelectField>
                                </NativeSelectRoot>
                              </Field.Root>
                            </Flex>
                          </Stack>
                        );
                      })
                    )}
                    <Text fontSize="xs" fontWeight="bold" color="#aaa" mt={1}>
                      Add room item
                    </Text>
                    <Stack gap={2}>
                      <Flex gap={2} flexWrap="wrap" align="flex-end">
                        <Field.Root flex="1" minW="160px">
                          <Field.Label fontSize="xs">Item template</Field.Label>
                          <NativeSelectRoot>
                            <NativeSelectField
                              value={newRoomItemId}
                              onChange={(e) => setNewRoomItemId(e.target.value)}
                              bg="#222"
                            >
                              <option value="">— choose —</option>
                              {itemTemplates.map((it) => (
                                <option key={it.id} value={String(it.id)}>
                                  {it.name} ({it.slug})
                                </option>
                              ))}
                            </NativeSelectField>
                          </NativeSelectRoot>
                        </Field.Root>
                        <Field.Root maxW="140px">
                          <Field.Label fontSize="xs">Nickname (optional)</Field.Label>
                          <Input
                            value={newRoomNickname}
                            onChange={(e) => setNewRoomNickname(e.target.value)}
                            placeholder="e.g. rusty"
                            bg="#222"
                          />
                        </Field.Root>
                      </Flex>
                      <Text fontSize="xs" color="#888">
                        Show only when player is in:
                      </Text>
                      <Flex gap={2} flexWrap="wrap" align="flex-end">
                        <Field.Root flex="1" minW="140px">
                          <Field.Label fontSize="xs">Quest</Field.Label>
                          <NativeSelectRoot>
                            <NativeSelectField
                              value={newRoomVisibleQuestId}
                              onChange={async (e) => {
                                const v = e.target.value;
                                setNewRoomVisibleQuestId(v);
                                setNewRoomVisibleStateId("");
                                const qid = v === "" ? null : parseInt(v, 10);
                                if (qid != null && Number.isFinite(qid)) {
                                  revealQuestFetchedRef.current.add(qid);
                                  try {
                                    const token = await getTokenRef.current();
                                    const d = await dmFetchQuestDetail(
                                      token,
                                      qid,
                                    );
                                    setQuestDetailById((prev) =>
                                      new Map(prev).set(qid, d),
                                    );
                                  } catch {
                                    revealQuestFetchedRef.current.delete(qid);
                                  }
                                }
                              }}
                              bg="#222"
                            >
                              <option value="">— any player —</option>
                              {[...dmQuests]
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map((q) => (
                                  <option key={q.id} value={String(q.id)}>
                                    {q.name}
                                  </option>
                                ))}
                            </NativeSelectField>
                          </NativeSelectRoot>
                        </Field.Root>
                        <Field.Root flex="1" minW="140px">
                          <Field.Label fontSize="xs">Quest state</Field.Label>
                          <NativeSelectRoot>
                            <NativeSelectField
                              value={newRoomVisibleStateId}
                              onChange={(e) =>
                                setNewRoomVisibleStateId(e.target.value)
                              }
                              pointerEvents={
                                !newRoomQuestDetailForAdd ? "none" : undefined
                              }
                              bg="#222"
                              opacity={!newRoomQuestDetailForAdd ? 0.55 : undefined}
                            >
                              <option value="">
                                {newRoomQuestDetailForAdd
                                  ? "— choose state —"
                                  : "— pick quest first —"}
                              </option>
                              {(newRoomQuestDetailForAdd?.states ?? [])
                                .slice()
                                .sort(
                                  (a, b) =>
                                    a.sort_order - b.sort_order ||
                                    a.name.localeCompare(b.name),
                                )
                                .map((s) => (
                                  <option key={s.id} value={String(s.id)}>
                                    {s.name} ({s.slug})
                                  </option>
                                ))}
                            </NativeSelectField>
                          </NativeSelectRoot>
                        </Field.Root>
                      </Flex>
                      <Box>
                        <QffButton
                          type="button"
                          size="sm"
                          {...DM_PRIMARY_BTN}
                          onClick={async () => {
                            const id = parseInt(newRoomItemId, 10);
                            if (!Number.isFinite(id)) {
                              setErr("Choose an item template.");
                              return;
                            }
                            const vsRaw = newRoomVisibleStateId.trim();
                            const vsid =
                              vsRaw === ""
                                ? null
                                : parseInt(vsRaw, 10);
                            if (
                              newRoomVisibleQuestId !== "" &&
                              (!Number.isFinite(vsid as number) || vsRaw === "")
                            ) {
                              setErr(
                                "Pick a quest state, or clear the quest filters.",
                              );
                              return;
                            }
                            setErr(null);
                            const token = await getTokenRef.current();
                            await dmCreateRoomRoomItem(token, selectedRoom!.id, {
                              item_id: id,
                              nickname: newRoomNickname.trim() || undefined,
                              visible_quest_state_id:
                                vsid != null && Number.isFinite(vsid)
                                  ? vsid
                                  : undefined,
                            });
                            setNewRoomNickname("");
                            setNewRoomVisibleQuestId("");
                            setNewRoomVisibleStateId("");
                            const next = await dmFetchRoomRoomItems(
                              token,
                              selectedRoom!.id,
                            );
                            setRoomItems(next);
                          }}
                        >
                          Add room item
                        </QffButton>
                      </Box>
                    </Stack>

                    <Field.Root>
                      <Field.Label>Search text</Field.Label>
                      <Textarea
                        value={panelSearch}
                        onChange={(e) => setPanelSearch(e.target.value)}
                        rows={2}
                        bg="#222"
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>Search DC (1–100, roll 1d100 + Sense)</Field.Label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        w="100px"
                        value={panelSearchChance}
                        onChange={(e) => setPanelSearchChance(e.target.value)}
                        bg="#222"
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>Grid cell (0-based)</Field.Label>
                      <Flex gap={2} flexWrap="wrap" align="center">
                        <Input
                          type="number"
                          min={0}
                          max={area.grid_width - 1}
                          w="72px"
                          value={panelCellX}
                          onChange={(e) => setPanelCellX(e.target.value)}
                          bg="#222"
                        />
                        <Text fontSize="sm" color="#888">
                          ×
                        </Text>
                        <Input
                          type="number"
                          min={0}
                          max={area.grid_height - 1}
                          w="72px"
                          value={panelCellY}
                          onChange={(e) => setPanelCellY(e.target.value)}
                          bg="#222"
                        />
                        <QffButton
                          type="button"
                          size="sm"
                          {...DM_PRIMARY_BTN}
                          onClick={() => void applyCellPosition()}
                        >
                          Apply position
                        </QffButton>
                      </Flex>
                    </Field.Root>

                    <Text fontWeight="bold" mt={2}>
                      Exits
                    </Text>
                    <Text fontSize="xs" color="#888" mb={1}>
                      Hidden exits are invisible in play until reveal conditions (if any) are met.
                      Lock kind still controls passing through.
                    </Text>
                    {exits.map((ex) => {
                      const dest = exitDestRooms.find((r) => r.id === ex.to_room_id);
                      const destLabel = dest
                        ? `${dest.areaName} — ${dest.name}`
                        : ex.to_room_name;
                      const revealQuestDetail =
                        ex.reveal_quest_id != null
                          ? questDetailById.get(ex.reveal_quest_id)
                          : undefined;
                      const mergeExit = (patch: DmExit) =>
                        patch.to_room_name != null
                          ? patch
                          : ({ ...patch, to_room_name: ex.to_room_name } as DmExit);
                      return (
                        <Stack
                          key={ex.id}
                          gap={1}
                          py={1.5}
                          borderBottomWidth="1px"
                          borderColor="#333"
                        >
                          <Flex
                            justify="space-between"
                            align="center"
                            fontSize="sm"
                            gap={2}
                          >
                            <Text>
                              {ex.direction} → {destLabel}
                            </Text>
                            <QffButton
                              type="button"
                              size="sm"
                              {...DM_PRIMARY_BTN}
                              onClick={async () => {
                                const token = await getTokenRef.current();
                                await dmDeleteExit(token, ex.id);
                                const nx = await dmFetchExits(token, selectedRoom!.id);
                                setExits(nx);
                                if (areaId) {
                                  setAreaExits(await dmFetchAreaExits(token, areaId));
                                }
                              }}
                            >
                              Del
                            </QffButton>
                          </Flex>
                          <Flex align="center" gap={2} fontSize="xs" flexWrap="wrap">
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={ex.is_hidden}
                                onChange={async (e) => {
                                  const checked = e.target.checked;
                                  const token = await getTokenRef.current();
                                  const nx = mergeExit(
                                    await dmPatchExit(token, ex.id, {
                                      is_hidden: checked,
                                      ...(!checked
                                        ? {
                                            reveal_item_id: null,
                                            reveal_quest_state_id: null,
                                          }
                                        : {}),
                                    }),
                                  );
                                  setExits((prev) =>
                                    prev.map((x) => (x.id === ex.id ? nx : x)),
                                  );
                                  if (areaId) {
                                    setAreaExits(
                                      await dmFetchAreaExits(token, areaId),
                                    );
                                  }
                                }}
                              />
                              Hidden until revealed
                            </label>
                          </Flex>
                          {ex.is_hidden && (
                            <Flex gap={2} flexWrap="wrap" align="flex-end">
                              <Field.Root maxW="220px" flex="1" minW="140px">
                                <Field.Label fontSize="xs">
                                  Reveal if carrying item
                                </Field.Label>
                                <NativeSelectRoot>
                                  <NativeSelectField
                                    value={
                                      ex.reveal_item_id != null
                                        ? String(ex.reveal_item_id)
                                        : ""
                                    }
                                    onChange={async (e) => {
                                      const raw = e.target.value;
                                      const parsed =
                                        raw === ""
                                          ? null
                                          : parseInt(raw, 10);
                                      const revealItem =
                                        parsed != null && Number.isFinite(parsed)
                                          ? parsed
                                          : null;
                                      const token = await getTokenRef.current();
                                      const nx = mergeExit(
                                        await dmPatchExit(token, ex.id, {
                                          reveal_item_id: revealItem,
                                        }),
                                      );
                                      setExits((prev) =>
                                        prev.map((x) => (x.id === ex.id ? nx : x)),
                                      );
                                    }}
                                    bg="#222"
                                  >
                                    <option value="">— none —</option>
                                    {itemTemplates.map((it) => (
                                      <option key={it.id} value={String(it.id)}>
                                        {it.name} ({it.slug})
                                      </option>
                                    ))}
                                  </NativeSelectField>
                                </NativeSelectRoot>
                              </Field.Root>
                              <Field.Root maxW="200px" flex="1" minW="120px">
                                <Field.Label fontSize="xs">Quest</Field.Label>
                                <NativeSelectRoot>
                                  <NativeSelectField
                                    value={
                                      ex.reveal_quest_id != null
                                        ? String(ex.reveal_quest_id)
                                        : ""
                                    }
                                    onChange={async (e) => {
                                      const raw = e.target.value;
                                      const qid =
                                        raw === ""
                                          ? null
                                          : parseInt(raw, 10);
                                      const token = await getTokenRef.current();
                                      if (qid != null) {
                                        revealQuestFetchedRef.current.add(qid);
                                        const d = await dmFetchQuestDetail(
                                          token,
                                          qid,
                                        );
                                        setQuestDetailById((prev) =>
                                          new Map(prev).set(qid, d),
                                        );
                                      }
                                      const rawNx = mergeExit(
                                        await dmPatchExit(token, ex.id, {
                                          reveal_quest_state_id: null,
                                        }),
                                      );
                                      setExits((prev) =>
                                        prev.map((x) =>
                                          x.id === ex.id
                                            ? {
                                                ...rawNx,
                                                reveal_quest_id: qid,
                                                reveal_quest_slug:
                                                  qid != null
                                                    ? dmQuests.find(
                                                        (q) => q.id === qid,
                                                      )?.slug ?? null
                                                    : null,
                                                reveal_quest_state_slug: null,
                                              }
                                            : x,
                                        ),
                                      );
                                    }}
                                    bg="#222"
                                  >
                                    <option value="">— none —</option>
                                    {[...dmQuests]
                                      .sort((a, b) =>
                                        a.name.localeCompare(b.name),
                                      )
                                      .map((q) => (
                                        <option key={q.id} value={String(q.id)}>
                                          {q.name}
                                        </option>
                                      ))}
                                  </NativeSelectField>
                                </NativeSelectRoot>
                              </Field.Root>
                              <Field.Root maxW="200px" flex="1" minW="120px">
                                <Field.Label fontSize="xs">Quest state</Field.Label>
                                <NativeSelectRoot>
                                  <NativeSelectField
                                    value={
                                      ex.reveal_quest_state_id != null
                                        ? String(ex.reveal_quest_state_id)
                                        : ""
                                    }
                                    pointerEvents={
                                      !revealQuestDetail ? "none" : undefined
                                    }
                                    onChange={async (e) => {
                                      const raw = e.target.value;
                                      const sid =
                                        raw === ""
                                          ? null
                                          : parseInt(raw, 10);
                                      const token = await getTokenRef.current();
                                      const nx = mergeExit(
                                        await dmPatchExit(token, ex.id, {
                                          reveal_quest_state_id:
                                            sid != null &&
                                            Number.isFinite(sid)
                                              ? sid
                                              : null,
                                        }),
                                      );
                                      setExits((prev) =>
                                        prev.map((x) =>
                                          x.id === ex.id ? nx : x,
                                        ),
                                      );
                                    }}
                                    bg="#222"
                                    opacity={!revealQuestDetail ? 0.55 : undefined}
                                  >
                                    <option value="">
                                      {revealQuestDetail
                                        ? "— state —"
                                        : "— pick quest —"}
                                    </option>
                                    {(revealQuestDetail?.states ?? [])
                                      .slice()
                                      .sort(
                                        (a, b) =>
                                          a.sort_order - b.sort_order ||
                                          a.name.localeCompare(b.name),
                                      )
                                      .map((s) => (
                                        <option key={s.id} value={String(s.id)}>
                                          {s.name} ({s.slug})
                                        </option>
                                      ))}
                                  </NativeSelectField>
                                </NativeSelectRoot>
                              </Field.Root>
                            </Flex>
                          )}
                        </Stack>
                      );
                    })}

                    <Flex gap={2} flexWrap="wrap" align="flex-end">
                      <Field.Root maxW="100px">
                        <Field.Label fontSize="xs">Direction</Field.Label>
                        <NativeSelectRoot>
                          <NativeSelectField
                            value={newExitDir}
                            onChange={(e) => setNewExitDir(e.target.value)}
                            bg="#222"
                          >
                            {DIRECTIONS.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </NativeSelectField>
                        </NativeSelectRoot>
                      </Field.Root>
                      <Field.Root flex="1" minW="140px">
                        <Field.Label fontSize="xs">Destination area</Field.Label>
                        <NativeSelectRoot>
                          <NativeSelectField
                            value={exitDestAreaId ?? ""}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setExitDestAreaId(Number.isFinite(v) ? v : null);
                              setNewExitTo(null);
                            }}
                            bg="#222"
                          >
                            <option value="">— area —</option>
                            {[...areas]
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                          </NativeSelectField>
                        </NativeSelectRoot>
                      </Field.Root>
                      <Field.Root flex="1" minW="160px">
                        <Field.Label fontSize="xs">Destination room</Field.Label>
                        <NativeSelectRoot>
                          <NativeSelectField
                            value={newExitTo ?? ""}
                            pointerEvents={exitDestAreaId == null ? "none" : undefined}
                            opacity={exitDestAreaId == null ? 0.6 : undefined}
                            onChange={(e) =>
                              setNewExitTo(Number(e.target.value) || null)
                            }
                            bg="#222"
                          >
                            <option value="">
                              {exitDestAreaId == null
                                ? "— choose area first —"
                                : "— room —"}
                            </option>
                            {roomsInExitDestArea.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </NativeSelectField>
                        </NativeSelectRoot>
                      </Field.Root>
                      <QffButton type="button" size="sm" {...DM_PRIMARY_BTN} onClick={addExit}>
                        Add exit
                      </QffButton>
                    </Flex>
                  </Stack>
                </Box>
                <Flex
                  flexShrink={0}
                  gap={2}
                  flexWrap="wrap"
                  align="center"
                  px={3}
                  py={3}
                  borderTopWidth="1px"
                  borderColor="#444"
                  bg="#141414"
                >
                  <QffButton type="button" {...DM_PRIMARY_BTN} onClick={saveRoom}>
                    Save room
                  </QffButton>
                  <QffButton
                    type="button"
                    colorPalette="red"
                    variant="solid"
                    onClick={() => void deleteRoom()}
                  >
                    Delete room
                  </QffButton>
                </Flex>
              </>
            )}
          </Box>
        </Grid>
      )}
    </Box>
  );
}

/** Visual cue per exit direction on the DM grid (positioned inside the cell). */
function dmExitMarkerGlyph(direction: string): string {
  switch (direction) {
    case "up":
      return "↑";
    case "down":
      return "↓";
    case "in":
      return "⟨";
    case "out":
      return "⟩";
    case "n":
    case "s":
    case "e":
    case "w":
    case "nw":
    case "ne":
    case "sw":
    case "se":
      return "●";
    default:
      return "·";
  }
}

const DM_EXIT_MARKER_POS: Record<
  string,
  { top?: string; bottom?: string; left?: string; right?: string; transform?: string; fontSize: string }
> = {
  n: { top: "1px", left: "50%", transform: "translateX(-50%)", fontSize: "8px" },
  s: { bottom: "1px", left: "50%", transform: "translateX(-50%)", fontSize: "8px" },
  e: { right: "2px", top: "50%", transform: "translateY(-50%)", fontSize: "8px" },
  w: { left: "2px", top: "50%", transform: "translateY(-50%)", fontSize: "8px" },
  nw: { top: "2px", left: "2px", fontSize: "7px" },
  ne: { top: "2px", right: "2px", fontSize: "7px" },
  sw: { bottom: "2px", left: "2px", fontSize: "7px" },
  se: { bottom: "2px", right: "2px", fontSize: "7px" },
  up: { top: "11px", left: "50%", transform: "translateX(-50%)", fontSize: "12px" },
  down: { bottom: "11px", left: "50%", transform: "translateX(-50%)", fontSize: "12px" },
  in: { left: "3px", top: "50%", transform: "translateY(-50%)", fontSize: "11px" },
  out: { right: "3px", top: "50%", transform: "translateY(-50%)", fontSize: "11px" },
};

function DmExitMarkers({ exits }: { exits: DmAreaExit[] }) {
  if (exits.length === 0) return null;
  return (
    <Box position="absolute" inset={0} pointerEvents="none" zIndex={1} aria-hidden>
      {exits.map((ex) => {
        const pos = DM_EXIT_MARKER_POS[ex.direction] ?? {
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: "9px",
        };
        const label = `${ex.direction} → ${ex.to_room_name}${ex.is_hidden ? " (hidden)" : ""}`;
        return (
          <Text
            key={ex.id}
            as="span"
            position="absolute"
            lineHeight="1"
            fontWeight={ex.direction === "up" || ex.direction === "down" ? "bold" : "normal"}
            title={label}
            color={ex.is_hidden ? "rgba(154, 208, 160, 0.42)" : "#9ad0a0"}
            {...pos}
          >
            {dmExitMarkerGlyph(ex.direction)}
          </Text>
        );
      })}
    </Box>
  );
}

function DmGrid({
  area,
  cells,
  areaExits,
  selectedRoomId,
  onSelect,
  onMoveRoom,
  onEmptyCellClick,
}: {
  area: DmArea;
  cells: Array<{ x: number; y: number; room_id: number; room_name: string }>;
  areaExits: DmAreaExit[];
  selectedRoomId: number | null;
  onSelect: (id: number) => void;
  onMoveRoom: (roomId: number, x: number, y: number) => void;
  onEmptyCellClick: (x: number, y: number) => void;
}) {
  const byKey = new Map<string, { room_id: number; room_name: string }>();
  for (const c of cells) {
    byKey.set(`${c.x},${c.y}`, { room_id: c.room_id, room_name: c.room_name });
  }

  const exitsByRoomId = useMemo(() => {
    const m = new Map<number, DmAreaExit[]>();
    for (const ex of areaExits) {
      const list = m.get(ex.from_room_id);
      if (list) list.push(ex);
      else m.set(ex.from_room_id, [ex]);
    }
    return m;
  }, [areaExits]);

  const labelCol = "2.25rem";
  const cellCols = `repeat(${area.grid_width}, minmax(0, 1fr))`;
  const axisProps = {
    fontSize: "xs",
    fontWeight: "semibold",
    color: "#a0c090",
    userSelect: "none" as const,
    lineHeight: "short",
  };

  const rows = [];
  for (let y = 0; y < area.grid_height; y++) {
    const cols = [];
    for (let x = 0; x < area.grid_width; x++) {
      const cell = byKey.get(`${x},${y}`);
      const sel = cell && selectedRoomId === cell.room_id;
      cols.push(
        <Button
          key={`${x}-${y}`}
          variant="outline"
          {...qffGridCellButtonProps}
          borderWidth="1px"
          borderColor={sel ? "#6a8a6a" : "#444"}
          bg={cell ? "#243024" : "#121212"}
          minH="56px"
          h="auto"
          p={1}
          fontSize="11px"
          position="relative"
          overflow="visible"
          cursor={cell ? "grab" : "pointer"}
          userSelect="none"
          draggable={!!cell}
          onDragStart={(e) => {
            if (!cell) return;
            e.dataTransfer.setData(DM_DRAG_TYPE, String(cell.room_id));
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onDrop={(e) => {
            e.preventDefault();
            const raw = e.dataTransfer.getData(DM_DRAG_TYPE);
            if (!raw) return;
            const roomId = Number(raw);
            if (!Number.isFinite(roomId)) return;
            onMoveRoom(roomId, x, y);
          }}
          onClick={() => {
            if (cell) onSelect(cell.room_id);
            else onEmptyCellClick(x, y);
          }}
          title={
            cell
              ? "Drag to move, or click to select"
              : "Click to create a room here, or drop a room from elsewhere"
          }
        >
          {cell ? (
            <Box position="relative" w="100%" minH="44px" display="flex" alignItems="center" justifyContent="center">
              <DmExitMarkers exits={exitsByRoomId.get(cell.room_id) ?? []} />
              <Text
                position="relative"
                zIndex={2}
                fontSize="11px"
                lineHeight="short"
                wordBreak="break-word"
                textAlign="center"
                w="100%"
                px={0.5}
              >
                {cell.room_name}
              </Text>
            </Box>
          ) : (
            "·"
          )}
        </Button>,
      );
    }
    rows.push(
      <Grid
        key={`row-${y}`}
        templateColumns={`${labelCol} ${cellCols}`}
        gap={1}
        alignItems="stretch"
      >
        <Flex align="center" justify="center" minW={labelCol} maxW={labelCol}>
          <Text {...axisProps}>{y}</Text>
        </Flex>
        {cols}
      </Grid>,
    );
  }

  return (
    <Stack gap={1}>
      <Grid
        templateColumns={`${labelCol} ${cellCols}`}
        gap={1}
        alignItems="center"
        minW={0}
      >
        <Box minW={labelCol} maxW={labelCol} aria-hidden />
        {Array.from({ length: area.grid_width }, (_, x) => (
          <Text key={`col-h-${x}`} textAlign="center" {...axisProps}>
            {x}
          </Text>
        ))}
      </Grid>
      {rows}
    </Stack>
  );
}
