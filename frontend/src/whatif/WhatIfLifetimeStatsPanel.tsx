import { Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { useAppSession } from "../auth/AppSessionContext";
import { APP_TEXT_SIZES } from "../theme/typography";
import { fetchWhatIfLifetimeStats } from "./api";
import type { WhatIfFullLifetimeStats } from "./types";

type WhatIfLifetimeStatsPanelProps = {
  /** Muted label color; defaults to theme muted foreground. */
  mutedColor?: string;
};

function formatStatValue(value: number): string {
  return value.toLocaleString();
}

function formatRate(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function SectionHeading({ label, mutedColor }: { label: string; mutedColor: string }) {
  return (
    <Text
      fontSize={APP_TEXT_SIZES.label}
      fontWeight="bold"
      letterSpacing="0.12em"
      textTransform="uppercase"
      color={mutedColor}
    >
      {label}
    </Text>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <Text fontSize={APP_TEXT_SIZES.body} lineHeight="1.4">
      <Text as="span" fontWeight="semibold">
        {label}:
      </Text>{" "}
      {value}
    </Text>
  );
}

function GameStatRow({
  value,
  label,
  prefix,
}: {
  value: string;
  label: string;
  prefix?: string;
}) {
  return (
    <Text fontSize={APP_TEXT_SIZES.body} lineHeight="1.4" fontWeight="semibold">
      {prefix ? `${prefix} ` : ""}
      {value} {label}
    </Text>
  );
}

/** Lobby lifetime stats for a signed-in user. */
export default function WhatIfLifetimeStatsPanel({
  mutedColor = "fg.muted",
}: WhatIfLifetimeStatsPanelProps) {
  const { isAuthenticated, getApiAccessToken } = useAppSession();
  const [stats, setStats] = useState<WhatIfFullLifetimeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setStats(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const token = await getApiAccessToken();
        if (!token) throw new Error("Sign in to view lifetime stats.");
        const data = await fetchWhatIfLifetimeStats(token);
        if (!cancelled) setStats(data);
      } catch (e) {
        if (!cancelled) {
          setStats(null);
          setError(e instanceof Error ? e.message : "Could not load lifetime stats.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getApiAccessToken, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
        Sign in to view lifetime stats.
      </Text>
    );
  }

  if (loading) {
    return (
      <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
        Loading lifetime stats…
      </Text>
    );
  }

  if (error) {
    return (
      <Text role="alert" fontSize={APP_TEXT_SIZES.body} color="nautical.solid" fontWeight="medium">
        {error}
      </Text>
    );
  }

  if (!stats) {
    return null;
  }

  const medalRows = [
    { emoji: "🥇", label: "Gold medals", value: stats.gold_medals ?? 0 },
    { emoji: "🥈", label: "Silver medals", value: stats.silver_medals ?? 0 },
    { emoji: "🥉", label: "Bronze medals", value: stats.bronze_medals ?? 0 },
  ].filter((row) => row.value >= 1);

  const overviewRows = [
    { label: "Games completed", value: formatStatValue(stats.games_completed ?? 0) },
    { label: "Lifetime points", value: formatStatValue(stats.total_points ?? 0) },
    { label: "Personal best score", value: formatStatValue(stats.personal_best_score ?? 0) },
  ];

  const bestRows: Array<{ value: string; label: string }> = [];
  if (typeof stats.best_challenge_conversion === "number" && stats.best_challenge_conversion > 0) {
    bestRows.push({
      value: formatRate(stats.best_challenge_conversion),
      label: `pts/challenge (best single game)`,
    });
  }
  if (typeof stats.best_duel_points_in_game === "number" && stats.best_duel_points_in_game > 0) {
    bestRows.push({
      value: formatStatValue(stats.best_duel_points_in_game),
      label: "challenge points in a game",
    });
  }
  if (typeof stats.best_rounds_scored_in_game === "number" && stats.best_rounds_scored_in_game > 0) {
    bestRows.push({
      value: formatStatValue(stats.best_rounds_scored_in_game),
      label: "rounds scored in a game",
    });
  }
  if (
    typeof stats.best_challenges_issued_in_game === "number" &&
    stats.best_challenges_issued_in_game > 0
  ) {
    bestRows.push({
      value: formatStatValue(stats.best_challenges_issued_in_game),
      label: "challenges issued in a game",
    });
  }
  if (
    typeof stats.best_times_challenged_in_game === "number" &&
    stats.best_times_challenged_in_game > 0
  ) {
    bestRows.push({
      value: formatStatValue(stats.best_times_challenged_in_game),
      label: "times challenged in a game",
    });
  }

  const careerRows: Array<{ value: string; label: string }> = [];
  if (typeof stats.total_rounds_scored === "number" && stats.total_rounds_scored > 0) {
    careerRows.push({
      value: formatStatValue(stats.total_rounds_scored),
      label: "rounds scored",
    });
  }
  if (typeof stats.total_duel_points === "number" && stats.total_duel_points > 0) {
    careerRows.push({
      value: formatStatValue(stats.total_duel_points),
      label: "challenge points",
    });
  }
  if (typeof stats.total_challenges_issued === "number" && stats.total_challenges_issued > 0) {
    careerRows.push({
      value: formatStatValue(stats.total_challenges_issued),
      label: "challenges issued",
    });
  }
  if (typeof stats.total_times_challenged === "number" && stats.total_times_challenged > 0) {
    careerRows.push({
      value: formatStatValue(stats.total_times_challenged),
      label: "times challenged",
    });
  }

  const noGames = (stats.games_completed ?? 0) === 0;

  if (noGames) {
    return null;
  }

  return (
    <Stack gap="4">
      {medalRows.length > 0 ? (
        <Stack gap="1">
          <SectionHeading label="Medals" mutedColor={mutedColor} />
          {medalRows.map(({ emoji, label, value }) => (
            <GameStatRow
              key={label}
              prefix={emoji}
              value={formatStatValue(value)}
              label={value === 1 ? label.slice(0, -1).toLowerCase() : label.toLowerCase()}
            />
          ))}
        </Stack>
      ) : null}
      <Stack gap="1">
        <SectionHeading label="Overview" mutedColor={mutedColor} />
        {overviewRows.map(({ label, value }) => (
          <StatRow key={label} label={label} value={value} />
        ))}
      </Stack>
      {bestRows.length > 0 ? (
        <Stack gap="1">
          <SectionHeading label="Single-game bests" mutedColor={mutedColor} />
          {bestRows.map(({ value, label }) => (
            <GameStatRow key={label} value={value} label={label} />
          ))}
        </Stack>
      ) : null}
      {careerRows.length > 0 ? (
        <Stack gap="1">
          <SectionHeading label="Career totals" mutedColor={mutedColor} />
          {careerRows.map(({ value, label }) => (
            <GameStatRow key={label} value={value} label={label} />
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
