import { describe, expect, it } from "vitest";
import {
  boundsCenterFromPairs,
  entriesWithGeo,
  geoEntryLatLng,
  latLngPairsForGeoEntries,
} from "./geoMapUtils";
import type { RecommendationEntry } from "./types";

function entry(partial: Partial<RecommendationEntry> & Pick<RecommendationEntry, "id">): RecommendationEntry {
  return {
    category: {
      id: 1,
      slug: "restaurants",
      name: "Restaurants",
      emoji: "🍽️",
      group: "places",
      is_preset: true,
      created_at: "",
    },
    title: "Test",
    link: "",
    image_url: "",
    creator: "",
    media_source: "",
    address: "",
    location_label: "",
    google_place_id: "",
    latitude: null,
    longitude: null,
    created_by: { id: 1, email: "", nickname: "", avatar_url: "" },
    average_rating: null,
    average_rating_display: null,
    review_count: 0,
    reviewer_avatars: [],
    last_reviewed_at: null,
    viewer_review_id: null,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("entriesWithGeo", () => {
  it("keeps entries with valid coordinates", () => {
    const rows = entriesWithGeo([
      entry({ id: 1, latitude: "33.448373", longitude: "-112.074037" }),
      entry({ id: 2, latitude: null, longitude: "-112.0" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(1);
  });
});

describe("geoEntryLatLng", () => {
  it("returns null for missing or zero island coords", () => {
    expect(geoEntryLatLng(entry({ id: 1 }))).toBeNull();
    expect(geoEntryLatLng(entry({ id: 2, latitude: "0", longitude: "0" }))).toBeNull();
  });

  it("parses numeric strings", () => {
    expect(geoEntryLatLng(entry({ id: 1, latitude: "33.44", longitude: "-112.07" }))).toEqual({
      lat: 33.44,
      lng: -112.07,
    });
  });
});

describe("latLngPairsForGeoEntries", () => {
  it("collects pairs for geo entries only", () => {
    const pairs = latLngPairsForGeoEntries([
      entry({ id: 1, latitude: "33.44", longitude: "-112.07" }),
      entry({ id: 2, latitude: "33.51", longitude: "-111.97" }),
      entry({ id: 3 }),
    ]);
    expect(pairs).toEqual([
      { lat: 33.44, lng: -112.07 },
      { lat: 33.51, lng: -111.97 },
    ]);
  });
});

describe("boundsCenterFromPairs", () => {
  it("returns the single point for one marker", () => {
    expect(boundsCenterFromPairs([{ lat: 33.44, lng: -112.07 }])).toEqual({
      lat: 33.44,
      lng: -112.07,
    });
  });

  it("averages multiple points", () => {
    expect(
      boundsCenterFromPairs([
        { lat: 33.0, lng: -112.0 },
        { lat: 35.0, lng: -110.0 },
      ]),
    ).toEqual({ lat: 34, lng: -111 });
  });
});
