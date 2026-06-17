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

export type GoogleMarkerInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
  addListener: (event: string, handler: () => void) => { remove: () => void };
};

export type GoogleInfoWindowInstance = {
  setContent: (content: string | HTMLElement) => void;
  open: (options: { map: GoogleMapInstance; anchor?: GoogleMarkerInstance }) => void;
  close: () => void;
};

type GoogleMapsNamespace = {
  Map: new (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => GoogleMapInstance;
  Marker: new (options: {
    position: LatLngLiteral;
    map?: GoogleMapInstance | null;
    title?: string;
  }) => GoogleMarkerInstance;
  InfoWindow: new () => GoogleInfoWindowInstance;
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
