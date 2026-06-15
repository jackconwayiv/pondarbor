export type CalendarOwnerRow = {
  id: number;
  display_name: string;
  avatar_url: string;
  calendar_display_source_names?: boolean;
};

export type CalendarColor = "lilypad" | "sky" | "nautical" | "gray";

export type CalendarSourceType = "ical" | "manual" | "google_oauth";

export type CalendarSource = {
  id: number;
  owner: CalendarOwnerRow;
  source_type: CalendarSourceType;
  display_name: string;
  color: CalendarColor;
  is_active: boolean;
  last_synced_at: string | null;
  last_error: string;
  created_at: string;
  updated_at: string;
};

/**
 * Date-only "busy" event. The API returns `title` only for manual events
 * owned by the requesting user — for any shared/iCal-imported event, `title`
 * is always `null`.
 */
export type CalendarEvent = {
  id: number;
  owner: CalendarOwnerRow;
  source_id: number;
  source_display_name: string;
  source_type: CalendarSourceType;
  is_manual: boolean;
  title: string | null;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD, inclusive
};

export type CalendarBirthdayRow = {
  user_id: number;
  display_name: string;
  birth_month: number;
  birth_day: number;
};

export type EventWritePayload = {
  title?: string;
  start_date: string;
  end_date: string;
};

export type SourceCreatePayload = {
  display_name: string;
  ical_url: string;
  color?: CalendarColor;
};

export type SourceUpdatePayload = {
  display_name: string;
};

export type SourceSyncSummary = {
  created: number;
  updated: number;
  deleted: number;
  not_modified: boolean;
};

export type CalendarSyncSummary = {
  sources_processed: number;
  sources_ok: number;
  sources_failed: number;
  created: number;
  updated: number;
  deleted: number;
};

export type CalendarFeedSubscription = {
  subscribe_url: string;
  webcal_url: string;
  owner_ids: number[];
  include_all_visible: boolean;
  updated_at: string;
};

export type CalendarFeedUpsertPayload = {
  include_all_visible: boolean;
  owner_ids?: number[];
};
