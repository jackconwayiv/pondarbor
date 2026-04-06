export type QuoteOwner = {
  id: number;
  email: string;
  username: string;
  avatar_url: string;
};

export type QuoteLabel = {
  id: number;
  kind: "tag" | "attribution";
  name: string;
  linked_user_id: number | null;
};

export type Quote = {
  id: number;
  owner: QuoteOwner;
  body: string;
  created_at: string;
  date_of_quote: string | null;
  visibility: "private" | "public";
  updated_at: string;
  labels: QuoteLabel[];
  relationship_to_viewer: "owner" | "tagged" | "public";
};

export type QuoteCreatePayload = {
  body: string;
  date_of_quote?: string | null;
  visibility?: "private" | "public";
  labels?: Array<{
    kind: "tag" | "attribution";
    name?: string;
    email?: string;
    friend_user_id?: number;
  }>;
};

export type QuotePatchPayload = {
  body?: string;
  date_of_quote?: string | null;
  visibility?: "private" | "public";
  labels?: Array<{
    kind: "tag" | "attribution";
    name?: string;
    email?: string;
    friend_user_id?: number;
  }>;
};

