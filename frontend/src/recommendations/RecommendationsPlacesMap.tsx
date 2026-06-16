import { Box, Text } from "@chakra-ui/react";
import { useMemo } from "react";
import { googleMapsApiKey } from "../auth/publicConfig";
import { buildStaticMapUrl, entriesWithGeo } from "./geoMapUtils";
import type { RecommendationEntry } from "./types";

type RecommendationsPlacesMapProps = {
  entries: RecommendationEntry[];
};

export default function RecommendationsPlacesMap({ entries }: RecommendationsPlacesMapProps) {
  const mapsKey = googleMapsApiKey();
  const geoEntries = useMemo(() => entriesWithGeo(entries), [entries]);
  const mapUrl = useMemo(
    () => (mapsKey ? buildStaticMapUrl(geoEntries, mapsKey) : null),
    [geoEntries, mapsKey],
  );

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

  if (!mapUrl) return null;

  return (
    <Box borderRadius="md" overflow="hidden" bg="bg.muted">
      <img
        src={mapUrl}
        alt={`Map showing ${geoEntries.length} recommended place${geoEntries.length === 1 ? "" : "s"}`}
        style={{ width: "100%", height: "320px", objectFit: "cover", display: "block" }}
        loading="lazy"
      />
    </Box>
  );
}
