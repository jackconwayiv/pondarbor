export type RecommendationUser = {
  id: number;
  email: string;
  nickname: string;
  avatar_url: string;
};

export type RecommendationCategory = {
  id: number;
  slug: string;
  name: string;
  emoji: string;
  group: "places" | "media" | "links";
  is_preset: boolean;
  created_at: string;
};

export type RecommendationReview = {
  id: number;
  reviewer: RecommendationUser;
  rating: string;
  rating_display: string | null;
  body: string;
  date_recommended: string;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RecommendationEntry = {
  id: number;
  category: RecommendationCategory;
  title: string;
  link: string;
  image_url: string;
  creator: string;
  media_source: string;
  address: string;
  location_label: string;
  google_place_id: string;
  latitude: string | null;
  longitude: string | null;
  created_by: RecommendationUser;
  average_rating: number | null;
  average_rating_display: string | null;
  review_count: number;
  reviewer_avatars: RecommendationUser[];
  last_reviewed_at: string | null;
  viewer_review_id: number | null;
  created_at: string;
  updated_at: string;
  reviews?: RecommendationReview[];
};

export type ResolveLinkResult = {
  title: string;
  description: string;
  image_url: string;
  address: string;
  location_label: string;
  category_slug: string | null;
  google_place_id: string;
  latitude: string | null;
  longitude: string | null;
  hints: string[];
  partial: boolean;
};

export type EntryCreatePayload = {
  category_slug: string;
  title: string;
  link?: string;
  image_url?: string;
  address?: string;
  creator?: string;
  media_source?: string;
  google_place_id?: string;
  latitude?: string | null;
  longitude?: string | null;
  rating: number;
  body: string;
  date_recommended?: string;
};

export type EntryCreateResponse = {
  merged: boolean;
  message?: string;
  entry: RecommendationEntry;
  review: RecommendationReview;
};

export type ReviewPatchPayload = {
  rating?: number;
  body?: string;
};

export type FriendRecommendationRow = RecommendationReview & {
  entry: RecommendationEntry;
};
