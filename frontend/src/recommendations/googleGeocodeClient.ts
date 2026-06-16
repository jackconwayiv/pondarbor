/** Client-side geocode via Maps JavaScript API (works with referrer-restricted browser keys). */

export type ClientGeocodeResult = {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId: string;
};

export type ClientGeocodeResponse =
  | { ok: true; result: ClientGeocodeResult }
  | { ok: false; status: string };

type GoogleGeocoderLocation =
  | { lat: number; lng: number }
  | { lat: () => number; lng: () => number };

type GoogleGeocoderResult = {
  formatted_address?: string;
  place_id?: string;
  geometry?: { location?: GoogleGeocoderLocation };
};

type GoogleGeocoderInstance = {
  geocode: (
    request: { address?: string; location?: { lat: number; lng: number } },
    callback?: (results: GoogleGeocoderResult[] | null, status: string) => void,
  ) => Promise<{ results: GoogleGeocoderResult[] }> | void;
};

declare global {
  interface Window {
    google?: {
      maps: {
        Geocoder: new () => GoogleGeocoderInstance;
        importLibrary?: (name: string) => Promise<{ Geocoder: new () => GoogleGeocoderInstance }>;
      };
    };
  }
}

let loaderPromise: Promise<void> | null = null;
let loadedApiKey: string | null = null;

function readCoord(location: GoogleGeocoderLocation, axis: "lat" | "lng"): number {
  const value = location[axis];
  return typeof value === "function" ? value.call(location) : value;
}

function parseTopResult(results: GoogleGeocoderResult[]): ClientGeocodeResult | null {
  const top = results[0];
  const location = top?.geometry?.location;
  if (!top || !location) return null;
  const lat = readCoord(location, "lat");
  const lng = readCoord(location, "lng");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    formattedAddress: (top.formatted_address ?? "").trim(),
    placeId: (top.place_id ?? "").trim(),
  };
}

export function clientGeocodeErrorHint(status: string): string {
  if (status === "REQUEST_DENIED" || status.includes("RefererNotAllowed")) {
    return (
      "Browser geocode was denied — enable Maps JavaScript API and Geocoding API on your key, " +
      "and add this site to HTTP referrer restrictions."
    );
  }
  if (status === "OVER_QUERY_LIMIT") {
    return "Geocode quota exceeded — try again later or post without map coordinates.";
  }
  if (status === "ZERO_RESULTS") {
    return "No map match for that address — you can still post without coordinates.";
  }
  return "Could not geocode in the browser — you can still post without map coordinates.";
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (loaderPromise && loadedApiKey === apiKey && window.google?.maps) {
    return loaderPromise;
  }

  loadedApiKey = apiKey;
  loaderPromise = new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }

    const callbackName = `_pondarborMapsInit_${Date.now()}`;
    (window as unknown as Record<string, unknown>)[callbackName] = () => {
      delete (window as unknown as Record<string, unknown>)[callbackName];
      if (window.google?.maps) resolve();
      else reject(new Error("Google Maps loaded but maps namespace is missing"));
    };

    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      `&loading=async&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      delete (window as unknown as Record<string, unknown>)[callbackName];
      reject(new Error("Failed to load Google Maps JavaScript API"));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}

async function createGeocoder(): Promise<GoogleGeocoderInstance> {
  const importLibrary = window.google?.maps?.importLibrary;
  if (importLibrary) {
    const geocoding = await importLibrary("geocoding");
    return new geocoding.Geocoder();
  }
  return new window.google!.maps.Geocoder();
}

function runGeocode(
  geocoder: GoogleGeocoderInstance,
  request: { address?: string; location?: { lat: number; lng: number } },
): Promise<{ results: GoogleGeocoderResult[]; status: string }> {
  const response = geocoder.geocode(request);
  if (response && typeof (response as Promise<unknown>).then === "function") {
    return (response as Promise<{ results: GoogleGeocoderResult[] }>).then((payload) => ({
      results: payload.results,
      status: "OK",
    }));
  }
  return new Promise((resolve) => {
    geocoder.geocode(request, (results, status) => {
      resolve({ results: results ?? [], status: status || "UNKNOWN_ERROR" });
    });
  });
}

async function geocodeWithClient(
  request: { address?: string; location?: { lat: number; lng: number } },
  apiKey: string,
): Promise<ClientGeocodeResponse> {
  try {
    await loadGoogleMaps(apiKey);
    const geocoder = await createGeocoder();
    const { results, status } = await runGeocode(geocoder, request);
    if (status !== "OK") return { ok: false, status };
    const parsed = parseTopResult(results);
    if (!parsed) return { ok: false, status: "ZERO_RESULTS" };
    return { ok: true, result: parsed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return { ok: false, status: message };
  }
}

export async function geocodeAddressClient(
  address: string,
  apiKey: string,
): Promise<ClientGeocodeResponse> {
  const query = address.trim();
  if (!query || !apiKey.trim()) return { ok: false, status: "MISSING_INPUT" };
  return geocodeWithClient({ address: query }, apiKey);
}

export async function reverseGeocodeClient(
  lat: number,
  lng: number,
  apiKey: string,
): Promise<ClientGeocodeResponse> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !apiKey.trim()) {
    return { ok: false, status: "MISSING_INPUT" };
  }
  return geocodeWithClient({ location: { lat, lng } }, apiKey);
}
