import {
  BIG_THREE_BODY,
  chartKeyForRulerPlanet,
  chartPointDisplayLabel,
  modernRulingPlanetForSign,
  normalizeZodiacSign,
  planetHouseActPhrases,
  rulerPlanetNameForChartKey,
  signDisplayName,
  traitsForSign,
} from "./astroLexicon";
import { signFromLongitudeDeg } from "./chartAngles";
import type { NatalChartPayload } from "./chartTypes";
import { CHART_POINT_ORDER } from "./chartPointOrder";
import { ZODIAC_MEMBER_PLANET_EXCLUDE_KEYS } from "./zodiacDisplayConfig";
import { joinEnglishList } from "./buildInterpretWriteup";
import {
  formatHouseOrdinal,
  HOUSE_PLACEMENT_PHRASES,
  houseInterpretSeekVerbs,
  houseInterpretTheme,
} from "./zodiacHouseDescriptors";

export type InterpretHouseOccupant = {
  chartKey: string;
  label: string;
  /** Placement sign (API key) for sign-colored callout chrome. */
  sign: string;
  signName: string;
  summary: string;
};

export type InterpretHouseSignLinkParagraph = {
  /** Sign key for card chrome (cusp sign or ruler's placement sign). */
  sign: string;
  text: string;
  /** When set, card links to this body's placement page instead of the sign page. */
  placementChartKey?: string;
};

export type InterpretHouseWriteup = {
  house: number;
  ordinal: string;
  theme: string;
  /** Cusp sign (lowercase key) for sign-colored chrome on the house page. */
  cuspSign: string | null;
  title: string;
  staticParagraphs: string[];
  /** Cusp sign link (sign page) and House ruler link (placement page when chart has the ruler). */
  rulerSignLinks: InterpretHouseSignLinkParagraph[];
  /** When no planets occupy this house in the chart. */
  emptyHouseParagraph: string | null;
  occupantsLeadIn: string | null;
  occupants: InterpretHouseOccupant[];
};

function rulerPlanetWithArticle(planetName: string): string {
  if (planetName === "Moon") return "the Moon";
  if (planetName === "Sun") return "the Sun";
  return planetName;
}

/** House theme as a phrase in running copy (e.g. “achievement”, not title-case “Achievement”). */
function themeInHousePhrase(theme: string): string {
  if (theme === "Self") return "identity and self-presentation";
  return theme.toLowerCase();
}

function cuspSignLinkText(
  ordinal: string,
  cuspSignKey: string,
  cuspSignName: string,
  themePhrase: string,
  rulerLabel?: string | null,
): string {
  const cuspTraits = traitsForSign(cuspSignKey);
  const traitsPhrase =
    cuspTraits?.length ? joinEnglishList(cuspTraits) : `${cuspSignName} themes`;
  const lead = rulerLabel
    ? `Your ${ordinal} House cusp is in ${cuspSignName}, ruled by ${rulerLabel}.`
    : `Your ${ordinal} House cusp is in ${cuspSignName}.`;
  return `${lead} You approach ${themePhrase} with a spirit that is ${traitsPhrase}.`;
}

function occupantSummary(actPhrases: readonly string[]): string {
  const themes = joinEnglishList(actPhrases);
  return `Emphasizes ${themes}.`;
}

/** Planet card copy on house interpret pages (distinct from cusp “You approach …”). */
function houseOccupantSummary(themePhrase: string, actPhrases: readonly string[]): string {
  const themes = joinEnglishList(actPhrases);
  return `Regarding ${themePhrase}, emphasizes ${themes}.`;
}

function actPhrasesForOccupant(chartKey: string): readonly string[] | null {
  if (chartKey === "rising") return BIG_THREE_BODY.rising.bodyPhrases;
  return planetHouseActPhrases(chartKey);
}

/** Pager placement id (`rising` vs API `ascendant`). */
export function interpretPlacementChartKey(rawKey: string): string {
  return rawKey === "ascendant" ? "rising" : rawKey;
}

function occupantFromPoint(
  chartKey: string,
  sign: string,
  themePhrase?: string,
): InterpretHouseOccupant | null {
  const actPhrases = actPhrasesForOccupant(chartKey);
  if (!actPhrases?.length) return null;
  const trimmedSign = sign.trim();
  if (!trimmedSign) return null;
  const pagerKey = interpretPlacementChartKey(chartKey);
  const summary =
    themePhrase != null
      ? houseOccupantSummary(themePhrase, actPhrases)
      : occupantSummary(actPhrases);
  return {
    chartKey: pagerKey,
    label: chartPointDisplayLabel(pagerKey),
    sign: trimmedSign,
    signName: signDisplayName(trimmedSign),
    summary,
  };
}

function houseGovernAndSeekPhrase(house: number): string | null {
  const governPhrases = HOUSE_PLACEMENT_PHRASES[house];
  const seekVerbs = houseInterpretSeekVerbs(house);
  if (!governPhrases?.length || !seekVerbs?.length) return null;
  return `governs ${joinEnglishList(governPhrases)}—where you seek to ${joinEnglishList(seekVerbs)}`;
}

/** Merged govern + seek copy for interpret house pages. */
export function houseStaticParagraph(house: number): string | null {
  const ordinal = formatHouseOrdinal(house);
  const governSeek = houseGovernAndSeekPhrase(house);
  if (!ordinal || !governSeek) return null;
  return `The ${ordinal} House ${governSeek}.`;
}

/** Sign-page card when this sign is on a house cusp (not planetary house rulership). */
export function signRuledHouseCardText(signName: string, house: number): string | null {
  const ordinal = formatHouseOrdinal(house);
  const governSeek = houseGovernAndSeekPhrase(house);
  if (!ordinal || !governSeek) return null;
  return `${signName} is on your ${ordinal} House cusp, which ${governSeek}.`;
}

export type InterpretPlacementRuledHouse = {
  house: number;
  /** Cusp sign for card chrome. */
  cuspSign: string;
  text: string;
};

/** Placement-page card: this planet is modern ruler of the sign on a house cusp. */
export function placementRuledHouseCardText(
  planetLabel: string,
  placementSignName: string,
  ruledHouse: number,
): string | null {
  const ordinal = formatHouseOrdinal(ruledHouse);
  const housePhrases = HOUSE_PLACEMENT_PHRASES[ruledHouse];
  if (!ordinal || !housePhrases?.length) return null;
  const houseThemes = joinEnglishList(housePhrases);
  return `Because your ${planetLabel} in ${placementSignName} rules the ${ordinal} House, its influence also manages ${houseThemes}.`;
}

/** Houses whose cusp sign is ruled by this placement body (modern rulers only). */
export function housesRuledByPlacement(
  chart: NatalChartPayload,
  placementChartKey: string,
  placementSignKey: string,
): InterpretPlacementRuledHouse[] {
  const rulerPlanet = rulerPlanetNameForChartKey(placementChartKey);
  if (!rulerPlanet) return [];

  const planetLabel = chartPointDisplayLabel(
    interpretPlacementChartKey(placementChartKey),
  );
  const placementSignName = signDisplayName(placementSignKey);
  if (!placementSignName) return [];

  const cusps = chart.houses?.cusps_longitude_deg;
  if (!Array.isArray(cusps) || cusps.length < 12) return [];

  const out: InterpretPlacementRuledHouse[] = [];
  for (let house = 1; house <= 12; house += 1) {
    const lon = cusps[house - 1];
    if (typeof lon !== "number" || !Number.isFinite(lon)) continue;
    const cuspSignKey = signFromLongitudeDeg(lon);
    if (modernRulingPlanetForSign(cuspSignKey) !== rulerPlanet) continue;
    const text = placementRuledHouseCardText(planetLabel, placementSignName, house);
    if (!text) continue;
    out.push({ house, cuspSign: cuspSignKey, text });
  }
  return out;
}

function occupantsInHouse(
  chart: NatalChartPayload,
  house: number,
  themePhrase: string,
): InterpretHouseOccupant[] {
  const rank = (k: string) => {
    const i = CHART_POINT_ORDER.indexOf(k);
    return i === -1 ? 1000 : i;
  };

  const entries = Object.entries(chart.points)
    .filter(([key, pt]) => pt.house === house && !ZODIAC_MEMBER_PLANET_EXCLUDE_KEYS.has(key))
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));

  const occupants: InterpretHouseOccupant[] = [];
  for (const [chartKey, pt] of entries) {
    const occ = occupantFromPoint(chartKey, pt.sign ?? "", themePhrase);
    if (occ) occupants.push(occ);
  }
  return occupants;
}

/** Chart points (and Rising) in a given sign for sign interpret pages. */
export function occupantsInSign(
  chart: NatalChartPayload,
  signKey: string,
): InterpretHouseOccupant[] {
  const signNorm = normalizeZodiacSign(signKey);
  if (!signNorm) return [];

  const rank = (k: string) => {
    const i = CHART_POINT_ORDER.indexOf(k);
    return i === -1 ? 1000 : i;
  };

  const occupants: InterpretHouseOccupant[] = [];

  const asc = chart.angles.ascendant;
  if (asc?.sign && normalizeZodiacSign(asc.sign) === signNorm) {
    const occ = occupantFromPoint("rising", asc.sign);
    if (occ) occupants.push(occ);
  }

  const entries = Object.entries(chart.points)
    .filter(
      ([key, pt]) =>
        !ZODIAC_MEMBER_PLANET_EXCLUDE_KEYS.has(key) &&
        pt.sign != null &&
        normalizeZodiacSign(pt.sign) === signNorm,
    )
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));

  for (const [chartKey, pt] of entries) {
    const occ = occupantFromPoint(chartKey, pt.sign ?? "");
    if (occ) occupants.push(occ);
  }

  return occupants;
}

/** Chart-aware interpret copy for one house (1–12). */
export function buildHouseInterpretWriteup(
  house: number,
  chart: NatalChartPayload,
): InterpretHouseWriteup | null {
  const ordinal = formatHouseOrdinal(house);
  const theme = houseInterpretTheme(house);
  const governPhrases = HOUSE_PLACEMENT_PHRASES[house];
  const seekVerbs = houseInterpretSeekVerbs(house);
  if (!ordinal || !theme || !governPhrases?.length || !seekVerbs?.length) return null;

  const staticIntro = houseStaticParagraph(house);
  const staticParagraphs = staticIntro ? [staticIntro] : [];

  const rulerSignLinks: InterpretHouseSignLinkParagraph[] = [];
  let cuspSign: string | null = null;
  let rulerPlanet: string | null = null;
  let rulerLabel: string | null = null;
  const themePhrase = themeInHousePhrase(theme);
  const cusps = chart.houses?.cusps_longitude_deg;
  const cuspLon = Array.isArray(cusps) && cusps.length >= house ? cusps[house - 1] : null;
  if (typeof cuspLon === "number" && Number.isFinite(cuspLon)) {
    const cuspSignKey = signFromLongitudeDeg(cuspLon);
    cuspSign = cuspSignKey;
    const cuspSignName = signDisplayName(cuspSignKey);
    rulerPlanet = modernRulingPlanetForSign(cuspSignKey);
    if (rulerPlanet) {
      rulerLabel = rulerPlanetWithArticle(rulerPlanet);
      const rulerKey = chartKeyForRulerPlanet(rulerPlanet);
      const rulerPt = rulerKey ? chart.points[rulerKey] : undefined;
      const rulerSignKey = rulerPt?.sign ? normalizeZodiacSign(rulerPt.sign) : null;
      const rulerSignName = rulerSignKey ? signDisplayName(rulerSignKey) : null;
      rulerSignLinks.push({
        sign: cuspSignKey,
        text: cuspSignLinkText(ordinal, cuspSignKey, cuspSignName, themePhrase, rulerLabel),
      });
      if (rulerKey && rulerSignKey && rulerSignName) {
        const rulerTraits = traitsForSign(rulerSignKey);
        const traitsPhrase =
          rulerTraits?.length ? joinEnglishList(rulerTraits) : `${rulerSignName} themes`;
        rulerSignLinks.push({
          sign: rulerSignKey,
          text: `With the House ruler ${rulerPlanet} in ${rulerSignName}, your path regarding ${themePhrase} is driven by an energy that is ${traitsPhrase}.`,
          placementChartKey: interpretPlacementChartKey(rulerKey),
        });
      }
    } else {
      rulerSignLinks.push({
        sign: cuspSignKey,
        text: cuspSignLinkText(ordinal, cuspSignKey, cuspSignName, themePhrase),
      });
    }
  }

  const occupants = occupantsInHouse(chart, house, themePhrase);
  let emptyHouseParagraph: string | null = null;
  if (occupants.length === 0) {
    if (rulerLabel) {
      emptyHouseParagraph = `With no planets in your ${ordinal} House in this chart, you often navigate ${themePhrase} with a lighter touch, guided especially by ${rulerLabel}.`;
    } else {
      emptyHouseParagraph = `With no planets in your ${ordinal} House in this chart, you often navigate ${themePhrase} with a lighter touch.`;
    }
  }

  const occupantsLeadIn =
    occupants.length > 0
      ? `These planets also play a role in your approach to ${themePhrase}:`
      : null;

  return {
    house,
    ordinal,
    theme,
    cuspSign,
    title: `${ordinal} House: ${theme}`,
    staticParagraphs,
    rulerSignLinks,
    emptyHouseParagraph,
    occupantsLeadIn,
    occupants,
  };
}
