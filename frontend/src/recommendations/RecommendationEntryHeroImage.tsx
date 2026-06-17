import { Box } from "@chakra-ui/react";
import { useState } from "react";

export function entryImageUrl(imageUrl: string | null | undefined): string | null {
  const trimmed = imageUrl?.trim();
  return trimmed || null;
}

type RecommendationEntryHeroImageProps = {
  src: string;
  alt: string;
};

/** Detail hero — only renders when the image URL loads; no placeholder on miss or error. */
export default function RecommendationEntryHeroImage({
  src,
  alt,
}: RecommendationEntryHeroImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <Box borderRadius="md" overflow="hidden" w="100%" maxH={{ base: "240px", md: "320px" }}>
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        style={{
          width: "100%",
          height: "auto",
          maxHeight: "320px",
          objectFit: "cover",
          display: "block",
          verticalAlign: "middle",
        }}
      />
    </Box>
  );
}
