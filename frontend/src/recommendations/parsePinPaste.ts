export type ParsedPinPaste = {
  lat: number;
  lng: number;
  /** Place name extracted from a maps URL, if any. */
  label?: string;
};

function validCoord(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function tryPair(a: string, b: string): ParsedPinPaste | null {
  const lat = Number.parseFloat(a);
  const lng = Number.parseFloat(b);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!validCoord(lat, lng)) return null;
  return { lat, lng };
}

/** Prefer place pin coords from Google Maps URLs over map viewport @lat,lng. */
function extractGoogleMapsCoords(decoded: string): ParsedPinPaste | null {
  const dataMatch = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (dataMatch) return tryPair(dataMatch[1]!, dataMatch[2]!);

  const placeAt =
    decoded.match(/\/maps\/place\/[^/@]+\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ??
    decoded.match(/\/place\/[^/@]+\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (placeAt) return tryPair(placeAt[1]!, placeAt[2]!);

  const atMatches = [...decoded.matchAll(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)];
  if (atMatches.length > 1) {
    const last = atMatches.at(-1)!;
    return tryPair(last[1]!, last[2]!);
  }
  if (atMatches.length === 1) {
    return tryPair(atMatches[0]![1]!, atMatches[0]![2]!);
  }
  return null;
}

/** Parse pasted pin text: raw coordinates, geo URIs, Apple/Google Maps links, etc. */
export function parsePinPaste(raw: string): ParsedPinPaste | null {
  const text = raw.trim();
  if (!text) return null;

  // geo:33.4484,-112.0740
  const geoMatch = text.match(/^geo:(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i);
  if (geoMatch) return tryPair(geoMatch[1]!, geoMatch[2]!);

  // Plain "33.4484, -112.0740" or "33.4484 -112.0740"
  const plainComma = text.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (plainComma) return tryPair(plainComma[1]!, plainComma[2]!);

  const plainSpace = text.match(/^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/);
  if (plainSpace) return tryPair(plainSpace[1]!, plainSpace[2]!);

  const decoded = decodeURIComponent(text);

  const mapsCoords = extractGoogleMapsCoords(decoded);
  if (mapsCoords) {
    const placeMatch = decoded.match(/\/maps\/place\/([^/@?]+)/);
    if (placeMatch) {
      mapsCoords.label = placeMatch[1]!.replace(/\+/g, " ").trim();
    }
    return mapsCoords;
  }

  // ?q=lat,lng or &q=lat,lng
  const qMatch = decoded.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (qMatch) return tryPair(qMatch[1]!, qMatch[2]!);

  // Apple Maps ll=lat,lng or ll=lat%2Clng
  const llMatch = decoded.match(/[?&]ll=(-?\d+(?:\.\d+)?)[,%2C](-?\d+(?:\.\d+)?)/i);
  if (llMatch) return tryPair(llMatch[1]!, llMatch[2]!);

  // center=lat,lng (some embed/share links)
  const centerMatch = decoded.match(/[?&]center=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
  if (centerMatch) return tryPair(centerMatch[1]!, centerMatch[2]!);

  return null;
}

export function looksLikeMapsLink(raw: string): boolean {
  const text = raw.trim().toLowerCase();
  return (
    /^https?:\/\//.test(text) &&
    (text.includes("maps.apple.com") ||
      text.includes("maps.google") ||
      text.includes("google.com/maps") ||
      text.includes("maps.app.goo.gl") ||
      text.includes("goo.gl/maps") ||
      text.startsWith("geo:"))
  );
}

export type ParsedPlacePaste = {
  title: string;
  address: string;
};

/** Parse "Name, street, city, state zip" without geocoding. */
export function parsePlacePaste(raw: string): ParsedPlacePaste | null {
  const text = raw.trim();
  if (!text || looksLikeMapsLink(text) || parsePinPaste(text)) return null;
  if (!text.includes(",")) return null;

  const firstComma = text.indexOf(",");
  const first = text.slice(0, firstComma).trim();
  const rest = text.slice(firstComma + 1).trim();
  if (!first || !rest) return null;

  if (/^\d/.test(first)) {
    return { title: "", address: text };
  }
  return { title: first, address: rest };
}

export function looksLikePlacePaste(raw: string): boolean {
  return parsePlacePaste(raw) !== null;
}
