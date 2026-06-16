import { describe, expect, it } from "vitest";
import { buildStaticMapUrl, entriesWithGeo } from "./geoMapUtils";
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

describe("buildStaticMapUrl", () => {
  it("includes markers for geo entries", () => {
    const url = buildStaticMapUrl(
      [entry({ id: 1, latitude: "33.448373", longitude: "-112.074037" })],
      "test-key",
    );
    expect(url).toContain("maps.googleapis.com/maps/api/staticmap");
    expect(url).toContain("markers=33.448373%2C-112.074037");
    expect(url).toContain("key=test-key");
  });

  it("uses visible bounds for multiple markers", () => {
    const url = buildStaticMapUrl(
      [
        entry({ id: 1, latitude: "33.44", longitude: "-112.07" }),
        entry({ id: 2, latitude: "33.51", longitude: "-111.97" }),
      ],
      "test-key",
    );
    expect(url).toContain("visible=33.44%2C-112.07%7C33.51%2C-111.97");
    expect(url).toContain("markers=33.44%2C-112.07%7C33.51%2C-111.97");
  });
});
