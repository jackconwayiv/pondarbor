/** QFF API client — same auth pattern as clicker/whatif. */

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
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
  character_classes: QffCharacterClass[];
};

export type QffExit = {
  direction: string;
  label: string;
  to_room_id: number;
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
    spawn_room: { id: number; name: string };
  };
  room: { id: number; name: string; description: string; youSee: string[] };
  area: { id: number; name: string; theme: QffAreaTheme };
  exits: QffExit[];
  others_here: string[];
  /** One minimap grid per visited area; current_area_id marks where the player is. */
  area_map: {
    current_area_id: number;
    grids: QffAreaMapGrid[];
  };
  character_profile: QffCharacterProfile;
  action_log: string[];
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
  curHealth: number;
  maxHealth: number;
  curMana: number;
  maxMana: number;
  /** Sum of armor from equipped items. */
  armorTotal: number;
  class: { slug: string; name: string };
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
};

export async function fetchQffSession(accessToken: string | null): Promise<QffSession> {
  const response = await fetch(`${apiBase()}/api/v1/qff/session/`, {
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

export async function createQffCharacter(
  accessToken: string | null,
  body: { name: string; character_class: string },
): Promise<QffSessionWithCharacter> {
  const response = await fetch(`${apiBase()}/api/v1/qff/character/`, {
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
  const response = await fetch(`${apiBase()}/api/v1/qff/character/`, {
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
  const response = await fetch(`${apiBase()}/api/v1/qff/command/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({ line }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`QFF command (${response.status}): ${text}`);
  }
  return (await response.json()) as QffCommandResponse;
}

/** --- DM (staff) --- */

export type DmArea = {
  id: number;
  name: string;
  slug: string;
  description: string;
  grid_width: number;
  grid_height: number;
  theme: QffAreaTheme;
  theme_primary: string;
  theme_secondary: string;
  theme_accent: string;
};

export async function dmFetchAreas(accessToken: string | null): Promise<DmArea[]> {
  const response = await fetch(`${apiBase()}/api/v1/qff/dm/areas/`, {
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
  const response = await fetch(`${apiBase()}/api/v1/qff/dm/areas/`, {
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
  const response = await fetch(`${apiBase()}/api/v1/qff/dm/areas/${areaId}/rooms/`, {
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
  const response = await fetch(`${apiBase()}/api/v1/qff/dm/areas/${areaId}/cells/`, {
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
      | "theme_primary"
      | "theme_secondary"
      | "theme_accent"
    >
  >,
): Promise<DmArea> {
  const response = await fetch(`${apiBase()}/api/v1/qff/dm/areas/${areaId}/`, {
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
  const response = await fetch(`${apiBase()}/api/v1/qff/dm/areas/${areaId}/rooms-export/`, {
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
  const response = await fetch(`${apiBase()}/api/v1/qff/dm/areas/${areaId}/rooms-import/`, {
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
  const response = await fetch(`${apiBase()}/api/v1/qff/dm/areas/${areaId}/cells/`, {
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
  cell: { id: number; x: number; y: number } | null;
};

export async function dmFetchRooms(accessToken: string | null, areaId: number): Promise<DmRoom[]> {
  const response = await fetch(`${apiBase()}/api/v1/qff/dm/areas/${areaId}/rooms/`, {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmRoom[];
}

export async function dmPatchRoom(
  accessToken: string | null,
  roomId: number,
  body: Partial<Pick<DmRoom, "name" | "description" | "search_text" | "search_chance">>,
): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/qff/dm/rooms/${roomId}/`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
}

export async function dmDeleteRoom(accessToken: string | null, roomId: number): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/qff/dm/rooms/${roomId}/`, {
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
};

/** All exits from rooms in an area (map overlay). */
export type DmAreaExit = DmExit & {
  from_room_id: number;
};

export async function dmFetchAreaExits(
  accessToken: string | null,
  areaId: number,
): Promise<DmAreaExit[]> {
  const response = await fetch(`${apiBase()}/api/v1/qff/dm/areas/${areaId}/exits/`, {
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
  const response = await fetch(`${apiBase()}/api/v1/qff/dm/rooms/${roomId}/exits/`, {
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
  const response = await fetch(`${apiBase()}/api/v1/qff/dm/rooms/${roomId}/exits/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
}

export async function dmDeleteExit(accessToken: string | null, exitId: number): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/qff/dm/exits/${exitId}/`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
}

export type DmItem = {
  id: number;
  slug: string;
  name: string;
  item_type: string;
  slot: string;
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
};

export async function dmFetchItems(accessToken: string | null): Promise<DmItem[]> {
  const response = await fetch(`${apiBase()}/api/v1/qff/dm/items/`, {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmItem[];
}

export async function dmCreateItem(
  accessToken: string | null,
  body: Partial<DmItem> & { slug: string; name: string; slot: string },
): Promise<DmItem> {
  const response = await fetch(`${apiBase()}/api/v1/qff/dm/items/`, {
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
  const response = await fetch(`${apiBase()}/api/v1/qff/dm/items/${itemId}/`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmItem;
}

export async function dmDeleteItem(accessToken: string | null, itemId: number): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/qff/dm/items/${itemId}/`, {
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
  const response = await fetch(`${apiBase()}/api/v1/qff/dm/classes/`, {
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
  const response = await fetch(`${apiBase()}/api/v1/qff/dm/classes/`, {
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
  const response = await fetch(`${apiBase()}/api/v1/qff/dm/classes/${classId}/`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as DmCharacterClass;
}

export async function dmDeleteClass(accessToken: string | null, classId: number): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/qff/dm/classes/${classId}/`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (response.status === 204) return;
  if (!response.ok) throw new Error(await response.text());
}
