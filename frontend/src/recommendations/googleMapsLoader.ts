/** Shared Google Maps JavaScript API loader (map display + geocoding). */

export type LatLngLiteral = { lat: number; lng: number };

export type GoogleMapInstance = {
  setCenter: (center: LatLngLiteral) => void;
  setZoom: (zoom: number) => void;
  fitBounds: (bounds: GoogleLatLngBounds, padding?: number | { padding: number }) => void;
};

export type GoogleLatLngBounds = {
  extend: (point: LatLngLiteral) => void;
  getCenter: () => LatLngLiteral;
};

export type GoogleAdvancedMarkerInstance = {
  map: GoogleMapInstance | null;
  addListener: (event: string, handler: () => void) => { remove: () => void };
};

export type GoogleInfoWindowInstance = {
  setContent: (content: string | HTMLElement) => void;
  open: (options: { map: GoogleMapInstance; anchor?: GoogleAdvancedMarkerInstance }) => void;
  close: () => void;
};

type GoogleInfoWindowCtor = new (options?: Record<string, unknown>) => GoogleInfoWindowInstance;

type GoogleMapsNamespace = {
  Map: new (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => GoogleMapInstance;
  InfoWindow: GoogleInfoWindowCtor;
  LatLngBounds: new () => GoogleLatLngBounds;
  importLibrary?: (name: string) => Promise<Record<string, unknown>>;
};

declare global {
  interface Window {
    google?: {
      maps: GoogleMapsNamespace;
    };
  }
}

let loaderPromise: Promise<void> | null = null;
let loadedApiKey: string | null = null;

export function loadGoogleMaps(apiKey: string): Promise<void> {
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
    const win = window as unknown as Record<string, unknown>;
    win[callbackName] = () => {
      delete win[callbackName];
      if (window.google?.maps) resolve();
      else reject(new Error("Google Maps loaded but maps namespace is missing"));
    };

    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      `&loading=async&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      delete win[callbackName];
      reject(new Error("Failed to load Google Maps JavaScript API"));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}

export function getGoogleMaps(): GoogleMapsNamespace {
  if (!window.google?.maps) {
    throw new Error("Google Maps JavaScript API is not loaded");
  }
  return window.google.maps;
}

type AdvancedMarkerCtor = new (options: {
  map: GoogleMapInstance;
  position: LatLngLiteral;
  title?: string;
}) => GoogleAdvancedMarkerInstance;

export async function createAdvancedMarker(
  options: {
    map: GoogleMapInstance;
    position: LatLngLiteral;
    title?: string;
  },
): Promise<GoogleAdvancedMarkerInstance> {
  const maps = getGoogleMaps();
  if (maps.importLibrary) {
    const { AdvancedMarkerElement } = (await maps.importLibrary("marker")) as {
      AdvancedMarkerElement: AdvancedMarkerCtor;
    };
    return new AdvancedMarkerElement(options);
  }
  throw new Error("Google Maps marker library is not available");
}

/** Google's documented dev fallback; production should set VITE_GOOGLE_MAPS_MAP_ID. */
export const GOOGLE_MAPS_DEMO_MAP_ID = "DEMO_MAP_ID";
