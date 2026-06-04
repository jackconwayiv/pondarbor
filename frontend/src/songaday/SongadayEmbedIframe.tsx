import type { CSSProperties } from "react";

export const YOUTUBE_EMBED_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; compute-pressure";

export const SPOTIFY_EMBED_ALLOW =
  "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture; compute-pressure";

export function youtubeEmbedSrc(videoId: string, autoplay?: boolean): string {
  const id = videoId.trim();
  const base = `https://www.youtube-nocookie.com/embed/${id}`;
  return autoplay ? `${base}?autoplay=1&mute=1` : base;
}

type EmbedIframeProps = {
  title: string;
  src: string;
  height: number;
  allow: string;
  loading?: "lazy" | "eager";
  referrerPolicy?: HTMLIFrameElement["referrerPolicy"];
  allowFullScreen?: boolean;
  style?: CSSProperties;
};

export function SongadayEmbedIframe({
  title,
  src,
  height,
  allow,
  loading = "lazy",
  referrerPolicy,
  allowFullScreen,
  style,
}: EmbedIframeProps) {
  return (
    <iframe
      title={title}
      width="100%"
      height={height}
      src={src}
      allow={allow}
      loading={loading}
      referrerPolicy={referrerPolicy}
      allowFullScreen={allowFullScreen}
      style={{ border: "none", display: "block", ...style }}
    />
  );
}
