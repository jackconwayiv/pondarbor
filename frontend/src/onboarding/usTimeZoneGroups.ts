export type UsTimeZoneOption = {
  id: string;
  label: string;
  iana: string;
};

export const US_TIME_ZONE_OPTIONS: UsTimeZoneOption[] = [
  { id: "et", label: "Eastern", iana: "America/New_York" },
  { id: "ct", label: "Central", iana: "America/Chicago" },
  { id: "mt", label: "Mountain", iana: "America/Denver" },
  { id: "az", label: "Arizona", iana: "America/Phoenix" },
  { id: "pt", label: "Pacific", iana: "America/Los_Angeles" },
  { id: "ak", label: "Alaska", iana: "America/Anchorage" },
  { id: "hi", label: "Hawaii", iana: "Pacific/Honolulu" },
];

const US_IANA = new Set(US_TIME_ZONE_OPTIONS.map((z) => z.iana));

export function isUsTimeZone(iana: string): boolean {
  return US_IANA.has(iana);
}
