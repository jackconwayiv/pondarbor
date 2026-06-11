/** IANA time zones for profile dropdown; uses Intl when available. */
const FALLBACK_ZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export function getSortedIanaTimeZones(): string[] {
  try {
    const supported = (
      Intl as unknown as {
        supportedValuesOf?: (key: string) => string[];
      }
    ).supportedValuesOf;
    if (typeof supported === "function") {
      return supported.call(Intl, "timeZone").slice().sort();
    }
  } catch {
    /* ignore */
  }
  return [...FALLBACK_ZONES];
}

/** Ensure a saved value not in the standard list still appears once (legacy data). */
export function timeZoneOptionsForValue(
  current: string | undefined,
  zones: string[],
): string[] {
  const z = (current ?? "").trim();
  if (z && !zones.includes(z)) {
    return [z, ...zones];
  }
  return zones;
}

const timeInZoneFormatters = new Map<string, Intl.DateTimeFormat>();

/** Localized current clock time for an IANA zone, e.g. "2:34 PM". */
export function formatCurrentTimeInTimeZone(
  iana: string,
  now: Date = new Date(),
): string {
  const zone = iana.trim();
  if (!zone) return "";
  try {
    let formatter = timeInZoneFormatters.get(zone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat(undefined, {
        timeZone: zone,
        hour: "numeric",
        minute: "2-digit",
      });
      timeInZoneFormatters.set(zone, formatter);
    }
    return formatter.format(now);
  } catch {
    return "";
  }
}
