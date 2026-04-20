export type CalendarOwnerRow = {
  id: number;
  email: string;
  display_name: string;
  avatar_url: string;
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

export type CalendarEvent = {
  id: number;
  owner: CalendarOwnerRow;
  source: number;
  source_display_name: string;
  source_type: CalendarSourceType;
  color: CalendarColor;
  external_uid: string;
  title: string;
  location: string;
  notes: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  is_manual: boolean;
  source_timezone: string;
  created_at: string;
  updated_at: string;
};

export type EventWritePayload = {
  title: string;
  location?: string;
  notes?: string;
  start_at: string;
  end_at: string;
  all_day?: boolean;
};

export type SourceCreatePayload = {
  display_name: string;
  ical_url: string;
  color?: CalendarColor;
};

export type SourceSyncSummary = {
  created: number;
  updated: number;
  deleted: number;
  not_modified: boolean;
};
