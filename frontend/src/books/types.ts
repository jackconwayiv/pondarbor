export type GoodreadsBook = {
  title: string;
  author_name: string;
  book_id: string;
  isbn: string;
  link: string;
  book_image_url: string;
  book_large_image_url: string;
  num_pages: string;
  user_rating: number;
  user_read_at: string;
  user_date_added: string;
  average_rating: string;
  book_published: string;
  user_review: string;
};

export type GoodreadsShelf = {
  slug: string;
  label: string;
  book_count: number;
  books: GoodreadsBook[];
};

export type BooksShelvesResponse = {
  linked: boolean;
  goodreads_user_id: string;
  profile_url: string;
  shelves: GoodreadsShelf[];
};

export type BooksLinkResponse = BooksShelvesResponse & {
  session?: unknown;
};

export type BooksStatusResponse = {
  linked: boolean;
  goodreads_user_id: string | null;
  profile_url: string | null;
};

export type BooksReader = {
  id: number;
  display_name: string;
  avatar_url: string;
  goodreads_user_id: string | null;
  profile_url: string | null;
};

export type BooksCommunityEntry = {
  user: BooksReader;
  shelf: string;
  book_count: number;
  books: GoodreadsBook[];
  error: string | null;
};

export type BooksCommunityResponse = {
  shelf: string;
  shelf_label: string;
  results: BooksCommunityEntry[];
};

export type CommunityShelfSlug = "currently-reading" | "read" | "to-read";
