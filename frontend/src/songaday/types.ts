export type SongadayUserRow = {
  id: number;
  email: string;
  nickname: string;
  avatar_url: string;
};

export type SongadayResponse = {
  id: number;
  user: SongadayUserRow;
  prompt_id: number;
  entry_date: string;
  prompt_snapshot: string;
  notes: string;
  artist: string;
  title: string;
  raw_label: string;
  youtube_video_id: string;
  spotify_url: string;
  apple_music_url: string;
  edited: boolean;
  created_at: string;
  updated_at: string;
  heart_count: number;
  viewer_has_hearted: boolean;
};

export type SongadayPromptPayload = {
  id?: number;
  prompt: string | null;
  month: number;
  day: number;
};

/** Row from staff-only `GET /prompts/list/`. */
export type SongPromptCatalogRow = {
  month: number;
  day: number;
  prompt: string;
};

export type ParsedSongFields = {
  artist: string;
  title: string;
  raw_label: string;
  youtube_video_id: string;
  spotify_url: string;
  apple_music_url: string;
};

export type SongadayArchiveListResponse = {
  results: SongadayResponse[];
  page: number;
  page_size: number;
  total: number;
  has_next: boolean;
  has_prev: boolean;
};
