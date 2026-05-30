/** Pirate display face for in-voyage headings (Pirata One via @fontsource/pirata-one). */
export const SQUALLS_HEADING_FONT_FAMILY =
  '"Pirata One", "Caprasimo", "Spinnaker", Verdana, Geneva, "DejaVu Sans", cursive';

export const SQUALLS_WORLD_COLORS = {
  deepSea: "#0B233A",
  stormSea: "#1C3F63",
  skyBlueSoft: "#7FA8C8",
  harborFog: "#35526C",
  navalBlue: "#253B57",
  tropicalSea: "#6FAFC3",
  tavernAmber: "#7C5A3A",
  stormCloud: "#404A57",
  deckWood: "#8A6B4F",
  islandGreen: "#7FAE7A",
  islandLeaf: "#4E7C4C",
  islandSun: "#D5BE7C",
  portStone: "#8F98A3",
  portMarble: "#DCE2E8",
  dungeonBrown: "#5A4A3D",
  dungeonTimber: "#3D332A",
  wreckNavy: "#152E49",
  wreckMarine: "#244E4B",
  combatRed: "#9A3F35",
  combatOrange: "#B86B3A",
  brass: "#CDAA63",
  rope: "#A97A4B",
  parchment: "#E6D4AD",
  parchmentDark: "#C7B182",
} as const;

export const SQUALLS_HUD_COLORS = {
  panelBg: "rgba(9, 22, 31, 0.74)",
  panelBorder: "rgba(205, 170, 99, 0.45)",
  panelBorderStrong: "rgba(205, 170, 99, 0.75)",
  panelText: "#F8F3E6",
  panelMuted: "#E4D8C0",
  panelSubtle: "#C8BDA5",
  cardBg: "#F7ECD2",
  cardBorder: "#6B4A2A",
  cardText: "#2B1A0E",
  actionShadow: "0 10px 18px rgba(7, 14, 20, 0.22)",
  actionShadowHover: "0 14px 24px rgba(7, 14, 20, 0.34)",
  focusRing: "rgba(205, 170, 99, 0.85)",
} as const;

export const SQUALLS_TEXT_ZONE = {
  bg: `linear-gradient(180deg, ${SQUALLS_WORLD_COLORS.parchment} 0%, #DCC8A3 100%)`,
  border: "rgba(107, 74, 42, 0.68)",
  text: "#2E2013",
  muted: "#58432D",
  subtle: "#755C40",
  shadow: "0 6px 14px rgba(26, 20, 12, 0.25)",
} as const;

export const SQUALLS_ACTION_ACCENT_HEX = {
  blue: "#2A7D9B",
  teal: "#2E8D76",
  orange: "#B86D2C",
  yellow: "#B28933",
  purple: "#6D4F8E",
  gray: "#6B6B6B",
} as const;

export const SQUALLS_WORLD_PANEL = {
  borderWidth: "1px",
  borderColor: "rgba(124, 90, 58, 0.7)",
  borderRadius: "2xl",
  bg: `linear-gradient(180deg, ${SQUALLS_WORLD_COLORS.parchment} 0%, #D9C198 100%)`,
  color: "#2E2013",
  boxShadow:
    "0 12px 24px rgba(33, 24, 12, 0.2), inset 0 0 0 1px rgba(255, 248, 229, 0.45)",
  position: "relative",
  overflow: "hidden",
} as const;

export const SQUALLS_ACTION_SHEET = {
  panelBg: "rgba(0,0,0,0)",
  panelBorder: "rgba(122, 87, 56, 0.45)",
  sectionLabel: "#5D432A",
  optionBg: "rgba(242, 227, 194, 0.78)",
  optionBorder: "rgba(107, 74, 42, 0.52)",
  optionText: "#2B1E12",
  optionMuted: "#5B4631",
} as const;
