import { Heading, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { APP_TEXT_SIZES } from "../theme/typography";

import {
  ESTATES_GUIDE_SECTIONS,
  ESTATES_GUIDE_TITLE,
  ESTATES_SUIT_GUIDE,
  ESTATES_ZONE_GUIDE,
  ZONE_EFFECT_HINTS,
  ZONE_LABELS,
  ZONE_SUIT_HINTS,
  type ZoneGuideEntry,
} from "./estatesGuideCopy";
import { ActionSockets } from "./play/ActionSockets";
import { Card } from "./play/Card";
import { SuitGlyph } from "./play/glyphs";
import { ZoneIllumination } from "./play/illumination";
import "./estatesHowToPlay.css";
import "./play/playCanvas.css";

export type EstatesHowToPlayPanelProps = {
  /** Tighter spacing for the in-game modal. */
  compact?: boolean;
  /** Show the panel heading (landing Help tab; modal uses AppModal title). */
  showTitle?: boolean;
};

function GuideSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <Stack gap="2" className="estates-how-to-play__section">
      <Heading as="h3" size="sm" fontSize={APP_TEXT_SIZES.label}>
        {heading}
      </Heading>
      {children}
    </Stack>
  );
}

function SuitLegendRow() {
  return (
    <div className="estates-how-to-play__suit-row">
      {ESTATES_SUIT_GUIDE.map((entry) => (
        <div key={entry.suit} className="estates-how-to-play__suit-item">
          <Card card={entry.demoCard} size="small" draggable={false} />
          <div className="estates-how-to-play__suit-meta">
            <Text fontSize={APP_TEXT_SIZES.body} fontWeight="semibold" color="fg">
              {entry.name}
            </Text>
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
              {entry.colorLabel}
            </Text>
          </div>
        </div>
      ))}
    </div>
  );
}

function ZoneGuideTile({ entry }: { entry: ZoneGuideEntry }) {
  const { zone, scoringStep, allowedSuits } = entry;
  const suitHint =
    allowedSuits.length === 3 ? ZONE_SUIT_HINTS.gate : ZONE_SUIT_HINTS[zone];

  return (
    <article className="estates-guide-zone">
      <div className="estates-guide-zone__art" aria-hidden>
        <ZoneIllumination zone={zone} />
      </div>
      <div className="estates-guide-zone__head">
        <span className="estates-guide-zone__name">{ZONE_LABELS[zone]}</span>
        <span className="estates-guide-zone__step" title="Scoring order">
          {scoringStep}
        </span>
        <span className="estates-guide-zone__glyphs">
          {allowedSuits.map((s) => (
            <SuitGlyph key={s} suit={s} size={14} aria-hidden />
          ))}
        </span>
      </div>
      <div className="estates-guide-zone__body">
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" lineHeight="snug">
          {suitHint}
        </Text>
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg" lineHeight="snug" fontWeight="medium">
          {ZONE_EFFECT_HINTS[zone]}
        </Text>
      </div>
    </article>
  );
}

function ZoneGuideGrid() {
  return (
    <div className="estates-how-to-play__zone-grid">
      {ESTATES_ZONE_GUIDE.map((entry) => (
        <ZoneGuideTile key={entry.zone} entry={entry} />
      ))}
    </div>
  );
}

export function EstatesHowToPlayPanel({
  compact = false,
  showTitle = true,
}: EstatesHowToPlayPanelProps) {
  const sections = ESTATES_GUIDE_SECTIONS;
  const rootClass = [
    "estates-how-to-play",
    compact ? "estates-how-to-play--compact" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Stack gap={compact ? "3" : "4"} className={rootClass}>
      {showTitle ? (
        <Heading as="h2" size="md" fontSize={APP_TEXT_SIZES.title}>
          {ESTATES_GUIDE_TITLE}
        </Heading>
      ) : null}

      <GuideSection heading={sections.goal.heading}>
        <Text fontSize={APP_TEXT_SIZES.body} color="fg" lineHeight="tall">
          {sections.goal.body}
        </Text>
      </GuideSection>

      <GuideSection heading={sections.round.heading}>
        <Text fontSize={APP_TEXT_SIZES.body} color="fg" lineHeight="tall">
          {sections.round.body}
        </Text>
        <div className="estates-how-to-play__round-actions">
          <ActionSockets actionsTaken={0} compact />
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
            3 placements per player per round
          </Text>
        </div>
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" lineHeight="tall">
          {sections.round.roadNote}
        </Text>
      </GuideSection>

      <GuideSection heading={sections.suits.heading}>
        <Text fontSize={APP_TEXT_SIZES.body} color="fg" lineHeight="tall">
          {sections.suits.intro}
        </Text>
        <SuitLegendRow />
        <Text fontSize={APP_TEXT_SIZES.body} color="fg" fontWeight="medium" lineHeight="tall">
          {sections.suits.tiebreak}
        </Text>
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" lineHeight="tall">
          {sections.suits.bonuses}
        </Text>
      </GuideSection>

      <GuideSection heading={sections.zones.heading}>
        <Text fontSize={APP_TEXT_SIZES.body} color="fg" lineHeight="tall">
          {sections.zones.intro}
        </Text>
        <ZoneGuideGrid />
      </GuideSection>
    </Stack>
  );
}
