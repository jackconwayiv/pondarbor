/** QFF API client — same auth pattern as clicker/whatif. */

/**
 * Resolve QFF API paths for `fetch`. Supports:
 * - unset env → same-origin `/api/v1/qff/...`
 * - `https://host` → `https://host/api/v1/qff/...`
 * - path prefix `/proxy` → `/proxy/api/v1/qff/...`
 */
/** WebSocket URL for live QFF session sync (Auth0 token in query string). */
export function qffSessionWsUrl(accessToken: string): string {
  const path = "/api/v1/qff/ws/session/";
  const tokenParam = `token=${encodeURIComponent(accessToken)}`;
  const raw = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (!raw) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}${path}?${tokenParam}`;
  }
  if (/^https?:\/\//i.test(raw)) {
    const u = new URL(raw);
    const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProto}//${u.host}${path}?${tokenParam}`;
  }
  const prefix = raw.startsWith("/") ? raw : `/${raw}`;
  const base = prefix.replace(/\/$/, "");
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${base}${path}?${tokenParam}`;
}

function qffJoinBase(path: string): string {
  const raw = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!raw) return p;
  if (/^https?:\/\//i.test(raw)) {
    return `${raw.replace(/\/$/, "")}${p}`;
  }
  const prefix = raw.startsWith("/") ? raw : `/${raw}`;
  return `${prefix.replace(/\/$/, "")}${p}`;
}

function authHeaders(accessToken: string | null): Record<string, string> {
  if (!accessToken) return { "Content-Type": "application/json" };
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

export type QffCharacterClass = {
  id: number;
  slug: string;
  name: string;
  /** Flavor text for character creation; may be empty. */
  description: string;
  priority_stat_1: string;
  priority_stat_2: string;
};

export type QffSessionNoCharacter = {
  has_character: false;
};

export type QffExit = {
  direction: string;
  label: string;
  to_room_id: number;
  is_blocked?: boolean;
};

export type QffAreaMapCell = {
  x: number;
  y: number;
  room_id: number;
  room_name: string;
  exits: Array<{
    direction: string;
    to_room_id: number;
    to_room_name: string;
  }>;
};

export type QffAreaMapGrid = {
  area_id: number;
  area_name: string;
  grid_width: number;
  grid_height: number;
  cells: QffAreaMapCell[];
  is_dark_minimap?: boolean;
  lit_room_ids?: number[];
  /** Visited room ids in this area (for map-reveal vs fog-lit styling). */
  visited_room_ids?: number[];
  /** When true, visited-but-unlit rooms show as map-revealed (secondary style). */
  map_full_reveal_active?: boolean;
};

export type QffAreaTheme = {
  primary: string;
  secondary: string;
  accent: string;
};

export type QffSessionWithCharacter = {
  has_character: true;
  character: {
    id: number;
    name: string;
    class_slug: string;
    class_name: string;
    glyphs: string[];
    spawn_room: { id: number; name: string };
  };
  room: {
    id: number;
    name: string;
    description: string;
    /** When false (dark unlit room), play UI hides room description prose. */
    details_visible?: boolean;
    youSee: string[];
    npcs?: Array<{ slug: string; name: string }>;
    interactables?: Array<{ slug: string; name: string; kind: string }>;
    monsters?: Array<{ id: number; slug: string; name: string; cur_hp: number; max_hp: number }>;
    gold_piles?: Array<{ id: number; amount: number; label: string }>;
  };
  area: { id: number; name: string; theme: QffAreaTheme };
  exits: QffExit[];
  others_here: Array<{ name: string; inactive: boolean }>;
  /** When true, client should leave play (e.g. AFK kick to lobby). */
  force_lobby?: boolean;
  /** One minimap grid per visited area; current_area_id marks where the player is. */
  area_map: {
    current_area_id: number;
    grids: QffAreaMapGrid[];
    /** Server skipped minimap build (QFF_SESSION_MINIMAL_AREA_MAP); hide map panel. */
    minimal?: boolean;
  };
  character_profile: QffCharacterProfile;
  /** Room narrative queue; ids prevent duplicate lines when HTTP and WebSocket both deliver a session. */
  action_log: Array<{ id: number; text: string; log_tone?: string; logTone?: string }>;
  /** Shops in the current room; populated for the play UI's shop panel. */
  shops?: QffShopPanelData[];
  /** Pending y/n service-NPC prompt (healer_pay / innkeeper_stay) or null. */
  pending_prompt?: QffPendingPrompt | null;
};

export type QffShopPanelLine = {
  id: number;
  item_id: number;
  name: string;
  /** "static" | "consignment" — matches NpcShopStockLine.Kind. */
  kind: string;
  price: number;
  quantity: number;
};

export type QffShopPanelData = {
  id: number;
  npc_id: number;
  npc_name: string;
  welcome_text: string;
  stock_lines: QffShopPanelLine[];
};

export type QffPendingPrompt = {
  /** "healer_pay" | "innkeeper_stay" */
  kind: string;
  npc_id: number;
  cost: number;
};

export type QffStatBlock = {
  gains: number;
  moves: number;
  guts: number;
  smarts: number;
  sense: number;
  rizz: number;
};

export type QffCharacterProfile = {
  name: string;
  level: number;
  xp: number;
  gold: number;
  /** When true, the hero cannot act until revive. */
  isDead?: boolean;
  /** ISO timestamp for next combat round action, if armed. */
  nextCombatAt?: string | null;
  /** True if 5+ minutes since last command/input (AFK for HUD). */
  isInactive?: boolean;
  curHealth: number;
  maxHealth: number;
  curMana: number;
  maxMana: number;
  /** Sum of armor from equipped items. */
  armorTotal: number;
  class: { slug: string; name: string };
  glyphs: string[];
  equipment_slots: {
    head: string | null;
    mainHand: string | null;
    offHand: string | null;
    chest: string | null;
    feet: string | null;
    ring: string | null;
    amulet: string | null;
  };
  inventory: number[];
  /** Display names in order (most recently stowed first). */
  inventoryItems: string[];
  /** Parallel stack sizes (same order as inventory / inventoryItems). */
  inventoryQuantities?: number[];
  stats: {
    base: QffStatBlock;
    modified: QffStatBlock;
    /** Equipment bonus totals only (same as modified − base when bonuses are additive). */
    bonusSum: QffStatBlock;
  };
};

export type QffSession = QffSessionNoCharacter | QffSessionWithCharacter;

export type QffCommandResponse = {
  messages: string[];
  session: QffSessionWithCharacter;
  /** When true, the client should show the user's raw command line with the messages. */
  echo_command?: boolean;
};

export async function fetchQffSession(accessToken: string | null): Promise<QffSession> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/session/`), {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`QFF session (${response.status}): ${text}`);
  }
  return (await response.json()) as QffSession;
}

/** Bump ``last_activity_at`` so returning from lobby clears AFK kick (GET session does not touch it). */
export async function postQffSessionActivity(accessToken: string | null): Promise<void> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/session/activity/`), {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`QFF session activity (${response.status}): ${text}`);
  }
}

export async function createQffCharacter(
  accessToken: string | null,
  body: { name: string; glyphs: string[] },
): Promise<QffSessionWithCharacter> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/character/`), {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`QFF create (${response.status}): ${text}`);
  }
  return (await response.json()) as QffSessionWithCharacter;
}

export async function deleteQffCharacter(accessToken: string | null): Promise<void> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/character/`), {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (response.status === 204) return;
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`QFF delete character (${response.status}): ${text}`);
  }
}

export async function sendQffCommand(
  accessToken: string | null,
  line: string,
): Promise<QffCommandResponse> {
  const t0 =
    typeof performance !== "undefined" && performance.now ? performance.now() : null;
  const response = await fetch(qffJoinBase(`/api/v1/qff/command/`), {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({ line }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`QFF command (${response.status}): ${text}`);
  }
  const data = (await response.json()) as QffCommandResponse;
  if (import.meta.env.DEV && t0 != null && typeof performance !== "undefined") {
    const ms = Math.round(performance.now() - t0);
    console.debug(`qff.command roundtrip_ms=${ms} (fetch+JSON; use Network tab for TTFB)`);
  }
  return data;
}

export type DmIneffectiveInputRow = {
  id: number;
  user_id: number;
  user_email: string;
  raw_line: string;
  room_id: number | null;
  room_name: string;
  created_at: string;
};

export async function dmFetchIneffectiveInputs(
  accessToken: string | null,
  params?: { limit?: number; offset?: number },
): Promise<{ count: number; results: DmIneffectiveInputRow[] }> {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set("limit", String(params.limit));
  if (params?.offset != null) sp.set("offset", String(params.offset));
  const q = sp.toString();
  const path = `/api/v1/qff/dm/ineffective-inputs/${q ? `?${q}` : ""}`;
  const response = await fetch(qffJoinBase(path), {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as { count: number; results: DmIneffectiveInputRow[] };
}

export async function dmDeleteIneffectiveInput(
  accessToken: string | null,
  id: number,
): Promise<void> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/ineffective-inputs/${id}/`), {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (response.status === 204) return;
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`QFF delete ineffective input (${response.status}): ${text}`);
  }
}

/** --- DM (staff) --- */

export type DmArea = {
  id: number;
  name: string;
  slug: string;
  description: string;
  grid_width: number;
  grid_height: number;
  /** When true, play minimap uses fog-of-war until lit. */
  is_dark_minimap?: boolean;
  theme: QffAreaTheme;
  theme_primary: string;
  theme_secondary: string;
  theme_accent: string;
};

export async function dmFetchAreas(accessToken: string | null): Promise<DmArea[]> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/areas/`), {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmArea[];
}

export async function dmCreateArea(
  accessToken: string | null,
  body: {
    name: string;
    slug: string;
    description?: string;
    grid_width?: number;
    grid_height?: number;
    theme_primary?: string;
    theme_secondary?: string;
    theme_accent?: string;
  },
): Promise<DmArea> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/areas/`), {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Create area (${response.status})`);
  }
  return (await response.json()) as DmArea;
}

export async function dmCreateRoom(
  accessToken: string | null,
  areaId: number,
  body: {
    name: string;
    slug?: string;
    description?: string;
    search_text?: string;
    cell_x?: number;
    cell_y?: number;
  },
): Promise<{ id: number; name: string; slug: string; description: string; search_text: string }> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/areas/${areaId}/rooms/`), {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Create room (${response.status})`);
  }
  return (await response.json()) as {
    id: number;
    name: string;
    slug: string;
    description: string;
    search_text: string;
  };
}

/** Place or move a room to grid cell (same as POST cell). */
export async function dmPlaceRoomInCell(
  accessToken: string | null,
  areaId: number,
  roomId: number,
  x: number,
  y: number,
): Promise<void> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/areas/${areaId}/cells/`), {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({ room_id: roomId, x, y }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Place room (${response.status})`);
  }
}

export async function dmPatchArea(
  accessToken: string | null,
  areaId: number,
  body: Partial<
    Pick<
      DmArea,
      | "name"
      | "slug"
      | "description"
      | "grid_width"
      | "grid_height"
      | "is_dark_minimap"
      | "theme_primary"
      | "theme_secondary"
      | "theme_accent"
    >
  >,
): Promise<DmArea> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/areas/${areaId}/`), {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmArea;
}

/** Full area rooms + exits snapshot (import/export). */
export type DmAreaRoomsJson = {
  version: number;
  format: string;
  area: { id: number; slug: string; name: string };
  rooms: Array<{
    id: number;
    slug: string;
    name: string;
    description: string;
    search_text: string;
    search_chance?: number;
    cell: { x: number; y: number } | null;
    exits: Array<{
      direction: string;
      to_area_slug: string | null;
      to_room_slug: string;
      is_hidden: boolean;
      lock_kind: string;
    }>;
  }>;
};

export async function dmFetchAreaRoomsExportJson(
  accessToken: string | null,
  areaId: number,
): Promise<DmAreaRoomsJson> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/areas/${areaId}/rooms-export/`), {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmAreaRoomsJson;
}

/** Triggers a browser download of `qff-area-<slug>-rooms.json`. */
export async function dmDownloadAreaRoomsJson(
  accessToken: string | null,
  areaId: number,
): Promise<void> {
  const data = await dmFetchAreaRoomsExportJson(accessToken, areaId);
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `qff-area-${data.area.slug || areaId}-rooms.json`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function dmPostAreaRoomsImportJson(
  accessToken: string | null,
  areaId: number,
  payload: DmAreaRoomsJson,
): Promise<{ ok: boolean; area_id: number; rooms_imported: number }> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/areas/${areaId}/rooms-import/`), {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as { ok: boolean; area_id: number; rooms_imported: number };
}

export async function dmFetchCells(
  accessToken: string | null,
  areaId: number,
): Promise<Array<{ id: number; x: number; y: number; room_id: number; room_name: string }>> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/areas/${areaId}/cells/`), {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as Array<{
    id: number;
    x: number;
    y: number;
    room_id: number;
    room_name: string;
  }>;
}

export type DmRoom = {
  id: number;
  name: string;
  slug: string;
  description: string;
  search_text: string;
  search_chance: number;
  permanent_minimap_light?: boolean;
  reset_dark_lighting_on_enter?: boolean;
  is_safe?: boolean;
  is_spawn_point?: boolean;
  monster_lair_template_id?: number | null;
  cell: { id: number; x: number; y: number } | null;
};

export type DmMonsterTemplate = {
  id: number;
  slug: string;
  name: string;
  spawn_cooldown_minutes: number;
  level: number;
  max_hp: number;
  damage_min: number;
  damage_max: number;
  moves: number;
  xp_value: number;
  gold_min: number;
  gold_max: number;
  loot_table: unknown[];
  armor: number;
  accuracy: number;
  penetration?: number;
  crit_chance_bonus_pct?: number;
  crit_damage_bonus?: number;
  dodge_reduction?: number;
  dodge_ignore?: number;
  description?: string;
  hidden_description?: string;
};

export async function dmFetchMonsterTemplates(
  accessToken: string | null,
): Promise<DmMonsterTemplate[]> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/monster-templates/`), {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmMonsterTemplate[];
}

export async function dmPatchMonsterTemplate(
  accessToken: string | null,
  templateId: number,
  body: Partial<DmMonsterTemplate>,
): Promise<DmMonsterTemplate> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/monster-templates/${templateId}/`), {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmMonsterTemplate;
}

export async function dmCreateMonsterTemplate(
  accessToken: string | null,
  body: Partial<DmMonsterTemplate> & { slug: string; name: string },
): Promise<DmMonsterTemplate> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/monster-templates/`), {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmMonsterTemplate;
}

export async function dmFetchRooms(accessToken: string | null, areaId: number): Promise<DmRoom[]> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/areas/${areaId}/rooms/`), {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmRoom[];
}

export async function dmPatchRoom(
  accessToken: string | null,
  roomId: number,
  body: Partial<
    Pick<
      DmRoom,
      | "name"
      | "description"
      | "search_text"
      | "search_chance"
      | "permanent_minimap_light"
      | "reset_dark_lighting_on_enter"
      | "is_safe"
      | "is_spawn_point"
      | "monster_lair_template_id"
    >
  >,
): Promise<void> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/rooms/${roomId}/`), {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
}

export async function dmDeleteRoom(accessToken: string | null, roomId: number): Promise<void> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/rooms/${roomId}/`), {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
}

export type DmExit = {
  id: number;
  direction: string;
  to_room_id: number;
  to_room_name: string;
  is_hidden: boolean;
  lock_kind: string;
  key_item_id: number | null;
  key_item_slug: string | null;
  key_unlock_scope: string;
  device_interactable_id: number | null;
  quest_required_state_id: number | null;
  quest_required_quest_slug: string | null;
  quest_required_state_slug: string | null;
  unlock_duration_seconds: number;
  reveal_item_id: number | null;
  reveal_item_slug: string | null;
  reveal_quest_state_id: number | null;
  reveal_quest_id: number | null;
  reveal_quest_slug: string | null;
  reveal_quest_state_slug: string | null;
};

/** All exits from rooms in an area (map overlay). */
export type DmAreaExit = DmExit & {
  from_room_id: number;
};

export async function dmFetchAreaExits(
  accessToken: string | null,
  areaId: number,
): Promise<DmAreaExit[]> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/areas/${areaId}/exits/`), {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmAreaExit[];
}

export async function dmFetchExits(
  accessToken: string | null,
  roomId: number,
): Promise<DmExit[]> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/rooms/${roomId}/exits/`), {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmExit[];
}

export async function dmCreateExit(
  accessToken: string | null,
  roomId: number,
  body: {
    direction: string;
    to_room_id: number;
    is_hidden?: boolean;
    lock_kind?: string;
  },
): Promise<void> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/rooms/${roomId}/exits/`), {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
}

export async function dmDeleteExit(accessToken: string | null, exitId: number): Promise<void> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/exits/${exitId}/`), {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
}

export async function dmPatchExit(
  accessToken: string | null,
  exitId: number,
  body: Partial<{
    is_hidden: boolean;
    lock_kind: string;
    direction: string;
    to_room_id: number;
    key_item_id: number | null;
    key_unlock_scope: string;
    device_interactable_id: number | null;
    quest_required_state_id: number | null;
    unlock_duration_seconds: number;
    reveal_item_id: number | null;
    reveal_quest_state_id: number | null;
  }>,
): Promise<DmExit> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/exits/${exitId}/`), {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmExit;
}

export type DmItem = {
  id: number;
  slug: string;
  name: string;
  item_type: string;
  /** Null = cannot be equipped (quest item, consumable without wear slot, etc.). */
  slot: string | null;
  consumable: boolean;
  /** eat | drink | use | "" (any) */
  consume_verb?: string;
  stackable: boolean;
  max_stack: number;
  extra_data: Record<string, unknown>;
  cost: number;
  description: string;
  lore: string;
  lore_chance: number | null;
  rarity: string;
  damage: number;
  dmg_type: string;
  armor: number;
  element: string;
  hidden_special_effect: string;
  hidden_bonus_stat: string;
  hidden_bonus_value: number;
  two_handed: boolean;
  req_gains: number | null;
  req_moves: number | null;
  req_guts: number | null;
  req_smarts: number | null;
  req_sense: number | null;
  req_rizz: number | null;
  bonus_gains: number;
  bonus_moves: number;
  bonus_guts: number;
  bonus_smarts: number;
  bonus_sense: number;
  bonus_rizz: number;
  weapon_accuracy: number;
  crit_chance_bonus_pct: number;
  crit_damage_bonus: number;
  penetration: number;
  dodge_bonus: number;
  dodge_reduction: number;
  dodge_ignore: number;
  unsellable: boolean;
  vendor_refuses_buy: boolean;
};

export async function dmFetchItems(accessToken: string | null): Promise<DmItem[]> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/items/`), {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmItem[];
}

export async function dmCreateItem(
  accessToken: string | null,
  body: Partial<DmItem> & { slug: string; name: string },
): Promise<DmItem> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/items/`), {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmItem;
}

export async function dmPatchItem(
  accessToken: string | null,
  itemId: number,
  body: Partial<DmItem>,
): Promise<DmItem> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/items/${itemId}/`), {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmItem;
}

export async function dmDeleteItem(accessToken: string | null, itemId: number): Promise<void> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/items/${itemId}/`), {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (response.status === 204) return;
  if (!response.ok) throw new Error(await response.text());
}

/** Unowned item instances lying on the floor of a room (players use `get` to pick up). */
export type DmFloorItem = {
  id: number;
  item_id: number;
  item_slug: string;
  item_name: string;
  quantity: number;
  nickname: string;
  visible_quest_state_id: number | null;
  visible_quest_id: number | null;
  visible_quest_slug: string | null;
  visible_quest_state_slug: string | null;
};

export async function dmFetchRoomFloorItems(
  accessToken: string | null,
  roomId: number,
): Promise<DmFloorItem[]> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/rooms/${roomId}/floor-items/`), {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmFloorItem[];
}

export async function dmCreateRoomFloorItem(
  accessToken: string | null,
  roomId: number,
  body: {
    item_id: number;
    nickname?: string;
    visible_quest_state_id?: number | null;
  },
): Promise<DmFloorItem> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/rooms/${roomId}/floor-items/`), {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmFloorItem;
}

export async function dmPatchFloorItem(
  accessToken: string | null,
  instanceId: number,
  body: { visible_quest_state_id?: number | null },
): Promise<DmFloorItem> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/floor-items/${instanceId}/`), {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmFloorItem;
}

export async function dmDeleteFloorItem(accessToken: string | null, instanceId: number): Promise<void> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/floor-items/${instanceId}/`), {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (response.status === 204) return;
  if (!response.ok) throw new Error(await response.text());
}

/** Room-tagged item template; each player gets a new instance on get (not a shared floor row). */
export type DmRoomItem = {
  id: number;
  room_id: number;
  item_id: number;
  item_slug: string;
  item_name: string;
  nickname: string;
  visible_quest_state_id: number | null;
  visible_quest_id: number | null;
  visible_quest_slug: string | null;
  visible_quest_state_slug: string | null;
  allow_repeat_while_carrying: boolean;
};

export async function dmFetchRoomRoomItems(
  accessToken: string | null,
  roomId: number,
): Promise<DmRoomItem[]> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/rooms/${roomId}/room-items/`), {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmRoomItem[];
}

export async function dmCreateRoomRoomItem(
  accessToken: string | null,
  roomId: number,
  body: {
    item_id: number;
    nickname?: string;
    visible_quest_state_id?: number | null;
    allow_repeat_while_carrying?: boolean;
  },
): Promise<DmRoomItem> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/rooms/${roomId}/room-items/`), {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmRoomItem;
}

export async function dmPatchRoomItem(
  accessToken: string | null,
  roomItemId: number,
  body: {
    nickname?: string;
    visible_quest_state_id?: number | null;
    allow_repeat_while_carrying?: boolean;
  },
): Promise<DmRoomItem> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/room-items/${roomItemId}/`), {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmRoomItem;
}

export async function dmDeleteRoomItem(accessToken: string | null, roomItemId: number): Promise<void> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/room-items/${roomItemId}/`), {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (response.status === 204) return;
  if (!response.ok) throw new Error(await response.text());
}

export type DmCharacterClass = {
  id: number;
  slug: string;
  name: string;
  sort_order: number;
  description: string;
  priority_stat_1: string;
  priority_stat_2: string;
  starter_chest_item_id: number | null;
  starter_main_hand_item_id: number | null;
  extra_data: Record<string, unknown>;
};

export async function dmFetchClasses(accessToken: string | null): Promise<DmCharacterClass[]> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/classes/`), {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmCharacterClass[];
}

export async function dmCreateClass(
  accessToken: string | null,
  body: Partial<DmCharacterClass> & { slug: string; name: string },
): Promise<DmCharacterClass> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/classes/`), {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmCharacterClass;
}

export async function dmPatchClass(
  accessToken: string | null,
  classId: number,
  body: Partial<DmCharacterClass> & { extra_data?: Record<string, unknown> },
): Promise<DmCharacterClass> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/classes/${classId}/`), {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmCharacterClass;
}

export async function dmDeleteClass(accessToken: string | null, classId: number): Promise<void> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/classes/${classId}/`), {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (response.status === 204) return;
  if (!response.ok) throw new Error(await response.text());
}

function _downloadJsonBlob(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function dmDownloadItemsJsonExport(accessToken: string | null): Promise<void> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/items-export/`), {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  _downloadJsonBlob(data, "qff-items.json");
}

export async function dmDownloadClassesJsonExport(accessToken: string | null): Promise<void> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/classes-export/`), {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  _downloadJsonBlob(data, "qff-classes.json");
}

export async function dmDownloadQuestWorldJsonExport(accessToken: string | null): Promise<void> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/quest-world-export/`), {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  _downloadJsonBlob(data, "qff-quest-world.json");
}

export type DmQuestSummary = { id: number; slug: string; name: string; state_count: number };

export async function dmFetchQuests(accessToken: string | null): Promise<DmQuestSummary[]> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/quests/`), {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmQuestSummary[];
}

export type DmQuestState = {
  id: number;
  slug: string;
  name: string;
  is_initial: boolean;
  is_terminal: boolean;
  sort_order: number;
};

export type DmQuestEffectRow = {
  id: number;
  kind: string;
  amount: number;
  item_id: number | null;
  room_exit_id: number | null;
  sort_order: number;
};

export type DmQuestTransitionRow = {
  id: number;
  from_state_id: number;
  to_state_id: number;
  requires_item_id: number | null;
  sort_order: number;
  effects: DmQuestEffectRow[];
};

export type DmQuestDetail = {
  id: number;
  slug: string;
  name: string;
  description: string;
  states: DmQuestState[];
  transitions: DmQuestTransitionRow[];
};

export async function dmFetchQuestDetail(
  accessToken: string | null,
  questId: number,
): Promise<DmQuestDetail> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/quests/${questId}/`), {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmQuestDetail;
}

export async function dmCreateQuest(
  accessToken: string | null,
  body: { slug: string; name: string; description?: string },
): Promise<DmQuestDetail> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/quests/`), {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmQuestDetail;
}

export async function dmPatchQuest(
  accessToken: string | null,
  questId: number,
  body: Partial<Pick<DmQuestDetail, "slug" | "name" | "description">>,
): Promise<DmQuestDetail> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/quests/${questId}/`), {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmQuestDetail;
}

export async function dmDeleteQuest(accessToken: string | null, questId: number): Promise<void> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/quests/${questId}/`), {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (response.status === 204) return;
  if (!response.ok) throw new Error(await response.text());
}

export async function dmCreateQuestState(
  accessToken: string | null,
  questId: number,
  body: {
    slug: string;
    name?: string;
    is_initial?: boolean;
    is_terminal?: boolean;
    sort_order?: number;
  },
): Promise<DmQuestState> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/quests/${questId}/states/`), {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmQuestState;
}

export async function dmPatchQuestState(
  accessToken: string | null,
  stateId: number,
  body: Partial<
    Pick<DmQuestState, "slug" | "name" | "is_initial" | "is_terminal" | "sort_order">
  >,
): Promise<DmQuestState> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/quest-states/${stateId}/`), {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmQuestState;
}

export async function dmDeleteQuestState(accessToken: string | null, stateId: number): Promise<void> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/quest-states/${stateId}/`), {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (response.status === 204) return;
  if (!response.ok) throw new Error(await response.text());
}

export async function dmCreateQuestTransition(
  accessToken: string | null,
  questId: number,
  body: {
    from_state_id: number;
    to_state_id: number;
    requires_item_id?: number | null;
    sort_order?: number;
  },
): Promise<DmQuestTransitionRow> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/quests/${questId}/transitions/`), {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmQuestTransitionRow;
}

export async function dmPatchQuestTransition(
  accessToken: string | null,
  transitionId: number,
  body: Partial<
    Pick<DmQuestTransitionRow, "from_state_id" | "to_state_id" | "requires_item_id" | "sort_order">
  >,
): Promise<DmQuestTransitionRow> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/quest-transitions/${transitionId}/`), {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmQuestTransitionRow;
}

export async function dmDeleteQuestTransition(
  accessToken: string | null,
  transitionId: number,
): Promise<void> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/quest-transitions/${transitionId}/`), {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (response.status === 204) return;
  if (!response.ok) throw new Error(await response.text());
}

export async function dmCreateQuestEffect(
  accessToken: string | null,
  transitionId: number,
  body: {
    kind: string;
    amount?: number;
    item_id?: number | null;
    room_exit_id?: number | null;
    sort_order?: number;
  },
): Promise<DmQuestEffectRow> {
  const response = await fetch(
    qffJoinBase(`/api/v1/qff/dm/quest-transitions/${transitionId}/effects/`),
    {
      method: "POST",
      headers: authHeaders(accessToken),
      credentials: "omit",
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmQuestEffectRow;
}

export async function dmPatchQuestEffect(
  accessToken: string | null,
  effectId: number,
  body: Partial<
    Pick<DmQuestEffectRow, "kind" | "amount" | "item_id" | "room_exit_id" | "sort_order">
  >,
): Promise<DmQuestEffectRow> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/quest-effects/${effectId}/`), {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmQuestEffectRow;
}

export async function dmDeleteQuestEffect(accessToken: string | null, effectId: number): Promise<void> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/quest-effects/${effectId}/`), {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (response.status === 204) return;
  if (!response.ok) throw new Error(await response.text());
}

export type DmNpcRow = {
  id: number;
  room_id: number;
  slug: string;
  name: string;
  description: string;
  is_trainer?: boolean;
  is_healer?: boolean;
  is_innkeeper?: boolean;
  /** Gold to heal (healer) or stay the night (innkeeper). 0 = free. */
  healing_cost?: number;
};

export type DmNpcDialogue = {
  id: number;
  quest_id: number | null;
  quest_state_id: number | null;
  priority: number;
  text: string;
};

export type DmNpcDetail = DmNpcRow & {
  dialogues: DmNpcDialogue[];
};

/** Rooms from all areas, sorted by area name then room name (for NPC room picker). */
export async function dmFetchAllDmRooms(
  accessToken: string | null,
): Promise<Array<{ id: number; name: string; area_id: number; area_name: string }>> {
  const areas = await dmFetchAreas(accessToken);
  const chunks = await Promise.all(
    areas.map(async (a) => {
      const rooms = await dmFetchRooms(accessToken, a.id);
      return rooms.map((r) => ({
        id: r.id,
        name: r.name,
        area_id: a.id,
        area_name: a.name,
      }));
    }),
  );
  return chunks.flat().sort((x, y) => {
    const c = x.area_name.localeCompare(y.area_name);
    if (c !== 0) return c;
    return x.name.localeCompare(y.name);
  });
}

export async function dmFetchNpcs(
  accessToken: string | null,
  roomId?: number,
): Promise<DmNpcRow[]> {
  let path = qffJoinBase(`/api/v1/qff/dm/npcs/`);
  if (roomId != null) {
    path += `?${new URLSearchParams({ room_id: String(roomId) })}`;
  }
  const response = await fetch(path, {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmNpcRow[];
}

export async function dmFetchNpcDetail(
  accessToken: string | null,
  npcId: number,
): Promise<DmNpcDetail> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/npcs/${npcId}/`), {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmNpcDetail;
}

export async function dmCreateNpc(
  accessToken: string | null,
  body: {
    room_id: number;
    slug: string;
    name: string;
    description?: string;
    is_trainer?: boolean;
    is_healer?: boolean;
    is_innkeeper?: boolean;
    healing_cost?: number;
  },
): Promise<DmNpcRow> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/npcs/`), {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmNpcRow;
}

export async function dmPatchNpc(
  accessToken: string | null,
  npcId: number,
  body: Partial<
    Pick<
      DmNpcRow,
      | "room_id"
      | "slug"
      | "name"
      | "description"
      | "is_trainer"
      | "is_healer"
      | "is_innkeeper"
      | "healing_cost"
    >
  >,
): Promise<DmNpcDetail> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/npcs/${npcId}/`), {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmNpcDetail;
}

export async function dmDeleteNpc(accessToken: string | null, npcId: number): Promise<void> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/npcs/${npcId}/`), {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (response.status === 204) return;
  if (!response.ok) throw new Error(await response.text());
}

export async function dmCreateNpcDialogue(
  accessToken: string | null,
  npcId: number,
  body: {
    text: string;
    priority?: number;
    quest_id?: number | null;
    quest_state_id?: number | null;
  },
): Promise<DmNpcDialogue> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/npcs/${npcId}/dialogues/`), {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmNpcDialogue;
}

export async function dmPatchNpcDialogue(
  accessToken: string | null,
  dialogueId: number,
  body: Partial<Pick<DmNpcDialogue, "text" | "priority" | "quest_id" | "quest_state_id">>,
): Promise<DmNpcDialogue> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/npc-dialogues/${dialogueId}/`), {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmNpcDialogue;
}

export async function dmDeleteNpcDialogue(
  accessToken: string | null,
  dialogueId: number,
): Promise<void> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/npc-dialogues/${dialogueId}/`), {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (response.status === 204) return;
  if (!response.ok) throw new Error(await response.text());
}

export type DmNpcShopPickerRow = {
  id: number;
  slug: string;
  name: string;
  room_id: number;
  room_name: string;
  area_name: string;
  has_shop: boolean;
};

export type DmNpcShopStockLine = {
  id: number;
  item_id: number;
  item_name: string;
  item_slug: string;
  price: number;
  quantity: number | null;
  sort_order: number;
  kind: string;
  times_shown_without_sale: number;
  consignment_item_instance_id: number | null;
};

export type DmNpcShopDetail = {
  id: number;
  npc_id: number;
  welcome_text: string;
  enabled: boolean;
  sell_price_percent: number;
  stock_lines: DmNpcShopStockLine[];
};

export async function dmFetchNpcShopPicker(
  accessToken: string | null,
): Promise<DmNpcShopPickerRow[]> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/npc-shop-picker/`), {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmNpcShopPickerRow[];
}

export async function dmFetchNpcShop(
  accessToken: string | null,
  npcId: number,
): Promise<DmNpcShopDetail | null> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/npcs/${npcId}/shop/`), {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmNpcShopDetail;
}

export async function dmCreateNpcShop(
  accessToken: string | null,
  npcId: number,
  body: Partial<Pick<DmNpcShopDetail, "welcome_text" | "enabled" | "sell_price_percent">>,
): Promise<DmNpcShopDetail> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/npcs/${npcId}/shop/`), {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmNpcShopDetail;
}

export async function dmPatchNpcShop(
  accessToken: string | null,
  npcId: number,
  body: Partial<Pick<DmNpcShopDetail, "welcome_text" | "enabled" | "sell_price_percent">>,
): Promise<DmNpcShopDetail> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/npcs/${npcId}/shop/`), {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmNpcShopDetail;
}

export async function dmCreateNpcShopStockLine(
  accessToken: string | null,
  npcId: number,
  body: {
    item_id: number;
    price: number;
    quantity?: number | null;
    sort_order?: number;
  },
): Promise<DmNpcShopStockLine> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/npcs/${npcId}/shop/stock-lines/`), {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmNpcShopStockLine;
}

export async function dmPatchNpcShopStockLine(
  accessToken: string | null,
  lineId: number,
  body: Partial<
    Pick<DmNpcShopStockLine, "item_id" | "price" | "quantity" | "sort_order">
  >,
): Promise<DmNpcShopStockLine> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/npc-shop-stock-lines/${lineId}/`), {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmNpcShopStockLine;
}

export async function dmDeleteNpcShopStockLine(
  accessToken: string | null,
  lineId: number,
): Promise<void> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/npc-shop-stock-lines/${lineId}/`), {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (response.status === 204) return;
  if (!response.ok) throw new Error(await response.text());
}

export type DmInteractableRow = {
  id: number;
  room_id: number;
  slug: string;
  name: string;
  kind: string;
  inspect_text: string;
  read_text: string;
  map_reveal_minutes: number | null;
  quest_transition_id: number | null;
  unlocks_exit_id: number | null;
};

export async function dmFetchInteractables(
  accessToken: string | null,
  roomId?: number,
): Promise<DmInteractableRow[]> {
  let path = qffJoinBase(`/api/v1/qff/dm/interactables/`);
  if (roomId != null) {
    path += `?${new URLSearchParams({ room_id: String(roomId) })}`;
  }
  const response = await fetch(path, {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmInteractableRow[];
}

export async function dmPatchInteractable(
  accessToken: string | null,
  id: number,
  body: Record<string, unknown>,
): Promise<DmInteractableRow> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/interactables/${id}/`), {
    method: "PATCH",
    headers: { ...authHeaders(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmInteractableRow;
}

export async function dmCreateInteractable(
  accessToken: string | null,
  body: Record<string, unknown>,
): Promise<DmInteractableRow> {
  const response = await fetch(qffJoinBase(`/api/v1/qff/dm/interactables/`), {
    method: "POST",
    headers: { ...authHeaders(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmInteractableRow;
}
