import { Box } from "@chakra-ui/react";

import "./Clicker2TiledTextureOverlay.css";

/** Tiled image at low opacity over a play-surface fill or gradient. */
export default function Clicker2TiledTextureOverlay({
  src,
  opacity,
}: {
  src: string;
  opacity: number;
}) {
  return (
    <Box
      className="clicker2TiledTextureOverlay"
      position="absolute"
      inset="0"
      pointerEvents="none"
      aria-hidden
      style={{
        opacity,
        backgroundImage: `url(${src})`,
      }}
    />
  );
}
