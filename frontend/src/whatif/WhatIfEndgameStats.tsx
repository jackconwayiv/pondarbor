import { Grid, GridItem, HStack, Stack, Text } from "@chakra-ui/react";

import type {
  WhatIfEndgameAward,
  WhatIfEndgameStats as WhatIfEndgameStatsType,
  WhatIfLifetimeStats,
  WhatIfPlayer,
} from "./types";
import { WhatIfPlayerFace } from "./whatifPlayerFace";

type WhatIfEndgameStatsProps = {
  stats?: WhatIfEndgameStatsType | undefined;
  awards?: WhatIfEndgameAward[] | undefined;
  lifetime?: WhatIfLifetimeStats | undefined;
  players?: WhatIfPlayer[];
  viewerPlayerId?: number | null;
  /** Muted label color on dark TV cards. */
  mutedColor?: string;
  fontSize?: string;
  /** Awards left, game stats right; lifetime spans full width below when present. */
  layout?: "stack" | "split";
  showGameStats?: boolean;
  /** When set, only awards this player won are shown (hand view). */
  filterAwardsToPlayerId?: number | null;
};

/** Shown after flair counts in endgame game stats only. */
const ENDGAME_FLAIR_DESCRIPTIONS: Record<string, string> = {
  Obviously: "everyone picked the same answer",
  Selfless: "subject scored no points",
  Splitskies: "top vote was a tie",
  Whiff: "every vote was different",
};

type GameStatRowData = {
  label: string;
  value: string;
  description?: string;
};

function formatStatValue(value: number): string {
  return value.toLocaleString();
}

function formatRate(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

function SectionHeading({
  mutedColor,
  fontSize,
  label,
}: {
  mutedColor: string;
  fontSize: string;
  label: string;
}) {
  return (
    <Text
      fontSize={fontSize}
      fontWeight="bold"
      letterSpacing="0.12em"
      textTransform="uppercase"
      color={mutedColor}
    >
      {label}
    </Text>
  );
}

function StatRow({ label, value, fontSize }: { label: string; value: string; fontSize: string }) {
  return (
    <Text fontSize={fontSize} lineHeight="1.35">
      <Text as="span" fontWeight="semibold">
        {label}:
      </Text>{" "}
      {value}
    </Text>
  );
}

type EndgameStatsContentProps = {
  sessionRows: GameStatRowData[];
  awardRows: WhatIfEndgameAward[];
  lifetimeRows: Array<{ label: string; value: string }>;
  playerById: Map<number, WhatIfPlayer>;
  viewerPlayerId: number | null;
  mutedColor: string;
  fontSize: string;
};

function AwardsSection({
  awardRows,
  playerById,
  viewerPlayerId,
  mutedColor,
  fontSize,
  personalAwards,
}: Pick<
  EndgameStatsContentProps,
  "awardRows" | "playerById" | "viewerPlayerId" | "mutedColor" | "fontSize"
> & { personalAwards?: boolean }) {
  if (awardRows.length === 0) return null;
  return (
    <Stack gap="1">
      <SectionHeading
        mutedColor={mutedColor}
        fontSize={fontSize}
        label={personalAwards ? "Your awards" : "Awards"}
      />
      {awardRows.map((award) => {
        const valueLabel =
          award.key === "best_challenge_conversion"
            ? formatRate(award.value)
            : formatStatValue(award.value);
        const suffix =
          award.key === "best_challenge_conversion"
            ? `: ${valueLabel} pts/challenge`
            : `: ${valueLabel}`;
        return (
          <Stack key={award.key} gap="1">
            <Text fontSize={fontSize} lineHeight="1.35" fontWeight="semibold">
              {award.label}
              {suffix}
            </Text>
            {personalAwards ? null : (
              <HStack gap="2" flexWrap="wrap">
                {award.player_ids.map((pid, i) => {
                  const player = playerById.get(pid);
                  const name = award.player_names[i] ?? player?.display_name ?? "Player";
                  return player ? (
                    <HStack key={pid} gap="1" align="center">
                      <WhatIfPlayerFace
                        player={player}
                        viewerPlayerId={viewerPlayerId}
                        avatarSize="sm"
                      />
                      <Text fontSize={fontSize}>{name}</Text>
                    </HStack>
                  ) : (
                    <Text key={pid} fontSize={fontSize}>
                      {name}
                    </Text>
                  );
                })}
              </HStack>
            )}
          </Stack>
        );
      })}
    </Stack>
  );
}

function GameStatRow({
  label,
  value,
  description,
  fontSize,
  mutedColor,
}: GameStatRowData & { fontSize: string; mutedColor: string }) {
  return (
    <Text fontSize={fontSize} lineHeight="1.35" fontWeight="semibold">
      {value} {label}
      {description ? (
        <Text as="span" fontWeight="normal" color={mutedColor}>
          {" "}
          ({description})
        </Text>
      ) : null}
    </Text>
  );
}

function GameStatsSection({
  sessionRows,
  mutedColor,
  fontSize,
}: Pick<EndgameStatsContentProps, "sessionRows" | "mutedColor" | "fontSize">) {
  if (sessionRows.length === 0) return null;
  return (
    <Stack gap="1">
      <SectionHeading mutedColor={mutedColor} fontSize={fontSize} label="Game stats" />
      {sessionRows.map(({ label, value, description }) => (
        <GameStatRow
          key={description ? `${label}-${description}` : label}
          label={label}
          value={value}
          description={description}
          fontSize={fontSize}
          mutedColor={mutedColor}
        />
      ))}
    </Stack>
  );
}

function LifetimeSection({
  lifetimeRows,
  mutedColor,
  fontSize,
}: Pick<EndgameStatsContentProps, "lifetimeRows" | "mutedColor" | "fontSize">) {
  if (lifetimeRows.length === 0) return null;
  return (
    <Stack gap="1">
      <SectionHeading mutedColor={mutedColor} fontSize={fontSize} label="Your lifetime" />
      {lifetimeRows.map(({ label, value }) => (
        <StatRow key={label} label={label} value={value} fontSize={fontSize} />
      ))}
    </Stack>
  );
}

/** End-of-game session stats, awards, and lifetime summary (TV main panel and hand). */
export default function WhatIfEndgameStats({
  stats,
  awards,
  lifetime,
  players = [],
  viewerPlayerId = null,
  mutedColor = "fg.muted",
  fontSize = "clamp(0.95rem, 2.1vh, 1.2rem)",
  layout = "stack",
  showGameStats = true,
  filterAwardsToPlayerId = null,
}: WhatIfEndgameStatsProps) {
  const personalAwards = filterAwardsToPlayerId != null;
  const sessionRows: GameStatRowData[] = [];
  if (showGameStats && stats) {
    if (typeof stats.rounds_completed === "number") {
      sessionRows.push({ label: "Rounds", value: formatStatValue(stats.rounds_completed) });
    }
    if (typeof stats.questions_drawn === "number") {
      sessionRows.push({ label: "Questions drawn", value: formatStatValue(stats.questions_drawn) });
    }
    if (typeof stats.questions_vetoed === "number") {
      sessionRows.push({ label: "Questions vetoed", value: formatStatValue(stats.questions_vetoed) });
    }
    if (typeof stats.challenges_started === "number") {
      sessionRows.push({ label: "Challenges", value: formatStatValue(stats.challenges_started) });
    }
    if (stats.flairs) {
      for (const [label, count] of Object.entries(stats.flairs)) {
        if (typeof count === "number" && count > 0) {
          const flairName = label.replace(/!$/, "");
          sessionRows.push({
            label: flairName,
            value: formatStatValue(count),
            description: ENDGAME_FLAIR_DESCRIPTIONS[flairName],
          });
        }
      }
    }
  }

  const lifetimeRows: Array<{ label: string; value: string }> = [];
  if (lifetime) {
    if (typeof lifetime.gold_medals === "number") {
      lifetimeRows.push({
        label: lifetime.gold_medals === 1 ? "Gold medal" : "Gold medals",
        value: formatStatValue(lifetime.gold_medals),
      });
    }
    if (typeof lifetime.silver_medals === "number" && lifetime.silver_medals > 0) {
      lifetimeRows.push({
        label: lifetime.silver_medals === 1 ? "Silver medal" : "Silver medals",
        value: formatStatValue(lifetime.silver_medals),
      });
    }
    if (typeof lifetime.total_points === "number") {
      lifetimeRows.push({ label: "Lifetime points", value: formatStatValue(lifetime.total_points) });
    }
    if (lifetime.is_personal_best_this_session) {
      lifetimeRows.push({ label: "Personal best", value: "New high score!" });
    }
  }

  const awardRows = (awards ?? [])
    .filter((a) => a.player_names.length > 0)
    .filter((a) =>
      filterAwardsToPlayerId == null ? true : a.player_ids.includes(filterAwardsToPlayerId),
    );
  if (sessionRows.length === 0 && lifetimeRows.length === 0 && awardRows.length === 0) {
    return null;
  }

  const playerById = new Map(players.map((p) => [p.id, p]));
  const contentProps: EndgameStatsContentProps = {
    sessionRows,
    awardRows,
    lifetimeRows,
    playerById,
    viewerPlayerId,
    mutedColor,
    fontSize,
  };

  if (layout === "split" && showGameStats) {
    return (
      <Stack gap="4" w="100%">
        <Grid
          templateColumns={{ base: "1fr", md: "1fr 1fr" }}
          gap={{ base: "4", md: "6" }}
          w="100%"
          alignItems="start"
        >
          <GridItem minW={0}>
            <AwardsSection {...contentProps} personalAwards={personalAwards} />
          </GridItem>
          <GridItem minW={0}>
            <GameStatsSection {...contentProps} />
          </GridItem>
        </Grid>
        <LifetimeSection {...contentProps} />
      </Stack>
    );
  }

  return (
    <Stack gap="3" w="100%">
      {showGameStats ? <GameStatsSection {...contentProps} /> : null}
      <AwardsSection {...contentProps} personalAwards={personalAwards} />
      <LifetimeSection {...contentProps} />
    </Stack>
  );
}
