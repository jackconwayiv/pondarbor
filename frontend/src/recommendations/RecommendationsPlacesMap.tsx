import { Box, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { googleMapsApiKey, googleMapsMapId } from "../auth/publicConfig";
import { entriesWithGeo, geoEntryLatLng } from "./geoMapUtils";
import {
  createAdvancedMarker,
  getGoogleMaps,
  loadGoogleMaps,
  type GoogleAdvancedMarkerInstance,
  type GoogleInfoWindowInstance,
  type GoogleMapInstance,
} from "./googleMapsLoader";
import { buildMapInfoWindowElement } from "./mapInfoWindowContent";
import type { RecommendationEntry } from "./types";

const MAP_HEIGHT_PX = 320;
const SINGLE_PIN_ZOOM = 14;
const FIT_BOUNDS_PADDING_PX = 48;

type RecommendationsPlacesMapProps = {
  entries: RecommendationEntry[];
  onEntrySelect?: (entryId: number) => void;
};

type MarkerBinding = {
  marker: GoogleAdvancedMarkerInstance;
  listener: { remove: () => void };
};

export default function RecommendationsPlacesMap({
  entries,
  onEntrySelect,
}: RecommendationsPlacesMapProps) {
  const mapsKey = googleMapsApiKey();
  const mapId = googleMapsMapId();
  const geoEntries = useMemo(() => entriesWithGeo(entries), [entries]);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const infoWindowRef = useRef<GoogleInfoWindowInstance | null>(null);
  const markersRef = useRef<MarkerBinding[]>([]);
  const onEntrySelectRef = useRef(onEntrySelect);
  const [mapStatus, setMapStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  onEntrySelectRef.current = onEntrySelect;

  useEffect(() => {
    if (!mapsKey || geoEntries.length === 0 || !mapContainerRef.current) {
      setMapStatus("idle");
      return;
    }

    let cancelled = false;
    setMapStatus("loading");

    const clearMarkers = () => {
      for (const binding of markersRef.current) {
        binding.listener.remove();
        binding.marker.map = null;
      }
      markersRef.current = [];
    };

    void (async () => {
      try {
        await loadGoogleMaps(mapsKey);
        if (cancelled || !mapContainerRef.current) return;

        const maps = getGoogleMaps();
        if (!mapRef.current) {
          mapRef.current = new maps.Map(mapContainerRef.current, {
            mapId,
            mapTypeId: "roadmap",
            disableDefaultUI: false,
            mapTypeControl: false,
            fullscreenControl: false,
            streetViewControl: false,
            scrollwheel: true,
            gestureHandling: "auto",
          });
          infoWindowRef.current = new maps.InfoWindow({
            headerDisabled: true,
          });
        }

        const map = mapRef.current;
        const infoWindow = infoWindowRef.current;
        if (!map || !infoWindow) return;

        clearMarkers();

        const bounds = new maps.LatLngBounds();
        let markerCount = 0;

        for (const entry of geoEntries) {
          const position = geoEntryLatLng(entry);
          if (!position) continue;

          const marker = await createAdvancedMarker({
            map,
            position,
            title: entry.title,
          });

          const listener = marker.addListener("gmp-click", () => {
            const content = buildMapInfoWindowElement(entry, (entryId) => {
              infoWindow.close();
              onEntrySelectRef.current?.(entryId);
            });
            infoWindow.setContent(content);
            infoWindow.open({ map, anchor: marker });
          });

          markersRef.current.push({ marker, listener });
          bounds.extend(position);
          markerCount += 1;
        }

        if (markerCount === 1) {
          map.setCenter(bounds.getCenter());
          map.setZoom(SINGLE_PIN_ZOOM);
        } else if (markerCount > 1) {
          map.fitBounds(bounds, FIT_BOUNDS_PADDING_PX);
        }

        if (!cancelled) setMapStatus("ready");
      } catch {
        if (!cancelled) setMapStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      infoWindowRef.current?.close();
      clearMarkers();
    };
  }, [geoEntries, mapId, mapsKey]);

  if (!mapsKey) {
    return (
      <Box bg="bg.muted" borderRadius="md" p={4}>
        <Text fontSize="sm" color="fg.muted">
          Set <code>VITE_GOOGLE_MAPS_API_KEY</code> (local) or the same variable on the server
          (production) to enable the map. You can still browse recommendations in the list below.
        </Text>
      </Box>
    );
  }

  if (entries.length > 0 && geoEntries.length === 0) {
    return (
      <Box bg="bg.muted" borderRadius="md" p={4}>
        <Text fontSize="sm" color="fg.muted">
          None of your filtered places have map coordinates yet. When adding a recommendation,
          paste a Google Maps link or an address so we can pin it here.
        </Text>
      </Box>
    );
  }

  if (geoEntries.length === 0) return null;

  return (
    <Box position="relative" borderRadius="md" overflow="hidden" bg="bg.muted">
      <Box
        ref={mapContainerRef}
        h={`${MAP_HEIGHT_PX}px`}
        w="100%"
        aria-label={`Interactive map with ${geoEntries.length} recommended place${geoEntries.length === 1 ? "" : "s"}`}
      />
      {mapStatus === "loading" ? (
        <Box
          position="absolute"
          inset={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg="bg.muted"
          pointerEvents="none"
        >
          <Text fontSize="sm" color="fg.muted">
            Loading map…
          </Text>
        </Box>
      ) : null}
      {mapStatus === "error" ? (
        <Box position="absolute" inset={0} display="flex" alignItems="center" justifyContent="center" p={4}>
          <Text fontSize="sm" color="fg.muted" textAlign="center">
            Could not load the interactive map. Check that Maps JavaScript API is enabled on your key.
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
