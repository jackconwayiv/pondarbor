import {
  createSystem,
  defaultConfig,
  defineConfig,
  defineSemanticTokens,
  defineTokens,
} from "@chakra-ui/react";

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
            sky: { value: "#7CB7DF" },
            skyStrong: { value: "#7CB7DF" },
            skySubtle: { value: "#7CB7DF" },
            pondBlue: { value: "#7CB7DF" },
            pondBlueStrong: { value: "#7CB7DF" },
            pondBlueSubtle: { value: "#7CB7DF" },

            lilypad: { value: "#B7D394" },
            lilypadStrong: { value: "#B7D394" },
            lilypadSubtle: { value: "#B7D394" },

            nautical: { value: "#E9A14A" },
            nauticalStrong: { value: "#E9A14A" },
            nauticalSubtle: { value: "#E9A14A" },
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
