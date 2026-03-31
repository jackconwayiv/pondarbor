import {
  createSystem,
  defaultConfig,
  defineConfig,
  defineSemanticTokens,
  defineTokens,
} from "@chakra-ui/react";
import { BRAND_COLORS } from "./tokens";

/**
 * Single source of truth for PondArbor UI (Chakra v3 system).
 * White chrome, black typography, Verdana, sky vs nautical button palettes.
 */
export const system = createSystem(
  defaultConfig,
  defineConfig({
    theme: {
      tokens: {
        fonts: defineTokens.fonts({
          body: { value: "Verdana, Geneva, sans-serif" },
          heading: { value: "Verdana, Geneva, sans-serif" },
        }),
        colors: defineTokens.colors({
          pond: {
            // Single-source-of-truth accent colors from `assets/colors-*.png`
            // Sky Blue:    #7CB7DF
            // Lilypad:     #B7D394
            // Soft Marigold / Pond Orange: #E9A14A
            sky: { value: BRAND_COLORS.skyBlue },
            skyStrong: { value: BRAND_COLORS.skyBlue },
            skySubtle: { value: BRAND_COLORS.skyBlue },
            pondBlue: { value: BRAND_COLORS.skyBlue },
            pondBlueStrong: { value: BRAND_COLORS.skyBlue },
            pondBlueSubtle: { value: BRAND_COLORS.skyBlue },

            lilypad: { value: BRAND_COLORS.lilypad },
            lilypadStrong: { value: BRAND_COLORS.lilypad },
            lilypadSubtle: { value: BRAND_COLORS.lilypad },

            orange: { value: BRAND_COLORS.orange },
            orangeStrong: { value: BRAND_COLORS.orange },
            orangeSubtle: { value: BRAND_COLORS.orange },
            nautical: { value: BRAND_COLORS.orange },
            nauticalStrong: { value: BRAND_COLORS.orange },
            nauticalSubtle: { value: BRAND_COLORS.orange },
          },
        }),
      },
      semanticTokens: {
        colors: defineSemanticTokens.colors({
          bg: {
            DEFAULT: { value: { _light: "#ffffff", _dark: "#ffffff" } },
            subtle: { value: { _light: "#ffffff", _dark: "#ffffff" } },
            muted: { value: { _light: "#ffffff", _dark: "#ffffff" } },
            emphasized: { value: { _light: "#ffffff", _dark: "#ffffff" } },
            panel: { value: { _light: "#ffffff", _dark: "#ffffff" } },
          },
          fg: {
            DEFAULT: { value: { _light: "#000000", _dark: "#000000" } },
            muted: { value: { _light: "#000000", _dark: "#000000" } },
            subtle: { value: { _light: "#000000", _dark: "#000000" } },
          },
          border: {
            DEFAULT: { value: { _light: "#000000", _dark: "#000000" } },
            muted: { value: { _light: "#000000", _dark: "#000000" } },
            subtle: { value: { _light: "#000000", _dark: "#000000" } },
          },
          gray: {
            fg: { value: { _light: "#000000", _dark: "#000000" } },
          },
          sky: {
            contrast: { value: { _light: "#000000", _dark: "#000000" } },
            fg: { value: { _light: "#000000", _dark: "#000000" } },
            subtle: {
              value: {
                _light: "{colors.pond.skySubtle}",
                _dark: "{colors.pond.skySubtle}",
              },
            },
            muted: { value: { _light: "{colors.pond.sky}", _dark: "{colors.pond.sky}" } },
            emphasized: {
              value: {
                _light: "{colors.pond.skyStrong}",
                _dark: "{colors.pond.skyStrong}",
              },
            },
            solid: { value: { _light: "{colors.pond.sky}", _dark: "{colors.pond.sky}" } },
            focusRing: {
              value: {
                _light: "{colors.pond.skyStrong}",
                _dark: "{colors.pond.skyStrong}",
              },
            },
            border: {
              value: {
                _light: "{colors.pond.skyStrong}",
                _dark: "{colors.pond.skyStrong}",
              },
            },
          },
          nautical: {
            contrast: { value: { _light: "#000000", _dark: "#000000" } },
            fg: { value: { _light: "#000000", _dark: "#000000" } },
            subtle: {
              value: {
                _light: "{colors.pond.nauticalSubtle}",
                _dark: "{colors.pond.nauticalSubtle}",
              },
            },
            muted: { value: { _light: "{colors.pond.nautical}", _dark: "{colors.pond.nautical}" } },
            emphasized: {
              value: {
                _light: "{colors.pond.nauticalStrong}",
                _dark: "{colors.pond.nauticalStrong}",
              },
            },
            solid: {
              value: {
                _light: "{colors.pond.nautical}",
                _dark: "{colors.pond.nautical}",
              },
            },
            focusRing: {
              value: {
                _light: "{colors.pond.nauticalStrong}",
                _dark: "{colors.pond.nauticalStrong}",
              },
            },
            border: {
              value: {
                _light: "{colors.pond.nauticalStrong}",
                _dark: "{colors.pond.nauticalStrong}",
              },
            },
          },
          orange: {
            contrast: { value: { _light: "#000000", _dark: "#000000" } },
            fg: { value: { _light: "#000000", _dark: "#000000" } },
            subtle: {
              value: {
                _light: "{colors.pond.orangeSubtle}",
                _dark: "{colors.pond.orangeSubtle}",
              },
            },
            muted: { value: { _light: "{colors.pond.orange}", _dark: "{colors.pond.orange}" } },
            emphasized: {
              value: {
                _light: "{colors.pond.orangeStrong}",
                _dark: "{colors.pond.orangeStrong}",
              },
            },
            solid: {
              value: {
                _light: "{colors.pond.orange}",
                _dark: "{colors.pond.orange}",
              },
            },
            focusRing: {
              value: {
                _light: "{colors.pond.orangeStrong}",
                _dark: "{colors.pond.orangeStrong}",
              },
            },
            border: {
              value: {
                _light: "{colors.pond.orangeStrong}",
                _dark: "{colors.pond.orangeStrong}",
              },
            },
          },
          lilypad: {
            contrast: { value: { _light: "#000000", _dark: "#000000" } },
            fg: { value: { _light: "#000000", _dark: "#000000" } },
            subtle: {
              value: {
                _light: "{colors.pond.lilypadSubtle}",
                _dark: "{colors.pond.lilypadSubtle}",
              },
            },
            muted: { value: { _light: "{colors.pond.lilypad}", _dark: "{colors.pond.lilypad}" } },
            emphasized: {
              value: {
                _light: "{colors.pond.lilypadStrong}",
                _dark: "{colors.pond.lilypadStrong}",
              },
            },
            solid: {
              value: {
                _light: "{colors.pond.lilypad}",
                _dark: "{colors.pond.lilypad}",
              },
            },
            focusRing: {
              value: {
                _light: "{colors.pond.lilypadStrong}",
                _dark: "{colors.pond.lilypadStrong}",
              },
            },
            border: {
              value: {
                _light: "{colors.pond.lilypadStrong}",
                _dark: "{colors.pond.lilypadStrong}",
              },
            },
          },
          pond: {
            contrast: { value: { _light: "#000000", _dark: "#000000" } },
            fg: { value: { _light: "#000000", _dark: "#000000" } },
            subtle: {
              value: {
                _light: "{colors.pond.pondBlueSubtle}",
                _dark: "{colors.pond.pondBlueSubtle}",
              },
            },
            muted: { value: { _light: "{colors.pond.pondBlue}", _dark: "{colors.pond.pondBlue}" } },
            emphasized: {
              value: {
                _light: "{colors.pond.pondBlueStrong}",
                _dark: "{colors.pond.pondBlueStrong}",
              },
            },
            solid: {
              value: {
                _light: "{colors.pond.pondBlue}",
                _dark: "{colors.pond.pondBlue}",
              },
            },
            focusRing: {
              value: {
                _light: "{colors.pond.pondBlueStrong}",
                _dark: "{colors.pond.pondBlueStrong}",
              },
            },
            border: {
              value: {
                _light: "{colors.pond.pondBlueStrong}",
                _dark: "{colors.pond.pondBlueStrong}",
              },
            },
          },
        }),
      },
    },
  }),
);
