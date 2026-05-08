import {
  createSystem,
  defaultConfig,
  defineConfig,
  defineSemanticTokens,
  defineSlotRecipe,
  defineTokens,
} from "@chakra-ui/react";
import { BRAND_COLORS, DESIGN } from "./tokens";

/** Success: lilypad; warning/error: nautical. */
const pondToastSlotRecipe = defineSlotRecipe({
  slots: ["root", "title", "description", "indicator", "closeTrigger", "actionTrigger"],
  base: {
    root: {
      "&[data-type=success]": {
        bg: "lilypad.solid",
        color: "lilypad.contrast",
        "--toast-trigger-bg": "{white/10}",
        "--toast-border-color": "{white/40}",
      },
      "&[data-type=warning]": {
        bg: "nautical.solid",
        color: "nautical.contrast",
        "--toast-trigger-bg": "{white/10}",
        "--toast-border-color": "{white/40}",
      },
      "&[data-type=error]": {
        bg: "nautical.solid",
        color: "nautical.contrast",
        "--toast-trigger-bg": "{white/10}",
        "--toast-border-color": "{white/40}",
      },
    },
  },
});

function pondHex(base: string) {
  return {
    value: base,
  };
}

function rgbaFromHex(hex: string, a: number): string {
  const h = hex.trim().replace(/^#/, "");
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Chakra v3: semantic color groups for `colorPalette` and `bg`/`fg` tokens.
 * Designer system: cloud-white canvas, sky/lilypad/nautical triads, medium-gray borders.
 */
export const system = createSystem(
  defaultConfig,
  defineConfig({
    theme: {
      tokens: {
        fonts: defineTokens.fonts({
          body: {
            value: '"Spinnaker", Verdana, Geneva, "DejaVu Sans", sans-serif',
          },
          heading: {
            value: '"Caprasimo", "Spinnaker", Verdana, Geneva, "DejaVu Sans", sans-serif',
          },
        }),
        colors: defineTokens.colors({
          pond: {
            sky: pondHex(BRAND_COLORS.skyBlue),
            skyStrong: pondHex(DESIGN.skyDark),
            skySubtle: pondHex(DESIGN.skyLight),

            /** Legacy alias used in many existing views; maps to lilypad. */
            teal: pondHex(DESIGN.lilypad),
            tealStrong: pondHex(DESIGN.lilypadDark),
            tealSubtle: pondHex(DESIGN.lilypadLight),

            lilypad: pondHex(BRAND_COLORS.lilypad),
            lilypadStrong: pondHex(DESIGN.lilypadDark),
            lilypadSubtle: pondHex(DESIGN.lilypadLight),

            orange: pondHex(BRAND_COLORS.orange),
            orangeStrong: pondHex(DESIGN.nauticalDark),
            orangeSubtle: pondHex(DESIGN.nauticalLight),
            /** Legacy name: same as orange (attention / warning / secondary destructive). */
            nautical: pondHex(BRAND_COLORS.orange),
            nauticalStrong: pondHex(DESIGN.nauticalDark),
            nauticalSubtle: pondHex(DESIGN.nauticalLight),

            /** Legacy alias used by older components; maps to lilypad dark. */
            forest: pondHex(DESIGN.lilypadDark),
            forestStrong: pondHex(DESIGN.lilypadDark),
            forestSubtle: pondHex(DESIGN.lilypadLight),

            navy: pondHex(DESIGN.navy),
            navyStrong: pondHex(DESIGN.navy),
            navySubtle: pondHex(DESIGN.navy),

            deep: pondHex(DESIGN.deep),
            deepStrong: pondHex(DESIGN.deep),
            deepSubtle: pondHex(DESIGN.deep),

            pondBlue: pondHex(BRAND_COLORS.skyBlue),
            pondBlueStrong: pondHex(DESIGN.sky),
            pondBlueSubtle: pondHex(BRAND_COLORS.skyBlue),
          },
        }),
      },
      semanticTokens: {
        colors: defineSemanticTokens.colors({
          bg: {
            DEFAULT: { value: { _light: DESIGN.cloudWhite, _dark: DESIGN.cloudWhite } },
            subtle: { value: { _light: DESIGN.surfaceTint, _dark: DESIGN.surfaceTint } },
            muted: { value: { _light: DESIGN.warmTint, _dark: DESIGN.warmTint } },
            emphasized: { value: { _light: DESIGN.surface, _dark: DESIGN.surface } },
            panel: { value: { _light: DESIGN.surface, _dark: DESIGN.surface } },
            canvas: { value: { _light: DESIGN.cloudWhite, _dark: DESIGN.cloudWhite } },
          },
          fg: {
            DEFAULT: { value: { _light: DESIGN.textPrimary, _dark: DESIGN.textPrimary } },
            muted: { value: { _light: `${DESIGN.textSecondary}CC`, _dark: `${DESIGN.textSecondary}CC` } },
            subtle: { value: { _light: `${DESIGN.textSecondary}99`, _dark: `${DESIGN.textSecondary}99` } },
            inverted: { value: { _light: DESIGN.cloudWhite, _dark: DESIGN.cloudWhite } },
          },
          border: {
            DEFAULT: { value: { _light: DESIGN.borderNeutral, _dark: DESIGN.borderNeutral } },
            muted: { value: { _light: rgbaFromHex(DESIGN.borderNeutral, 0.8), _dark: rgbaFromHex(DESIGN.borderNeutral, 0.8) } },
            subtle: { value: { _light: rgbaFromHex(DESIGN.borderNeutral, 0.55), _dark: rgbaFromHex(DESIGN.borderNeutral, 0.55) } },
          },
          gray: {
            fg: { value: { _light: DESIGN.textPrimary, _dark: DESIGN.textPrimary } },
          },
          teal: {
            contrast: { value: { _light: DESIGN.textPrimary, _dark: DESIGN.textPrimary } },
            fg: { value: { _light: DESIGN.lilypad, _dark: DESIGN.lilypad } },
            subtle: { value: { _light: "{colors.pond.tealSubtle}", _dark: "{colors.pond.tealSubtle}" } },
            muted: { value: { _light: "{colors.pond.teal}", _dark: "{colors.pond.teal}" } },
            emphasized: { value: { _light: "{colors.pond.tealStrong}", _dark: "{colors.pond.tealStrong}" } },
            solid: { value: { _light: "{colors.pond.teal}", _dark: "{colors.pond.teal}" } },
            focusRing: { value: { _light: DESIGN.lilypadActive, _dark: DESIGN.lilypadActive } },
            border: { value: { _light: DESIGN.lilypadDark, _dark: DESIGN.lilypadDark } },
          },
          forest: {
            contrast: { value: { _light: DESIGN.cloudWhite, _dark: DESIGN.cloudWhite } },
            fg: { value: { _light: DESIGN.lilypadDark, _dark: DESIGN.lilypadDark } },
            subtle: { value: { _light: "{colors.pond.forestSubtle}", _dark: "{colors.pond.forestSubtle}" } },
            muted: { value: { _light: "{colors.pond.forest}", _dark: "{colors.pond.forest}" } },
            emphasized: { value: { _light: "{colors.pond.forestStrong}", _dark: "{colors.pond.forestStrong}" } },
            solid: { value: { _light: "{colors.pond.forest}", _dark: "{colors.pond.forest}" } },
            focusRing: { value: { _light: DESIGN.lilypadDark, _dark: DESIGN.lilypadDark } },
            border: { value: { _light: DESIGN.lilypadDark, _dark: DESIGN.lilypadDark } },
          },
          navy: {
            contrast: { value: { _light: DESIGN.cloudWhite, _dark: DESIGN.cloudWhite } },
            fg: { value: { _light: DESIGN.cloudWhite, _dark: DESIGN.cloudWhite } },
            subtle: { value: { _light: "{colors.pond.navySubtle}", _dark: "{colors.pond.navySubtle}" } },
            muted: { value: { _light: "{colors.pond.navy}", _dark: "{colors.pond.navy}" } },
            emphasized: { value: { _light: "{colors.pond.navyStrong}", _dark: "{colors.pond.navyStrong}" } },
            solid: { value: { _light: "{colors.pond.navy}", _dark: "{colors.pond.navy}" } },
            focusRing: { value: { _light: DESIGN.sky, _dark: DESIGN.sky } },
            border: { value: { _light: DESIGN.navy, _dark: DESIGN.navy } },
          },
          deep: {
            contrast: { value: { _light: DESIGN.cloudWhite, _dark: DESIGN.cloudWhite } },
            fg: { value: { _light: DESIGN.cloudWhite, _dark: DESIGN.cloudWhite } },
            subtle: { value: { _light: "{colors.pond.deepSubtle}", _dark: "{colors.pond.deepSubtle}" } },
            muted: { value: { _light: "{colors.pond.deep}", _dark: "{colors.pond.deep}" } },
            emphasized: { value: { _light: "{colors.pond.deepStrong}", _dark: "{colors.pond.deepStrong}" } },
            solid: { value: { _light: "{colors.pond.deep}", _dark: "{colors.pond.deep}" } },
            focusRing: { value: { _light: DESIGN.sky, _dark: DESIGN.sky } },
            border: { value: { _light: DESIGN.deep, _dark: DESIGN.deep } },
          },
          sky: {
            contrast: { value: { _light: DESIGN.textPrimary, _dark: DESIGN.textPrimary } },
            fg: { value: { _light: BRAND_COLORS.skyBlue, _dark: BRAND_COLORS.skyBlue } },
            subtle: { value: { _light: "{colors.pond.skySubtle}", _dark: "{colors.pond.skySubtle}" } },
            muted: { value: { _light: "{colors.pond.sky}", _dark: "{colors.pond.sky}" } },
            emphasized: { value: { _light: "{colors.pond.skyStrong}", _dark: "{colors.pond.skyStrong}" } },
            solid: { value: { _light: "{colors.pond.sky}", _dark: "{colors.pond.sky}" } },
            focusRing: { value: { _light: DESIGN.skyDark, _dark: DESIGN.skyDark } },
            border: { value: { _light: DESIGN.skyDark, _dark: DESIGN.skyDark } },
          },
          nautical: {
            contrast: { value: { _light: DESIGN.cloudWhite, _dark: DESIGN.cloudWhite } },
            fg: { value: { _light: BRAND_COLORS.orange, _dark: BRAND_COLORS.orange } },
            subtle: { value: { _light: "{colors.pond.nauticalSubtle}", _dark: "{colors.pond.nauticalSubtle}" } },
            muted: { value: { _light: "{colors.pond.nautical}", _dark: "{colors.pond.nautical}" } },
            emphasized: { value: { _light: "{colors.pond.nauticalStrong}", _dark: "{colors.pond.nauticalStrong}" } },
            solid: { value: { _light: "{colors.pond.nautical}", _dark: "{colors.pond.nautical}" } },
            focusRing: { value: { _light: DESIGN.nauticalDark, _dark: DESIGN.nauticalDark } },
            border: { value: { _light: DESIGN.nauticalDark, _dark: DESIGN.nauticalDark } },
          },
          orange: {
            contrast: { value: { _light: DESIGN.cloudWhite, _dark: DESIGN.cloudWhite } },
            fg: { value: { _light: BRAND_COLORS.orange, _dark: BRAND_COLORS.orange } },
            subtle: { value: { _light: "{colors.pond.orangeSubtle}", _dark: "{colors.pond.orangeSubtle}" } },
            muted: { value: { _light: "{colors.pond.orange}", _dark: "{colors.pond.orange}" } },
            emphasized: { value: { _light: "{colors.pond.orangeStrong}", _dark: "{colors.pond.orangeStrong}" } },
            solid: { value: { _light: "{colors.pond.orange}", _dark: "{colors.pond.orange}" } },
            focusRing: { value: { _light: DESIGN.nauticalDark, _dark: DESIGN.nauticalDark } },
            border: { value: { _light: DESIGN.nauticalDark, _dark: DESIGN.nauticalDark } },
          },
          lilypad: {
            contrast: { value: { _light: DESIGN.textPrimary, _dark: DESIGN.textPrimary } },
            fg: { value: { _light: DESIGN.lilypadDark, _dark: DESIGN.lilypadDark } },
            subtle: { value: { _light: "{colors.pond.lilypadSubtle}", _dark: "{colors.pond.lilypadSubtle}" } },
            muted: { value: { _light: "{colors.pond.lilypad}", _dark: "{colors.pond.lilypad}" } },
            emphasized: { value: { _light: "{colors.pond.lilypadStrong}", _dark: "{colors.pond.lilypadStrong}" } },
            solid: { value: { _light: "{colors.pond.lilypad}", _dark: "{colors.pond.lilypad}" } },
            focusRing: { value: { _light: "{colors.pond.lilypadStrong}", _dark: "{colors.pond.lilypadStrong}" } },
            border: { value: { _light: "{colors.pond.lilypadStrong}", _dark: "{colors.pond.lilypadStrong}" } },
          },
          pond: {
            contrast: { value: { _light: DESIGN.textPrimary, _dark: DESIGN.textPrimary } },
            fg: { value: { _light: "{colors.pond.pondBlue}", _dark: "{colors.pond.pondBlue}" } },
            subtle: { value: { _light: "{colors.pond.pondBlueSubtle}", _dark: "{colors.pond.pondBlueSubtle}" } },
            muted: { value: { _light: "{colors.pond.pondBlue}", _dark: "{colors.pond.pondBlue}" } },
            emphasized: { value: { _light: "{colors.pond.pondBlueStrong}", _dark: "{colors.pond.pondBlueStrong}" } },
            solid: { value: { _light: "{colors.pond.pondBlue}", _dark: "{colors.pond.pondBlue}" } },
            focusRing: { value: { _light: "{colors.pond.pondBlueStrong}", _dark: "{colors.pond.pondBlueStrong}" } },
            border: { value: { _light: "{colors.pond.pondBlueStrong}", _dark: "{colors.pond.pondBlueStrong}" } },
          },
        }),
      },
      slotRecipes: {
        toast: pondToastSlotRecipe,
      },
    },
  }),
);
