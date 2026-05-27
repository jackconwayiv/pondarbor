import {
  signDisplayName,
  signSymbolForSign,
  traitsForSign,
} from "./astroLexicon";
import type { NatalChartPayload } from "./chartTypes";
import { buildSignCalloutParagraph } from "./buildInterpretWriteup";
import {
  occupantsInSign,
  signRuledHouseCardText,
  type InterpretHouseOccupant,
} from "./buildHouseInterpretWriteup";
import { signFromLongitudeDeg } from "./chartAngles";

export type InterpretSignRuledHouse = {
  house: number;
  text: string;
};

export type InterpretSignWriteup = {
  sign: string;
  signName: string;
  signSymbol: string | null;
  calloutParagraph: string | null;
  adjectivePhrases: readonly string[];
  ruledHouses: InterpretSignRuledHouse[];
  occupants: InterpretHouseOccupant[];
};

function ruledHousesForSign(
  chart: NatalChartPayload,
  signKey: string,
): InterpretSignRuledHouse[] {
  const signName = signDisplayName(signKey);
  const cusps = chart.houses?.cusps_longitude_deg;
  if (!Array.isArray(cusps) || cusps.length < 12) return [];

  const out: InterpretSignRuledHouse[] = [];
  for (let house = 1; house <= 12; house += 1) {
    const lon = cusps[house - 1];
    if (typeof lon !== "number" || !Number.isFinite(lon)) continue;
    const cuspSign = signFromLongitudeDeg(lon);
    if (cuspSign !== signKey) continue;
    const text = signRuledHouseCardText(signName, house);
    if (!text) continue;
    out.push({ house, text });
  }
  return out;
}

export function buildSignInterpretWriteup(
  signKey: string,
  chart: NatalChartPayload,
): InterpretSignWriteup | null {
  const signName = signDisplayName(signKey);
  const adjectivePhrases = traitsForSign(signKey);
  if (!adjectivePhrases?.length) return null;

  const calloutParagraph = buildSignCalloutParagraph(signKey);

  return {
    sign: signKey,
    signName,
    signSymbol: signSymbolForSign(signKey),
    calloutParagraph,
    adjectivePhrases,
    ruledHouses: ruledHousesForSign(chart, signKey),
    occupants: occupantsInSign(chart, signKey),
  };
}
