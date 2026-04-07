export type ClosetUser = {
  id: number;
  email: string;
  display_name: string;
  avatar_url: string;
};

export type BorrowRequest = {
  id: number;
  item_id: number;
  requester_user: ClosetUser;
  status: "pending" | "approved" | "declined" | "canceled" | "fulfilled";
  date_needed_by: string;
  message: string;
  decline_message: string;
  created_at: string;
  updated_at: string;
  responded_at: string | null;
};

export type ClosetItem = {
  id: number;
  owner_user: ClosetUser;
  current_holder_user: ClosetUser;
  name: string;
  description: string;
  category: string;
  tags: string[];
  image_key: string;
  /** Public URL when CLOSET_R2_PUBLIC_BASE_URL is set and image_key is non-empty. */
  image_url?: string;
  custody_disputed: boolean;
  pending_request_count: number;
  my_pending_request: BorrowRequest | null;
  my_declined_request: BorrowRequest | null;
  active_loan_id: number | null;
  active_loan_marked_returned_by_borrower: boolean;
  custody_marked_returned_by_holder: boolean;
  pending_custody_user?: ClosetUser | null;
  created_at: string;
  updated_at: string;
};

export type MyItemsResponse = {
  declined_by_me: ClosetItem[];
  borrowed_by_me: ClosetItem[];
  custody_offered_to_me: ClosetItem[];
  requested_by_me: ClosetItem[];
  owned_by_me: ClosetItem[];
};

export type FriendsItemsResponse = {
  results: ClosetItem[];
  page: number;
  page_size: number;
  total: number;
  has_next: boolean;
  has_prev: boolean;
};

export type ClosetActionSummary = {
  outstanding_actions_count: number;
};

export type ClosetImageInventoryRow = {
  image_key: string;
  image_url: string;
  attached_live_item_count: number;
  attached_live_item_ids: number[];
  attached_live_item_names: string[];
  status: "attached" | "stranded";
  present_in_bucket: boolean;
};

export type ClosetImageInventoryResponse = {
  results: ClosetImageInventoryRow[];
};

