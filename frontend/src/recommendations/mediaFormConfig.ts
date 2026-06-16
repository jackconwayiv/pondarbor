export type MediaFormConfig = {
  fieldOrder: "title-first" | "artist-first";
  showTitle: boolean;
  titleLabel: string;
  titlePlaceholder?: string;
  titleRequired: boolean;
  showCreator: boolean;
  creatorLabel?: string;
  creatorPlaceholder?: string;
  creatorRequired: boolean;
  showMediaSource: boolean;
  mediaSourceLabel?: string;
  mediaSourcePlaceholder?: string;
  mediaSourceRequired: boolean;
  showLink: boolean;
  linkLabel: string;
  linkPlaceholder?: string;
};

const TV: MediaFormConfig = {
  fieldOrder: "title-first",
  showTitle: true,
  titleLabel: "Title",
  titleRequired: true,
  showCreator: false,
  creatorRequired: false,
  showMediaSource: true,
  mediaSourceLabel: "Network or service",
  mediaSourcePlaceholder: "Netflix, HBO, Apple TV+…",
  mediaSourceRequired: true,
  showLink: false,
  linkLabel: "Link (optional)",
};

const BOOKS: MediaFormConfig = {
  fieldOrder: "title-first",
  showTitle: true,
  titleLabel: "Title",
  titleRequired: true,
  showCreator: true,
  creatorLabel: "Author",
  creatorPlaceholder: "Author name",
  creatorRequired: true,
  showMediaSource: false,
  mediaSourceRequired: false,
  showLink: true,
  linkLabel: "Link (optional)",
  linkPlaceholder: "Goodreads, Storygraph…",
};

const FILMS: MediaFormConfig = {
  fieldOrder: "title-first",
  showTitle: true,
  titleLabel: "Title",
  titleRequired: true,
  showCreator: false,
  creatorRequired: false,
  showMediaSource: false,
  mediaSourceRequired: false,
  showLink: true,
  linkLabel: "Link (optional)",
  linkPlaceholder: "IMDb, Letterboxd…",
};

const MUSIC: MediaFormConfig = {
  fieldOrder: "artist-first",
  showTitle: false,
  titleLabel: "Title",
  titleRequired: false,
  showCreator: true,
  creatorLabel: "Artist",
  creatorPlaceholder: "Artist name",
  creatorRequired: true,
  showMediaSource: true,
  mediaSourceLabel: "Album or song",
  mediaSourcePlaceholder: "Album or track name",
  mediaSourceRequired: true,
  showLink: true,
  linkLabel: "Link (optional)",
  linkPlaceholder: "Spotify, Apple Music, YouTube…",
};

const OTHER_MEDIA: MediaFormConfig = {
  fieldOrder: "title-first",
  showTitle: true,
  titleLabel: "Title",
  titleRequired: true,
  showCreator: true,
  creatorLabel: "Creator or artist (optional)",
  creatorRequired: false,
  showMediaSource: true,
  mediaSourceLabel: "Album, network, or details (optional)",
  mediaSourceRequired: false,
  showLink: true,
  linkLabel: "Link (optional)",
};

export function linksEntryCanSubmit(fields: { title: string; link: string }): boolean {
  const trimmedLink = fields.link.trim();
  if (!fields.title.trim() || !trimmedLink) return false;
  return /^https?:\/\//i.test(trimmedLink);
}

const MEDIA_FORM_BY_SLUG: Record<string, MediaFormConfig> = {
  tv: TV,
  books: BOOKS,
  films: FILMS,
  music: MUSIC,
};

export function getMediaFormConfig(categorySlug: string, isOther: boolean): MediaFormConfig | null {
  if (isOther) return OTHER_MEDIA;
  if (categorySlug === "links") return null;
  return MEDIA_FORM_BY_SLUG[categorySlug] ?? OTHER_MEDIA;
}

export function mediaEntryCanSubmit(
  categorySlug: string,
  isOther: boolean,
  fields: { title: string; creator: string; mediaSource: string },
): boolean {
  const config = getMediaFormConfig(categorySlug, isOther);
  if (!config) return false;
  if (config.titleRequired && !fields.title.trim()) return false;
  if (config.creatorRequired && !fields.creator.trim()) return false;
  if (config.mediaSourceRequired && !fields.mediaSource.trim()) return false;
  if (categorySlug === "music" && !isOther) {
    return Boolean(fields.creator.trim() && fields.mediaSource.trim());
  }
  return true;
}

export function resolveMediaTitleForSubmit(
  categorySlug: string,
  isOther: boolean,
  fields: { title: string; creator: string; mediaSource: string },
): string {
  const trimmedTitle = fields.title.trim();
  if (trimmedTitle) return trimmedTitle;
  if (categorySlug === "music" && !isOther) {
    const artist = fields.creator.trim();
    const albumOrSong = fields.mediaSource.trim();
    if (artist && albumOrSong) return `${artist} — ${albumOrSong}`;
    return artist || albumOrSong;
  }
  return trimmedTitle;
}

export function applyMusicResolveTitle(
  resolvedTitle: string,
  setFields: {
    setCreator: (value: string) => void;
    setMediaSource: (value: string) => void;
  },
): void {
  const parts = resolvedTitle.split(/\s*[—–-]\s*/);
  if (parts.length >= 2) {
    const artist = parts[0]?.trim() ?? "";
    const rest = parts.slice(1).join(" — ").trim();
    if (artist) setFields.setCreator(artist);
    if (rest) setFields.setMediaSource(rest);
    return;
  }
  if (resolvedTitle.trim()) setFields.setMediaSource(resolvedTitle.trim());
}
