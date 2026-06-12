import { publicAssetUrl } from "../publicAsset";

/** Tiled grass texture for clear-weather play surfaces (public/). */
export const CLICKER2_GRASS_TEXTURE_SRC = publicAssetUrl("grass.avif");

/** Opacity of the grass tile layer over solid lilypad fills. */
export const CLICKER2_GRASS_TEXTURE_OPACITY = 0.1;

/** Tiled ripple texture for the pond water surface (public/). */
export const CLICKER2_POND_RIPPLES_TEXTURE_SRC = publicAssetUrl("pond-ripples.webp");

/** Opacity of the ripple tile layer over the pond water gradient. */
export const CLICKER2_POND_RIPPLES_TEXTURE_OPACITY = 0.05;

/** Tiled sandstone texture for the fossil shop interstitial panel (public/). */
export const FOSSIL_SHOP_SANDSTONE_TEXTURE_SRC = publicAssetUrl(
  "fossil-shop-sandstone.webp",
);

/** Opacity of the sandstone tile layer inside the fossil shop panel. */
export const FOSSIL_SHOP_SANDSTONE_TEXTURE_OPACITY = 0.15;
